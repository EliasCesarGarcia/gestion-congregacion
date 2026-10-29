/**
 * ARCHIVO: motivos.go
 * UBICACIÓN: backend/internal/models/motivos.go
 * DESCRIPCIÓN: Motivos configurables para asignar o quitar un puesto (tabla
 * core_puestos_motivos). Los gestiona solo el superadmin; el resto elige.
 */

package models

// MotivoPuesto: Tipo es "asignar" o "quitar". Un motivo desactivado no se
// ofrece más, pero el historial conserva una copia de su texto.
type MotivoPuesto struct {
	ID     int64  `json:"id"`
	Tipo   string `json:"tipo"`
	Texto  string `json:"texto"`
	Activo bool   `json:"activo"`
	Orden  int    `json:"orden"`
}
