/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/models/personas_rol.go
 * DESCRIPCIÓN: Roles de la aplicación (coordinador, secretario, servicio).
 * Una persona puede tener varios roles; cada rol tiene un solo titular por
 * congregación. "Publicador" es la ausencia de rol.
 */

package models

// ConteoRol: cuántas personas en ALTA tienen ese rol (publicador = sin ningún
// rol). Titulares lista sus nombres (vacío para publicador).
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

// RotacionRoles: el NUEVO titular de cada rol que cambia (id de persona).
// 0 = ese rol no cambia. Ejemplo: {"coordinador": 31, "servicio": 31}.
type RotacionRoles struct {
	Coordinador int `json:"coordinador"`
	Secretario  int `json:"secretario"`
	Servicio    int `json:"servicio"`
}