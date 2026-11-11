/**
 * ARCHIVO: personas_situaciones_fechas.go
 * UBICACIÓN: backend/internal/handlers/personas_situaciones_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.3. Modificar la fecha de una fila ya cargada
 * del historial de situaciones. Solo coordinador, secretario, servicio o superadmin.
 *
 *  - POST /api/personas/situaciones/fechas -> { id, fecha_inicio?, fecha_fin? }
 *      id = id de la fila (lo devuelve GET /api/personas/historial, en "situaciones").
 *      Fechas AAAA-MM-DD; al menos una. Una fila de otra congregación da 404.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func ModificarFechasSituacionHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "modificar-fechas-situacion")
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
		if err := s.ModificarFechasSituacion(a, esSuper, req.ID, req.FechaInicio, req.FechaFin); err != nil {
			responderErrorPersonas(w, err, "modificar-fechas-situacion", a.PersonaID)
			return
		}
		log.Printf("🕒 fechas de la fila %d del historial de situaciones modificadas por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
