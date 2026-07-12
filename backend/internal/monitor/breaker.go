/**
 * ARCHIVO: breaker.go
 * UBICACIÓN: backend/internal/monitor/breaker.go
 * DESCRIPCIÓN: Estado global del Circuit Breaker para evitar dependencias circulares.
 */

package monitor

import (
	"sync/atomic"
	"time"
)

var (
	failureCount int32
	circuitOpen  int32 // 0 = cerrado, 1 = abierto
)

const MaxFailures = 5

// TripCircuit aumenta el contador de fallos
func TripCircuit() {
	newFailures := atomic.AddInt32(&failureCount, 1)
	if newFailures >= MaxFailures {
		atomic.StoreInt32(&circuitOpen, 1)
		// Intentar re-abrir en 30 segundos
		time.AfterFunc(30*time.Second, func() {
			atomic.StoreInt32(&failureCount, 0)
			atomic.StoreInt32(&circuitOpen, 0)
		})
	}
}

// IsCircuitOpen verifica si el sistema debe estar bloqueado
func IsCircuitOpen() bool {
	return atomic.LoadInt32(&circuitOpen) == 1
}

// ResetFailures limpia los errores si una operación fue exitosa
func ResetFailures() {
	atomic.StoreInt32(&failureCount, 0)
}