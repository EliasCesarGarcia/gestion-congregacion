/**
 * ARCHIVO: grupos_mover.go
 * UBICACIÓN: backend/internal/handlers/grupos_mover.go
 * DESCRIPCIÓN: Ruta para mover una persona de grupo. Solo coordinador,
 * secretario, servicio o superadmin, y solo personas de su congregación.
 *
 *  - POST /api/personas/grupos/mover -> { persona_id, grupo_id (0 = sin grupo), fecha,
 *                                         motivo_id?, detalles? }
 *      motivo_id: motivo activo del uso personas.grupo (0 o ausente = sin motivo).
 *      Un superintendente o auxiliar no se mueve (409): primero se lo reemplaza.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func MoverGrupoPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "mover-grupo")
		if !ok {
			return
		}
		var req struct {
			PersonaID int    `json:"persona_id"`
			GrupoID   int    `json:"grupo_id"`
			Fecha     string `json:"fecha"`
			MotivoID  int64  `json:"motivo_id"`
			Detalles  string `json:"detalles"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.MoverPersonaDeGrupo(a, esSuper, req.PersonaID, req.GrupoID, req.Fecha, req.Detalles, req.MotivoID); err != nil {
			responderErrorPersonas(w, err, "mover-grupo", a.PersonaID)
			return
		}
		log.Printf("👥 persona %d movida al grupo %d por persona %s", req.PersonaID, req.GrupoID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
