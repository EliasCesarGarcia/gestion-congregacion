/**
 * ARCHIVO: personas.go
 * UBICACIÓN: backend/internal/handlers/personas.go
 * DESCRIPCIÓN: Rutas de lectura del módulo de personas.
 *
 *  Coordinador, secretario, servicio o superadmin (el backend lo exige acá):
 *  - GET /api/personas/buscar?q=&estado=&condicion=&situacion_1=&situacion_2=
 *        &situacion_3=&grupo=&congregacion_id=&page=&limit=
 *        (congregacion_id solo lo respeta el superadmin)
 *  - GET /api/personas/conteos?congregacion_id=
 *  - GET /api/personas/ficha?id=
 *  - GET /api/personas/historial?id=
 *
 *  Cualquier persona con sesión (solo ve lo suyo, el id sale de la sesión):
 *  - GET /api/me/ficha
 *  - GET /api/me/historial
 */

package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/service"
)

// responderErrorPersonas: agrega el filtro inválido (400) y deja el resto al
// traductor común de errores.
func responderErrorPersonas(w http.ResponseWriter, err error, accion, personaID string) {
	switch {
	case errors.Is(err, service.ErrPersonaFiltro),
		errors.Is(err, service.ErrPersonaDatos):
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	case errors.Is(err, service.ErrPersonaSinCambio),
		errors.Is(err, service.ErrPersonaRolOcupado),
		errors.Is(err, service.ErrPersonaTitularRol):
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}
	responderErrorModulos(w, err, accion, personaID)
}

// actorEncargadoPersonas: quién pide y si puede ver a otras personas.
func actorEncargadoPersonas(w http.ResponseWriter, r *http.Request, accion string) (*models.Actor, bool, bool) {
	a := ActorFromContext(r)
	if a == nil {
		http.Error(w, "Sesión no válida", http.StatusUnauthorized)
		return nil, false, false
	}
	esSuper := EsSuperAdmin(a.PersonaID)
	if !esSuper && !esEncargadoGeneral(a.RolApp) {
		log.Printf("⚠️ %s RECHAZADO: persona '%s' con rol '%s'", accion, a.PersonaID, a.RolApp)
		http.Error(w, "No autorizado", http.StatusForbidden)
		return nil, false, false
	}
	return a, esSuper, true
}

// responderJSONPersonas: datos personales, así que nada se guarda en caché.
func responderJSONPersonas(w http.ResponseWriter, datos interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(datos)
}

func BuscarPersonasHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "buscar-personas")
		if !ok {
			return
		}
		q := r.URL.Query()
		res, err := s.BuscarPersonas(a, esSuper, models.FiltroPersonas{
			CongregacionID: q.Get("congregacion_id"),
			Q:              q.Get("q"),
			Estado:         q.Get("estado"),
			Condicion:      q.Get("condicion"),
			Situacion1:     q.Get("situacion_1"),
			Situacion2:     q.Get("situacion_2"),
			Situacion3:     q.Get("situacion_3"),
			Grupo:          q.Get("grupo"),
			RolApp:         q.Get("rol_app"),
		}, enteroDeQuery(r, "page"), enteroDeQuery(r, "limit"))
		if err != nil {
			responderErrorPersonas(w, err, "buscar-personas", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}

func ConteosPersonasHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "conteos-personas")
		if !ok {
			return
		}
		res, err := s.ConteosPersonas(a, esSuper, r.URL.Query().Get("congregacion_id"))
		if err != nil {
			responderErrorPersonas(w, err, "conteos-personas", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}

func FichaPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "ficha-persona")
		if !ok {
			return
		}
		res, err := s.FichaPersona(a, esSuper, enteroDeQuery(r, "id"))
		if err != nil {
			responderErrorPersonas(w, err, "ficha-persona", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}

func HistorialPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "historial-persona")
		if !ok {
			return
		}
		res, err := s.HistorialPersona(a, esSuper, enteroDeQuery(r, "id"))
		if err != nil {
			responderErrorPersonas(w, err, "historial-persona", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}

// MiFichaHandler: la persona ve sus propios datos.
func MiFichaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		res, err := s.MiFicha(a)
		if err != nil {
			responderErrorPersonas(w, err, "mi-ficha", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}

// MiHistorialHandler: la persona ve sus propios historiales.
func MiHistorialHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		res, err := s.MiHistorial(a)
		if err != nil {
			responderErrorPersonas(w, err, "mi-historial", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}
