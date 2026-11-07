/**
 * ARCHIVO: personas_baja.go
 * UBICACIÓN: backend/internal/handlers/personas_baja.go
 * DESCRIPCIÓN: Rutas de bajas, reactivación y motivos de baja.
 *
 *  Coordinador, secretario, servicio o superadmin:
 *  - POST /api/personas/baja            -> { id, fecha, motivo_id?, detalles? }
 *  - POST /api/personas/reactivar       -> { id, fecha }
 *  - GET  /api/personas/motivos-baja    -> motivos ACTIVOS para el desplegable
 *
 *  Solo superadmin (las rutas van dentro de SuperAdminMiddleware):
 *  - GET  /api/admin/personas/motivos-baja             -> todos, también los desactivados
 *  - POST /api/admin/personas/motivos-baja/crear       -> { nombre, orden? }
 *  - POST /api/admin/personas/motivos-baja/editar      -> { id, nombre?, orden?, activo? }
 *    "Eliminar" = editar con activo=false: nunca se borra un motivo.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func DarDeBajaPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "baja-persona")
		if !ok {
			return
		}
		var req struct {
			ID       int    `json:"id"`
			Fecha    string `json:"fecha"`
			MotivoID int64  `json:"motivo_id"`
			Detalles string `json:"detalles"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.DarDeBajaPersona(a, esSuper, req.ID, req.Fecha, req.Detalles, req.MotivoID); err != nil {
			responderErrorPersonas(w, err, "baja-persona", a.PersonaID)
			return
		}
		log.Printf("👤 persona %d dada de baja por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

func ReactivarPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "reactivar-persona")
		if !ok {
			return
		}
		var req struct {
			ID    int    `json:"id"`
			Fecha string `json:"fecha"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.ReactivarPersona(a, esSuper, req.ID, req.Fecha); err != nil {
			responderErrorPersonas(w, err, "reactivar-persona", a.PersonaID)
			return
		}
		log.Printf("👤 persona %d reactivada por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

// ListMotivosBajaHandler: motivos activos para elegir al dar de baja.
func ListMotivosBajaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, _, ok := actorEncargadoPersonas(w, r, "motivos-baja")
		if !ok {
			return
		}
		lista, err := s.ListMotivosBaja(true)
		if err != nil {
			responderErrorPersonas(w, err, "motivos-baja", a.PersonaID)
			return
		}
		responderJSONPersonas(w, map[string]interface{}{"motivos": lista})
	}
}

func ListMotivosBajaAdminHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lista, err := s.ListMotivosBaja(false)
		if err != nil {
			responderErrorPersonas(w, err, "motivos-baja-admin", PersonaIDFromContext(r))
			return
		}
		responderJSONPersonas(w, map[string]interface{}{"motivos": lista})
	}
}

func CrearMotivoBajaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Nombre string `json:"nombre"`
			Orden  int    `json:"orden"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		m, err := s.CrearMotivoBaja(req.Nombre, req.Orden)
		if err != nil {
			responderErrorPersonas(w, err, "crear-motivo-baja", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏷️ motivo de baja %d creado por persona %s", m.ID, PersonaIDFromContext(r))
		responderJSONPersonas(w, m)
	}
}

func EditarMotivoBajaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID     int64   `json:"id"`
			Nombre *string `json:"nombre"`
			Orden  *int    `json:"orden"`
			Activo *bool   `json:"activo"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		m, err := s.EditarMotivoBaja(req.ID, req.Nombre, req.Orden, req.Activo)
		if err != nil {
			responderErrorPersonas(w, err, "editar-motivo-baja", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏷️ motivo de baja %d editado por persona %s", m.ID, PersonaIDFromContext(r))
		responderJSONPersonas(w, m)
	}
}
