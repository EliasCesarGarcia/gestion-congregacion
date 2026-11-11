/**
 * ARCHIVO: personas_situaciones_fechas.go
 * UBICACIÓN: backend/internal/service/personas_situaciones_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.3: reglas para modificar la fecha de una fila
 * ya cargada del historial de situaciones (campos 1, 2 y 3).
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Quién: coordinador, secretario o servicio dentro de SU congregación, y el
 *    superadmin en cualquiera. Una fila de una persona de otra congregación
 *    responde 404.
 *  - Cada fecha es AAAA-MM-DD, obligatoria si se envía y nunca futura (misma
 *    tolerancia de un día que el resto del módulo). Se guarda como fecha, sin hora.
 *  - El inicio no es posterior al fin; el período queda dentro de un período de
 *    alta de la persona; no se superpone con otros períodos de la misma
 *    situación (mismo campo) de la persona.
 *  - Una situación vigente no tiene fecha de fin: se cierra cambiando la situación.
 *  - Se registra quién y cuándo modificó (modificado_por, modificado_at).
 */

package service

import (
	"errors"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// fechaDiaHistorial valida una fecha opcional (AAAA-MM-DD) enviada para
// modificar un historial con columnas de tipo fecha. nil = no se envió.
// Una cadena vacía NO vale: al modificar hay que indicar la fecha.
func fechaDiaHistorial(valor *string) (*string, error) {
	if valor == nil {
		return nil, nil
	}
	dia, err := fechaPersona(*valor, true)
	if err != nil {
		return nil, err
	}
	return &dia, nil
}

func traducirErrorFechasSituacion(err error) error {
	switch {
	case errors.Is(err, repository.ErrFilaInexistente):
		return ErrFilaHistorialNoExiste
	case errors.Is(err, repository.ErrFechaInicioPosteriorFin):
		return errDatosPersona("la fecha de inicio no puede ser posterior a la fecha de fin")
	case errors.Is(err, repository.ErrFechaFueraDeAlta):
		return errDatosPersona("la fecha queda fuera de un período de alta de la persona (no puede ser anterior a su alta ni posterior a su baja)")
	case errors.Is(err, repository.ErrFinEnSituacionVigente):
		return errDatosPersona("la situación sigue vigente y no tiene fecha de fin: para cerrarla cambie la situación")
	case errors.Is(err, repository.ErrFechaSolapaSituacion):
		return errDatosPersona("la fecha se superpone con otro período de la misma situación de la persona")
	}
	return err
}

// ModificarFechasSituacion cambia la fecha de inicio y/o de fin de la fila `id`
// del historial de situaciones. Un campo nil no se toca; al menos uno es obligatorio.
func (s *Service) ModificarFechasSituacion(a *models.Actor, esSuper bool, id int64, fechaInicio, fechaFin *string) error {
	if id <= 0 {
		return errDatosPersona("el id de la fila no es válido")
	}
	if fechaInicio == nil && fechaFin == nil {
		return errDatosPersona("indique fecha_inicio, fecha_fin o ambas")
	}
	if !esSuper && a.CongregacionID == "" {
		return ErrSinCongregacion
	}

	ini, err := fechaDiaHistorial(fechaInicio)
	if err != nil {
		return err
	}
	fin, err := fechaDiaHistorial(fechaFin)
	if err != nil {
		return err
	}

	cambio, err := s.repo.ModificarFechasSituacion(id, a.CongregacionID, esSuper, ini, fin, a.PersonaID)
	if err != nil {
		return traducirErrorFechasSituacion(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}
