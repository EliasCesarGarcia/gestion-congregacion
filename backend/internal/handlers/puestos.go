/**
 * ARCHIVO: puestos.go
 * UBICACIÓN: backend/internal/handlers/puestos.go
 * DESCRIPCIÓN: Rutas de los puestos de cada departamento y su historial.
 * Solo coordinador, secretario, servicio o superadmin (lo hace cumplir el
 * backend en cada handler).
 *
 *  - GET  /api/modulos/asignaciones  -> puestos ocupados hoy.
 *  - POST /api/modulos/asignar       -> { persona_id, modulo_id, puesto, motivo_id?, detalles? }
 *  - POST /api/modulos/quitar        -> { persona_id, modulo_id, motivo_id?, detalles? }
 *  - GET  /api/modulos/historial     -> ?modulo_id=&persona_id=&page=&limit=
 *
 * motivo_id es el id de un motivo ACTIVO del tipo correcto (ver motivos.go);
 * 0 o ausente = sin motivo.
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
// servidor según el puesto; "motivo_id" y "detalles" son opcionales.
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
			MotivoID  int64  `json:"motivo_id"`
			Detalles  string `json:"detalles"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}

		if err := s.AsignarPuesto(a, esSuper, req.PersonaID, req.ModuloID, req.Puesto, req.Detalles, req.MotivoID); err != nil {
			responderErrorModulos(w, err, "asignar-puesto", a.PersonaID)
			return
		}
		// El texto de "detalles" no se escribe en el log.
		log.Printf("🔑 puesto '%s' en '%s' asignado a persona %d por persona %s", req.Puesto, req.ModuloID, req.PersonaID, a.PersonaID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// QuitarPuestoHandler quita el puesto de una persona en un departamento y
// cierra su fila del historial. "motivo_id" y "detalles" son opcionales.
func QuitarPuestoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		esSuper := EsSuperAdmin(a.PersonaID)
		if !esSuper && !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ quitar-puesto RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}

		var req struct {
			PersonaID int    `json:"persona_id"`
			ModuloID  string `json:"modulo_id"`
			MotivoID  int64  `json:"motivo_id"`
			Detalles  string `json:"detalles"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}

		if err := s.QuitarPuesto(a, esSuper, req.PersonaID, req.ModuloID, req.Detalles, req.MotivoID); err != nil {
			responderErrorModulos(w, err, "quitar-puesto", a.PersonaID)
			return
		}
		log.Printf("🔑 puesto en '%s' quitado a persona %d por persona %s", req.ModuloID, req.PersonaID, a.PersonaID)
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
