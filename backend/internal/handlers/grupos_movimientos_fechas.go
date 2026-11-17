/**
 * ARCHIVO: grupos_movimientos_fechas.go
 * UBICACIÓN: backend/internal/handlers/grupos_movimientos_fechas.go
 * DESCRIPCIÓN: Tramo A7.1. Modificar la fecha de una fila ya cargada del
 * historial de pertenencia a grupos. Solo coordinador, secretario, servicio o
 * superadmin.
 *
 *  - POST /api/personas/grupos/movimientos/fechas -> { id, fecha_inicio?, fecha_fin? }
 *      id = id de la fila de core_grupos_movimientos.
 *      Fechas AAAA-MM-DD; al menos una. Una fila de otra congregación da 404.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func ModificarFechasMovimientoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "modificar-fechas-movimiento")
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
		if err := s.ModificarFechasMovimiento(a, esSuper, req.ID, req.FechaInicio, req.FechaFin); err != nil {
			responderErrorPersonas(w, err, "modificar-fechas-movimiento", a.PersonaID)
			return
		}
		log.Printf("🕒 fechas de la fila %d del historial de grupos modificadas por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}