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
 */

package service

import (
	"errors"
	"fmt"
	"strings"

	"gestion-congregacion/backend/internal/models"
)

var (
	ErrPuestoInvalido       = errors.New("puesto no válido (encargado, auxiliar o auxiliar_2)")
	ErrPuestoOcupado        = errors.New("ese puesto ya está ocupado: quite primero a la persona actual")
	ErrPersonaYaTienePuesto = errors.New("la persona ya tiene otro puesto en este departamento: quítelo primero")
	ErrSinCongregacion      = errors.New("la persona no tiene congregación")
)

// nivelPorPuesto: encargado edita (2); auxiliares solo ven (1).
var nivelPorPuesto = map[string]int{
	"encargado":  2,
	"auxiliar":   1,
	"auxiliar_2": 1,
}

// ListAsignaciones: puestos ocupados en la congregación del actor.
func (s *Service) ListAsignaciones(a *models.Actor) ([]models.AsignacionPuesto, error) {
	if a.CongregacionID == "" {
		return nil, ErrSinCongregacion
	}
	return s.repo.ListAsignaciones(a.CongregacionID)
}

// AsignarPuesto: el permiso del actor (rol) ya lo revisó el handler.
func (s *Service) AsignarPuesto(a *models.Actor, esSuper bool, personaDestino int, moduloID, puesto string) error {
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

	filas, err := s.repo.AsignarPuesto(destino, moduloID, puesto, nivel)
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
