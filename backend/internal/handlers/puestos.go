/**
 * ARCHIVO: puestos.go
 * UBICACIÓN: backend/internal/handlers/puestos.go
 * DESCRIPCIÓN: Rutas de los puestos de cada departamento y su historial.
 * Solo coordinador, secretario, servicio o superadmin (lo hace cumplir el
 * backend en cada handler).
 *
 *  - GET  /api/modulos/asignaciones  -> puestos ocupados hoy.
 *  - POST /api/modulos/asignar       -> { persona_id, modulo_id, puesto, detalles? }
 *  - GET  /api/modulos/historial     -> ?modulo_id=&persona_id=&page=&limit=
 */

package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"gestion-congregacion/backend/internal/service"
)

// ListAsignacionesHandler devuelve quién ocupa cada puesto en mi congregación.
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
			responderErrorModulos(w, err, "listar-asignaciones", a.PersonaID)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"asignaciones": lista})
	}
}

// AsignarPuestoHandler asigna un puesto. El nivel de acceso lo decide el
// servidor según el puesto; "detalles" es opcional (máximo 100 palabras).
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
			Detalles  string `json:"detalles"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}

		if err := s.AsignarPuesto(a, esSuper, req.PersonaID, req.ModuloID, req.Puesto, req.Detalles); err != nil {
			responderErrorModulos(w, err, "asignar-puesto", a.PersonaID)
			return
		}
		// El texto de "detalles" no se escribe en el log.
		log.Printf("🔑 puesto '%s' en '%s' asignado a persona %d por persona %s", req.Puesto, req.ModuloID, req.PersonaID, a.PersonaID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// ListHistorialPuestosHandler devuelve el historial de puestos de mi
// congregación, paginado. Filtros opcionales: modulo_id y persona_id.
func ListHistorialPuestosHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		if !EsSuperAdmin(a.PersonaID) && !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ historial-puestos RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}

		q := r.URL.Query()

		personaID := 0
		if v := strings.TrimSpace(q.Get("persona_id")); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n <= 0 {
				http.Error(w, "persona_id no válido", http.StatusBadRequest)
				return
			}
			personaID = n
		}
		page, _ := strconv.Atoi(q.Get("page"))
		limit, _ := strconv.Atoi(q.Get("limit"))

		res, err := s.ListHistorialPuestos(a, q.Get("modulo_id"), personaID, page, limit)
		if err != nil {
			responderErrorModulos(w, err, "historial-puestos", a.PersonaID)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(res)
	}
}
