/**
 * ARCHIVO: personas_baja.go
 * UBICACIÓN: backend/internal/service/personas_baja.go
 * DESCRIPCIÓN: Reglas de bajas, reactivación y motivos de baja.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Un encargado solo actúa en su congregación; el superadmin en cualquiera.
 *  - La fecha es obligatoria, no futura y no anterior al alta (baja) ni a la
 *    última baja (reactivación). Nunca se inventan fechas.
 *  - Motivo opcional (del catálogo, activo); detalles hasta 100 palabras.
 *  - No se puede dar de baja a un titular de rol (coordinador, secretario o
 *    servicio): primero se lo reemplaza con la rotación de roles.
 *  - Nadie se da de baja a sí mismo.
 *  - La baja quita los puestos y cierra las situaciones, todo con la fecha de
 *    baja elegida (no se puede dar de baja antes de que empiece un puesto
 *    vigente); reactivar deja a la persona como Publicador y los cargos se
 *    reasignan a mano.
 *  - El catálogo de motivos lo gestiona solo el superadmin (lo exige la ruta).
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
	}
	return err
}

// validarMotivoBaja: motivoID 0 = sin motivo. Si viene, debe existir y estar activo.
func (s *Service) validarMotivoBaja(motivoID int64) (*int64, error) {
	if motivoID == 0 {
		return nil, nil
	}
	if motivoID < 0 {
		return nil, ErrMotivoInvalido
	}
	m, err := s.repo.GetMotivoBaja(motivoID)
	if err != nil {
		return nil, err
	}
	if m == nil || !m.Activo {
		return nil, ErrMotivoInvalido
	}
	return &motivoID, nil
}

// DarDeBajaPersona: la persona debe estar en ALTA y no ser titular de un rol.
func (s *Service) DarDeBajaPersona(a *models.Actor, esSuper bool, personaID int, fecha, detalles string, motivoID int64) error {
	if personaID <= 0 {
		return ErrPersonaIDInvalid
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
	motivo, err := s.validarMotivoBaja(motivoID)
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
func (s *Service) ReactivarPersona(a *models.Actor, esSuper bool, personaID int, fecha string) error {
	if personaID <= 0 {
		return ErrPersonaIDInvalid
	}
	f, err := fechaPersona(fecha, true)
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

	if err := s.repo.ReactivarPersona(personaID, f, a.PersonaID); err != nil {
		return traducirErrorBaja(err)
	}
	return nil
}

// ---- Motivos de baja ----

// ListMotivosBaja: soloActivos=true es lo que ven los encargados; el
// superadmin pide false para ver también los desactivados.
func (s *Service) ListMotivosBaja(soloActivos bool) ([]models.MotivoBaja, error) {
	return s.repo.ListMotivosBaja(soloActivos)
}

// CrearMotivoBaja: solo superadmin (lo comprueba la ruta).
func (s *Service) CrearMotivoBaja(nombre string, orden int) (*models.MotivoBaja, error) {
	nombre, err := normalizarTextoMotivo(nombre)
	if err != nil {
		return nil, err
	}
	if orden < 0 || orden > maxOrdenMotivo {
		return nil, ErrMotivoDatos
	}
	m, err := s.repo.CrearMotivoBaja(nombre, orden)
	if errors.Is(err, repository.ErrMotivoDuplicado) {
		return nil, ErrMotivoExiste
	}
	return m, err
}

// EditarMotivoBaja: cambia solo los campos enviados. Desactivar es activo=false.
// Renombrar NO cambia el historial viejo (guarda su propia copia del texto).
func (s *Service) EditarMotivoBaja(id int64, nombre *string, orden *int, activo *bool) (*models.MotivoBaja, error) {
	if id <= 0 {
		return nil, ErrMotivoNoExiste
	}
	if nombre == nil && orden == nil && activo == nil {
		return nil, ErrMotivoSinCambios
	}
	if nombre != nil {
		t, err := normalizarTextoMotivo(*nombre)
		if err != nil {
			return nil, err
		}
		nombre = &t
	}
	if orden != nil && (*orden < 0 || *orden > maxOrdenMotivo) {
		return nil, ErrMotivoDatos
	}
	m, err := s.repo.EditarMotivoBaja(id, nombre, orden, activo)
	if errors.Is(err, repository.ErrMotivoDuplicado) {
		return nil, ErrMotivoExiste
	}
	if err != nil {
		return nil, err
	}
	if m == nil {
		return nil, ErrMotivoNoExiste
	}
	return m, nil
}
