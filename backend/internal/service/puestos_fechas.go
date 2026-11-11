/**
 * ARCHIVO: puestos_fechas.go
 * UBICACIÓN: backend/internal/service/puestos_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.1: reglas para modificar la fecha de una fila
 * ya cargada del historial de puestos.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Quién: coordinador, secretario o servicio dentro de SU congregación, y el
 *    superadmin en cualquiera. Una fila de otra congregación responde 404.
 *  - Cada fecha es AAAA-MM-DD, obligatoria si se envía, nunca futura. Si es hoy
 *    se guarda la hora real; si es pasada, las 12:00 UTC de ese día.
 *  - El inicio no es posterior al fin; el período queda dentro de un período de
 *    alta de la persona; no se superpone con otras filas de la persona en ese
 *    departamento ni del mismo puesto en ese departamento.
 *  - Un puesto vigente no tiene fecha de fin (se cierra con "quitar").
 *  - Se registra quién y cuándo modificó (modificado_por, modificado_at).
 */

package service

import (
	"errors"
	"time"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// ErrFilaHistorialNoExiste: la fila no existe o es de otra congregación (404).
var ErrFilaHistorialNoExiste = errors.New("la fila del historial no existe en su congregación")

// fechaElegidaHistorial valida una fecha opcional enviada para modificar un
// historial con columnas de fecha y hora. nil = no se envió (no se toca).
// Una cadena vacía NO vale: al modificar hay que indicar la fecha.
func fechaElegidaHistorial(valor *string) (*repository.FechaElegida, error) {
	if valor == nil {
		return nil, nil
	}
	dia, err := fechaPersona(*valor, true)
	if err != nil {
		return nil, err
	}
	hora, err := fechaHoraPersona(dia)
	if err != nil {
		return nil, err
	}
	if hora == nil {
		dia = time.Now().UTC().Format("2006-01-02") // hoy: la hora real del servidor
	}
	return &repository.FechaElegida{Dia: dia, Hora: hora}, nil
}

func traducirErrorFechasPuesto(err error) error {
	switch {
	case errors.Is(err, repository.ErrFilaInexistente), errors.Is(err, repository.ErrPersonaInexistente):
		return ErrFilaHistorialNoExiste
	case errors.Is(err, repository.ErrFechaInicioPosteriorFin):
		return errDatosPersona("la fecha de inicio no puede ser posterior a la fecha de fin")
	case errors.Is(err, repository.ErrFechaFueraDeAlta):
		return errDatosPersona("la fecha queda fuera de un período de alta de la persona (no puede ser anterior a su alta ni posterior a su baja)")
	case errors.Is(err, repository.ErrFinEnPuestoVigente):
		return errDatosPersona("el puesto sigue vigente y no tiene fecha de fin: para cerrarlo use quitar")
	case errors.Is(err, repository.ErrFechaSolapaPuestoPersona):
		return errDatosPersona("la fecha se superpone con otro período de la persona en ese departamento")
	case errors.Is(err, repository.ErrFechaSolapaPuestoCargo):
		return errDatosPersona("la fecha se superpone con otro período de ese puesto en el departamento")
	}
	return err
}

// ModificarFechasPuesto cambia la fecha de inicio y/o de fin de la fila `id`
// del historial de puestos. Un campo nil no se toca; al menos uno es obligatorio.
func (s *Service) ModificarFechasPuesto(a *models.Actor, esSuper bool, id int64, fechaInicio, fechaFin *string) error {
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

	cambio, err := s.repo.ModificarFechasPuesto(id, a.CongregacionID, esSuper, ini, fin, a.PersonaID)
	if err != nil {
		return traducirErrorFechasPuesto(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}
