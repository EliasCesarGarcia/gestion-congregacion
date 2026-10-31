/**
 * ARCHIVO: congregaciones.go
 * UBICACIÓN: backend/internal/repository/congregaciones.go
 * DESCRIPCIÓN: Consultas del panel de congregaciones (core_congregaciones y
 * core_congregaciones_historial). Cada cambio y su línea de historial se
 * guardan en la MISMA transacción: o quedan los dos o ninguno.
 */

package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

var (
	// ErrCongregacionDuplicada: ya existe ese número en ese país.
	ErrCongregacionDuplicada = errors.New("congregación duplicada")
	// ErrCongregacionReferenciada: tiene datos asociados, no se puede borrar.
	ErrCongregacionReferenciada = errors.New("congregación con datos asociados")
)

const selectCongregacion = `
SELECT c.id::text AS id,
       c.nombre,
       c.pais,
       c.provincia_estado,
       c.ciudad,
       COALESCE(c.region, '')              AS region,
       COALESCE(c.partido, '')             AS partido,
       COALESCE(c.direccion, '')           AS direccion,
       COALESCE(c.numero_congregacion, '') AS numero_congregacion,
       c.zona_horaria,
       COALESCE(c.circuito, '')            AS circuito,
       c.activa,
       (SELECT count(*) FROM core_personas p
         WHERE p.congregacion_id = c.id AND p.estado = 'ALTA') AS personas,
       EXISTS (SELECT 1 FROM core_personas p
         WHERE p.congregacion_id = c.id AND p.estado = 'ALTA'
           AND p.rol_app = 'coordinador') AS tiene_coordinador,
       EXISTS (SELECT 1 FROM core_personas p
         WHERE p.congregacion_id = c.id AND p.estado = 'ALTA'
           AND p.rol_app = 'secretario') AS tiene_secretario,
       EXISTS (SELECT 1 FROM core_personas p
         WHERE p.congregacion_id = c.id AND p.estado = 'ALTA'
           AND p.rol_app = 'servicio') AS tiene_servicio
FROM core_congregaciones c
`

// Filtro de la lista: texto (nombre, número o ciudad) y estado.
// Argumentos: q x4, estado x2. estado: "" = todas, "true" o "false".
const filtroCongregaciones = `
WHERE (?::text = ''
       OR c.nombre ILIKE '%' || ?::text || '%'
       OR COALESCE(c.numero_congregacion, '') ILIKE '%' || ?::text || '%'
       OR c.ciudad ILIKE '%' || ?::text || '%')
  AND (?::text = '' OR c.activa = (?::text = 'true'))
`

// filaCongregacion: lo mínimo para escribir el historial.
type filaCongregacion struct {
	ID     string
	Nombre string
	Numero string
}

// ListCongregaciones devuelve una página y el total que cumple el filtro.
func (r *Repository) ListCongregaciones(q, estado string, limit, offset int) ([]models.CongregacionAdmin, int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var total int64
	if err := r.db.WithContext(ctx).Raw(
		"SELECT count(*) FROM core_congregaciones c "+filtroCongregaciones,
		q, q, q, q, estado, estado).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	lista := []models.CongregacionAdmin{}
	if err := r.db.WithContext(ctx).Raw(
		selectCongregacion+filtroCongregaciones+
			" ORDER BY lower(c.nombre) ASC, c.id ASC LIMIT ? OFFSET ?",
		q, q, q, q, estado, estado, limit, offset).Scan(&lista).Error; err != nil {
		return nil, 0, err
	}
	return lista, total, nil
}

// GetCongregacion devuelve una congregación por id, o nil si no existe.
func (r *Repository) GetCongregacion(id string) (*models.CongregacionAdmin, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var c models.CongregacionAdmin
	res := r.db.WithContext(ctx).Raw(
		selectCongregacion+" WHERE c.id = ?::uuid LIMIT 1", id).Scan(&c)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &c, nil
}

