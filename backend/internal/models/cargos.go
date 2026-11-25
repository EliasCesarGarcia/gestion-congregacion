/**
 * ARCHIVO: cargos.go
 * UBICACIÓN: backend/internal/models/cargos.go
 * DESCRIPCIÓN: Cargos de la congregación (coordinador, secretario y servicio)
 * para la pantalla del superadmin. Cada fila es un período de un cargo; las
 * fechas van en UTC (AAAA-MM-DD HH:MM) y vienen null si no se conocen.
 */

package models

// FilaCargo: un período de un cargo, con quién lo tuvo y con qué motivos.
type FilaCargo struct {
	ID             int64   `json:"id" gorm:"column:id"`
	Rol            string  `json:"rol" gorm:"column:rol"`
	PersonaID      int     `json:"persona_id" gorm:"column:persona_id"`
	Apellido       string  `json:"apellido" gorm:"column:apellido"`
	Nombre         string  `json:"nombre" gorm:"column:nombre"`
	Contacto       string  `json:"contacto" gorm:"column:contacto"`
	FechaInicio    *string `json:"fecha_inicio" gorm:"column:fecha_inicio"`
	FechaFin       *string `json:"fecha_fin" gorm:"column:fecha_fin"`
	Vigente        bool    `json:"vigente" gorm:"column:vigente"`
	MotivoInicio   *string `json:"motivo_inicio" gorm:"column:motivo_inicio"`
	DetallesInicio *string `json:"detalles_inicio" gorm:"column:detalles_inicio"`
	MotivoFin      *string `json:"motivo_fin" gorm:"column:motivo_fin"`
	DetallesFin    *string `json:"detalles_fin" gorm:"column:detalles_fin"`
	AsignadoPor    string  `json:"asignado_por" gorm:"column:asignado_por"`
	QuitadoPor     string  `json:"quitado_por" gorm:"column:quitado_por"`
}

// CargoActual: un cargo con su titular vigente (null si está vacante) y todo su historial.
type CargoActual struct {
	Rol       string      `json:"rol"`
	Titular   *FilaCargo  `json:"titular"`
	Historial []FilaCargo `json:"historial"`
}

// CargosCongregacion: los tres cargos de una congregación. Completos = los tres tienen titular.
type CargosCongregacion struct {
	CongregacionID string        `json:"congregacion_id"`
	Completos      bool          `json:"completos"`
	Cargos         []CargoActual `json:"cargos"`
}

// CargoCambio: lo que se pide para UN cargo. Si persona_id es el titular actual,
// el cargo no cambia y los motivos se ignoran. Si cambia, el motivo de alta es
// obligatorio y, si había titular, también el de baja.
type CargoCambio struct {
	PersonaID    int    `json:"persona_id"`
	MotivoAltaID int64  `json:"motivo_alta_id"`
	DetallesAlta string `json:"detalles_alta"`
	MotivoBajaID int64  `json:"motivo_baja_id"`
	DetallesBaja string `json:"detalles_baja"`
}

// CambioCargos: el cambio de los tres cargos de una congregación en un solo paso.
// Fecha (AAAA-MM-DD) es obligatoria: hoy o anterior, nunca futura.
type CambioCargos struct {
	CongregacionID string      `json:"congregacion_id"`
	Fecha          string      `json:"fecha"`
	Coordinador    CargoCambio `json:"coordinador"`
	Secretario     CargoCambio `json:"secretario"`
	Servicio       CargoCambio `json:"servicio"`
}