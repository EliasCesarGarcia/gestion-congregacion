/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/service/personas_rol.go
 * DESCRIPCIÓN: Roles de la aplicación (coordinador, secretario, servicio).
 *
 * REGLAS:
 *  - Solo un Anciano en ALTA puede tener uno de esos tres roles.
 *  - Un mismo anciano puede tener varios; nunca dos titulares del mismo rol.
 *  - Rotación (coordinador, secretario o servicio, solo en su congregación):
 *    se nombra al nuevo titular de cada rol que cambia, así nunca queda vacante.
 *  - Asignar o quitar libremente (incluso dejar un rol vacante): solo superadmin.
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

// rolesApp: valores válidos de rol (publicador = sin rol).
var rolesApp = []string{"publicador", "secretario", "coordinador", "servicio"}

func traducirErrorRol(err error) error {
	switch {
	case errors.Is(err, repository.ErrRolOcupado):
		return ErrPersonaRolOcupado
	case errors.Is(err, repository.ErrPersonaInexistente):
		return ErrPersonaNoValida
	case errors.Is(err, repository.ErrRolNoElegible):
		return errDatosPersona("las personas deben estar en alta y ser Anciano para un rol de encargado")
	case errors.Is(err, repository.ErrRolesIncompletos):
		return errDatosPersona("después del cambio, coordinador, secretario y servicio deben quedar cada uno con una sola persona en alta")
	case errors.Is(err, repository.ErrFechaAnteriorRol):
		return errDatosPersona("la fecha es anterior al inicio del período vigente del rol que se reemplaza")
	case errors.Is(err, repository.ErrFechaSolapaRol):
		return errDatosPersona("la fecha se superpone con un período anterior de la persona en ese mismo rol")
	case errors.Is(err, repository.ErrFechaAnteriorAltaRol):
		return errDatosPersona("la fecha es anterior a la fecha de alta de uno de los nuevos titulares")
	}
	return err
}

// CambiarRolPersona (solo superadmin, lo comprobó la ruta). rol "publicador"
// quita todos los roles de la persona; quitar=true quita solo ese rol; si no,
// lo asigna. Nadie cambia su propio rol.
func (s *Service) CambiarRolPersona(a *models.Actor, personaID int, rol string, quitar bool) error {
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
	if quitar && rol == "publicador" {
		return errDatosPersona("para quitar un rol indique cuál: coordinador, secretario o servicio")
	}
	if fmt.Sprintf("%d", personaID) == a.PersonaID {
		return errDatosPersona("no puede cambiar su propio rol")
	}

	asigna := rol != "publicador" && !quitar
	ficha, err := s.fichaParaEscribir(a, true, personaID, asigna)
	if err != nil {
		return err
	}
	if asigna && ficha.Situacion2 != "Anciano" {
		return errDatosPersona("solo un Anciano puede ser coordinador, secretario o servicio")
	}

	cambio, err := s.repo.CambiarRolPersona(personaID, rol, quitar, a.PersonaID)
	if err != nil {
		return traducirErrorRol(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}

// RotarRolesPersonas: un titular rota los roles dentro de SU congregación.
// in = nuevo titular de cada rol que cambia (0 = no cambia).
func (s *Service) RotarRolesPersonas(a *models.Actor, in models.RotacionRoles) error {
	if a.CongregacionID == "" {
		return ErrSinCongregacion
	}
	titulares := map[string]int{}
	for rol, id := range map[string]int{
		"coordinador": in.Coordinador,
		"secretario":  in.Secretario,
		"servicio":    in.Servicio,
	} {
		if id < 0 {
			return ErrPersonaIDInvalid
		}
		if id > 0 {
			titulares[rol] = id
		}
	}
	if len(titulares) == 0 {
		return errDatosPersona("indique al menos un rol a cambiar: coordinador, secretario o servicio")
	}

	fecha, err := fechaHoraPersona(in.Fecha)
	if err != nil {
		return err
	}
	
	hecho, err := s.repo.RotarRolesPersonas(a.CongregacionID, titulares, fecha, a.PersonaID)
	if err != nil {
		return traducirErrorRol(err)
	}
	if !hecho {
		return ErrPersonaSinCambio
	}
	return nil
}
