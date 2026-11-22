/**
 * ARCHIVO: historial_correcciones.go
 * UBICACIÓN: backend/internal/service/historial_correcciones.go
 * DESCRIPCIÓN: Tramo 3.6. Reglas para corregir lo que se escribió mal en una
 * fila ya cargada de un historial de la persona (motivos, detalles y, en
 * situaciones, el valor). Las fechas se corrigen con las rutas de fechas.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Un encargado solo corrige filas de SU congregación; el superadmin las de
 *    cualquiera. Una fila de otra congregación responde igual que una inexistente.
 *  - Los motivos salen del catálogo (activos y del uso correcto: alta o baja de
 *    personas, o grupo) y no pueden quedar vacíos. Los detalles admiten hasta
 *    100 palabras; vacíos, se borran.
 *  - Solo se tocan los datos que llegan: lo que no llega no cambia.
 *  - Situaciones: se corrige el valor (campo 1 o 2) de cualquier período. La
 *    situación 3 depende del grupo y no se corrige acá. Si es el período
 *    vigente, también cambia el dato actual de la persona. Un titular de rol
 *    debe seguir siendo anciano.
 *  - Una excepción de encargado de grupo no puede quedar sin motivo.
 *  - Cada corrección anota quién y cuándo la hizo.
 */

package service

