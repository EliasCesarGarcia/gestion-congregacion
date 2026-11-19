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

// CabeceraGrupoHistorial: los datos del grupo en el historial. Las fechas van
// como AAAA-MM-DD y vienen null si no se conocen.
type CabeceraGrupoHistorial struct {
	ID          int     `json:"id"`
	Numero      int     `json:"numero"`
	Activo      bool    `json:"activo"`
	FechaInicio *string `json:"fecha_inicio"`
	FechaCierre *string `json:"fecha_cierre"`
}

// MiembroHistorialGrupo: una pertenencia de una persona a este grupo.
type MiembroHistorialGrupo struct {
	ID              int64   `json:"id" gorm:"column:id"`
	PersonaID       int     `json:"persona_id" gorm:"column:persona_id"`
	Apellido        string  `json:"apellido" gorm:"column:apellido"`
	Nombre          string  `json:"nombre" gorm:"column:nombre"`
	FechaInicio     *string `json:"fecha_inicio" gorm:"column:fecha_inicio"`
	FechaFin        *string `json:"fecha_fin" gorm:"column:fecha_fin"`
	Vigente         bool    `json:"vigente" gorm:"column:vigente"`
	MotivoEntrada   string  `json:"motivo_entrada" gorm:"column:motivo_entrada"`
	DetallesEntrada string  `json:"detalles_entrada" gorm:"column:detalles_entrada"`
	MotivoSalida    string  `json:"motivo_salida" gorm:"column:motivo_salida"`
	DetallesSalida  string  `json:"detalles_salida" gorm:"column:detalles_salida"`
	AsignadoPor     string  `json:"asignado_por" gorm:"column:asignado_por"`
	QuitadoPor      string  `json:"quitado_por" gorm:"column:quitado_por"`
}

// EncargadoHistorialGrupo: un período de una persona como superintendente o
// auxiliar de este grupo.
type EncargadoHistorialGrupo struct {
	ID          int64   `json:"id" gorm:"column:id"`
	PersonaID   int     `json:"persona_id" gorm:"column:persona_id"`
	Apellido    string  `json:"apellido" gorm:"column:apellido"`
	Nombre      string  `json:"nombre" gorm:"column:nombre"`
	Cargo       string  `json:"cargo" gorm:"column:cargo"`
	FechaInicio *string `json:"fecha_inicio" gorm:"column:fecha_inicio"`
	FechaFin    *string `json:"fecha_fin" gorm:"column:fecha_fin"`
	Vigente     bool    `json:"vigente" gorm:"column:vigente"`
	Excepcion   bool    `json:"excepcion" gorm:"column:excepcion"`
	Detalles    string  `json:"detalles" gorm:"column:detalles"`
	AsignadoPor string  `json:"asignado_por" gorm:"column:asignado_por"`
	QuitadoPor  string  `json:"quitado_por" gorm:"column:quitado_por"`
}

// HistorialGrupo: el historial completo de un grupo, en dos listas planas.
type HistorialGrupo struct {
	Grupo      CabeceraGrupoHistorial    `json:"grupo"`
	Miembros   []MiembroHistorialGrupo   `json:"miembros"`
	Encargados []EncargadoHistorialGrupo `json:"encargados"`
}