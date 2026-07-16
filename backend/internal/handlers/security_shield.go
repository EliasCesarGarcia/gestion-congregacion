package handlers

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"bytes"
	"encoding/json"
)

var (
	ctxRdb = context.Background()
	rdb    *redis.Client

	localBlacklist sync.Map
	panicMode      bool
	panicMutex     sync.RWMutex
)

func init() {
	godotenv.Load()
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		rdb = redis.NewClient(&redis.Options{Addr: "localhost:6379"})
		return
	}
	opt, _ := redis.ParseURL(redisURL)
	rdb = redis.NewClient(opt)
}

const (
	MaxRequestsPerMinute = 100
	GlobalPanicThreshold = 1000 // 1000 IPs distintas detectadas
)

func ShieldMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. OBTENER IP REAL (Prioriza Cloudflare)
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		if cfIP := r.Header.Get("CF-Connecting-IP"); cfIP != "" {
			ip = cfIP
		} else if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			ip = forwarded
		}

		// 2. FILTRO DE BLACKLIST (Memoria Local + Redis)
		if _, blocked := localBlacklist.Load(ip); blocked {
			w.WriteHeader(http.StatusForbidden)
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
		defer cancel()

		// 3. MODO PÁNICO GLOBAL (Filtro rápido)
		panicMutex.RLock()
		if panicMode {
			panicMutex.RUnlock()
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		panicMutex.RUnlock()

		// --- PASO 3: DETECCIÓN DE BOTNETS (NUEVA LÓGICA) ---
		// Contamos cuántas IPs únicas nos han visitado en el último segundo
		cardinalityKey := fmt.Sprintf("unique_ips:%d", time.Now().Unix())
		rdb.PFAdd(ctx, cardinalityKey, ip)
		rdb.Expire(ctx, cardinalityKey, 5*time.Second)
		uniqueIPs, _ := rdb.PFCount(ctx, cardinalityKey).Result()

		if uniqueIPs > GlobalPanicThreshold {
			// ACTIVACIÓN CON IP Y CONTEO PARA EL LOG/WEBHOOK
			activatePanicMode(ip, uniqueIPs)
		}
		// ----------------------------------------------------

		// 4. RATE LIMIT POR IP
		limitKey := "limit:" + ip
		count, err := rdb.Incr(ctx, limitKey).Result()
		if err == nil {
			if count == 1 {
				rdb.Expire(ctx, limitKey, time.Minute)
			}
			if count > MaxRequestsPerMinute {
				rdb.Set(ctx, "blacklist:"+ip, "true", 24*time.Hour)
				localBlacklist.Store(ip, true)
				w.WriteHeader(http.StatusTooManyRequests)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

// Envía la alerta visual al equipo de infraestructura
func notifyInfraTeam(ipAtacante string, totalIPs int64) {
	webhookURL := os.Getenv("INFRA_ALERTA_WEBHOOK")
	if webhookURL == "" {
		return
	}

	payload := map[string]interface{}{
		"content": "🚨 **ALERTA DE SEGURIDAD CRÍTICA** 🚨",
		"embeds": []map[string]interface{}{
			{
				"title":       "Modo Pánico Activado",
				"description": "Se ha detectado un ataque coordinado (Botnet) y el servidor ha entrado en modo de autoprotección.",
				"color":       15158332,
				"fields": []map[string]interface{}{
					{"name": "IP que disparó el umbral", "value": ipAtacante, "inline": true},
					{"name": "IPs Únicas (ventana actual)", "value": fmt.Sprintf("%d", totalIPs), "inline": true},
					{"name": "Acción", "value": "Tráfico global bloqueado por 30s", "inline": false},
				},
				"timestamp": time.Now().Format(time.RFC3339),
			},
		},
	}

	body, _ := json.Marshal(payload)
	client := &http.Client{Timeout: 5 * time.Second}
	client.Post(webhookURL, "application/json", bytes.NewBuffer(body))
}

func activatePanicMode(ipAtacante string, totalIPs int64) {
	panicMutex.Lock()
	if !panicMode {
		panicMode = true
		fmt.Printf("🚨 [ALERTA] MODO PÁNICO ACTIVADO por IP: %s (IPs únicas: %d)\n", ipAtacante, totalIPs)

		go notifyInfraTeam(ipAtacante, totalIPs)

		time.AfterFunc(30*time.Second, func() {
			panicMutex.Lock()
			panicMode = false
			fmt.Println("✅ Modo Pánico desactivado automáticamente. Reanudando tráfico.")
			panicMutex.Unlock()
		})
	}
	panicMutex.Unlock()
}