// registrarHistorialCongregacion escribe una línea del registro de cambios.
func registrarHistorialCongregacion(tx *gorm.DB, id, nombre, numero, accion string, actorID int, detalle string) error {
	return tx.Exec(`
		INSERT INTO core_congregaciones_historial
			(congregacion_id, congregacion_nombre, congregacion_numero, accion, actor_id, detalle)
		VALUES (?::uuid, ?::text, NULLIF(?::text, ''), ?::text, ?::integer, NULLIF(?::text, ''))`,
		id, nombre, numero, accion, actorID, detalle).Error
}

// CrearCongregacion inserta la congregación DESHABILITADA y devuelve su id.
// Devuelve ErrCongregacionDuplicada si ya existe ese número en ese país.
func (r *Repository) CrearCongregacion(d models.DatosCongregacion, actorID int) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var fila filaCongregacion
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Raw(`
			INSERT INTO core_congregaciones
				(nombre, pais, provincia_estado, ciudad, region, partido, direccion,
				 numero_congregacion, zona_horaria, circuito, activa)
			VALUES (?::text, ?::text, ?::text, ?::text,
			        NULLIF(?::text, ''), NULLIF(?::text, ''), NULLIF(?::text, ''),
			        ?::text, ?::text, NULLIF(?::text, ''), false)
			ON CONFLICT DO NOTHING
			RETURNING id::text AS id`,
			d.Nombre, d.Pais, d.ProvinciaEstado, d.Ciudad,
			d.Region, d.Partido, d.Direccion,
			d.Numero, d.ZonaHoraria, d.Circuito).Scan(&fila)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrCongregacionDuplicada
		}
		return registrarHistorialCongregacion(tx, fila.ID, d.Nombre, d.Numero, "crear", actorID, "")
	})
	if err != nil {
		return "", err
	}
	return fila.ID, nil
}

func valorTexto(p *string) interface{} {
	if p == nil {
		return nil
	}
	return *p
}

func textoOVacio(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// EditarCongregacion cambia solo los campos no nil. Devuelve false si la
// congregación no existe, y ErrCongregacionDuplicada si el nuevo número ya
// está en uso en ese país. detalle va al historial (hasta 100 caracteres).
func (r *Repository) EditarCongregacion(id string, c models.CambiosCongregacion, detalle string, actorID int) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	existe := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var fila filaCongregacion
		res := tx.Raw(`
			UPDATE core_congregaciones SET
				nombre              = COALESCE(?::text, nombre),
				pais                = COALESCE(?::text, pais),
				provincia_estado    = COALESCE(?::text, provincia_estado),
				ciudad              = COALESCE(?::text, ciudad),
				numero_congregacion = COALESCE(?::text, numero_congregacion),
				zona_horaria        = COALESCE(?::text, zona_horaria),
				region    = CASE WHEN ?::boolean THEN NULLIF(?::text, '') ELSE region    END,
				partido   = CASE WHEN ?::boolean THEN NULLIF(?::text, '') ELSE partido   END,
				direccion = CASE WHEN ?::boolean THEN NULLIF(?::text, '') ELSE direccion END,
				circuito  = CASE WHEN ?::boolean THEN NULLIF(?::text, '') ELSE circuito  END
			WHERE id = ?::uuid
			RETURNING id::text AS id, nombre, COALESCE(numero_congregacion, '') AS numero`,
			valorTexto(c.Nombre), valorTexto(c.Pais), valorTexto(c.ProvinciaEstado),
			valorTexto(c.Ciudad), valorTexto(c.Numero), valorTexto(c.ZonaHoraria),
			c.Region != nil, textoOVacio(c.Region),
			c.Partido != nil, textoOVacio(c.Partido),
			c.Direccion != nil, textoOVacio(c.Direccion),
			c.Circuito != nil, textoOVacio(c.Circuito),
			id).Scan(&fila)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil
		}
		existe = true
		return registrarHistorialCongregacion(tx, fila.ID, fila.Nombre, fila.Numero, "editar", actorID, detalle)
	})
	if err != nil {
		if strings.Contains(err.Error(), "23505") {
			return false, ErrCongregacionDuplicada
		}
		return false, err
	}
	return existe, nil
}

