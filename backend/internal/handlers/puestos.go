/**
 * ARCHIVO: puestos.go
 * UBICACIÓN: backend/internal/handlers/puestos.go
 * DESCRIPCIÓN: Rutas de los puestos de cada departamento (encargado,
 * auxiliar, segundo auxiliar). Solo coordinador, secretario, servicio o
 * superadmin.
 */

package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

// ListAsignacionesHandler: quién ocupa cada puesto en mi congregación.
func ListAsignacionesHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		if !EsSuperAdmin(a.PersonaID) && !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ asignaciones RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}

		lista, err := s.ListAsignaciones(a)
		if err != nil {
			log.Printf("❌ listar asignaciones (persona %s): %v", a.PersonaID, err)
			http.Error(w, "No se pudo obtener la lista", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(map[string]interface{}{"asignaciones": lista})
	}
}

// AsignarPuestoHandler: body {"persona_id", "modulo_id", "puesto"}.
// El nivel de acceso NO viene del cliente: lo decide el servidor según el puesto.
func AsignarPuestoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		esSuper := EsSuperAdmin(a.PersonaID)
		if !esSuper && !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ asignar-puesto RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}

		var req struct {
			PersonaID int    `json:"persona_id"`
			ModuloID  string `json:"modulo_id"`
			Puesto    string `json:"puesto"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}

		if err := s.AsignarPuesto(a, esSuper, req.PersonaID, req.ModuloID, req.Puesto); err != nil {
			responderErrorModulos(w, err, "asignar-puesto", a.PersonaID)
			return
		}
		log.Printf("🔑 puesto '%s' en '%s' asignado a persona %d por persona %s", req.Puesto, req.ModuloID, req.PersonaID, a.PersonaID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
