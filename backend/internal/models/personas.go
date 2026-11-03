/**
 * ARCHIVO: personas.go
 * UBICACIÓN: backend/internal/models/personas.go
 * DESCRIPCIÓN: Modelos del módulo de personas: filtros de búsqueda, fila de la
 * lista, ficha, conteos y los dos historiales (altas/bajas y situaciones).
 * A propósito NO incluyen password_hash ni username_temp.
 */

package models

// FiltroPersonas: lo que llega de la pantalla para buscar. Los campos vacíos
// no filtran. Palabras las completa el servicio a partir de Q.
// CongregacionID solo lo tiene en cuenta el superadmin.
type FiltroPersonas struct {
	CongregacionID string
	Q              string
	Estado         string // "", ALTA o BAJA
	Condicion      string // "", A o I
	Situacion1     string // "" o un valor de la lista
	Situacion2     string // "", un valor de la lista o "sin"
	Situacion3     string // "", un valor de la lista o "sin"
	Grupo          string // "", "sin" o un número
	RolApp         string // "" o publicador, secretario, coordinador, servicio
	Palabras       []string
}

// PersonaFila: una persona en la lista. Sin email, contacto ni dirección.
type PersonaFila struct {
	ID             int    `json:"id" gorm:"column:id"`
	CongregacionID string `json:"congregacion_id" gorm:"column:congregacion_id"`
	Apellido       string `json:"apellido" gorm:"column:apellido"`
	Nombre         string `json:"nombre" gorm:"column:nombre"`
	Estado         string `json:"estado" gorm:"column:estado"`
	Condicion      string `json:"condicion" gorm:"column:condicion"`
	Grupo          *int   `json:"grupo" gorm:"column:grupo"`
	Situacion1     string `json:"situacion_1" gorm:"column:situacion_1"`
	Situacion2     string `json:"situacion_2" gorm:"column:situacion_2"`
	Situacion3     string `json:"situacion_3" gorm:"column:situacion_3"`
	FotoURL        string `json:"foto_url" gorm:"column:foto_url"`
	RolApp         string `json:"rol_app" gorm:"column:rol_app"`
}

// BusquedaPersonasPagina: respuesta paginada de la búsqueda.
type BusquedaPersonasPagina struct {
	Personas []PersonaFila `json:"personas"`
	Total    int64         `json:"total"`
	Page     int           `json:"page"`
	Limit    int           `json:"limit"`
}

// PersonaFicha: todos los datos de una persona que ven los encargados, el
// superadmin y la propia persona. Las fechas van como texto AAAA-MM-DD y
// vienen null si no se conocen.
type PersonaFicha struct {
	ID              int     `json:"id" gorm:"column:id"`
	CongregacionID  string  `json:"congregacion_id" gorm:"column:congregacion_id"`
	Apellido        string  `json:"apellido" gorm:"column:apellido"`
	Nombre          string  `json:"nombre" gorm:"column:nombre"`
	Estado          string  `json:"estado" gorm:"column:estado"`
	Condicion       string  `json:"condicion" gorm:"column:condicion"`
	Grupo           *int    `json:"grupo" gorm:"column:grupo"`
	Situacion1      string  `json:"situacion_1" gorm:"column:situacion_1"`
	Situacion2      string  `json:"situacion_2" gorm:"column:situacion_2"`
	Situacion3      string  `json:"situacion_3" gorm:"column:situacion_3"`
	FechaAlta       *string `json:"fecha_alta" gorm:"column:fecha_alta"`
	FechaBaja       *string `json:"fecha_baja" gorm:"column:fecha_baja"`
	Contacto        string  `json:"contacto" gorm:"column:contacto"`
	Email           string  `json:"email" gorm:"column:email"`
	Detalles        string  `json:"detalles" gorm:"column:detalles"`
	FotoURL         string  `json:"foto_url" gorm:"column:foto_url"`
	RolApp          string  `json:"rol_app" gorm:"column:rol_app"`
	Direccion       string  `json:"direccion" gorm:"column:direccion"`
	Ciudad          string  `json:"ciudad" gorm:"column:ciudad"`
	Partido         string  `json:"partido" gorm:"column:partido"`
	ProvinciaEstado string  `json:"provincia_estado" gorm:"column:provincia_estado"`
	Pais            string  `json:"pais" gorm:"column:pais"`
	CodigoPostal    string  `json:"codigo_postal" gorm:"column:codigo_postal"`
}

