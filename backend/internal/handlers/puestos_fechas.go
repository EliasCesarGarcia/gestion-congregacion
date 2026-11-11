/**
 * ARCHIVO: puestos_fechas.go
 * UBICACIÓN: backend/internal/handlers/puestos_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.1. Modificar la fecha de una fila ya cargada
 * del historial de puestos. Solo coordinador, secretario, servicio o superadmin.
 *
 *  - POST /api/modulos/historial/fechas -> { id, fecha_inicio?, fecha_fin? }
 *      id = id de la fila (lo devuelve GET /api/modulos/historial).
 *      Fechas AAAA-MM-DD; al menos una. Una fila de otra congregación da 404.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func ModificarFechasPuestoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "modificar-fechas-puesto")
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
		if err := s.ModificarFechasPuesto(a, esSuper, req.ID, req.FechaInicio, req.FechaFin); err != nil {
			responderErrorPersonas(w, err, "modificar-fechas-puesto", a.PersonaID)
			return
		}
		log.Printf("🕒 fechas de la fila %d del historial de puestos modificadas por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
