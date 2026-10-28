/**
 * ARCHIVO: puestos.go
 * UBICACIÓN: backend/internal/service/puestos.go
 * DESCRIPCIÓN: Reglas de los puestos de cada departamento.
 *
 * REGLAS (las hace cumplir el backend; la pantalla solo oculta):
 *  - Puestos: encargado, auxiliar y auxiliar_2 (opcional).
 *  - Un solo encargado, un solo auxiliar y un solo auxiliar_2 por
 *    departamento y congregación (índice único en la base).
 *  - Una persona no puede tener dos puestos en el mismo departamento.
 *  - El encargado edita (nivel_acceso 2); los auxiliares solo leen (nivel 1).
 *    El nivel lo decide SIEMPRE el servidor a partir del puesto.
 *  - Cada asignación y cada baja de puesto queda en el historial
 *    (core_puestos_historial); nunca se borra. Al asignar se puede guardar un
 *    texto corto en "detalles" (máximo 100 palabras).
 */

package service

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"gestion-congregacion/backend/internal/models"
)

var (
	ErrPuestoInvalido       = errors.New("puesto no válido (encargado, auxiliar o auxiliar_2)")
	ErrPuestoOcupado        = errors.New("ese puesto ya está ocupado: quite primero a la persona actual")
	ErrPersonaYaTienePuesto = errors.New("la persona ya tiene otro puesto en este departamento: quítelo primero")
	ErrSinCongregacion      = errors.New("la persona no tiene congregación")
	ErrDetallesInvalido     = errors.New("los detalles no pueden superar 100 palabras ni 1000 caracteres")
)

const (
	maxPalabrasDetalles   = 100
	maxCaracteresDetalles = 1000

	historialLimitePorDefecto = 20
	historialLimiteMaximo     = 100
)

// nivelPorPuesto: encargado edita (2); auxiliares solo ven (1).
var nivelPorPuesto = map[string]int{
	"encargado":  2,
	"auxiliar":   1,
	"auxiliar_2": 1,
}

// normalizarDetalles recorta espacios y valida el texto: máximo 100 palabras
// y 1000 caracteres, UTF-8 válido y sin caracteres nulos (la base los rechaza).
func normalizarDetalles(d string) (string, error) {
	d = strings.TrimSpace(d)
	if d == "" {
		return "", nil
	}
	if !utf8.ValidString(d) || strings.ContainsRune(d, 0) {
		return "", ErrDetallesInvalido
	}
	if utf8.RuneCountInString(d) > maxCaracteresDetalles || len(strings.Fields(d)) > maxPalabrasDetalles {
		return "", ErrDetallesInvalido
	}
	return d, nil
}

// ListAsignaciones: puestos ocupados en la congregación del actor.
func (s *Service) ListAsignaciones(a *models.Actor) ([]models.AsignacionPuesto, error) {
	if a.CongregacionID == "" {
		return nil, ErrSinCongregacion
	}
	return s.repo.ListAsignaciones(a.CongregacionID)
}

// AsignarPuesto: el permiso del actor (rol) ya lo revisó el handler.
// detalles es opcional (texto corto); si el puesto ya estaba asignado igual,
// repetir el pedido no cambia nada y no toca el historial.
func (s *Service) AsignarPuesto(a *models.Actor, esSuper bool, personaDestino int, moduloID, puesto, detalles string) error {
	if personaDestino <= 0 {
		return ErrPersonaIDInvalid
	}
	puesto = strings.ToLower(strings.TrimSpace(puesto))
	nivel, ok := nivelPorPuesto[puesto]
	if !ok {
		return ErrPuestoInvalido
	}
	moduloID = strings.ToLower(strings.TrimSpace(moduloID))
	if moduloID == "" || len(moduloID) > 60 {
		return ErrModuloNoExiste
	}
	detalles, err := normalizarDetalles(detalles)
	if err != nil {
		return err
	}

	destino := fmt.Sprintf("%d", personaDestino)
	if err := s.destinoValido(a, esSuper, destino, true); err != nil {
		return err
	}

	m, err := s.repo.GetModulo(moduloID)
	if err != nil {
		return err
	}
	if m == nil {
		return ErrModuloNoExiste
	}
	if m.EsComun {
		return ErrModuloComun
	}

	filas, err := s.repo.AsignarPuesto(destino, moduloID, puesto, nivel, a.PersonaID, detalles)
	if err != nil {
		return err
	}
	if filas > 0 {
		return nil
	}

	// 0 filas = conflicto. Se averigua cuál para dar el error correcto.
	actual, err := s.repo.GetPuestoDe(destino, moduloID)
	if err != nil {
		return err
	}
	if actual == puesto {
		return nil // ya estaba asignado así: repetir no cambia nada
	}
	if actual != "" {
		return ErrPersonaYaTienePuesto
	}
	return ErrPuestoOcupado
}

// ListHistorialPuestos: historial de la congregación del actor, paginado.
// moduloID y personaID son filtros opcionales (vacío / 0 = sin filtro).
func (s *Service) ListHistorialPuestos(a *models.Actor, moduloID string, personaID, page, limit int) (*models.HistorialPuestosPagina, error) {
	if a.CongregacionID == "" {
		return nil, ErrSinCongregacion
	}
	moduloID = strings.ToLower(strings.TrimSpace(moduloID))
	if len(moduloID) > 60 {
		return nil, ErrModuloNoExiste
	}
	if personaID < 0 {
		return nil, ErrPersonaIDInvalid
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = historialLimitePorDefecto
	}
	if limit > historialLimiteMaximo {
		limit = historialLimiteMaximo
	}

	filtroPersona := ""
	if personaID > 0 {
		filtroPersona = fmt.Sprintf("%d", personaID)
	}

	lista, total, err := s.repo.ListHistorialPuestos(a.CongregacionID, moduloID, filtroPersona, limit, (page-1)*limit)
	if err != nil {
		return nil, err
	}
	return &models.HistorialPuestosPagina{Historial: lista, Total: total, Page: page, Limit: limit}, nil
}
