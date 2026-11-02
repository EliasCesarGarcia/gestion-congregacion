/**
 * ARCHIVO: personas.go
 * UBICACIÓN: backend/internal/service/personas.go
 * DESCRIPCIÓN: Reglas de lectura del módulo de personas.
 *
 * REGLAS (las hace cumplir el backend):
 *  - Una persona común nunca ve a otras: solo su ficha y sus historiales.
 *  - Coordinador, secretario y servicio ven SOLO su congregación.
 *  - El superadmin ve todas, o una sola si manda congregacion_id.
 *  - Una persona de otra congregación responde igual que una inexistente.
 *  - Los filtros de situación, estado, condición y grupo se validan contra
 *    las listas cerradas; un valor raro es un error, no se ignora.
 */

package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"

	"gestion-congregacion/backend/internal/models"
)

var ErrPersonaFiltro = errors.New("filtro no válido (estado: ALTA o BAJA; condición: A o I; situaciones: valores de la lista o 'sin'; grupo: número o 'sin')")

const (
	personasLimitePorDefecto = 20
	personasLimiteMaximo     = 50
	personasPaginaMaxima     = 100000
	personasMaxPalabras      = 5
	personasMaxLargoPalabra  = 40
	personasMaxLargoBusqueda = 80
	personasMaxGrupo         = 9999
)

var (
	situacionesLista1 = []string{"Publicador", "Precursor Auxiliar", "Precursor Auxiliar de Continuo", "Precursor Regular", "Precursor Especial", "Misionero"}
	situacionesLista2 = []string{"Siervo Ministerial", "Anciano"}
	situacionesLista3 = []string{"Superintendente", "Auxiliar de Grupo"}
)

// situacionCanonica devuelve el valor escrito tal como figura en la lista
// ("anciano" → "Anciano"). "" no filtra; "sin" (si se permite) es "sin valor".
func situacionCanonica(v string, validas []string, permitirSin bool) (string, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return "", nil
	}
	if permitirSin && strings.EqualFold(v, "sin") {
		return "sin", nil
	}
	for _, c := range validas {
		if strings.EqualFold(v, c) {
			return c, nil
		}
	}
	return "", ErrPersonaFiltro
}

// palabrasBusqueda parte lo escrito en palabras (hasta 5), recorta el largo y
// escapa los comodines de LIKE: lo que escribe la persona es texto común.
func palabrasBusqueda(q string) []string {
	q = strings.TrimSpace(q)
	if !utf8.ValidString(q) || strings.ContainsRune(q, 0) {
		return nil
	}
	if letras := []rune(q); len(letras) > personasMaxLargoBusqueda {
		q = string(letras[:personasMaxLargoBusqueda])
	}
	escapar := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	palabras := []string{}
	for _, p := range strings.Fields(q) {
		if letras := []rune(p); len(letras) > personasMaxLargoPalabra {
			p = string(letras[:personasMaxLargoPalabra])
		}
		palabras = append(palabras, escapar.Replace(p))
		if len(palabras) == personasMaxPalabras {
			break
		}
	}
	return palabras
}

// prepararFiltroPersonas valida y normaliza el filtro que llega de la pantalla.
func prepararFiltroPersonas(in models.FiltroPersonas) (models.FiltroPersonas, error) {
	var f models.FiltroPersonas
	var err error

	f.Estado = strings.ToUpper(strings.TrimSpace(in.Estado))
	if f.Estado != "" && f.Estado != "ALTA" && f.Estado != "BAJA" {
		return f, ErrPersonaFiltro
	}
	f.Condicion = strings.ToUpper(strings.TrimSpace(in.Condicion))
	if f.Condicion != "" && f.Condicion != "A" && f.Condicion != "I" {
		return f, ErrPersonaFiltro
	}
	if f.Situacion1, err = situacionCanonica(in.Situacion1, situacionesLista1, false); err != nil {
		return f, err
	}
	if f.Situacion2, err = situacionCanonica(in.Situacion2, situacionesLista2, true); err != nil {
		return f, err
	}
	if f.Situacion3, err = situacionCanonica(in.Situacion3, situacionesLista3, true); err != nil {
		return f, err
	}

	g := strings.ToLower(strings.TrimSpace(in.Grupo))
	if g == "" || g == "sin" {
		f.Grupo = g
	} else {
		n, err := strconv.Atoi(g)
		if err != nil || n < 1 || n > personasMaxGrupo {
			return f, ErrPersonaFiltro
		}
		f.Grupo = strconv.Itoa(n)
	}

	f.RolApp = strings.ToLower(strings.TrimSpace(in.RolApp))
	if f.RolApp != "" {
		valido := false
		for _, rol := range rolesApp {
			if f.RolApp == rol {
				valido = true
			}
		}
		if !valido {
			return f, ErrPersonaFiltro
		}
	}

	f.Palabras = palabrasBusqueda(in.Q)
	return f, nil
}

