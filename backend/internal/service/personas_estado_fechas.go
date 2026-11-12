/**
 * ARCHIVO: personas_estado_fechas.go
 * UBICACIÓN: backend/internal/service/personas_estado_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.4: reglas para modificar la fecha de alta y/o
 * de baja de una fila ya cargada del historial de estado.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Quién: coordinador, secretario o servicio dentro de SU congregación, y el
 *    superadmin en cualquiera. Una fila de otra congregación responde 404.
 *  - Cada fecha es AAAA-MM-DD, nunca futura. Al menos una.
 *  - El alta no es posterior a la baja; no se superpone con otros períodos de
 *    alta de la persona (tocarse el mismo día sí).
 *  - Una fila de alta vigente no tiene baja: se da de baja con /api/personas/baja.
 *  - Regla 5: al mover una baja, las situaciones y puestos cerrados con ella
 *    se mueven en la misma transacción; si algo queda incoherente, se rechaza.
 *  - Se registra quién y cuándo modificó (modificado_por, modificado_at).
 */

package service

import (
	"errors"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

func traducirErrorFechasEstado(err error) error {
	var inc *repository.ErrEstadoIncoherente
	switch {
	case errors.As(err, &inc):
		return errDatosPersona("%s", inc.Detalle)
	case errors.Is(err, repository.ErrFilaInexistente):
		return ErrFilaHistorialNoExiste
	case errors.Is(err, repository.ErrFechaInicioPosteriorFin):
		return errDatosPersona("la fecha de alta no puede ser posterior a la fecha de baja")
	case errors.Is(err, repository.ErrBajaEnEstadoVigente):
		return errDatosPersona("la persona está de alta y esa fila no tiene fecha de baja: para darla de baja use la baja de personas")
	case errors.Is(err, repository.ErrFechaSolapaEstado):
		return errDatosPersona("la fecha se superpone con otro período de alta de la persona")
	}
	return err
}

// ModificarFechasEstado cambia la fecha de alta y/o de baja de la fila `id`
// del historial de estado. Un campo nil no se toca; al menos uno es obligatorio.
func (s *Service) ModificarFechasEstado(a *models.Actor, esSuper bool, id int64, fechaAlta, fechaBaja *string) error {
	if id <= 0 {
		return errDatosPersona("el id de la fila no es válido")
	}
	if fechaAlta == nil && fechaBaja == nil {
		return errDatosPersona("indique fecha_alta, fecha_baja o ambas")
	}
	if !esSuper && a.CongregacionID == "" {
		return ErrSinCongregacion
	}

	alta, err := fechaDiaHistorial(fechaAlta)
	if err != nil {
		return err
	}
	baja, err := fechaElegidaHistorial(fechaBaja)
	if err != nil {
		return err
	}

	cambio, err := s.repo.ModificarFechasEstado(id, a.CongregacionID, esSuper, alta, baja, a.PersonaID)
	if err != nil {
		return traducirErrorFechasEstado(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}