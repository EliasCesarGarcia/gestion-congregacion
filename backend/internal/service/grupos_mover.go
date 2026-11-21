/**
 * ARCHIVO: grupos_mover.go
 * UBICACIÓN: backend/internal/service/grupos_mover.go
 * DESCRIPCIÓN: Reglas para mover una persona de grupo, o varias a la vez.
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
 *  - Varias personas a la vez (hasta gruposMoverMaximo): todas de la misma
 *    congregación, con una sola fecha, motivo y detalle. Es todo o nada: si
 *    una falla no se mueve ninguna, y el error dice a quién le pasó. Las que ya
 *    estaban en el destino no cambian y se cuentan aparte.
 */

package service

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// ErrPersonaEncargadoGrupo: la persona es superintendente o auxiliar (409).
var ErrPersonaEncargadoGrupo = errors.New("la persona es superintendente o auxiliar de su grupo: primero hay que reemplazarla en ese cargo")

// gruposMoverMaximo: tope de personas por movimiento en lote.
const gruposMoverMaximo = 100

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
	case errors.Is(err, repository.ErrFechaAnteriorAltaPersona):
		return errDatosPersona("la fecha es anterior a la fecha de alta de la persona")
	}
	return traducirErrorGrupo(err)
}

// traducirErrorMovimientoLote: como traducirErrorMovimiento, pero si el error
// viene de una persona concreta del lote le antepone su nombre. El tipo de
// error (y con él el código HTTP) no cambia.
func traducirErrorMovimientoLote(err error) error {
	var em *repository.ErrMovimientoPersona
	if !errors.As(err, &em) {
		return traducirErrorMovimiento(err)
	}
	traducido := traducirErrorMovimiento(em.Err)
	quien := strings.TrimSpace(em.Nombre)
	if quien == "" {
		quien = fmt.Sprintf("persona %d", em.PersonaID)
	}
	if errors.Is(traducido, ErrPersonaDatos) {
		// El mensaje de datos no válidos empieza siempre con el mismo texto:
		// el nombre va después, para que el aviso siga viéndose igual.
		mensaje := strings.TrimPrefix(traducido.Error(), ErrPersonaDatos.Error()+": ")
		return errDatosPersona("%s: %s", quien, mensaje)
	}
	return fmt.Errorf("%s: %w", quien, traducido)
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

// MoverPersonasDeGrupo pasa a varias personas al grupo grupoID (0 = sin
// grupo) con una sola fecha, motivo y detalle. Devuelve cuántas se movieron y
// cuántas ya estaban en ese destino. Si ninguna cambia, ErrPersonaSinCambio.
func (s *Service) MoverPersonasDeGrupo(a *models.Actor, esSuper bool, personaIDs []int, grupoID int, fecha, detalles string, motivoID int64) (int, int, error) {
	if grupoID < 0 {
		return 0, 0, errDatosPersona("el grupo no es válido")
	}

	// Lista de personas: válidas, sin repetir y en orden de id.
	vistos := make(map[int]bool, len(personaIDs))
	ids := make([]int, 0, len(personaIDs))
	for _, id := range personaIDs {
		if id <= 0 {
			return 0, 0, errDatosPersona("hay una persona no válida en la lista")
		}
		if !vistos[id] {
			vistos[id] = true
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return 0, 0, errDatosPersona("no hay personas para mover")
	}
	if len(ids) > gruposMoverMaximo {
		return 0, 0, errDatosPersona("se pueden mover hasta %d personas a la vez", gruposMoverMaximo)
	}
	sort.Ints(ids)

	f, err := fechaPersona(fecha, true)
	if err != nil {
		return 0, 0, err
	}
	detalles, err = normalizarDetalles(detalles)
	if err != nil {
		return 0, 0, err
	}
	motivo, err := s.validarMotivoDeUso(motivoID, "personas.grupo")
	if err != nil {
		return 0, 0, err
	}

	// Cada persona debe existir, ser del alcance del actor y estar en ALTA, y
	// todas deben ser de la misma congregación. (La fecha contra el alta de
	// cada una la comprueba el repositorio, que dice a quién le pasa.)
	congID := ""
	for _, id := range ids {
		ficha, err := s.fichaParaEscribir(a, esSuper, id, true)
		if err != nil {
			return 0, 0, err
		}
		if congID == "" {
			congID = ficha.CongregacionID
		} else if ficha.CongregacionID != congID {
			return 0, 0, errDatosPersona("todas las personas deben ser de la misma congregación")
		}
	}

	var destino *int
	if grupoID > 0 {
		g, err := s.grupoDelAlcance(a, esSuper, grupoID)
		if err != nil {
			return 0, 0, err
		}
		if g.CongregacionID != congID {
			return 0, 0, ErrGrupoNoExiste
		}
		if !g.Activo {
			return 0, 0, ErrGrupoCerrado
		}
		destino = &grupoID
	}

	movidas, sinCambio, err := s.repo.MoverPersonasDeGrupo(ids, destino, f, motivo, detalles, a.PersonaID)
	if err != nil {
		return 0, 0, traducirErrorMovimientoLote(err)
	}
	if movidas == 0 {
		return 0, sinCambio, ErrPersonaSinCambio
	}
	return movidas, sinCambio, nil
}
