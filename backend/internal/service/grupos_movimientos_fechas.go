/**
 * ARCHIVO: grupos_movimientos_fechas.go
 * UBICACIÓN: backend/internal/service/grupos_movimientos_fechas.go
 * DESCRIPCIÓN: Tramo A7.1: reglas para modificar la fecha de una fila ya
 * cargada del historial de pertenencia a grupos.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Quién: coordinador, secretario o servicio dentro de SU congregación, y el
 *    superadmin en cualquiera. Una fila de otra congregación responde 404.
 *  - Cada fecha es AAAA-MM-DD, nunca futura. Al menos una.
 *  - El inicio no es posterior al fin; no es anterior al inicio del grupo; el
 *    período queda dentro de un período de alta de la persona; no se
 *    superpone con otras pertenencias de la persona (tocarse el mismo día sí).
 *  - Una pertenencia vigente no tiene fecha de fin: se cierra moviendo a la
 *    persona de grupo.
 *  - Los cargos de la persona en ese grupo deben seguir dentro de una pertenencia.
 *  - Se registra quién y cuándo modificó (modificado_por, modificado_at).
 */

package service

import (
	"errors"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

func traducirErrorFechasMovimiento(err error) error {
	var inc *repository.ErrEstadoIncoherente
	switch {
	case errors.As(err, &inc):
		return errDatosPersona("%s", inc.Detalle)
	case errors.Is(err, repository.ErrFilaInexistente):
		return ErrFilaHistorialNoExiste
	case errors.Is(err, repository.ErrFechaInicioPosteriorFin):
		return errDatosPersona("la fecha de inicio no puede ser posterior a la fecha de fin")
	case errors.Is(err, repository.ErrFechaFueraDeAlta):
		return errDatosPersona("la fecha queda fuera de un período de alta de la persona (no puede ser anterior a su alta ni posterior a su baja)")
	case errors.Is(err, repository.ErrFinEnMovimientoVigente):
		return errDatosPersona("la pertenencia sigue vigente y no tiene fecha de fin: para cerrarla mueva a la persona de grupo")
	case errors.Is(err, repository.ErrFechaSolapaMovimiento):
		return errDatosPersona("la fecha se superpone con otra pertenencia de la persona a un grupo")
	}
	return traducirErrorMovimiento(err)
}

// ModificarFechasMovimiento cambia la fecha de inicio y/o de fin de la fila
// `id` del historial de grupos. Un campo nil no se toca; al menos uno es obligatorio.
func (s *Service) ModificarFechasMovimiento(a *models.Actor, esSuper bool, id int64, fechaInicio, fechaFin *string) error {
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

	cambio, err := s.repo.ModificarFechasMovimiento(id, a.CongregacionID, esSuper, ini, fin, a.PersonaID)
	if err != nil {
		return traducirErrorFechasMovimiento(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}