/**
 * ARCHIVO: personas_escritura.go
 * UBICACIÓN: backend/internal/handlers/personas_escritura.go
 * DESCRIPCIÓN: Rutas de escritura del módulo de personas (tramo 2B).
 * Solo coordinador, secretario, servicio o superadmin (el backend lo exige acá).
 *
 *  - POST /api/personas/crear     -> { congregacion_id? (solo superadmin), apellido, nombre,
 *                                      fecha_alta, situacion_1?, situacion_2?, situacion_3?,
 *                                      condicion?, grupo?, contacto?, detalles?, direccion?,
 *                                      codigo_postal?, pais?, provincia_estado?, ciudad?, partido? }
 *  - POST /api/personas/editar    -> { id, apellido, nombre, fecha_alta?, condicion?, grupo?,
 *                                      contacto?, detalles?, direccion?, ... } (formulario completo:
 *                                      lo que llega vacío queda sin dato)
 *  - POST /api/personas/situacion -> { id, campo (1, 2 o 3), valor ("" o "sin" quita la 2 y la 3), fecha }
 *
 * El rol (coordinador, secretario, servicio) NO se cambia por acá.
 */

package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"gestion-congregacion/backend/internal/service"
)

// leerJSONPersonas: como leerJSONAdmin, pero con un límite mayor (el formulario
// de una persona lleva dirección y detalles; 4 KB se quedaban cortos).
func leerJSONPersonas(w http.ResponseWriter, r *http.Request, destino interface{}) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "Content-Type debe ser application/json", http.StatusUnsupportedMediaType)
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 16384)
	if err := json.NewDecoder(r.Body).Decode(destino); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return false
	}
	return true
}

// CrearPersonaHandler: crea una persona en ALTA. Devuelve su id.
func CrearPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "crear-persona")
		if !ok {
			return
		}
		var req service.EntradaPersona
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		id, err := s.CrearPersona(a, esSuper, req)
		if err != nil {
			responderErrorPersonas(w, err, "crear-persona", a.PersonaID)
			return
		}
		// Los datos personales no se escriben en el log.
		log.Printf("👤 persona %d creada por persona %s", id, a.PersonaID)
		responderJSONPersonas(w, map[string]interface{}{"status": "ok", "id": id})
	}
}

// EditarPersonaHandler: reemplaza los datos editables de una persona.
func EditarPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "editar-persona")
		if !ok {
			return
		}
		var req struct {
			ID int `json:"id"`
			service.EntradaPersona
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.EditarPersona(a, esSuper, req.ID, req.EntradaPersona); err != nil {
			responderErrorPersonas(w, err, "editar-persona", a.PersonaID)
			return
		}
		log.Printf("👤 persona %d editada por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

// CambiarSituacionPersonaHandler: cambia (o quita) una situación con su fecha.
func CambiarSituacionPersonaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "cambiar-situacion")
		if !ok {
			return
		}
		var req struct {
			ID    int    `json:"id"`
			Campo int    `json:"campo"`
			Valor string `json:"valor"`
			Fecha string `json:"fecha"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.CambiarSituacionPersona(a, esSuper, req.ID, req.Campo, req.Valor, req.Fecha); err != nil {
			responderErrorPersonas(w, err, "cambiar-situacion", a.PersonaID)
			return
		}
		log.Printf("👤 situación %d de persona %d cambiada por persona %s", req.Campo, req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}