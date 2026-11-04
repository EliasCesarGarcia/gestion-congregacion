/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/handlers/personas_rol.go
 * DESCRIPCIÓN: POST /api/admin/personas/rol -> { persona_id, rol_app }.
 * Solo superadmin (la ruta va dentro de SuperAdminMiddleware, en routes.go).
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
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CambiarRolPersona(a, req.PersonaID, req.RolApp); err != nil {
			responderErrorPersonas(w, err, "cambiar-rol", a.PersonaID)
			return
		}
		log.Printf("🛡️ rol de persona %d cambiado a '%s' por persona %s", req.PersonaID, req.RolApp, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

// RotarRolesPersonasHandler: POST /api/personas/roles/rotar
// -> { "cambios": [ { "persona_id": 12, "rol_app": "coordinador" }, ... ] }
// Solo coordinador, secretario o servicio, dentro de su congregación.
// El superadmin usa /api/admin/personas/rol.
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
		var req struct {
			Cambios []models.CambioRol `json:"cambios"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.RotarRolesPersonas(a, req.Cambios); err != nil {
			responderErrorPersonas(w, err, "rotar-roles", a.PersonaID)
			return
		}
		log.Printf("🛡️ rotación de roles (%d personas) hecha por persona %s", len(req.Cambios), a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}