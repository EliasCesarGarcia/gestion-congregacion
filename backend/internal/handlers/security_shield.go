/*
*
ARCHIVO: security_shield.go
UBICACIÓN: backend/internal/handlers/security_shield.go
DESCRIPCIÓN: Implementación de Rate Limiting avanzado, Blacklisting dinámico
y detección de patrones de ataque para alta disponibilidad.
*/
package handlers

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

var (
	ctxRdb = context.Background()
	rdb    *redis.Client
)

func init() {

	// Forzamos la carga del .env antes de conectar a Redis
	godotenv.Load()

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		fmt.Println("⚠️ [ALERTA] REDIS_URL no encontrada en el .env, usando fallback local")
		rdb = redis.NewClient(&redis.Options{Addr: "localhost:6379"})
		return
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		fmt.Printf("❌ [ERROR] Fallo al parsear REDIS_URL: %v\n", err)
		return
	}

	rdb = redis.NewClient(opt)

	// Prueba de conexión inmediata
	_, err = rdb.Ping(ctxRdb).Result()
	if err != nil {
		fmt.Printf("❌ [ERROR] No se pudo conectar a Upstash Redis: %v\n", err)
	} else {
		fmt.Println("✅ [ESCUDO] Conectado a Upstash Redis exitosamente")
	}
}

const (
	MaxRequestsPerMinute = 100
	GlobalPanicThreshold = 5000 // Si hay más de 5000 req/s totales en el sistema
)

func ShieldMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. OBTENCIÓN Y LIMPIEZA DE IP
		ip := r.Header.Get("X-Forwarded-For")
		if ip == "" {
			// net.SplitHostPort separa la IP del puerto para que el bloqueo sea por IP real
			host, _, err := net.SplitHostPort(r.RemoteAddr)
			if err == nil {
				ip = host
			} else {
				ip = r.RemoteAddr
			}
		}

		// 1. Verificar Blacklist
		blacklistKey := "blacklist:" + ip
		isBlacklisted, _ := rdb.Exists(ctxRdb, blacklistKey).Result()
		if isBlacklisted > 0 {
			fmt.Printf("🚫 [BLOQUEADO] IP en Blacklist: %s\n", ip)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusForbidden)
			w.Write([]byte(`{"error": "Tu IP ha sido baneada por 24h"}`))
			return
		}

		// 2. Incrementar contador
		limitKey := "limit:" + ip
		count, err := rdb.Incr(ctxRdb, limitKey).Result()

		// Si Redis da error (como te pasaba antes), esta vez lo imprimiremos para saberlo
		if err != nil {
			fmt.Printf("❌ [ERROR REDIS] %v\n", err)
			next.ServeHTTP(w, r)
			return
		}

		if count == 1 {
			rdb.Expire(ctxRdb, limitKey, time.Minute)
		}

		fmt.Printf("🛡️ [ESCUDO] IP: %s | Peticiones: %d/%d\n", ip, count, MaxRequestsPerMinute)

		if count > MaxRequestsPerMinute {
			rdb.Set(ctxRdb, blacklistKey, "true", 24*time.Hour)
			fmt.Printf("🔥 [BANEO] Límite excedido para IP: %s\n", ip)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error": "Demasiadas peticiones. Tu IP ha sido baneada."}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}
