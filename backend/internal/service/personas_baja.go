/**
 * ARCHIVO: personas_baja.go
 * UBICACIÓN: backend/internal/service/personas_baja.go
 * DESCRIPCIÓN: Reglas de bajas y reactivación.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Un encargado solo actúa en su congregación; el superadmin en cualquiera.
 *  - La fecha es obligatoria, no futura y no anterior al alta (baja) ni a la
 *    última baja (reactivación). Nunca se inventan fechas.
 *  - Motivo obligatorio (baja y reactivación). Sale del catálogo único: la baja acepta motivos activos
 *    del uso personas.baja y la reactivación los del uso personas.alta.
 *    Detalles de la baja: hasta 100 palabras.
 *  - No se puede dar de baja a un titular de rol (coordinador, secretario o
 *    servicio): primero se lo reemplaza con la rotación de roles.
 *  - Nadie se da de baja a sí mismo.
 *  - La baja quita los puestos, cierra las situaciones y deja a la persona sin
 *    grupo (cerrando su cargo de superintendente o auxiliar, que queda
 *    vacante), todo con la fecha de baja elegida (no se puede dar de baja antes
 *    de que empiece un puesto, la pertenencia al grupo o el cargo vigentes);
 *    reactivar deja a la persona como Publicador y sin grupo, y los puestos y
 *    el grupo se reasignan a mano.
 *  - El catálogo de motivos lo gestiona solo el superadmin (motivos_catalogo.go).
 */

package service

import (
	"errors"
	"fmt"
	"strings"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// ErrPersonaTitularRol: la persona tiene un rol de la congregación (409).
var ErrPersonaTitularRol = errors.New("la persona es titular de un rol de la congregación: primero hay que reemplazarla con la rotación de roles")

func traducirErrorBaja(err error) error {
	var tit *repository.ErrTitularRol
	switch {
	case errors.As(err, &tit):
		return fmt.Errorf("%w (%s)", ErrPersonaTitularRol, strings.Join(tit.Roles, ", "))
	case errors.Is(err, repository.ErrPersonaInexistente):
		return ErrPersonaNoValida
	case errors.Is(err, repository.ErrPersonaEstadoNoCorresponde):
		return ErrPersonaSinCambio
	case errors.Is(err, repository.ErrFechaAnteriorInicio):
		return errDatosPersona("la fecha es anterior al inicio de una situación vigente de la persona")
	case errors.Is(err, repository.ErrFechaAnteriorPuesto):
		return errDatosPersona("la fecha es anterior al inicio de un puesto vigente de la persona: no se puede cerrar antes de que empiece")
	case errors.Is(err, repository.ErrFechaAnteriorBaja):
		return errDatosPersona("la fecha es anterior a la última baja de la persona")
	case errors.Is(err, repository.ErrFechaAnteriorMovimiento):
		return errDatosPersona("la fecha es anterior al inicio de la pertenencia de la persona a su grupo: no se puede cerrar antes de que empiece")
	case errors.Is(err, repository.ErrFechaAnteriorEncargado):
		return errDatosPersona("la fecha es anterior al inicio de su cargo de superintendente o auxiliar del grupo: no se puede cerrar antes de que empiece")
	case errors.Is(err, repository.ErrGrupoInexistente):
		return ErrGrupoNoExiste
	}
	return err
}

// DarDeBajaPersona: la persona debe estar en ALTA y no ser titular de un rol.
// motivoID 0 = sin motivo; si viene, debe ser un motivo activo del uso personas.baja.
func (s *Service) DarDeBajaPersona(a *models.Actor, esSuper bool, personaID int, fecha, detalles string, motivoID int64) error {
	if personaID <= 0 {
		return ErrPersonaIDInvalid
	}
	if motivoID <= 0 {
		return errDatosPersona("el motivo de la baja es obligatorio")
	}
	if fmt.Sprintf("%d", personaID) == a.PersonaID {
		return errDatosPersona("no puede darse de baja a sí misma")
	}
	f, err := fechaPersona(fecha, true)
	if err != nil {
		return err
	}
	fechaHora, err := fechaHoraPersona(f)
	if err != nil {
		return err
	}
	detalles, err = normalizarDetalles(detalles)
	if err != nil {
		return err
	}
	motivo, err := s.validarMotivoDeUso(motivoID, "personas.baja")
	if err != nil {
		return err
	}

	ficha, err := s.fichaParaEscribir(a, esSuper, personaID, false)
	if err != nil {
		return err
	}
	if ficha.Estado != "ALTA" {
		return ErrPersonaSinCambio
	}
	if ficha.FechaAlta != nil && f < *ficha.FechaAlta {
		return errDatosPersona("la fecha de baja no puede ser anterior a la fecha de alta")
	}

	if err := s.repo.DarDeBajaPersona(personaID, f, fechaHora, motivo, detalles, a.PersonaID); err != nil {
		return traducirErrorBaja(err)
	}
	return nil
}

// ReactivarPersona: la persona debe estar en BAJA.
// motivoID 0 = sin motivo; si viene, debe ser un motivo activo del uso personas.alta.
func (s *Service) ReactivarPersona(a *models.Actor, esSuper bool, personaID int, fecha, detalles string, motivoID int64) error {
	if personaID <= 0 {
		return ErrPersonaIDInvalid
	}
	if motivoID <= 0 {
		return errDatosPersona("el motivo de la reactivación es obligatorio")
	}
	f, err := fechaPersona(fecha, true)
	if err != nil {
		return err
	}
	detalles, err = normalizarDetalles(detalles)
	if err != nil {
		return err
	}
	motivo, err := s.validarMotivoDeUso(motivoID, "personas.alta")
	if err != nil {
		return err
	}
	ficha, err := s.fichaParaEscribir(a, esSuper, personaID, false)
	if err != nil {
		return err
	}
	if ficha.Estado != "BAJA" {
		return ErrPersonaSinCambio
	}
	if ficha.FechaBaja != nil && f < *ficha.FechaBaja {
		return errDatosPersona("la fecha de alta no puede ser anterior a la fecha de baja")
	}

	if err := s.repo.ReactivarPersona(personaID, f, motivo, detalles, a.PersonaID); err != nil {
		return traducirErrorBaja(err)
	}
	return nil
}
