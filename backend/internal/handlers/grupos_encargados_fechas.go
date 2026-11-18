/**
 * ARCHIVO: grupos_encargados_fechas.go
 * UBICACIÓN: backend/internal/handlers/grupos_encargados_fechas.go
 * DESCRIPCIÓN: Tramo A7.2. Modificar la fecha de una fila ya cargada del
 * historial de encargados de grupo. Solo coordinador, secretario, servicio o
 * superadmin.
 *
 *  - POST /api/personas/grupos/encargados/fechas -> { id, fecha_inicio?, fecha_fin? }
 *      id = id de la fila de core_grupos_encargados_historial.
 *      Fechas AAAA-MM-DD; al menos una. La situación 3 se mueve sola.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func ModificarFechasEncargadoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "modificar-fechas-encargado")
		if !ok {
			return
		}
		var req struct {
			ID          int64   `json:"id"`
			FechaInicio *string `json:"fecha_inicio"`
			FechaFin    *string `json:"fecha_fin"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.ModificarFechasEncargado(a, esSuper, req.ID, req.FechaInicio, req.FechaFin); err != nil {
			responderErrorPersonas(w, err, "modificar-fechas-encargado", a.PersonaID)
			return
		}
		log.Printf("🕒 fechas de la fila %d del historial de encargados modificadas por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}