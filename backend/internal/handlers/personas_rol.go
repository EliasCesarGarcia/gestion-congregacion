/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/handlers/personas_rol.go
 * DESCRIPCIÓN: Roles de la aplicación.
 *
 *  - POST /api/admin/personas/rol -> { persona_id, rol_app, accion? }
 *      Solo superadmin (la ruta va dentro de SuperAdminMiddleware).
 *      accion "asignar" (por defecto) o "quitar". rol_app "publicador" quita todos.
 *  - POST /api/personas/roles/rotar -> { coordinador?, secretario?, servicio?, fecha? }
 *      fecha (AAAA-MM-DD) opcional: por defecto hoy; puede ser pasada, nunca futura.
 *      Cada valor es el id del NUEVO titular de ese rol. Solo coordinador,
 *      secretario o servicio, y solo dentro de su congregación.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/service"
)

func CambiarRolPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		var req struct {
			PersonaID int    `json:"persona_id"`
			RolApp    string `json:"rol_app"`
			Accion    string `json:"accion"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if req.Accion != "" && req.Accion != "asignar" && req.Accion != "quitar" {
			http.Error(w, "accion debe ser asignar o quitar", http.StatusBadRequest)
			return
		}
		if err := s.CambiarRolPersona(a, req.PersonaID, req.RolApp, req.Accion == "quitar"); err != nil {
			responderErrorPersonas(w, err, "cambiar-rol", a.PersonaID)
			return
		}
		log.Printf("🛡️ rol '%s' (%s) de persona %d cambiado por persona %s", req.RolApp, req.Accion, req.PersonaID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

func RotarRolesPersonasHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		if !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ rotar-roles RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}
		var req models.RotacionRoles
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.RotarRolesPersonas(a, req); err != nil {
			responderErrorPersonas(w, err, "rotar-roles", a.PersonaID)
			return
		}
		log.Printf("🛡️ rotación de roles hecha por persona %s", a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