// CambiarEstadoCongregacion habilita o deshabilita. accion es "habilitar" o
// "deshabilitar" (para el historial). Devuelve false si no existe.
func (r *Repository) CambiarEstadoCongregacion(id string, activa bool, accion string, actorID int) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	existe := false
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var fila filaCongregacion
		res := tx.Raw(`
			UPDATE core_congregaciones SET activa = ?::boolean
			WHERE id = ?::uuid
			RETURNING id::text AS id, nombre, COALESCE(numero_congregacion, '') AS numero`,
			activa, id).Scan(&fila)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil
		}
		existe = true
		return registrarHistorialCongregacion(tx, fila.ID, fila.Nombre, fila.Numero, accion, actorID, "")
	})
	if err != nil {
		return false, err
	}
	return existe, nil
}

// EliminarCongregacion borra de verdad, solo si está deshabilitada y nada la
// referencia (personas, usuarios, permisos, anuncios, historial de puestos,
// configuración ni las tablas pub_*). Si algo la referencia devuelve
// ErrCongregacionReferenciada y no cambia nada. El historial de la
// congregación NO se borra: queda con la copia del nombre y del número.
func (r *Repository) EliminarCongregacion(id string, actorID int) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var fila filaCongregacion
		res := tx.Raw(`
			DELETE FROM core_congregaciones c
			WHERE c.id = ?::uuid
			  AND c.activa = false
			  AND NOT EXISTS (SELECT 1 FROM core_personas            WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM core_usuarios            WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM core_permisos_modulos    WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM core_anuncios            WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM core_puestos_historial   WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM core_config_congregacion
			                   WHERE congregacion_id = c.id OR congregacion_coordinadora_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM pub_stock_local          WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM pub_entregas             WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM pub_suscripciones        WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM pub_pedidos              WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM pub_pedidos_central      WHERE congregacion_id = c.id)
			  AND NOT EXISTS (SELECT 1 FROM pub_comunicacion_coord   WHERE congregacion_id = c.id)
			RETURNING c.id::text AS id, c.nombre AS nombre, COALESCE(c.numero_congregacion, '') AS numero`,
			id).Scan(&fila)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrCongregacionReferenciada
		}
		return registrarHistorialCongregacion(tx, fila.ID, fila.Nombre, fila.Numero, "eliminar", actorID, "")
	})
	if err != nil && strings.Contains(err.Error(), "23503") {
		return ErrCongregacionReferenciada
	}
	return err
}

// ListHistorialCongregaciones devuelve una página del registro de cambios,
// lo más nuevo primero. id "" = todas las congregaciones.
func (r *Repository) ListHistorialCongregaciones(id string, limit, offset int) ([]models.CongregacionHistorial, int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	const filtro = ` WHERE (?::text = '' OR h.congregacion_id = NULLIF(?::text, '')::uuid) `

	var total int64
	if err := r.db.WithContext(ctx).Raw(
		"SELECT count(*) FROM core_congregaciones_historial h"+filtro,
		id, id).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	lista := []models.CongregacionHistorial{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT h.id,
		       h.congregacion_id::text                  AS congregacion_id,
		       h.congregacion_nombre,
		       COALESCE(h.congregacion_numero, '')      AS congregacion_numero,
		       h.accion,
		       h.actor_id,
		       COALESCE(p.apellido_nombre, '')          AS actor_nombre,
		       COALESCE(h.detalle, '')                  AS detalle,
		       h.creado_en
		FROM core_congregaciones_historial h
		LEFT JOIN core_personas p ON p.id = h.actor_id`+filtro+`
		ORDER BY h.creado_en DESC, h.id DESC
		LIMIT ? OFFSET ?`,
		id, id, limit, offset).Scan(&lista).Error; err != nil {
		return nil, 0, err
	}
	return lista, total, nil
}
