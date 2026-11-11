/**
 * ARCHIVO: personas_rol_fechas.go
 * UBICACIÓN: backend/internal/service/personas_rol_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.2: reglas para modificar la fecha de una fila
 * ya cargada del historial de roles (coordinador, secretario, servicio).
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Quién: coordinador, secretario o servicio dentro de SU congregación, y el
 *    superadmin en cualquiera. Una fila de otra congregación responde 404.
 *  - Cada fecha es AAAA-MM-DD, obligatoria si se envía, nunca futura. Si es hoy
 *    se guarda la hora real; si es pasada, las 12:00 UTC de ese día.
 *  - El inicio no es posterior al fin; el período queda dentro de un período de
 *    alta de la persona; no se superpone con otros períodos de la persona en
 *    ese rol ni con los de otra persona en ese rol de la congregación.
 *  - Un rol vigente no tiene fecha de fin: se cierra con la rotación de roles.
 *  - Se registra quién y cuándo modificó (modificado_por, modificado_at).
 */

package service

import (
	"errors"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

func traducirErrorFechasRol(err error) error {
	switch {
	case errors.Is(err, repository.ErrFilaInexistente), errors.Is(err, repository.ErrPersonaInexistente):
		return ErrFilaHistorialNoExiste
	case errors.Is(err, repository.ErrFechaInicioPosteriorFin):
		return errDatosPersona("la fecha de inicio no puede ser posterior a la fecha de fin")
	case errors.Is(err, repository.ErrFechaFueraDeAlta):
		return errDatosPersona("la fecha queda fuera de un período de alta de la persona (no puede ser anterior a su alta ni posterior a su baja)")
	case errors.Is(err, repository.ErrFinEnRolVigente):
		return errDatosPersona("el rol sigue vigente y no tiene fecha de fin: para cerrarlo use la rotación de roles")
	case errors.Is(err, repository.ErrFechaSolapaRol):
		return errDatosPersona("la fecha se superpone con otro período de la persona en ese mismo rol")
	case errors.Is(err, repository.ErrFechaSolapaRolCargo):
		return errDatosPersona("la fecha se superpone con un período de otra persona en ese mismo rol de la congregación")
	}
	return err
}

// ModificarFechasRol cambia la fecha de inicio y/o de fin de la fila `id` del
// historial de roles. Un campo nil no se toca; al menos uno es obligatorio.
func (s *Service) ModificarFechasRol(a *models.Actor, esSuper bool, id int64, fechaInicio, fechaFin *string) error {
	if id <= 0 {
		return errDatosPersona("el id de la fila no es válido")
	}
	if fechaInicio == nil && fechaFin == nil {
		return errDatosPersona("indique fecha_inicio, fecha_fin o ambas")
	}
	if !esSuper && a.CongregacionID == "" {
		return ErrSinCongregacion
	}

	ini, err := fechaElegidaHistorial(fechaInicio)
	if err != nil {
		return err
	}
	fin, err := fechaElegidaHistorial(fechaFin)
	if err != nil {
		return err
	}

	cambio, err := s.repo.ModificarFechasRol(id, a.CongregacionID, esSuper, ini, fin, a.PersonaID)
	if err != nil {
		return traducirErrorFechasRol(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}
