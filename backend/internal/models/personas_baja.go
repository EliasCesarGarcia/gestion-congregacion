/**
 * ARCHIVO: personas_baja.go
 * UBICACIÓN: backend/internal/models/personas_baja.go
 * DESCRIPCIÓN: Motivos de baja de una persona (core_personas_motivos_baja).
 * Los gestiona solo el superadmin; el historial guarda una copia del texto.
 */

package models

// MotivoBaja: un motivo del desplegable de bajas. Un motivo desactivado no se
// ofrece más, pero el historial conserva la copia de su texto.
type MotivoBaja struct {
	ID     int64  `json:"id" gorm:"column:id"`
	Nombre string `json:"nombre" gorm:"column:nombre"`
	Activo bool   `json:"activo" gorm:"column:activo"`
	Orden  int    `json:"orden" gorm:"column:orden"`
}
