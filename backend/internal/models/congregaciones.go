/**
 * ARCHIVO: congregaciones.go
 * UBICACIÓN: backend/internal/models/congregaciones.go
 * DESCRIPCIÓN: Modelos del panel de congregaciones (solo superadmin):
 * la congregación con sus conteos, los datos de alta y edición, la página
 * de resultados y el historial de cambios (core_congregaciones_historial).
 */

package models

import "time"

// CongregacionAdmin: una congregación con lo esencial para el panel.
// Personas cuenta solo las que están en ALTA. Los tres Tiene* indican si
// ya hay una persona en ALTA con ese rol (condición para habilitarla).
type CongregacionAdmin struct {
	ID                 string `json:"id"`
	Nombre             string `json:"nombre"`
	Pais               string `json:"pais"`
	ProvinciaEstado    string `json:"provincia_estado"`
	Ciudad             string `json:"ciudad"`
	Region             string `json:"region"`
	Partido            string `json:"partido"`
	Direccion          string `json:"direccion"`
	NumeroCongregacion string `json:"numero_congregacion"`
	ZonaHoraria        string `json:"zona_horaria"`
	Circuito           string `json:"circuito"`
	Activa             bool   `json:"activa"`
	Personas           int64  `json:"personas"`
	TieneCoordinador   bool   `json:"tiene_coordinador"`
	TieneSecretario    bool   `json:"tiene_secretario"`
	TieneServicio      bool   `json:"tiene_servicio"`
}

// CongregacionesPagina: respuesta paginada de la lista.
type CongregacionesPagina struct {
	Congregaciones []CongregacionAdmin `json:"congregaciones"`
	Total          int64               `json:"total"`
	Page           int                 `json:"page"`
	Limit          int                 `json:"limit"`
}

// DatosCongregacion: datos ya validados para crear. Numero es
// numero_congregacion. Los opcionales vacíos se guardan como NULL.
type DatosCongregacion struct {
	Nombre          string
	Pais            string
	ProvinciaEstado string
	Ciudad          string
	Region          string
	Partido         string
	Direccion       string
	Numero          string
	ZonaHoraria     string
	Circuito        string
}

// CambiosCongregacion: nil = no tocar. En los opcionales (Region, Partido,
// Direccion, Circuito) una cadena vacía significa "borrar el dato".
type CambiosCongregacion struct {
	Nombre          *string
	Pais            *string
	ProvinciaEstado *string
	Ciudad          *string
	Region          *string
	Partido         *string
	Direccion       *string
	Numero          *string
	ZonaHoraria     *string
	Circuito        *string
}

// CongregacionHistorial: una línea del registro de cambios. El nombre y el
// número son la copia del momento del cambio (sirve aunque se borre o
// renombre la congregación).
type CongregacionHistorial struct {
	ID                 int64     `json:"id"`
	CongregacionID     string    `json:"congregacion_id"`
	CongregacionNombre string    `json:"congregacion_nombre"`
	CongregacionNumero string    `json:"congregacion_numero"`
	Accion             string    `json:"accion"`
	ActorID            int64     `json:"actor_id"`
	ActorNombre        string    `json:"actor_nombre"`
	Detalle            string    `json:"detalle"`
	CreadoEn           time.Time `json:"creado_en"`
}

// HistorialCongregacionesPagina: respuesta paginada del historial.
type HistorialCongregacionesPagina struct {
	Historial []CongregacionHistorial `json:"historial"`
	Total     int64                   `json:"total"`
	Page      int                     `json:"page"`
	Limit     int                     `json:"limit"`
}
