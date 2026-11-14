/**
 * ARCHIVO: motivos_catalogo.go
 * UBICACIÓN: backend/internal/handlers/motivos_catalogo.go
 * DESCRIPCIÓN: Rutas del catálogo único de motivos.
 *
 *  Coordinador, secretario, servicio o superadmin:
 *  - GET  /api/personas/motivos?uso=alta|baja|grupo -> { motivos: [{ id, nombre, orden }] }
 *         (solo los ACTIVOS de ese uso, para el desplegable)
 *
 *  Solo superadmin (las rutas van dentro de SuperAdminMiddleware):
 *  - GET  /api/admin/catalogo-motivos        -> { motivos: [{ id, nombre, usos: [{ uso, activo, orden }] }] }
 *  - POST /api/admin/catalogo-motivos/crear  -> { nombre, usos: [{ uso, orden? }] }
 *         Si el nombre ya existe, le suma los usos (si alguno ya estaba: 409).
 *  - POST /api/admin/catalogo-motivos/editar -> { id, nombre }
 *  - POST /api/admin/catalogo-motivos/uso    -> { motivo_id, uso, orden?, activo? }
 *         Agrega el uso, o cambia su orden o su estado. "Eliminar" = activo=false:
 *         nunca se borra un motivo.
 *  Los códigos de uso son "modulo.operacion": personas.alta, personas.baja, personas.grupo.
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

// ListMotivosPersonasHandler: motivos activos de un uso para elegir en pantalla.
func ListMotivosPersonasHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, _, ok := actorEncargadoPersonas(w, r, "motivos-personas")
		if !ok {
			return
		}
		lista, err := s.ListOpcionesMotivoPersonas(r.URL.Query().Get("uso"))
		if err != nil {
			responderErrorPersonas(w, err, "motivos-personas", a.PersonaID)
			return
		}
		responderJSONPersonas(w, map[string]interface{}{"motivos": lista})
	}
}

// ListCatalogoMotivosAdminHandler: todo el catálogo, también los usos desactivados.
func ListCatalogoMotivosAdminHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lista, err := s.ListCatalogoMotivos()
		if err != nil {
			responderErrorPersonas(w, err, "catalogo-motivos", PersonaIDFromContext(r))
			return
		}
		responderJSONPersonas(w, map[string]interface{}{"motivos": lista})
	}
}

func CrearCatalogoMotivoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Nombre string                     `json:"nombre"`
			Usos   []service.EntradaUsoMotivo `json:"usos"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		m, err := s.CrearMotivoCatalogo(req.Nombre, req.Usos)
		if err != nil {
			responderErrorPersonas(w, err, "crear-catalogo-motivo", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏷️ motivo %d del catálogo creado o ampliado por persona %s", m.ID, PersonaIDFromContext(r))
		responderJSONPersonas(w, m)
	}
}

func EditarCatalogoMotivoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID     int64  `json:"id"`
			Nombre string `json:"nombre"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		m, err := s.EditarMotivoCatalogo(req.ID, req.Nombre)
		if err != nil {
			responderErrorPersonas(w, err, "editar-catalogo-motivo", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏷️ motivo %d del catálogo renombrado por persona %s", m.ID, PersonaIDFromContext(r))
		responderJSONPersonas(w, m)
	}
}

func UsoCatalogoMotivoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			MotivoID int64  `json:"motivo_id"`
			Uso      string `json:"uso"`
			Orden    *int   `json:"orden"`
			Activo   *bool  `json:"activo"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		m, err := s.GuardarUsoMotivo(req.MotivoID, req.Uso, req.Orden, req.Activo)
		if err != nil {
			responderErrorPersonas(w, err, "uso-catalogo-motivo", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏷️ uso %s del motivo %d modificado por persona %s", req.Uso, m.ID, PersonaIDFromContext(r))
		responderJSONPersonas(w, m)
	}
}
