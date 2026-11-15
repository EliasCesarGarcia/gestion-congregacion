/**
 * ARCHIVO: grupos.go
 * UBICACIÓN: backend/internal/service/grupos.go
 * DESCRIPCIÓN: Reglas de gestión de los grupos de servicio.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Coordinador, secretario y servicio gestionan SOLO los grupos de su
 *    congregación; el superadmin los de cualquiera (al crear debe indicarla).
 *    Un grupo de otra congregación responde igual que uno inexistente.
 *  - Los grupos se identifican solo por número (1 a 9999). No puede haber dos
 *    grupos ACTIVOS con el mismo número en una congregación.
 *  - Un grupo no se borra: se cierra, con fecha, y solo si no tiene personas
 *    ni encargados vigentes. Un grupo cerrado no se renumera ni recibe gente.
 *  - Renumerar un grupo no cambia los movimientos viejos: cada uno guarda el
 *    número que tenía el grupo en su momento.
 *  - La fecha de inicio es opcional (puede no conocerse), nunca futura. La
 *    fecha de cierre es obligatoria y no puede ser anterior al inicio del
 *    grupo ni a ningún movimiento de sus integrantes.
 */

package service

import (
	"errors"
	"strings"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

var (
	// ErrGrupoNoExiste: el grupo no existe o es de otra congregación (404).
	ErrGrupoNoExiste = errors.New("el grupo no existe en su congregación")
	// ErrGrupoNumeroExiste: ya hay un grupo activo con ese número (409).
	ErrGrupoNumeroExiste = errors.New("ya hay un grupo activo con ese número en la congregación")
	// ErrGrupoConGente: el grupo todavía tiene gente o encargados (409).
	ErrGrupoConGente = errors.New("el grupo todavía tiene personas o encargados vigentes: primero hay que pasarlos a otro grupo")
	// ErrGrupoCerrado: el grupo ya está cerrado (409).
	ErrGrupoCerrado = errors.New("el grupo está cerrado")
)

// EntradaGrupo: lo que manda la pantalla al crear un grupo. CongregacionID
// solo lo usa el superadmin.
type EntradaGrupo struct {
	CongregacionID string `json:"congregacion_id"`
	Numero         int    `json:"numero"`
	FechaInicio    string `json:"fecha_inicio"`
}

func traducirErrorGrupo(err error) error {
	switch {
	case errors.Is(err, repository.ErrGrupoInexistente):
		return ErrGrupoNoExiste
	case errors.Is(err, repository.ErrGrupoNumeroDuplicado):
		return ErrGrupoNumeroExiste
	case errors.Is(err, repository.ErrGrupoConGente):
		return ErrGrupoConGente
	case errors.Is(err, repository.ErrGrupoCerrado):
		return ErrGrupoCerrado
	case errors.Is(err, repository.ErrFechaAnteriorGrupo):
		return errDatosPersona("la fecha de cierre es anterior al inicio del grupo o a algún movimiento de sus integrantes")
	}
	return err
}

func numeroGrupoValido(n int) error {
	if n < 1 || n > personasMaxGrupo {
		return errDatosPersona("el número de grupo debe ser de 1 a %d", personasMaxGrupo)
	}
	return nil
}

// grupoDelAlcance: el grupo existe y es de la congregación del actor (el
// superadmin puede en cualquiera). Mismo error si no existe o es de otra.
func (s *Service) grupoDelAlcance(a *models.Actor, esSuper bool, id int) (*models.GrupoBase, error) {
	if id <= 0 {
		return nil, ErrGrupoNoExiste
	}
	if !esSuper && a.CongregacionID == "" {
		return nil, ErrSinCongregacion
	}
	g, err := s.repo.GetGrupo(id)
	if err != nil {
		return nil, err
	}
	if g == nil || (!esSuper && g.CongregacionID != a.CongregacionID) {
		return nil, ErrGrupoNoExiste
	}
	return g, nil
}

// ListGrupos: los grupos de la congregación del actor (el superadmin elige una
// con congregacionParam, o ve todas si lo deja vacío). Los cerrados solo se
// incluyen si incluirCerrados es true: los formularios ofrecen solo los vigentes.
func (s *Service) ListGrupos(a *models.Actor, esSuper bool, congregacionParam string, incluirCerrados bool) (*models.GruposLista, error) {
	congID, todas, err := s.alcancePersonas(a, esSuper, congregacionParam)
	if err != nil {
		return nil, err
	}
	return s.repo.ListGrupos(congID, todas, incluirCerrados)
}

// CrearGrupo: devuelve el id nuevo.
func (s *Service) CrearGrupo(a *models.Actor, esSuper bool, in EntradaGrupo) (int, error) {
	congID := a.CongregacionID
	if esSuper {
		if strings.TrimSpace(in.CongregacionID) == "" {
			return 0, errDatosPersona("falta la congregación")
		}
		normalizada, err := normalizarIDCongregacion(in.CongregacionID)
		if err != nil {
			return 0, err
		}
		congID = normalizada
	} else if congID == "" {
		return 0, ErrSinCongregacion
	}

	if err := numeroGrupoValido(in.Numero); err != nil {
		return 0, err
	}
	fecha, err := fechaPersona(in.FechaInicio, false)
	if err != nil {
		return 0, err
	}

	id, err := s.repo.CrearGrupo(congID, in.Numero, fecha, a.PersonaID)
	if err != nil {
		return 0, traducirErrorGrupo(err)
	}
	if id == 0 {
		return 0, ErrCongregacionNoExiste
	}
	return id, nil
}

// EditarGrupo cambia el número de un grupo activo.
func (s *Service) EditarGrupo(a *models.Actor, esSuper bool, id, numero int) error {
	g, err := s.grupoDelAlcance(a, esSuper, id)
	if err != nil {
		return err
	}
	if err := numeroGrupoValido(numero); err != nil {
		return err
	}
	if !g.Activo {
		return ErrGrupoCerrado
	}
	if g.Numero == numero {
		return ErrPersonaSinCambio
	}
	return traducirErrorGrupo(s.repo.RenumerarGrupo(id, numero, a.PersonaID))
}

// CerrarGrupo cierra un grupo activo con fecha, si no tiene gente.
func (s *Service) CerrarGrupo(a *models.Actor, esSuper bool, id int, fecha string) error {
	g, err := s.grupoDelAlcance(a, esSuper, id)
	if err != nil {
		return err
	}
	f, err := fechaPersona(fecha, true)
	if err != nil {
		return err
	}
	if !g.Activo {
		return ErrGrupoCerrado
	}
	if g.FechaInicio != nil && f < *g.FechaInicio {
		return errDatosPersona("la fecha de cierre no puede ser anterior al inicio del grupo")
	}
	return traducirErrorGrupo(s.repo.CerrarGrupo(id, f, a.PersonaID))
}
