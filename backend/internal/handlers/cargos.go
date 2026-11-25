/**
 * ARCHIVO: cargos.go
 * UBICACIÓN: backend/internal/handlers/cargos.go
 * DESCRIPCIÓN: Rutas de los tres cargos de la congregación (coordinador,
 * secretario y servicio). SOLO superadmin: las rutas van dentro de
 * SuperAdminMiddleware.
 *
 *  - GET  /api/admin/cargos?congregacion_id=
 *      -> { congregacion_id, completos, cargos: [{ rol, titular, historial: [...] }] }
 *      Los tres cargos en orden coordinador, secretario, servicio. "titular" es null si
 *      el cargo está vacante. Cada fila del historial: { id, rol, persona_id, apellido,
 *      nombre, contacto, fecha_inicio, fecha_fin, vigente, motivo_inicio, detalles_inicio,
 *      motivo_fin, detalles_fin, asignado_por, quitado_por } (fechas AAAA-MM-DD HH:MM UTC).
 *  - POST /api/admin/cargos/cambiar
 *      -> { congregacion_id, fecha (AAAA-MM-DD, hoy o anterior),
 *           coordinador: { persona_id, motivo_alta_id, detalles_alta?, motivo_baja_id, detalles_baja? },
 *           secretario: {...}, servicio: {...} }
 *      Los tres cargos vienen siempre con persona_id. Si es el titular actual, ese cargo no
 *      cambia. Si cambia: motivo_alta_id obligatorio (uso cargo_alta) y, si había titular,
 *      motivo_baja_id obligatorio (uso cargo_baja). Candidatos: Ancianos en ALTA de la
 *      congregación. Una persona puede tener varios cargos. Todo o nada.
 *  - POST /api/admin/cargos/corregir
 *      -> { id, motivo_inicio_id?, detalles_inicio?, motivo_fin_id?, detalles_fin? }
 *      id = id de la fila del historial. Lo que no se manda no se toca. Los datos de fin
 *      solo en un período cerrado. Las FECHAS se corrigen con /api/personas/roles/fechas.
 *
 * Los motivos para los desplegables: GET /api/personas/motivos?uso=cargo_alta | cargo_baja
 * (siempre en orden alfabético).
 */

package handlers

import (
	"errors"
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/service"
)

// responderErrorCargos: la congregación inexistente es 404; el resto, como en personas.
func responderErrorCargos(w http.ResponseWriter, err error, accion, personaID string) {
	if errors.Is(err, service.ErrCargosCongregacionNoExiste) {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	responderErrorPersonas(w, err, accion, personaID)
}

func ListCargosHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		res, err := s.ListCargos(r.URL.Query().Get("congregacion_id"))
		if err != nil {
			responderErrorCargos(w, err, "listar-cargos", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}

func CambiarCargosHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		var req models.CambioCargos
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CambiarCargos(a, req); err != nil {
			responderErrorCargos(w, err, "cambiar-cargos", a.PersonaID)
			return
		}
		log.Printf("🛡️ cargos de la congregación %s cambiados por persona %s", req.CongregacionID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

func CorregirCargoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		var req struct {
			ID             int64   `json:"id"`
			MotivoInicio   *int64  `json:"motivo_inicio_id"`
			DetallesInicio *string `json:"detalles_inicio"`
			MotivoFin      *int64  `json:"motivo_fin_id"`
			DetallesFin    *string `json:"detalles_fin"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CorregirCargo(a, req.ID, req.MotivoInicio, req.DetallesInicio, req.MotivoFin, req.DetallesFin); err != nil {
			responderErrorCargos(w, err, "corregir-cargo", a.PersonaID)
			return
		}
		log.Printf("✏️ fila %d del historial de cargos corregida por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}