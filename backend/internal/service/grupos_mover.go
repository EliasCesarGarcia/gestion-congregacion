/**
 * ARCHIVO: grupos_mover.go
 * UBICACIÓN: backend/internal/service/grupos_mover.go
 * DESCRIPCIÓN: Reglas para mover una persona de grupo.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Coordinador, secretario y servicio mueven solo personas de SU
 *    congregación; el superadmin las de cualquiera.
 *  - La persona debe estar en ALTA. El grupo destino debe estar activo y ser
 *    de la misma congregación que la persona. grupo_id 0 = sin grupo.
 *  - La fecha es obligatoria, no futura, y no puede ser anterior al alta de la
 *    persona, al inicio de su pertenencia actual, al fin de un movimiento
 *    anterior ni al inicio del grupo destino. Nunca se inventan fechas.
 *  - El motivo es opcional (del catálogo, uso personas.grupo). Motivo y detalles
 *    (hasta 100 palabras) quedan como salida del grupo viejo y entrada al nuevo.
 *  - Un superintendente o auxiliar de grupo no se mueve: primero se lo reemplaza.
 *  - Pasarla al grupo en el que ya está, o dejarla sin grupo si ya no tenía, es
 *    "nada que cambiar".
 */

package service

import (
	"errors"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// ErrPersonaEncargadoGrupo: la persona es superintendente o auxiliar (409).
var ErrPersonaEncargadoGrupo = errors.New("la persona es superintendente o auxiliar de su grupo: primero hay que reemplazarla en ese cargo")

// traducirErrorMovimiento traduce los errores de movimientos de grupo y deja
// el resto al traductor de errores de grupos.
func traducirErrorMovimiento(err error) error {
	switch {
	case errors.Is(err, repository.ErrPersonaInexistente):
		return ErrPersonaNoValida
	case errors.Is(err, repository.ErrPersonaEstadoNoCorresponde):
		return ErrPersonaSinCambio
	case errors.Is(err, repository.ErrPersonaEncargadoGrupo):
		return ErrPersonaEncargadoGrupo
	case errors.Is(err, repository.ErrFechaAnteriorMovimiento):
		return errDatosPersona("la fecha es anterior al inicio de la pertenencia actual de la persona al grupo, o a un movimiento anterior")
	case errors.Is(err, repository.ErrFechaAnteriorIngresoGrupo):
		return errDatosPersona("la fecha es anterior al inicio del grupo")
	}
	return traducirErrorGrupo(err)
}

// MoverPersonaDeGrupo pasa a la persona al grupo grupoID (0 = sin grupo).
func (s *Service) MoverPersonaDeGrupo(a *models.Actor, esSuper bool, personaID, grupoID int, fecha, detalles string, motivoID int64) error {
	if grupoID < 0 {
		return errDatosPersona("el grupo no es válido")
	}
	f, err := fechaPersona(fecha, true)
	if err != nil {
		return err
	}
	detalles, err = normalizarDetalles(detalles)
	if err != nil {
		return err
	}
	motivo, err := s.validarMotivoDeUso(motivoID, "personas.grupo")
	if err != nil {
		return err
	}

	ficha, err := s.fichaParaEscribir(a, esSuper, personaID, true)
	if err != nil {
		return err
	}
	if ficha.FechaAlta != nil && f < *ficha.FechaAlta {
		return errDatosPersona("la fecha es anterior a la fecha de alta de la persona")
	}

	var destino *int
	if grupoID > 0 {
		g, err := s.grupoDelAlcance(a, esSuper, grupoID)
		if err != nil {
			return err
		}
		if g.CongregacionID != ficha.CongregacionID {
			return ErrGrupoNoExiste
		}
		if !g.Activo {
			return ErrGrupoCerrado
		}
		destino = &grupoID
	}

	cambio, err := s.repo.MoverPersonaDeGrupo(personaID, destino, f, motivo, detalles, a.PersonaID)
	if err != nil {
		return traducirErrorMovimiento(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}
