/**
 * ARCHIVO: motivos.go
 * UBICACIÓN: backend/internal/handlers/motivos.go
 * DESCRIPCIÓN: Rutas del catálogo de motivos de puestos.
 *
 *  - GET  /api/modulos/motivos?tipo=     -> motivos ACTIVOS para el desplegable
 *                                           (coordinador, secretario, servicio o superadmin).
 *  - GET  /api/admin/motivos?tipo=       -> todos, también los desactivados (solo superadmin).
 *  - POST /api/admin/motivos/crear       -> { tipo, texto, orden? } (solo superadmin).
 *  - POST /api/admin/motivos/editar      -> { id, texto?, orden?, activo? } (solo superadmin).
 *    "Eliminar" = editar con activo=false: nunca se borra un motivo.
 *
 * Las rutas /api/admin/* van dentro de SuperAdminMiddleware (routes.go).
 */

package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

// ListMotivosHandler: motivos activos para elegir al asignar o quitar.
func ListMotivosHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		if !EsSuperAdmin(a.PersonaID) && !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ motivos RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}

		lista, err := s.ListMotivos(r.URL.Query().Get("tipo"), true)
		if err != nil {
			responderErrorModulos(w, err, "listar-motivos", a.PersonaID)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"motivos": lista})
	}
}

// ListMotivosAdminHandler: todos los motivos (activos e inactivos).
func ListMotivosAdminHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lista, err := s.ListMotivos(r.URL.Query().Get("tipo"), false)
		if err != nil {
			responderErrorModulos(w, err, "listar-motivos-admin", PersonaIDFromContext(r))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"motivos": lista})
	}
}

// CrearMotivoHandler: crea un motivo activo.
func CrearMotivoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Tipo  string `json:"tipo"`
			Texto string `json:"texto"`
			Orden int    `json:"orden"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		m, err := s.CrearMotivo(req.Tipo, req.Texto, req.Orden)
		if err != nil {
			responderErrorModulos(w, err, "crear-motivo", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏷️ motivo %d (%s) creado por persona %s", m.ID, m.Tipo, PersonaIDFromContext(r))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(m)
	}
}

// EditarMotivoHandler: cambia texto, orden o activo. Solo los campos enviados.
func EditarMotivoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID     int64   `json:"id"`
			Texto  *string `json:"texto"`
			Orden  *int    `json:"orden"`
			Activo *bool   `json:"activo"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		m, err := s.EditarMotivo(req.ID, req.Texto, req.Orden, req.Activo)
		if err != nil {
			responderErrorModulos(w, err, "editar-motivo", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏷️ motivo %d editado por persona %s", m.ID, PersonaIDFromContext(r))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(m)
	}
}
