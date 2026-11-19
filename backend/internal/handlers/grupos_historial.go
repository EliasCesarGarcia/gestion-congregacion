/**
 * ARCHIVO: grupos_historial.go
 * UBICACIÓN: backend/internal/handlers/grupos_historial.go
 * DESCRIPCIÓN: Historial de un grupo de servicio. Solo coordinador,
 * secretario, servicio o superadmin; un encargado solo ve grupos de SU
 * congregación (otra congregación responde 404).
 *
 *  - GET /api/personas/grupos/historial?id=<id del grupo>
 *         -> { grupo: { id, numero, activo, fecha_inicio, fecha_cierre },
 *              miembros: [{ id, persona_id, apellido, nombre, fecha_inicio, fecha_fin,
 *                           vigente, motivo_entrada, detalles_entrada, motivo_salida,
 *                           detalles_salida, asignado_por, quitado_por }],
 *              encargados: [{ id, persona_id, apellido, nombre, cargo, fecha_inicio,
 *                             fecha_fin, vigente, excepcion, detalles, asignado_por,
 *                             quitado_por }] }
 *         Cada lista va con la fila vigente primero y después de la más nueva a la
 *         más antigua.
 */

package handlers

import (
	"net/http"
	"strconv"

	"gestion-congregacion/backend/internal/service"
)

func HistorialGrupoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "historial-grupo")
		if !ok {
			return
		}
		id, err := strconv.Atoi(r.URL.Query().Get("id"))
		if err != nil {
			http.Error(w, "el id del grupo no es válido", http.StatusBadRequest)
			return
		}
		res, err := s.HistorialGrupo(a, esSuper, id)
		if err != nil {
			responderErrorPersonas(w, err, "historial-grupo", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}