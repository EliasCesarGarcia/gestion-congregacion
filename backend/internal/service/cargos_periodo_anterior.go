/**
 * ARCHIVO: cargos_periodo_anterior.go
 * UBICACIÓN: backend/internal/service/cargos_periodo_anterior.go
 * DESCRIPCIÓN: Reglas para cargar un período PASADO y cerrado de un cargo de la
 * congregación (coordinador, secretario o servicio). Solo superadmin (lo exige
 * la ruta). Sirve para casos excepcionales, como un coordinador interino entre
 * dos titulares que ya están cargados.
 *
 * REGLAS (las hace cumplir el backend):
 *  - La congregación debe existir (puede estar deshabilitada).
 *  - El cargo es coordinador, secretario o servicio.
 *  - Fecha de inicio y de fin: obligatorias, AAAA-MM-DD, nunca futuras, y el
 *    inicio no es posterior al fin.
 *  - Motivo de alta (uso personas.cargo_alta) y de baja (personas.cargo_baja)
 *    obligatorios; los detalles son opcionales (hasta 100 palabras).
 *  - La persona es de la congregación, está en ALTA hoy y es Anciano hoy. No se
 *    compara con fechas de la situación: puede haber sido Anciano desde antes
 *    de llegar a la congregación.
 *  - El período cae dentro de un período de alta de la persona y no se
 *    superpone con otro período de ese cargo (de ella ni de otra persona).
 *  - No cambia quién es el titular actual de ningún cargo.
 */

package service

import (
	"errors"
	"strings"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

func traducirErrorPeriodoCargo(err error) error {
	switch {
	case errors.Is(err, repository.ErrFechaInicioPosteriorFin):
		return errDatosPersona("la fecha de inicio no puede ser posterior a la fecha de fin")
	case errors.Is(err, repository.ErrFechaFueraDeAlta):
		return errDatosPersona("el período queda fuera de un período de alta de la persona (no puede empezar antes de su alta ni terminar después de su baja)")
	case errors.Is(err, repository.ErrFechaSolapaRol):
		return errDatosPersona("el período se superpone con otro período de la misma persona en ese cargo")
	case errors.Is(err, repository.ErrFechaSolapaRolCargo):
		return errDatosPersona("el período se superpone con un período de otra persona en ese cargo")
	case errors.Is(err, repository.ErrPeriodoCargoIndice):
		return errDatosPersona("no se pudo cargar el período: la base ya tiene un registro incompatible de esa persona en ese cargo")
	}
	return traducirErrorRol(err)
}

// CargarPeriodoAnteriorCargo inserta un período pasado y cerrado de un cargo.
func (s *Service) CargarPeriodoAnteriorCargo(a *models.Actor, in models.PeriodoAnteriorCargo) error {
	cong, err := s.congregacionParaCargos(in.CongregacionID)
	if err != nil {
		return err
	}

	rol := strings.TrimSpace(in.Rol)
	valido := false
	for _, c := range cargosRolesOrden {
		if c == rol {
			valido = true
		}
	}
	if !valido {
		return errDatosPersona("el cargo debe ser coordinador, secretario o servicio")
	}
	if in.PersonaID <= 0 {
		return errDatosPersona("falta elegir a la persona")
	}

	ini, err := fechaElegidaHistorial(&in.FechaInicio)
	if err != nil {
		return err
	}
	fin, err := fechaElegidaHistorial(&in.FechaFin)
	if err != nil {
		return err
	}
	if ini.Dia > fin.Dia {
		return errDatosPersona("la fecha de inicio no puede ser posterior a la fecha de fin")
	}

	mAlta, err := s.motivoCargoObligatorio(in.MotivoAltaID, "personas.cargo_alta", "alta", rol)
	if err != nil {
		return err
	}
	dAlta, err := normalizarDetalles(in.DetallesAlta)
	if err != nil {
		return err
	}
	mBaja, err := s.motivoCargoObligatorio(in.MotivoBajaID, "personas.cargo_baja", "baja", rol)
	if err != nil {
		return err
	}
	dBaja, err := normalizarDetalles(in.DetallesBaja)
	if err != nil {
		return err
	}

	alta := repository.MotivoRol{ID: mAlta, Detalles: dAlta}
	baja := repository.MotivoRol{ID: mBaja, Detalles: dBaja}
	if err := s.repo.InsertarPeriodoAnteriorCargo(cong, rol, in.PersonaID, *ini, *fin, alta, baja, a.PersonaID); err != nil {
		return traducirErrorPeriodoCargo(err)
	}
	return nil
}
