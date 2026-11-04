/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/service/personas_rol.go
 * DESCRIPCIÓN: Cambio del rol de la aplicación (coordinador, secretario,
 * servicio). Solo el superadmin: la ruta va dentro de SuperAdminMiddleware.
 */

package service

import (
	"errors"
	"fmt"
	"strings"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// ErrPersonaRolOcupado: la congregación ya tiene a alguien con ese rol (409).
var ErrPersonaRolOcupado = errors.New("la congregación ya tiene una persona con ese rol: quíteselo antes")

// rolesApp: valores válidos de core_personas.rol_app.
var rolesApp = []string{"publicador", "secretario", "coordinador", "servicio"}

// CambiarRolPersona: el actor es superadmin (lo comprobó la ruta). Nadie
// cambia su propio rol. Asignar un rol exige persona en ALTA; quitarlo
// (publicador) se puede siempre.
func (s *Service) CambiarRolPersona(a *models.Actor, personaID int, rol string) error {
	if personaID <= 0 {
		return ErrPersonaIDInvalid
	}
	rol = strings.ToLower(strings.TrimSpace(rol))
	valido := false
	for _, r := range rolesApp {
		if rol == r {
			valido = true
		}
	}
	if !valido {
		return errDatosPersona("el rol debe ser publicador, secretario, coordinador o servicio")
	}
	if fmt.Sprintf("%d", personaID) == a.PersonaID {
		return errDatosPersona("no puede cambiar su propio rol")
	}

	if _, err := s.fichaParaEscribir(a, true, personaID, rol != "publicador"); err != nil {
		return err
	}

	cambio, err := s.repo.CambiarRolPersona(personaID, rol, a.PersonaID)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrRolOcupado):
			return ErrPersonaRolOcupado
		case errors.Is(err, repository.ErrPersonaInexistente):
			return ErrPersonaNoValida
		}
		return err
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}

// RotarRolesPersonas: un encargado (coordinador, secretario o servicio) rota los
// tres roles dentro de SU congregación. cambios = rol final de cada persona
// involucrada (2 a 6 personas, sin repetir persona ni rol de encargado).
func (s *Service) RotarRolesPersonas(a *models.Actor, cambios []models.CambioRol) error {
	if a.CongregacionID == "" {
		return ErrSinCongregacion
	}
	if len(cambios) < 2 || len(cambios) > 6 {
		return errDatosPersona("una rotación involucra de 2 a 6 personas")
	}

	vistasPersona := map[int]bool{}
	vistosRol := map[string]bool{}
	limpios := make([]models.CambioRol, 0, len(cambios))
	for _, c := range cambios {
		if c.PersonaID <= 0 {
			return ErrPersonaIDInvalid
		}
		rol := strings.ToLower(strings.TrimSpace(c.RolApp))
		valido := false
		for _, r := range rolesApp {
			if rol == r {
				valido = true
			}
		}
		if !valido {
			return errDatosPersona("el rol debe ser publicador, secretario, coordinador o servicio")
		}
		if vistasPersona[c.PersonaID] {
			return errDatosPersona("una persona no puede aparecer dos veces")
		}
		vistasPersona[c.PersonaID] = true
		if rol != "publicador" {
			if vistosRol[rol] {
				return errDatosPersona("el rol '%s' no puede asignarse a dos personas", rol)
			}
			vistosRol[rol] = true
		}
		limpios = append(limpios, models.CambioRol{PersonaID: c.PersonaID, RolApp: rol})
	}

	hecho, err := s.repo.RotarRolesPersonas(a.CongregacionID, limpios, a.PersonaID)
	if err != nil {
		switch {
		case errors.Is(err, repository.ErrPersonaInexistente):
			return ErrPersonaNoValida
		case errors.Is(err, repository.ErrRolNoElegible):
			return errDatosPersona("todas las personas deben estar en alta y, para un rol de encargado, ser Anciano")
		case errors.Is(err, repository.ErrRolesIncompletos):
			return errDatosPersona("después del cambio, coordinador, secretario y servicio deben quedar cada uno con una sola persona en alta")
		case errors.Is(err, repository.ErrRolOcupado):
			return ErrPersonaRolOcupado
		}
		return err
	}
	if !hecho {
		return ErrPersonaSinCambio
	}
	return nil
}