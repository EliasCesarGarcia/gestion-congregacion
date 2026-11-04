/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/models/personas_rol.go
 * DESCRIPCIÓN: Conteo de personas en ALTA por rol de la aplicación
 * (publicador, secretario, coordinador, servicio).
 */

package models

// ConteoRol: cuántas personas en ALTA tienen ese rol. Titulares lista sus
// nombres (vacío para publicador).
type ConteoRol struct {
	Rol       string `json:"rol" gorm:"column:rol"`
	Total     int64  `json:"total" gorm:"column:total"`
	Titulares string `json:"titulares" gorm:"column:titulares"`
}

// HistorialRolPersona: un período en que la persona tuvo un rol (secretario,
// coordinador o servicio). Las fechas van en UTC (AAAA-MM-DD HH:MM) y vienen
// null si no se conocen (roles cargados antes de existir este historial).
type HistorialRolPersona struct {
	ID          int64   `json:"id" gorm:"column:id"`
	Rol         string  `json:"rol" gorm:"column:rol"`
	FechaInicio *string `json:"fecha_inicio" gorm:"column:fecha_inicio"`
	FechaFin    *string `json:"fecha_fin" gorm:"column:fecha_fin"`
	Vigente     bool    `json:"vigente" gorm:"column:vigente"`
	AsignadoPor string  `json:"asignado_por" gorm:"column:asignado_por"`
	QuitadoPor  string  `json:"quitado_por" gorm:"column:quitado_por"`
}

// CambioRol: una persona y el rol que pasa a tener en una rotación.
type CambioRol struct {
	PersonaID int    `json:"persona_id"`
	RolApp    string `json:"rol_app"`
}