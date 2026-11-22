/**
 * ARCHIVO: historial_correcciones.go
 * UBICACIÓN: backend/internal/handlers/historial_correcciones.go
 * DESCRIPCIÓN: Tramo 3.6. Corregir motivos, detalles y valores de una fila ya
 * cargada de un historial de la persona. Solo coordinador, secretario,
 * servicio o superadmin. Las fechas se corrigen con las rutas de fechas.
 * En todas, "id" es el de la fila (lo devuelve GET /api/personas/historial) y
 * lo que no se manda no se toca. Una fila de otra congregación da 404.
 *
 *  - POST /api/personas/estado/corregir
 *      { id, motivo_alta_id?, detalles_alta?, motivo_baja_id?, detalles_baja? }
 *      Motivos de uso personas.alta / personas.baja (no pueden quedar vacíos).
 *      Los datos de baja solo en una fila cerrada.
 *  - POST /api/personas/situaciones/corregir
 *      { id, campo (1 o 2), valor }
 *      Cualquier período. Si es el vigente, cambia también el dato actual.
 *  - POST /api/personas/grupos/movimientos/corregir
 *      { id, motivo_entrada_id?, detalles_entrada?, motivo_salida_id?, detalles_salida? }
 *      Motivos de uso personas.grupo. La salida solo en una fila cerrada y
 *      que no se haya cerrado con la baja de la persona.
 *  - POST /api/personas/grupos/encargados/corregir
 *      { id, detalles }
 *      Una excepción no puede quedar sin motivo.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func CorregirEstadoPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "corregir-estado")
		if !ok {
			return
		}
		var req struct {
			ID           int64   `json:"id"`
			MotivoAlta   *int64  `json:"motivo_alta_id"`
			DetallesAlta *string `json:"detalles_alta"`
			MotivoBaja   *int64  `json:"motivo_baja_id"`
			DetallesBaja *string `json:"detalles_baja"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CorregirEstadoPersona(a, esSuper, req.ID, req.MotivoAlta, req.DetallesAlta, req.MotivoBaja, req.DetallesBaja); err != nil {
			responderErrorPersonas(w, err, "corregir-estado", a.PersonaID)
			return
		}
		log.Printf("✏️ fila %d del historial de estado corregida por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

func CorregirSituacionPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "corregir-situacion")
		if !ok {
			return
		}
		var req struct {
			ID    int64  `json:"id"`
			Campo int    `json:"campo"`
			Valor string `json:"valor"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CorregirSituacionPersona(a, esSuper, req.ID, req.Campo, req.Valor); err != nil {
			responderErrorPersonas(w, err, "corregir-situacion", a.PersonaID)
			return
		}
		log.Printf("✏️ fila %d del historial de situaciones corregida por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

func CorregirMovimientoGrupoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "corregir-movimiento")
		if !ok {
			return
		}
		var req struct {
			ID              int64   `json:"id"`
			MotivoEntrada   *int64  `json:"motivo_entrada_id"`
			DetallesEntrada *string `json:"detalles_entrada"`
			MotivoSalida    *int64  `json:"motivo_salida_id"`
			DetallesSalida  *string `json:"detalles_salida"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CorregirMovimientoGrupo(a, esSuper, req.ID, req.MotivoEntrada, req.DetallesEntrada, req.MotivoSalida, req.DetallesSalida); err != nil {
			responderErrorPersonas(w, err, "corregir-movimiento", a.PersonaID)
			return
		}
		log.Printf("✏️ fila %d del historial de grupos corregida por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

func CorregirEncargadoGrupoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "corregir-encargado")
		if !ok {
			return
		}
		var req struct {
			ID       int64  `json:"id"`
			Detalles string `json:"detalles"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CorregirEncargadoGrupo(a, esSuper, req.ID, req.Detalles); err != nil {
			responderErrorPersonas(w, err, "corregir-encargado", a.PersonaID)
			return
		}
		log.Printf("✏️ fila %d del historial de encargados corregida por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
