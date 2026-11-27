/**
 * ARCHIVO: cargos_periodo_anterior.go
 * UBICACIÓN: backend/internal/models/cargos_periodo_anterior.go
 * DESCRIPCIÓN: Cuerpo de la ruta que carga un período PASADO y ya cerrado de un
 * cargo de la congregación (por ejemplo, un coordinador interino entre dos
 * titulares que ya están cargados). Fechas AAAA-MM-DD, nunca futuras.
 */

package models

// PeriodoAnteriorCargo: un período cerrado de un cargo (coordinador, secretario
// o servicio). El motivo de alta es del uso personas.cargo_alta y el de baja,
// del uso personas.cargo_baja; los dos son obligatorios. Los detalles son
// opcionales (hasta 100 palabras).
type PeriodoAnteriorCargo struct {
	CongregacionID string `json:"congregacion_id"`
	Rol            string `json:"rol"`
	PersonaID      int    `json:"persona_id"`
	FechaInicio    string `json:"fecha_inicio"`
	FechaFin       string `json:"fecha_fin"`
	MotivoAltaID   int64  `json:"motivo_alta_id"`
	DetallesAlta   string `json:"detalles_alta"`
	MotivoBajaID   int64  `json:"motivo_baja_id"`
	DetallesBaja   string `json:"detalles_baja"`
}
