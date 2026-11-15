/**
 * ARCHIVO: grupos.go
 * UBICACIÓN: backend/internal/models/grupos.go
 * DESCRIPCIÓN: Grupos de servicio de cada congregación (core_grupos) y sus
 * encargados vigentes. Los grupos se identifican solo por número. Un grupo
 * nunca se borra: se cierra, y solo si no tiene gente.
 */

package models

// GrupoBase: los datos de un grupo que usan las reglas (sin conteos).
// Las fechas van como AAAA-MM-DD y vienen null si no se conocen.
type GrupoBase struct {
	ID             int     `gorm:"column:id"`
	CongregacionID string  `gorm:"column:congregacion_id"`
	Numero         int     `gorm:"column:numero"`
	Activo         bool    `gorm:"column:activo"`
	FechaInicio    *string `gorm:"column:fecha_inicio"`
	FechaCierre    *string `gorm:"column:fecha_cierre"`
}

// EncargadoGrupo: superintendente o auxiliar vigente. Excepcion = fue
// habilitado aunque no es Anciano ni Siervo Ministerial (caso extraordinario).
type EncargadoGrupo struct {
	PersonaID int    `json:"persona_id"`
	Apellido  string `json:"apellido"`
	Nombre    string `json:"nombre"`
	Excepcion bool   `json:"excepcion"`
}

// GrupoFila: un grupo en la lista, con sus números. Miembros, Activos e
// Inactivos cuentan las personas con pertenencia vigente al grupo.
type GrupoFila struct {
	ID              int             `json:"id" gorm:"column:id"`
	CongregacionID  string          `json:"congregacion_id" gorm:"column:congregacion_id"`
	Numero          int             `json:"numero" gorm:"column:numero"`
	Activo          bool            `json:"activo" gorm:"column:activo"`
	FechaInicio     *string         `json:"fecha_inicio" gorm:"column:fecha_inicio"`
	FechaCierre     *string         `json:"fecha_cierre" gorm:"column:fecha_cierre"`
	Miembros        int64           `json:"miembros" gorm:"column:miembros"`
	Activos         int64           `json:"activos" gorm:"column:activos"`
	Inactivos       int64           `json:"inactivos" gorm:"column:inactivos"`
	Superintendente *EncargadoGrupo `json:"superintendente" gorm:"-"`
	Auxiliar        *EncargadoGrupo `json:"auxiliar" gorm:"-"`
}

// GruposLista: los grupos y cuántas personas en ALTA no tienen grupo.
type GruposLista struct {
	Grupos   []GrupoFila `json:"grupos"`
	SinGrupo int64       `json:"sin_grupo"`
}
