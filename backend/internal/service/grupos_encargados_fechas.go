/**
 * ARCHIVO: grupos_encargados_fechas.go
 * UBICACIÓN: backend/internal/service/grupos_encargados_fechas.go
 * DESCRIPCIÓN: Tramo A7.2: reglas para modificar la fecha de una fila ya
 * cargada del historial de encargados (superintendente y auxiliar).
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Quién: coordinador, secretario o servicio dentro de SU congregación, y el
 *    superadmin en cualquiera. Una fila de otra congregación responde 404.
 *  - Cada fecha es AAAA-MM-DD, nunca futura. Al menos una.
 *  - El inicio no es posterior al fin ni anterior al inicio del grupo; el
 *    período queda dentro de un período de alta de la persona, no se
 *    superpone con otros cargos de la persona ni del mismo cargo del grupo, y
 *    cae dentro de una pertenencia de la persona a ese grupo.
 *  - Un cargo vigente no tiene fecha de fin: se cierra cambiando el encargado.
 *  - La situación 3 espejo se mueve junto con el cargo.
 */

package service

import (
	"errors"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

func traducirErrorFechasEncargado(err error) error {
	switch {
	case errors.Is(err, repository.ErrFinEnEncargadoVigente):
		return errDatosPersona("el cargo sigue vigente y no tiene fecha de fin: para cerrarlo cambie el encargado del grupo")
	case errors.Is(err, repository.ErrFechaSolapaEncargado):
		return errDatosPersona("la fecha se superpone con otro período del mismo cargo del grupo o con otro cargo de la persona")
	}
	return traducirErrorFechasMovimiento(err)
}

// ModificarFechasEncargado cambia la fecha de inicio y/o de fin de la fila `id`
// del historial de encargados. Un campo nil no se toca; al menos uno es obligatorio.
func (s *Service) ModificarFechasEncargado(a *models.Actor, esSuper bool, id int64, fechaInicio, fechaFin *string) error {
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

	cambio, err := s.repo.ModificarFechasEncargado(id, a.CongregacionID, esSuper, ini, fin, a.PersonaID)
	if err != nil {
		return traducirErrorFechasEncargado(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}