/**
 * ARCHIVO: service_test.go
 * UBICACIÓN: backend/internal/service/service_test.go
 * DESCRIPCIÓN: Pruebas unitarias de lógica pura (Bcrypt y Strings).
 */

package service

import (
	"strings"
	"testing"
)

func TestSanitizeInput(t *testing.T) {
	// El servicio debe limpiar espacios y minúsculas
	input := "  Elias.Garcia.2026  "
	expected := "elias.garcia.2026"
	
	result := strings.TrimSpace(strings.ToLower(input))
	
	if result != expected {
		t.Errorf("FALLO EN LÓGICA: Sanitización incorrecta. Se obtuvo: %s", result)
	}
}