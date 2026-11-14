/**
 * ARCHIVO: motivos_catalogo.go
 * UBICACIÓN: backend/internal/repository/motivos_catalogo.go
 * DESCRIPCIÓN: Consultas del catálogo único de motivos (core_motivos y
 * core_motivos_usos). Nunca se borra un motivo: se desactiva su uso.
 */

package repository

import (
	"context"
	"strings"
	"time"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

// filaMotivoCatalogo: una fila de motivo + uso (el uso es NULL si el motivo
// todavía no sirve para nada).
type filaMotivoCatalogo struct {
	ID     int64   `gorm:"column:id"`
	Nombre string  `gorm:"column:nombre"`
	Uso    *string `gorm:"column:uso"`
	Activo *bool   `gorm:"column:activo"`
	Orden  *int    `gorm:"column:orden"`
}

const selectMotivosCatalogo = `
	SELECT m.id AS id, m.nombre AS nombre, u.uso AS uso, u.activo AS activo, u.orden AS orden
	FROM core_motivos m
	LEFT JOIN core_motivos_usos u ON u.motivo_id = m.id`

// agruparMotivosCatalogo junta las filas de un mismo motivo, en el orden en que llegan.
func agruparMotivosCatalogo(filas []filaMotivoCatalogo) []models.MotivoCatalogo {
	lista := []models.MotivoCatalogo{}
	pos := map[int64]int{}
	for _, f := range filas {
		i, ok := pos[f.ID]
		if !ok {
			lista = append(lista, models.MotivoCatalogo{ID: f.ID, Nombre: f.Nombre, Usos: []models.UsoMotivo{}})
			i = len(lista) - 1
			pos[f.ID] = i
		}
		if f.Uso != nil {
			u := models.UsoMotivo{Uso: *f.Uso}
			if f.Activo != nil {
				u.Activo = *f.Activo
			}
			if f.Orden != nil {
				u.Orden = *f.Orden
			}
			lista[i].Usos = append(lista[i].Usos, u)
		}
	}
	return lista
}

// ListOpcionesMotivo: los motivos ACTIVOS de un uso, ordenados, para el desplegable.
func (r *Repository) ListOpcionesMotivo(uso string) ([]models.OpcionMotivo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.OpcionMotivo{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT m.id AS id, m.nombre AS nombre, u.orden AS orden
		FROM core_motivos_usos u
		JOIN core_motivos m ON m.id = u.motivo_id
		WHERE u.uso = ?::text AND u.activo = true
		ORDER BY u.orden ASC, lower(m.nombre) ASC, m.id ASC`, uso).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}

// ListCatalogoMotivos: todos los motivos con todos sus usos, también los desactivados.
func (r *Repository) ListCatalogoMotivos() ([]models.MotivoCatalogo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filas := []filaMotivoCatalogo{}
	if err := r.db.WithContext(ctx).Raw(
		selectMotivosCatalogo+" ORDER BY lower(m.nombre) ASC, m.id ASC, u.uso ASC").Scan(&filas).Error; err != nil {
		return nil, err
	}
	return agruparMotivosCatalogo(filas), nil
}

// GetMotivoCatalogo devuelve un motivo con sus usos, o nil si no existe.
func (r *Repository) GetMotivoCatalogo(id int64) (*models.MotivoCatalogo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filas := []filaMotivoCatalogo{}
	if err := r.db.WithContext(ctx).Raw(
		selectMotivosCatalogo+" WHERE m.id = ?::integer ORDER BY u.uso ASC", id).Scan(&filas).Error; err != nil {
		return nil, err
	}
	lista := agruparMotivosCatalogo(filas)
	if len(lista) == 0 {
		return nil, nil
	}
	return &lista[0], nil
}

// NombreMotivoDeUso devuelve el nombre del motivo si existe y está activo
// para ese uso. El segundo valor es false si no sirve.
func (r *Repository) NombreMotivoDeUso(id int64, uso string) (string, bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var nombres []string
	if err := r.db.WithContext(ctx).Raw(`
		SELECT m.nombre
		FROM core_motivos m
		JOIN core_motivos_usos u ON u.motivo_id = m.id
		WHERE m.id = ?::integer AND u.uso = ?::text AND u.activo = true
		LIMIT 1`, id, uso).Scan(&nombres).Error; err != nil {
		return "", false, err
	}
	if len(nombres) == 0 {
		return "", false, nil
	}
	return nombres[0], true, nil
}

// CrearMotivoCatalogo: si el nombre no existe (sin importar mayúsculas) crea
// el motivo; si ya existe, le suma los usos. Si alguno de los usos ya estaba,
// devuelve ErrMotivoDuplicado y no escribe nada. Devuelve el id del motivo.
func (r *Repository) CrearMotivoCatalogo(nombre string, usos []models.UsoMotivo) (int64, error) {
	var id int64
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var ids []int64
		if err := tx.Raw(`
			INSERT INTO core_motivos (nombre) VALUES (?::text)
			ON CONFLICT DO NOTHING
			RETURNING id`, nombre).Scan(&ids).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			if err := tx.Raw(
				"SELECT id FROM core_motivos WHERE lower(nombre) = lower(?::text) LIMIT 1", nombre).Scan(&ids).Error; err != nil {
				return err
			}
			if len(ids) == 0 {
				return ErrMotivoDuplicado
			}
		}
		id = ids[0]

		for _, u := range usos {
			res := tx.Exec(`
				INSERT INTO core_motivos_usos (motivo_id, uso, orden)
				VALUES (?::integer, ?::text, ?::integer)
				ON CONFLICT DO NOTHING`, id, u.Uso, u.Orden)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return ErrMotivoDuplicado
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return id, nil
}

// RenombrarMotivoCatalogo cambia el nombre. Devuelve false si el motivo no
// existe y ErrMotivoDuplicado si el nombre ya lo tiene otro motivo. El
// historial no cambia: cada fila guarda su propia copia del texto.
func (r *Repository) RenombrarMotivoCatalogo(id int64, nombre string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res := r.db.WithContext(ctx).Exec(
		"UPDATE core_motivos SET nombre = ?::text WHERE id = ?::integer", nombre, id)
	if res.Error != nil {
		if strings.Contains(res.Error.Error(), "23505") {
			return false, ErrMotivoDuplicado
		}
		return false, res.Error
	}
	return res.RowsAffected > 0, nil
}

// GuardarUsoMotivo crea el uso si el motivo todavía no lo tenía (activo y con
// orden 0 si no se indican) o cambia solo los campos enviados (nil = no tocar).
// Devuelve false si el motivo no existe.
func (r *Repository) GuardarUsoMotivo(id int64, uso string, orden *int, activo *bool) (bool, error) {
	var pOrden, pActivo interface{}
	if orden != nil {
		pOrden = *orden
	}
	if activo != nil {
		pActivo = *activo
	}

	existe := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var ids []int64
		if err := tx.Raw("SELECT id FROM core_motivos WHERE id = ?::integer FOR UPDATE", id).Scan(&ids).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}
		existe = true
		return tx.Exec(`
			INSERT INTO core_motivos_usos (motivo_id, uso, activo, orden)
			VALUES (?::integer, ?::text, COALESCE(?::boolean, true), COALESCE(?::integer, 0))
			ON CONFLICT (motivo_id, uso) DO UPDATE SET
				activo = COALESCE(?::boolean, core_motivos_usos.activo),
				orden  = COALESCE(?::integer, core_motivos_usos.orden)`,
			id, uso, pActivo, pOrden, pActivo, pOrden).Error
	})
	if err != nil {
		return false, err
	}
	return existe, nil
}
