/**
 * ARCHIVO: cargos_periodo_anterior.go
 * UBICACIÓN: backend/internal/handlers/cargos_periodo_anterior.go
 * DESCRIPCIÓN: Ruta para cargar un período PASADO y cerrado de un cargo de la
 * congregación. SOLO superadmin: la ruta va dentro de SuperAdminMiddleware.
 *
 *  - POST /api/admin/cargos/periodo-anterior
 *      -> { congregacion_id, rol ("coordinador" | "secretario" | "servicio"),
 *           persona_id, fecha_inicio (AAAA-MM-DD), fecha_fin (AAAA-MM-DD),
 *           motivo_alta_id (uso cargo_alta), detalles_alta?,
 *           motivo_baja_id (uso cargo_baja), detalles_baja? }
 *      -> { status: "ok" }
 *      Las fechas no pueden ser futuras y el inicio no puede ser posterior al
 *      fin. La persona debe ser de la congregación, estar en ALTA y ser Anciano
 *      hoy. El período debe caer dentro de un período de alta de la persona y no
 *      superponerse con otro período de ese cargo. No cambia los titulares
 *      actuales. Errores de datos: 400 (texto plano); congregación inexistente: 404.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/service"
)

func PeriodoAnteriorCargoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		var req models.PeriodoAnteriorCargo
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CargarPeriodoAnteriorCargo(a, req); err != nil {
			responderErrorCargos(w, err, "periodo-anterior-cargo", a.PersonaID)
			return
		}
		log.Printf("📜 período anterior de %s cargado en la congregación %s (persona %d) por persona %s", req.Rol, req.CongregacionID, req.PersonaID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
