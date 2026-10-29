/**
 * ARCHIVO: motivos.go
 * UBICACIÓN: backend/internal/repository/motivos.go
 * DESCRIPCIÓN: Consultas del catálogo de motivos de puestos
 * (core_puestos_motivos). Nunca se borra un motivo: se desactiva.
 */

package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"gestion-congregacion/backend/internal/models"
)

// ErrMotivoDuplicado: ya existe un motivo con ese texto en ese tipo.
var ErrMotivoDuplicado = errors.New("motivo duplicado")

const columnasMotivo = "id, tipo, texto, activo, orden"

// ListMotivos devuelve los motivos, ordenados. tipo "" = ambos tipos.
// soloActivos=true oculta los desactivados.
func (r *Repository) ListMotivos(tipo string, soloActivos bool) ([]models.MotivoPuesto, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.MotivoPuesto{}
	res := r.db.WithContext(ctx).Raw(`
		SELECT `+columnasMotivo+`
		FROM core_puestos_motivos
		WHERE (?::text = '' OR tipo = ?::text)
		  AND (?::boolean = false OR activo = true)
		ORDER BY tipo ASC, orden ASC, id ASC`,
		tipo, tipo, soloActivos).Scan(&lista)
	if res.Error != nil {
		return nil, res.Error
	}
	return lista, nil
}

// GetMotivo devuelve un motivo por id, o nil si no existe.
func (r *Repository) GetMotivo(id int64) (*models.MotivoPuesto, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var m models.MotivoPuesto
	res := r.db.WithContext(ctx).Raw(
		"SELECT "+columnasMotivo+" FROM core_puestos_motivos WHERE id = ? LIMIT 1", id).Scan(&m)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &m, nil
}

// CrearMotivo inserta un motivo activo. Devuelve ErrMotivoDuplicado si ya
// existe el mismo texto (sin importar mayúsculas) en ese tipo.
func (r *Repository) CrearMotivo(tipo, texto string, orden int) (*models.MotivoPuesto, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var m models.MotivoPuesto
	res := r.db.WithContext(ctx).Raw(`
		INSERT INTO core_puestos_motivos (tipo, texto, orden)
		VALUES (?::text, ?::text, ?::integer)
		ON CONFLICT DO NOTHING
		RETURNING `+columnasMotivo, tipo, texto, orden).Scan(&m)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, ErrMotivoDuplicado
	}
	return &m, nil
}

// EditarMotivo cambia solo los campos que no son nil. Devuelve nil si el
// motivo no existe, y ErrMotivoDuplicado si el nuevo texto ya está en uso.
func (r *Repository) EditarMotivo(id int64, texto *string, orden *int, activo *bool) (*models.MotivoPuesto, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var pTexto, pOrden, pActivo interface{}
	if texto != nil {
		pTexto = *texto
	}
	if orden != nil {
		pOrden = *orden
	}
	if activo != nil {
		pActivo = *activo
	}

	var m models.MotivoPuesto
	res := r.db.WithContext(ctx).Raw(`
		UPDATE core_puestos_motivos SET
			texto  = COALESCE(?::text, texto),
			orden  = COALESCE(?::integer, orden),
			activo = COALESCE(?::boolean, activo)
		WHERE id = ?
		RETURNING `+columnasMotivo, pTexto, pOrden, pActivo, id).Scan(&m)
	if res.Error != nil {
		if strings.Contains(res.Error.Error(), "23505") {
			return nil, ErrMotivoDuplicado
		}
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &m, nil
}
