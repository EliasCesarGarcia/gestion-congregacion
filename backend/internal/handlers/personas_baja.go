/**
 * ARCHIVO: personas_baja.go
 * UBICACIÓN: backend/internal/handlers/personas_baja.go
 * DESCRIPCIÓN: Rutas de bajas y reactivación. Coordinador, secretario,
 * servicio o superadmin:
 *
 *  - POST /api/personas/baja      -> { id, fecha, motivo_id?, detalles? }
 *      motivo_id: motivo activo del uso personas.baja (0 o ausente = sin motivo).
 *  - POST /api/personas/reactivar -> { id, fecha, motivo_id? }
 *      motivo_id: motivo activo del uso personas.alta (0 o ausente = sin motivo).
 *
 * Los desplegables se llenan con GET /api/personas/motivos?uso=baja|alta|grupo
 * y el catálogo lo gestiona solo el superadmin (motivos_catalogo.go).
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func DarDeBajaPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "baja-persona")
		if !ok {
			return
		}
		var req struct {
			ID       int    `json:"id"`
			Fecha    string `json:"fecha"`
			MotivoID int64  `json:"motivo_id"`
			Detalles string `json:"detalles"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.DarDeBajaPersona(a, esSuper, req.ID, req.Fecha, req.Detalles, req.MotivoID); err != nil {
			responderErrorPersonas(w, err, "baja-persona", a.PersonaID)
			return
		}
		log.Printf("👤 persona %d dada de baja por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

func ReactivarPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "reactivar-persona")
		if !ok {
			return
		}
		var req struct {
			ID       int    `json:"id"`
			Fecha    string `json:"fecha"`
			MotivoID int64  `json:"motivo_id"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.ReactivarPersona(a, esSuper, req.ID, req.Fecha, req.MotivoID); err != nil {
			responderErrorPersonas(w, err, "reactivar-persona", a.PersonaID)
			return
		}
		log.Printf("👤 persona %d reactivada por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
