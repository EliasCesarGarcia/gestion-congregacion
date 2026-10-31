/**
 * ARCHIVO: congregaciones.go
 * UBICACIÓN: backend/internal/handlers/congregaciones.go
 * DESCRIPCIÓN: Rutas del panel de congregaciones. Todas van dentro de
 * SuperAdminMiddleware (routes.go): solo el superadmin.
 *
 *  - GET  /api/admin/congregaciones?q=&estado=&page=&limit=
 *         estado: todas | activas | deshabilitadas
 *  - POST /api/admin/congregaciones/crear   -> datos de la congregación (nace deshabilitada)
 *  - POST /api/admin/congregaciones/editar  -> { id, y los campos a cambiar }
 *  - POST /api/admin/congregaciones/estado  -> { id, activa } habilita o deshabilita
 *  - POST /api/admin/congregaciones/eliminar -> { id, numero_confirmacion } borrado físico
 *  - GET  /api/admin/congregaciones/historial?congregacion_id=&page=&limit=
 */

package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/service"
)

// actorIDCongregaciones: la persona (número) que hace el pedido, tomada del
// token firmado.
func actorIDCongregaciones(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(PersonaIDFromContext(r))
	if err != nil || id <= 0 {
		http.Error(w, "Sesión no válida", http.StatusUnauthorized)
		return 0, false
	}
	return id, true
}

func enteroDeQuery(r *http.Request, nombre string) int {
	n, err := strconv.Atoi(r.URL.Query().Get(nombre))
	if err != nil {
		return 0
	}
	return n
}

func ListCongregacionesAdminHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		pagina, err := s.ListCongregaciones(q.Get("q"), q.Get("estado"), enteroDeQuery(r, "page"), enteroDeQuery(r, "limit"))
		if err != nil {
			responderErrorModulos(w, err, "listar-congregaciones", PersonaIDFromContext(r))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pagina)
	}
}

func CrearCongregacionHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actorID, ok := actorIDCongregaciones(w, r)
		if !ok {
			return
		}
		var req struct {
			Nombre             string `json:"nombre"`
			Pais               string `json:"pais"`
			ProvinciaEstado    string `json:"provincia_estado"`
			Ciudad             string `json:"ciudad"`
			Region             string `json:"region"`
			Partido            string `json:"partido"`
			Direccion          string `json:"direccion"`
			NumeroCongregacion string `json:"numero_congregacion"`
			ZonaHoraria        string `json:"zona_horaria"`
			Circuito           string `json:"circuito"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		c, err := s.CrearCongregacion(models.DatosCongregacion{
			Nombre:          req.Nombre,
			Pais:            req.Pais,
			ProvinciaEstado: req.ProvinciaEstado,
			Ciudad:          req.Ciudad,
			Region:          req.Region,
			Partido:         req.Partido,
			Direccion:       req.Direccion,
			Numero:          req.NumeroCongregacion,
			ZonaHoraria:     req.ZonaHoraria,
			Circuito:        req.Circuito,
		}, actorID)
		if err != nil {
			responderErrorModulos(w, err, "crear-congregacion", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏛️ congregación %s creada por persona %d", c.ID, actorID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(c)
	}
}

func EditarCongregacionHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actorID, ok := actorIDCongregaciones(w, r)
		if !ok {
			return
		}
		var req struct {
			ID                 string  `json:"id"`
			Nombre             *string `json:"nombre"`
			Pais               *string `json:"pais"`
			ProvinciaEstado    *string `json:"provincia_estado"`
			Ciudad             *string `json:"ciudad"`
			Region             *string `json:"region"`
			Partido            *string `json:"partido"`
			Direccion          *string `json:"direccion"`
			NumeroCongregacion *string `json:"numero_congregacion"`
			ZonaHoraria        *string `json:"zona_horaria"`
			Circuito           *string `json:"circuito"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		c, err := s.EditarCongregacion(req.ID, models.CambiosCongregacion{
			Nombre:          req.Nombre,
			Pais:            req.Pais,
			ProvinciaEstado: req.ProvinciaEstado,
			Ciudad:          req.Ciudad,
			Region:          req.Region,
			Partido:         req.Partido,
			Direccion:       req.Direccion,
			Numero:          req.NumeroCongregacion,
			ZonaHoraria:     req.ZonaHoraria,
			Circuito:        req.Circuito,
		}, actorID)
		if err != nil {
			responderErrorModulos(w, err, "editar-congregacion", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏛️ congregación %s editada por persona %d", c.ID, actorID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(c)
	}
}

func EstadoCongregacionHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actorID, ok := actorIDCongregaciones(w, r)
		if !ok {
			return
		}
		var req struct {
			ID     string `json:"id"`
			Activa *bool  `json:"activa"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		if req.Activa == nil {
			responderErrorModulos(w, service.ErrCongregacionSinCambios, "estado-congregacion", PersonaIDFromContext(r))
			return
		}
		c, err := s.CambiarEstadoCongregacion(req.ID, *req.Activa, actorID)
		if err != nil {
			responderErrorModulos(w, err, "estado-congregacion", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏛️ congregación %s: activa=%t (persona %d)", c.ID, c.Activa, actorID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(c)
	}
}

func EliminarCongregacionHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		actorID, ok := actorIDCongregaciones(w, r)
		if !ok {
			return
		}
		var req struct {
			ID                 string `json:"id"`
			NumeroConfirmacion string `json:"numero_confirmacion"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		if err := s.EliminarCongregacion(req.ID, req.NumeroConfirmacion, actorID); err != nil {
			responderErrorModulos(w, err, "eliminar-congregacion", PersonaIDFromContext(r))
			return
		}
		log.Printf("🏛️ congregación %s ELIMINADA por persona %d", req.ID, actorID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func ListHistorialCongregacionesHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pagina, err := s.ListHistorialCongregaciones(
			r.URL.Query().Get("congregacion_id"), enteroDeQuery(r, "page"), enteroDeQuery(r, "limit"))
		if err != nil {
			responderErrorModulos(w, err, "historial-congregaciones", PersonaIDFromContext(r))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pagina)
	}
}
