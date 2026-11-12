/**
 * ARCHIVO: personas_estado_fechas.go
 * UBICACIÓN: backend/internal/handlers/personas_estado_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.4. Modificar la fecha de alta y/o de baja de
 * una fila ya cargada del historial de estado. Solo coordinador, secretario,
 * servicio o superadmin.
 *
 *  - POST /api/personas/estado/fechas -> { id, fecha_alta?, fecha_baja? }
 *      id = id de la fila (lo devuelve GET /api/personas/historial, en "estado").
 *      Fechas AAAA-MM-DD; al menos una. Una fila de otra congregación da 404.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func ModificarFechasEstadoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "modificar-fechas-estado")
		if !ok {
			return
		}
		var req struct {
			ID        int64   `json:"id"`
			FechaAlta *string `json:"fecha_alta"`
			FechaBaja *string `json:"fecha_baja"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.ModificarFechasEstado(a, esSuper, req.ID, req.FechaAlta, req.FechaBaja); err != nil {
			responderErrorPersonas(w, err, "modificar-fechas-estado", a.PersonaID)
			return
		}
		log.Printf("🕒 fechas de la fila %d del historial de estado modificadas por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}