/**
 * ARCHIVO: grupos_mover.go
 * UBICACIÓN: backend/internal/handlers/grupos_mover.go
 * DESCRIPCIÓN: Rutas para mover personas de grupo. Solo coordinador,
 * secretario, servicio o superadmin, y solo personas de su congregación.
 *
 *  - POST /api/personas/grupos/mover -> { persona_id, grupo_id (0 = sin grupo), fecha,
 *                                         motivo_id?, detalles? }
 *      motivo_id: motivo activo del uso personas.grupo (0 o ausente = sin motivo).
 *      Un superintendente o auxiliar no se mueve (409): primero se lo reemplaza.
 *
 *  - POST /api/personas/grupos/mover-varios -> { persona_ids: [..], grupo_id (0 = sin grupo),
 *                                                fecha, motivo_id?, detalles? }
 *      Varias personas con una sola fecha, motivo y detalle, todo o nada: si
 *      una falla no se mueve ninguna y el mensaje dice a quién le pasó.
 *      Responde { status, movidas, sin_cambio } (sin_cambio = las que ya
 *      estaban en ese destino). Hasta 100 personas, todas de una congregación.
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

func MoverGrupoPersonasHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "mover-grupo-varios")
		if !ok {
			return
		}
		var req struct {
			PersonaIDs []int  `json:"persona_ids"`
			GrupoID    int    `json:"grupo_id"`
			Fecha      string `json:"fecha"`
			MotivoID   int64  `json:"motivo_id"`
			Detalles   string `json:"detalles"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		movidas, sinCambio, err := s.MoverPersonasDeGrupo(a, esSuper, req.PersonaIDs, req.GrupoID, req.Fecha, req.Detalles, req.MotivoID)
		if err != nil {
			responderErrorPersonas(w, err, "mover-grupo-varios", a.PersonaID)
			return
		}
		log.Printf("👥 %d personas movidas al grupo %d (%d ya estaban) por persona %s", movidas, req.GrupoID, sinCambio, a.PersonaID)
		responderJSONPersonas(w, map[string]interface{}{
			"status":     "ok",
			"movidas":    movidas,
			"sin_cambio": sinCambio,
		})
	}
}
