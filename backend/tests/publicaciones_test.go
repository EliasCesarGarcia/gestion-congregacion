/**
 * ARCHIVO: publicaciones_test.go
 * UBICACIÓN: backend/tests/publicaciones_test.go
 * DESCRIPCIÓN: Valida el formato del catálogo para el Frontend.
 */

package tests

import (
	"encoding/json"
	"gestion-congregacion/backend/internal/models"
	"testing"
)

func TestPublicacionJSONStructure(t *testing.T) {
	// Simulamos un dato de la BD
	p := models.Publicacion{
		ID: "nwt-S",
		NombrePublicacion: "Traducción del Nuevo Mundo",
		Siglas: "nwt",
	}

	data, _ := json.Marshal(p)
	var raw map[string]interface{}
	json.Unmarshal(data, &raw)

	// Verificamos que los campos que usa el Frontend existan (SEO 2026)
	fields := []string{"id", "nombre_publicacion", "siglas"}
	for _, f := range fields {
		if _, ok := raw[f]; !ok {
			t.Errorf("ERROR DE COMPATIBILIDAD: El campo '%s' es vital para el Frontend y no existe en el JSON", f)
		}
	}
}