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

	cambio, err := s.repo.CambiarRolPersona(personaID, rol)
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