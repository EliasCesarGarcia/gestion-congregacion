/**
 * ARCHIVO: historial.go
 * UBICACIÓN: backend/internal/models/historial.go
 * DESCRIPCIÓN: Historial de puestos de los departamentos (tabla
 * core_puestos_historial). Una fila por cada vez que una persona ocupa un
 * puesto: fecha_fin vacía = puesto vigente. Nunca se borra.
 */

package models

import "time"

// HistorialPuesto es una fila del historial, lista para enviar al frontend.
type HistorialPuesto struct {
	ID             int64      `json:"id"`
	ModuloID       string     `json:"modulo_id"`
	PersonaID      int        `json:"persona_id"`
	NombreCompleto string     `json:"nombre_completo"`
	Puesto         string     `json:"puesto"`
	FechaInicio    time.Time  `json:"fecha_inicio"`
	FechaFin       *time.Time `json:"fecha_fin"` // null = vigente
	Detalles       string     `json:"detalles"`
	AsignadoPor    string     `json:"asignado_por"`
	QuitadoPor     string     `json:"quitado_por"`
}

// HistorialPuestosPagina es la respuesta paginada de la consulta.
type HistorialPuestosPagina struct {
	Historial []HistorialPuesto `json:"historial"`
	Total     int64             `json:"total"`
	Page      int               `json:"page"`
	Limit     int               `json:"limit"`
}
