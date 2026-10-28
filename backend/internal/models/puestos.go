/**
 * ARCHIVO: puestos.go
 * UBICACIÓN: backend/internal/models/puestos.go
 * DESCRIPCIÓN: Modelo de los puestos de cada departamento (módulo):
 * encargado, auxiliar y segundo auxiliar.
 */

package models

// AsignacionPuesto: quién ocupa qué puesto en qué departamento.
// Puesto: "encargado", "auxiliar" o "auxiliar_2".
type AsignacionPuesto struct {
	ModuloID       string `json:"modulo_id"`
	PersonaID      int    `json:"persona_id"`
	NombreCompleto string `json:"nombre_completo"`
	Puesto         string `json:"puesto"`
}