import (
	"errors"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// traducirErrorCorreccion traduce los errores del repositorio de correcciones.
func traducirErrorCorreccion(err error) error {
	switch {
	case errors.Is(err, repository.ErrFilaInexistente):
		return ErrPersonaNoValida
	case errors.Is(err, repository.ErrBajaEnEstadoVigente):
		return errDatosPersona("la persona está de alta: ese período no tiene baja que corregir")
	case errors.Is(err, repository.ErrSalidaEnMovimientoVigente):
		return errDatosPersona("la persona sigue en ese grupo: esa fila no tiene salida que corregir")
	case errors.Is(err, repository.ErrCorreccionSalidaPorBaja):
		return errDatosPersona("la salida de ese grupo se registró con la baja de la persona: se corrige en el historial de altas y bajas")
	case errors.Is(err, repository.ErrSituacionOtroCampo):
		return errDatosPersona("la fila no corresponde a esa situación")
	case errors.Is(err, repository.ErrTitularRolSituacion):
		return errDatosPersona("la persona es titular de un rol de la congregación y debe seguir siendo anciano: primero hay que reemplazarla en ese rol")
	case errors.Is(err, repository.ErrExcepcionSinMotivo):
		return errDatosPersona("el cargo es una excepción: su motivo no puede quedar vacío")
	}
	return err
}

// motivoCorreccion valida un motivo que llega para corregir: debe venir con
// un id y ser un motivo activo del uso indicado. nil = no se toca.
func (s *Service) motivoCorreccion(motivoID *int64, uso, nombre string) (*int64, error) {
	if motivoID == nil {
		return nil, nil
	}
	if *motivoID <= 0 {
		return nil, errDatosPersona("el motivo %s no puede quedar vacío", nombre)
	}
	return s.validarMotivoDeUso(*motivoID, uso)
}

// detallesCorreccion normaliza unos detalles que llegan para corregir
// (hasta 100 palabras). nil = no se toca; vacío = se borran.
func detallesCorreccion(detalles *string) (*string, error) {
	if detalles == nil {
		return nil, nil
	}
	d, err := normalizarDetalles(*detalles)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// alcanceCorreccion devuelve la congregación contra la que se compara la fila
// y si el actor ve todas (superadmin).
func alcanceCorreccion(a *models.Actor, esSuper bool) (string, bool, error) {
	if !esSuper && a.CongregacionID == "" {
		return "", false, ErrSinCongregacion
	}
	return a.CongregacionID, esSuper, nil
}

// CorregirEstadoPersona corrige motivos y detalles de una fila del historial
// de altas y bajas. Cada dato en nil no se toca.
func (s *Service) CorregirEstadoPersona(a *models.Actor, esSuper bool, id int64,
	motivoAlta *int64, detallesAlta *string, motivoBaja *int64, detallesBaja *string) error {

	if id <= 0 {
		return errDatosPersona("falta el registro a corregir")
	}
	if motivoAlta == nil && detallesAlta == nil && motivoBaja == nil && detallesBaja == nil {
		return errDatosPersona("no hay nada para corregir")
	}
	cong, todas, err := alcanceCorreccion(a, esSuper)
	if err != nil {
		return err
	}
	mAlta, err := s.motivoCorreccion(motivoAlta, "personas.alta", "de alta")
	if err != nil {
		return err
	}
	mBaja, err := s.motivoCorreccion(motivoBaja, "personas.baja", "de baja")
	if err != nil {
		return err
	}
	dAlta, err := detallesCorreccion(detallesAlta)
	if err != nil {
		return err
	}
	dBaja, err := detallesCorreccion(detallesBaja)
	if err != nil {
		return err
	}

	cambio, err := s.repo.CorregirEstadoPersona(id, cong, todas, mAlta, dAlta, mBaja, dBaja, a.PersonaID)
	if err != nil {
		return traducirErrorCorreccion(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}

// CorregirSituacionPersona corrige el valor de una fila del historial de
// situaciones (campo 1 o 2) de cualquier período.
func (s *Service) CorregirSituacionPersona(a *models.Actor, esSuper bool, id int64, campo int, valor string) error {
	if id <= 0 {
		return errDatosPersona("falta el registro a corregir")
	}
	var validas []string
	switch campo {
	case 1:
		validas = situacionesLista1
	case 2:
		validas = situacionesLista2
	case 3:
		return errDatosPersona("la situación 3 (superintendente o auxiliar de grupo) se corrige desde el grupo")
	default:
		return errDatosPersona("el campo debe ser 1 o 2")
	}
	nuevo, err := situacionPersona(valor, validas, campo)
	if err != nil {
		return err
	}
	if nuevo == "" {
		return errDatosPersona("la situación no puede quedar vacía: para quitarla use el cambio de situación")
	}
	cong, todas, err := alcanceCorreccion(a, esSuper)
	if err != nil {
		return err
	}

	cambio, err := s.repo.CorregirSituacionPersona(id, campo, nuevo, cong, todas, a.PersonaID)
	if err != nil {
		return traducirErrorCorreccion(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}

// CorregirMovimientoGrupo corrige motivos y detalles de entrada y de salida de
// una fila del historial de pertenencia a grupos. Cada dato en nil no se toca.
func (s *Service) CorregirMovimientoGrupo(a *models.Actor, esSuper bool, id int64,
	motivoEntrada *int64, detallesEntrada *string, motivoSalida *int64, detallesSalida *string) error {

	if id <= 0 {
		return errDatosPersona("falta el registro a corregir")
	}
	if motivoEntrada == nil && detallesEntrada == nil && motivoSalida == nil && detallesSalida == nil {
		return errDatosPersona("no hay nada para corregir")
	}
	cong, todas, err := alcanceCorreccion(a, esSuper)
	if err != nil {
		return err
	}
	mEntrada, err := s.motivoCorreccion(motivoEntrada, "personas.grupo", "de entrada")
	if err != nil {
		return err
	}
	mSalida, err := s.motivoCorreccion(motivoSalida, "personas.grupo", "de salida")
	if err != nil {
		return err
	}
	dEntrada, err := detallesCorreccion(detallesEntrada)
	if err != nil {
		return err
	}
	dSalida, err := detallesCorreccion(detallesSalida)
	if err != nil {
		return err
	}

	cambio, err := s.repo.CorregirMovimientoGrupo(id, cong, todas, mEntrada, dEntrada, mSalida, dSalida, a.PersonaID)
	if err != nil {
		return traducirErrorCorreccion(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}

// CorregirEncargadoGrupo corrige los detalles de una fila del historial de
// cargos de encargado de grupo.
func (s *Service) CorregirEncargadoGrupo(a *models.Actor, esSuper bool, id int64, detalles string) error {
	if id <= 0 {
		return errDatosPersona("falta el registro a corregir")
	}
	cong, todas, err := alcanceCorreccion(a, esSuper)
	if err != nil {
		return err
	}
	d, err := normalizarDetalles(detalles)
	if err != nil {
		return err
	}

	cambio, err := s.repo.CorregirEncargadoGrupo(id, cong, todas, d, a.PersonaID)
	if err != nil {
		return traducirErrorCorreccion(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}
