/**
 * ARCHIVO: personas_rol_fechas.go
 * UBICACIÓN: backend/internal/handlers/personas_rol_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.2. Modificar la fecha de una fila ya cargada
 * del historial de roles. Solo coordinador, secretario, servicio o superadmin.
 *
 *  - POST /api/personas/roles/fechas -> { id, fecha_inicio?, fecha_fin? }
 *      id = id de la fila (lo devuelve GET /api/personas/historial, en "roles").
 *      Fechas AAAA-MM-DD; al menos una. Una fila de otra congregación da 404.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func ModificarFechasRolHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "modificar-fechas-rol")
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
		if err := s.ModificarFechasRol(a, esSuper, req.ID, req.FechaInicio, req.FechaFin); err != nil {
			responderErrorPersonas(w, err, "modificar-fechas-rol", a.PersonaID)
			return
		}
		log.Printf("🕒 fechas de la fila %d del historial de roles modificadas por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
