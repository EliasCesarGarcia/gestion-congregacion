/**
 * ARCHIVO: motivos.go
 * UBICACIÓN: backend/internal/service/motivos.go
 * DESCRIPCIÓN: Reglas del catálogo de motivos de puestos.
 *
 * REGLAS (las hace cumplir el backend):
 *  - Dos tipos: "asignar" y "quitar".
 *  - Solo el superadmin crea, edita o desactiva motivos (lo exige la ruta).
 *  - Un motivo no se borra: se desactiva (activo = false).
 *  - Al asignar o quitar un puesto el motivo es opcional; si se envía, debe
 *    existir, estar activo y ser del tipo correcto.
 */

package service

import (
	"errors"
	"strings"
	"unicode/utf8"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

var (
	ErrMotivoInvalido     = errors.New("motivo no válido: debe existir, estar activo y ser del tipo correcto")
	ErrMotivoDatos        = errors.New("el texto del motivo es obligatorio (máximo 100 caracteres) y el orden va de 0 a 9999")
	ErrMotivoTipoInvalido = errors.New("tipo de motivo no válido (asignar o quitar)")
	ErrMotivoSinCambios   = errors.New("no se indicó ningún campo para modificar")
	ErrMotivoNoExiste     = errors.New("el motivo no existe")
	ErrMotivoExiste       = errors.New("ya existe un motivo con ese texto en ese tipo")
)

const (
	maxCaracteresMotivo = 100
	maxOrdenMotivo      = 9999
)

func tipoMotivoValido(t string) bool {
	return t == "asignar" || t == "quitar"
}

// normalizarTextoMotivo recorta espacios y valida el texto.
func normalizarTextoMotivo(t string) (string, error) {
	t = strings.TrimSpace(t)
	if t == "" || !utf8.ValidString(t) || strings.ContainsRune(t, 0) {
		return "", ErrMotivoDatos
	}
	if utf8.RuneCountInString(t) > maxCaracteresMotivo {
		return "", ErrMotivoDatos
	}
	return t, nil
}

// ListMotivos: tipo "" = ambos. soloActivos=true es lo que ven los encargados
// generales; el superadmin pide false para ver también los desactivados.
func (s *Service) ListMotivos(tipo string, soloActivos bool) ([]models.MotivoPuesto, error) {
	tipo = strings.ToLower(strings.TrimSpace(tipo))
	if tipo != "" && !tipoMotivoValido(tipo) {
		return nil, ErrMotivoTipoInvalido
	}
	return s.repo.ListMotivos(tipo, soloActivos)
}

// CrearMotivo: solo superadmin (lo comprueba la ruta).
func (s *Service) CrearMotivo(tipo, texto string, orden int) (*models.MotivoPuesto, error) {
	tipo = strings.ToLower(strings.TrimSpace(tipo))
	if !tipoMotivoValido(tipo) {
		return nil, ErrMotivoTipoInvalido
	}
	texto, err := normalizarTextoMotivo(texto)
	if err != nil {
		return nil, err
	}
	if orden < 0 || orden > maxOrdenMotivo {
		return nil, ErrMotivoDatos
	}

	m, err := s.repo.CrearMotivo(tipo, texto, orden)
	if errors.Is(err, repository.ErrMotivoDuplicado) {
		return nil, ErrMotivoExiste
	}
	return m, err
}

// EditarMotivo: cambia solo los campos enviados (nil = no tocar). Desactivar
// un motivo es activo=false. Renombrarlo NO cambia el historial viejo.
func (s *Service) EditarMotivo(id int64, texto *string, orden *int, activo *bool) (*models.MotivoPuesto, error) {
	if id <= 0 {
		return nil, ErrMotivoNoExiste
	}
	if texto == nil && orden == nil && activo == nil {
		return nil, ErrMotivoSinCambios
	}
	if texto != nil {
		t, err := normalizarTextoMotivo(*texto)
		if err != nil {
			return nil, err
		}
		texto = &t
	}
	if orden != nil && (*orden < 0 || *orden > maxOrdenMotivo) {
		return nil, ErrMotivoDatos
	}

	m, err := s.repo.EditarMotivo(id, texto, orden, activo)
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

// validarMotivo: motivoID 0 = sin motivo (opcional). Si viene, debe existir,
// estar activo y ser del tipo pedido. Devuelve nil si no hay motivo.
func (s *Service) validarMotivo(motivoID int64, tipo string) (*int64, error) {
	if motivoID == 0 {
		return nil, nil
	}
	if motivoID < 0 {
		return nil, ErrMotivoInvalido
	}
	m, err := s.repo.GetMotivo(motivoID)
	if err != nil {
		return nil, err
	}
	if m == nil || !m.Activo || m.Tipo != tipo {
		return nil, ErrMotivoInvalido
	}
	return &motivoID, nil
}