// ConteoSituacion: cuántas personas en ALTA tienen ese valor. Campo es 1, 2 o 3.
type ConteoSituacion struct {
	Campo int    `json:"campo" gorm:"column:campo"`
	Valor string `json:"valor" gorm:"column:valor"`
	Total int64  `json:"total" gorm:"column:total"`
}

// ConteoGrupo: personas en ALTA de un grupo (Grupo null = sin grupo), con el
// superintendente y el auxiliar de grupo si los hay.
type ConteoGrupo struct {
	Grupo           *int   `json:"grupo" gorm:"column:grupo"`
	Total           int64  `json:"total" gorm:"column:total"`
	Activos         int64  `json:"activos" gorm:"column:activos"`
	Inactivos       int64  `json:"inactivos" gorm:"column:inactivos"`
	Superintendente string `json:"superintendente" gorm:"column:superintendente"`
	Auxiliar        string `json:"auxiliar" gorm:"column:auxiliar"`
}

// ConteosPersonas: Total cuenta todas las filas; Alta y Bajas parten el total
// por estado; Activos, Inactivos y SinCondicion parten las personas en ALTA.
type ConteosPersonas struct {
	Total        int64             `json:"total" gorm:"column:total"`
	Alta         int64             `json:"alta" gorm:"column:alta"`
	Activos      int64             `json:"activos" gorm:"column:activos"`
	Inactivos    int64             `json:"inactivos" gorm:"column:inactivos"`
	SinCondicion int64             `json:"sin_condicion" gorm:"column:sin_condicion"`
	Bajas        int64             `json:"bajas" gorm:"column:bajas"`
	Situaciones  []ConteoSituacion `json:"situaciones" gorm:"-"`
	Grupos       []ConteoGrupo     `json:"grupos" gorm:"-"`
	Roles        []ConteoRol       `json:"roles" gorm:"-"`
}

// HistorialEstadoPersona: una vez que la persona estuvo de alta. Vigente =
// está de alta hoy. Las fechas null son fechas que no se conocen.
type HistorialEstadoPersona struct {
	ID         int64   `json:"id" gorm:"column:id"`
	FechaAlta  *string `json:"fecha_alta" gorm:"column:fecha_alta"`
	FechaBaja  *string `json:"fecha_baja" gorm:"column:fecha_baja"`
	Vigente    bool    `json:"vigente" gorm:"column:vigente"`
	MotivoBaja string  `json:"motivo_baja" gorm:"column:motivo_baja"`
	Detalles   string  `json:"detalles" gorm:"column:detalles"`
	AltaPor    string  `json:"alta_por" gorm:"column:alta_por"`
	BajaPor    string  `json:"baja_por" gorm:"column:baja_por"`
}

// HistorialSituacionPersona: un período de una situación (campo 1, 2 o 3).
type HistorialSituacionPersona struct {
	ID          int64   `json:"id" gorm:"column:id"`
	Campo       int     `json:"campo" gorm:"column:campo"`
	Valor       string  `json:"valor" gorm:"column:valor"`
	FechaInicio *string `json:"fecha_inicio" gorm:"column:fecha_inicio"`
	FechaFin    *string `json:"fecha_fin" gorm:"column:fecha_fin"`
	Vigente     bool    `json:"vigente" gorm:"column:vigente"`
	AsignadoPor string  `json:"asignado_por" gorm:"column:asignado_por"`
	QuitadoPor  string  `json:"quitado_por" gorm:"column:quitado_por"`
}

// HistorialPersona: los dos historiales de una persona.
type HistorialPersona struct {
	PersonaID   int                         `json:"persona_id"`
	Estado      []HistorialEstadoPersona    `json:"estado"`
	Situaciones []HistorialSituacionPersona `json:"situaciones"`
	Roles       []HistorialRolPersona       `json:"roles"`
}
