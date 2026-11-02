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