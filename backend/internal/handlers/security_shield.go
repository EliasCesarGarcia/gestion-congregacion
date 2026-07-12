/*
*
ARCHIVO: security_shield.go
UBICACIÓN: backend/internal/handlers/security_shield.go
DESCRIPCIÓN: Implementación de Rate Limiting avanzado, Blacklisting dinámico
y detección de patrones de ataque para alta disponibilidad.
*/
package handlers

import (
	"net/http"
	"sync"
	"time"
)

// IPStat guarda el historial de una dirección IP
type IPStat struct {
count int
lastSeen time.Time
isBlacklisted bool
}
var (
// store local para tracking de IPs (En producción avanzada usar Redis)
stats = make(map[string]*IPStat)
statsMutex sync.Mutex
)
const (
MaxRequestsPerMinute = 100
BlacklistDuration = 24 * time.Hour
)
// ShieldMiddleware actúa como el primer muro de contención
func ShieldMiddleware(next http.Handler) http.Handler {
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
ip := r.RemoteAddr // En producción tras proxy, usar r.Header.Get("X-Forwarded-For")

statsMutex.Lock()
	state, exists := stats[ip]

	// 1. Verificación de Blacklist
	if exists && state.isBlacklisted {
		if time.Since(state.lastSeen) < BlacklistDuration {
			statsMutex.Unlock()
			// Error 403 o simplemente cerrar la conexión para ahorrar ancho de banda
			w.WriteHeader(http.StatusForbidden)
			return
		}
		// Si pasó el tiempo de ban, lo perdonamos
		state.isBlacklisted = false
		state.count = 0
	}

	// 2. Lógica de Rate Limiting (Fixed Window)
	now := time.Now()
	if !exists || now.Sub(state.lastSeen) > time.Minute {
		stats[ip] = &IPStat{count: 1, lastSeen: now}
	} else {
		state.count++
		state.lastSeen = now
		if state.count > MaxRequestsPerMinute {
			state.isBlacklisted = true // Bloqueo automático por IP Insistente
			statsMutex.Unlock()
			
			w.Header().Set("X-Rate-Limit-Action", "Blacklisted")
			http.Error(w, "Demasiadas peticiones. Tu IP ha sido baneada.", http.StatusTooManyRequests)
			return
		}
	}
	statsMutex.Unlock()

	next.ServeHTTP(w, r)
})
}