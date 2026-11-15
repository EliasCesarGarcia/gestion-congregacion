/**
 * ARCHIVO: personas_escritura.go
 * UBICACIÓN: backend/internal/models/personas_escritura.go
 * DESCRIPCIÓN: Datos que viajan del servicio al repositorio al crear o editar
 * una persona. El servicio ya los validó y normalizó: un texto vacío significa
 * "sin dato" y se guarda como NULL.
 */

package models

// DatosPersona: lo que un encargado puede escribir de una persona al crear o
// editar. El grupo NO va acá: se elige al crear (NuevaPersona.GrupoID) y
// después solo cambia moviendo a la persona de grupo.
// FechaAlta va como AAAA-MM-DD; "" = fecha desconocida (solo personas antiguas).
// Condicion es "", "A" o "I".
type DatosPersona struct {
	Apellido        string
	Nombre          string
	ApellidoNombre  string // "APELLIDO Nombre": lo siguen leyendo otras partes
	Contacto        string
	Detalles        string
	Condicion       string
	FechaAlta       string
	Direccion       string
	CodigoPostal    string
	Pais            string
	ProvinciaEstado string
	Ciudad          string
	Partido         string
}

// NuevaPersona: datos de una persona que se crea. Nace en ALTA.
// Situacion2 y Situacion3 vacías = sin valor.
// MotivoAltaID: motivo del catálogo (uso personas.alta), nil = sin motivo.
// GrupoID: grupo activo de su congregación al que entra (id de core_grupos),
// nil = sin grupo.
type NuevaPersona struct {
	DatosPersona
	CongregacionID string
	Situacion1     string
	Situacion2     string
	Situacion3     string
	ActorID        string
	MotivoAltaID   *int64
	GrupoID        *int
}