func paginarPersonasLista(page, limit int) (int, int, int) {
	if limit <= 0 {
		limit = personasLimitePorDefecto
	}
	if limit > personasLimiteMaximo {
		limit = personasLimiteMaximo
	}
	if page < 1 {
		page = 1
	}
	if page > personasPaginaMaxima {
		page = personasPaginaMaxima
	}
	return page, limit, (page - 1) * limit
}

// alcancePersonas decide qué congregación(es) puede ver el actor. Devuelve el
// id a filtrar y si son todas (solo el superadmin, y solo si no pide una).
func (s *Service) alcancePersonas(a *models.Actor, esSuper bool, congregacionParam string) (string, bool, error) {
	if esSuper {
		congregacionParam = strings.TrimSpace(congregacionParam)
		if congregacionParam == "" {
			return "", true, nil
		}
		id, err := normalizarIDCongregacion(congregacionParam)
		if err != nil {
			return "", false, err
		}
		return id, false, nil
	}
	if a.CongregacionID == "" {
		return "", false, ErrSinCongregacion
	}
	return a.CongregacionID, false, nil
}

// BuscarPersonas: lista paginada con filtros. El permiso por rol lo revisó el handler.
func (s *Service) BuscarPersonas(a *models.Actor, esSuper bool, in models.FiltroPersonas, page, limit int) (*models.BusquedaPersonasPagina, error) {
	congID, todas, err := s.alcancePersonas(a, esSuper, in.CongregacionID)
	if err != nil {
		return nil, err
	}
	f, err := prepararFiltroPersonas(in)
	if err != nil {
		return nil, err
	}
	page, limit, offset := paginarPersonasLista(page, limit)
	lista, total, err := s.repo.BuscarPersonas(congID, todas, f, limit, offset)
	if err != nil {
		return nil, err
	}
	return &models.BusquedaPersonasPagina{Personas: lista, Total: total, Page: page, Limit: limit}, nil
}

// ConteosPersonas: los números del módulo para la congregación (o todas).
func (s *Service) ConteosPersonas(a *models.Actor, esSuper bool, congregacionParam string) (*models.ConteosPersonas, error) {
	congID, todas, err := s.alcancePersonas(a, esSuper, congregacionParam)
	if err != nil {
		return nil, err
	}
	return s.repo.ConteosPersonas(congID, todas)
}

// FichaPersona: la ficha de una persona de la congregación del actor.
func (s *Service) FichaPersona(a *models.Actor, esSuper bool, personaID int) (*models.PersonaFicha, error) {
	if personaID <= 0 {
		return nil, ErrPersonaIDInvalid
	}
	if err := s.destinoValido(a, esSuper, fmt.Sprintf("%d", personaID), false); err != nil {
		return nil, err
	}
	f, err := s.repo.GetFichaPersona(personaID)
	if err != nil {
		return nil, err
	}
	if f == nil {
		return nil, ErrPersonaNoValida
	}
	return f, nil
}

// MiFicha: la ficha de la propia persona (el id sale de la sesión).
func (s *Service) MiFicha(a *models.Actor) (*models.PersonaFicha, error) {
	id, err := strconv.Atoi(a.PersonaID)
	if err != nil || id <= 0 {
		return nil, ErrPersonaIDInvalid
	}
	f, err := s.repo.GetFichaPersona(id)
	if err != nil {
		return nil, err
	}
	if f == nil {
		return nil, ErrPersonaNoValida
	}
	return f, nil
}

func (s *Service) historialDe(personaID int) (*models.HistorialPersona, error) {
	estado, err := s.repo.ListHistorialEstadoPersona(personaID)
	if err != nil {
		return nil, err
	}
	situaciones, err := s.repo.ListHistorialSituacionesPersona(personaID)
	if err != nil {
		return nil, err
	}
	return &models.HistorialPersona{PersonaID: personaID, Estado: estado, Situaciones: situaciones}, nil
}

// HistorialPersona: los historiales de una persona de la congregación del actor.
func (s *Service) HistorialPersona(a *models.Actor, esSuper bool, personaID int) (*models.HistorialPersona, error) {
	if personaID <= 0 {
		return nil, ErrPersonaIDInvalid
	}
	if err := s.destinoValido(a, esSuper, fmt.Sprintf("%d", personaID), false); err != nil {
		return nil, err
	}
	return s.historialDe(personaID)
}

// MiHistorial: los historiales de la propia persona.
func (s *Service) MiHistorial(a *models.Actor) (*models.HistorialPersona, error) {
	id, err := strconv.Atoi(a.PersonaID)
	if err != nil || id <= 0 {
		return nil, ErrPersonaIDInvalid
	}
	return s.historialDe(id)
}
