/**
 * ARCHIVO: grupos.go
 * UBICACIÓN: backend/internal/handlers/grupos.go
 * DESCRIPCIÓN: Rutas de gestión de los grupos de servicio. Solo coordinador,
 * secretario, servicio o superadmin (el backend lo exige acá). Un encargado
 * solo ve y gestiona los grupos de SU congregación.
 *
 *  - GET  /api/personas/grupos?congregacion_id=&cerrados=1
 *         -> { grupos: [{ id, congregacion_id, numero, activo, fecha_inicio, fecha_cierre,
 *                         miembros, activos, inactivos, superintendente, auxiliar }],
 *              sin_grupo }
 *         congregacion_id solo lo respeta el superadmin (vacío = todas).
 *         Sin "cerrados" solo vienen los grupos vigentes: es la lista que ofrecen
 *         los formularios.
 *  - POST /api/personas/grupos/crear  -> { congregacion_id? (solo superadmin), numero, fecha_inicio? }
 *  - POST /api/personas/grupos/editar -> { id, numero }   (cambia el número de un grupo activo)
 *  - POST /api/personas/grupos/cerrar -> { id, fecha }    (solo si no tiene gente)
 */

package handlers

import (
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/service"
)

func ListGruposHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "grupos")
		if !ok {
			return
		}
		q := r.URL.Query()
		cerrados := q.Get("cerrados") == "1" || q.Get("cerrados") == "true"
		res, err := s.ListGrupos(a, esSuper, q.Get("congregacion_id"), cerrados)
		if err != nil {
			responderErrorPersonas(w, err, "grupos", a.PersonaID)
			return
		}
		responderJSONPersonas(w, res)
	}
}

func CrearGrupoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "crear-grupo")
		if !ok {
			return
		}
		var req service.EntradaGrupo
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		id, err := s.CrearGrupo(a, esSuper, req)
		if err != nil {
			responderErrorPersonas(w, err, "crear-grupo", a.PersonaID)
			return
		}
		log.Printf("👥 grupo %d creado por persona %s", id, a.PersonaID)
		responderJSONPersonas(w, map[string]interface{}{"status": "ok", "id": id})
	}
}

func EditarGrupoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "editar-grupo")
		if !ok {
			return
		}
		var req struct {
			ID     int `json:"id"`
			Numero int `json:"numero"`
		}
		if !leerJSONPersonas(w, r, &req) {
			return
		}
		if err := s.EditarGrupo(a, esSuper, req.ID, req.Numero); err != nil {
			responderErrorPersonas(w, err, "editar-grupo", a.PersonaID)
			return
		}
		log.Printf("👥 grupo %d renumerado por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}

func CerrarGrupoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a, esSuper, ok := actorEncargadoPersonas(w, r, "cerrar-grupo")
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
		if err := s.CerrarGrupo(a, esSuper, req.ID, req.Fecha); err != nil {
			responderErrorPersonas(w, err, "cerrar-grupo", a.PersonaID)
			return
		}
		log.Printf("👥 grupo %d cerrado por persona %s", req.ID, a.PersonaID)
		responderJSONPersonas(w, map[string]string{"status": "ok"})
	}
}
