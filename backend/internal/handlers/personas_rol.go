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