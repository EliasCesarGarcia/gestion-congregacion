/**
 * ARCHIVO: cargos.go
 * UBICACIÓN: backend/internal/service/cargos.go
 * DESCRIPCIÓN: Reglas de la gestión de los tres cargos de la congregación
 * (coordinador, secretario y servicio). Solo superadmin (lo exige la ruta).
 *
 * REGLAS (las hace cumplir el backend):
 *  - La congregación debe existir; puede estar deshabilitada.
 *  - El cambio es SIEMPRE de los tres cargos: cada uno trae su persona. Los que
 *    ya la tienen no cambian; si ninguno cambia, no hay nada que hacer.
 *  - Un cargo que cambia exige el motivo de alta (uso personas.cargo_alta) y,
 *    si había titular, también el motivo de baja (personas.cargo_baja). Los
 *    detalles son opcionales (hasta 100 palabras).
 *  - La fecha es obligatoria, de hoy o anterior, nunca futura. Cierra al
 *    titular anterior y abre al nuevo con la misma fecha, en una transacción.
 *  - Las personas deben ser de la congregación, estar en ALTA y ser Anciano.
 *    Una misma persona puede tener dos o los tres cargos.
 *  - Tras el cambio, los tres cargos tienen exactamente un titular en ALTA.
 *  - Las fechas de un período se corrigen con /api/personas/roles/fechas; los
 *    motivos y detalles, con CorregirCargo.
 */

package service

import (
	"errors"
	"strings"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// ErrCargosCongregacionNoExiste: la congregación no existe (404).
var ErrCargosCongregacionNoExiste = errors.New("la congregación no existe")

// cargosRolesOrden: los tres cargos, en el orden en que se muestran.
var cargosRolesOrden = []string{"coordinador", "secretario", "servicio"}

func traducirErrorCargo(err error) error {
	switch {
	case errors.Is(err, repository.ErrFilaInexistente):
		return ErrFilaHistorialNoExiste
	case errors.Is(err, repository.ErrFinEnRolVigente):
		return errDatosPersona("el cargo sigue vigente: todavía no tiene fin, así que no tiene motivo ni detalles de fin")
	}
	return err
}

// congregacionParaCargos valida el id de la congregación y que exista.
func (s *Service) congregacionParaCargos(id string) (string, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return "", errDatosPersona("falta la congregación")
	}
	existe, err := s.repo.ExisteCongregacionCargos(id)
	if err != nil {
		return "", err
	}
	if !existe {
		return "", ErrCargosCongregacionNoExiste
	}
	return id, nil
}

// motivoCargoObligatorio valida un motivo que es obligatorio: debe venir y ser
// un motivo activo del uso indicado. cual = "alta" o "baja".
func (s *Service) motivoCargoObligatorio(id int64, uso, cual, rol string) (*int64, error) {
	if id <= 0 {
		return nil, errDatosPersona("el motivo de %s del %s es obligatorio", cual, rol)
	}
	return s.validarMotivoDeUso(id, uso)
}

// ListCargos: los tres cargos de la congregación con su titular y su historial.
func (s *Service) ListCargos(congregacionID string) (*models.CargosCongregacion, error) {
	cong, err := s.congregacionParaCargos(congregacionID)
	if err != nil {
		return nil, err
	}
	filas, err := s.repo.ListHistorialCargos(cong)
	if err != nil {
		return nil, err
	}

	res := &models.CargosCongregacion{
		CongregacionID: cong,
		Completos:      true,
		Cargos:         []models.CargoActual{},
	}
	for _, rol := range cargosRolesOrden {
		c := models.CargoActual{Rol: rol, Historial: []models.FilaCargo{}}
		for i := range filas {
			if filas[i].Rol != rol {
				continue
			}
			c.Historial = append(c.Historial, filas[i])
			if filas[i].Vigente && c.Titular == nil {
				f := filas[i]
				c.Titular = &f
			}
		}
		if c.Titular == nil {
			res.Completos = false
		}
		res.Cargos = append(res.Cargos, c)
	}
	return res, nil
}

// CambiarCargos cambia los titulares de los cargos de una congregación.
func (s *Service) CambiarCargos(a *models.Actor, in models.CambioCargos) error {
	cong, err := s.congregacionParaCargos(in.CongregacionID)
	if err != nil {
		return err
	}
	f, err := fechaPersona(in.Fecha, true)
	if err != nil {
		return err
	}
	fechaHora, err := fechaHoraPersona(f)
	if err != nil {
		return err
	}
	actuales, err := s.repo.TitularesCargos(cong)
	if err != nil {
		return err
	}

	pedidos := []struct {
		rol string
		c   models.CargoCambio
	}{
		{"coordinador", in.Coordinador},
		{"secretario", in.Secretario},
		{"servicio", in.Servicio},
	}

	titulares := map[string]int{}
	motivos := map[string]repository.MotivosRol{}
	for _, p := range pedidos {
		if p.c.PersonaID <= 0 {
			return errDatosPersona("falta elegir a la persona del cargo de %s", p.rol)
		}
		if actuales[p.rol] == p.c.PersonaID {
			continue // ese cargo no cambia
		}

		mAlta, err := s.motivoCargoObligatorio(p.c.MotivoAltaID, "personas.cargo_alta", "alta", p.rol)
		if err != nil {
			return err
		}
		dAlta, err := normalizarDetalles(p.c.DetallesAlta)
		if err != nil {
			return err
		}
		m := repository.MotivosRol{Alta: repository.MotivoRol{ID: mAlta, Detalles: dAlta}}

		if _, habia := actuales[p.rol]; habia {
			mBaja, err := s.motivoCargoObligatorio(p.c.MotivoBajaID, "personas.cargo_baja", "baja", p.rol)
			if err != nil {
				return err
			}
			dBaja, err := normalizarDetalles(p.c.DetallesBaja)
			if err != nil {
				return err
			}
			m.Baja = repository.MotivoRol{ID: mBaja, Detalles: dBaja}
		}

		titulares[p.rol] = p.c.PersonaID
		motivos[p.rol] = m
	}
	if len(titulares) == 0 {
		return ErrPersonaSinCambio
	}

	hecho, err := s.repo.RotarRolesPersonasConMotivos(cong, titulares, motivos, fechaHora, a.PersonaID)
	if err != nil {
		return traducirErrorRol(err)
	}
	if !hecho {
		return ErrPersonaSinCambio
	}
	return nil
}

// CorregirCargo corrige motivos y detalles de una fila del historial de roles.
// Cada dato en nil no se toca. Solo superadmin (lo exige la ruta).
func (s *Service) CorregirCargo(a *models.Actor, id int64, motivoIni *int64, detIni *string, motivoFin *int64, detFin *string) error {
	if id <= 0 {
		return errDatosPersona("falta el registro a corregir")
	}
	if motivoIni == nil && detIni == nil && motivoFin == nil && detFin == nil {
		return errDatosPersona("no hay nada para corregir")
	}
	mIni, err := s.motivoCorreccion(motivoIni, "personas.cargo_alta", "de alta del cargo")
	if err != nil {
		return err
	}
	mFin, err := s.motivoCorreccion(motivoFin, "personas.cargo_baja", "de baja del cargo")
	if err != nil {
		return err
	}
	dIni, err := detallesCorreccion(detIni)
	if err != nil {
		return err
	}
	dFin, err := detallesCorreccion(detFin)
	if err != nil {
		return err
	}

	cambio, err := s.repo.CorregirCargo(id, mIni, dIni, mFin, dFin, a.PersonaID)
	if err != nil {
		return traducirErrorCargo(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}