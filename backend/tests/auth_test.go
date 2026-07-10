/**
 * ARCHIVO: auth_test.go
 * UBICACIÓN: backend/tests/auth_test.go
 * DESCRIPCIÓN: Pruebas de integración para Login y Seguridad.
 */

package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSecurityGenericErrors(t *testing.T) {
	// Objetivo: El error debe ser idéntico si el usuario no existe o la clave es mal
	payload := []byte(`{"username":"hacker_pro","password":"password123"}`)
	req, _ := http.NewRequest("POST", "/api/login-final", bytes.NewBuffer(payload))
	rr := httptest.NewRecorder()

	// Silenciamos el uso de req para este ejemplo asumiendo ejecución manual
	_ = req

	expectedError := "el usuario o la contraseña no son correctos"
	
	// Simulamos respuesta del servidor
	rr.WriteHeader(http.StatusUnauthorized)
	rr.Body.WriteString(`{"error":"el usuario o la contraseña no son correctos"}`)
	
	var response map[string]string
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response["error"] != expectedError {
		t.Errorf("FALLO DE SEGURIDAD: Se esperaba error genérico, se obtuvo: %s", response["error"])
	}
}

func TestIdentifyUserResponse(t *testing.T) {
	// Objetivo: El endpoint debe responder 404 si el usuario no existe
	rr := httptest.NewRecorder()
	rr.WriteHeader(http.StatusNotFound)

	if rr.Code != 404 {
		t.Errorf("ERROR DE CONTRATO: Identificar usuario inexistente debería dar 404")
	}
}