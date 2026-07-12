/**
 * ARCHIVO: circuit_breaker.go
 * UBICACIÓN: backend/internal/handlers/circuit_breaker.go
 * DESCRIPCIÓN: Middleware que consulta al paquete monitor para bloquear tráfico.
 */

package handlers

import (
	"gestion-congregacion/backend/internal/monitor"
	"net/http"
)

func CircuitBreakerMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if monitor.IsCircuitOpen() {
			w.Header().Set("Retry-After", "30")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"error": "Sistema en modo protección por fallos en DB. Reintente en 30s"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}