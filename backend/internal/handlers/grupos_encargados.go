/**
 * ARCHIVO: grupos_encargados.go
 * UBICACIÓN: backend/internal/handlers/grupos_encargados.go
 * DESCRIPCIÓN: Ruta para elegir, reemplazar o quitar el superintendente y el
 * auxiliar de un grupo. Solo coordinador, secretario, servicio o superadmin, y
 * solo grupos de su congregación.
 *
 *  - POST /api/personas/grupos/encargados
 *      -> { grupo_id, cargo ("superintendente" | "auxiliar"), persona_id (0 = quitar),
 *           fecha, excepcion?, detalles? }
 *      Por defecto la persona debe ser miembro del grupo y tener situación 2 Anciano o
 *      Siervo Ministerial. excepcion=true (con el motivo en detalles) solo se admite si
 *      ningún miembro libre del grupo cumple el requisito.
 *      La situación 3 de las personas se actualiza sola, con la misma fecha.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func CambiarEncargadoGrupoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "encargado-grupo")
		if !ok {
			return
		}
		var req struct {
			GrupoID   int    `json:"grupo_id"`
			Cargo     string `json:"cargo"`
			PersonaID int    `json:"persona_id"`
			Fecha     string `json:"fecha"`
			Excepcion bool   `json:"excepcion"`
			Detalles  string `json:"detalles"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CambiarEncargadoGrupo(a, esSuper, req.GrupoID, req.Cargo, req.PersonaID, req.Fecha, req.Excepcion, req.Detalles); err != nil {
			responderErrorPersonas(w, err, "encargado-grupo", a.PersonaID)
			return
		}
		log.Printf("👥 %s del grupo %d cambiado (persona %d) por persona %s", req.Cargo, req.GrupoID, req.PersonaID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
