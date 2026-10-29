/**
 * ARCHIVO: puestos.go
 * UBICACIÓN: backend/internal/repository/puestos.go
 * DESCRIPCIÓN: Consultas de los puestos de cada departamento (encargado,
 * auxiliar, segundo auxiliar) sobre core_permisos_modulos, y su historial
 * (core_puestos_historial). El permiso y el historial se escriben SIEMPRE en
 * la misma transacción: o quedan los dos o no queda ninguno.
 * Los motivos (core_puestos_motivos) se copian como texto al historial.
 */

package repository

import (
	"context"
	"time"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

// motivoParam convierte un *int64 opcional en un valor para la consulta
// (nil = NULL).
func motivoParam(motivoID *int64) interface{} {
	if motivoID == nil {
		return nil
	}
	return *motivoID
}

// ListAsignaciones devuelve quién ocupa cada puesto en los departamentos
// ACTIVOS de la congregación indicada. Incluye personas dadas de baja para
// que se les pueda quitar el puesto.
func (r *Repository) ListAsignaciones(congregacionID string) ([]models.AsignacionPuesto, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.AsignacionPuesto{}
	res := r.db.WithContext(ctx).Raw(`
		SELECT p.modulo_id AS modulo_id,
		       p.persona_id AS persona_id,
		       COALESCE(pe.apellido_nombre, '') AS nombre_completo,
		       p.puesto AS puesto
		FROM core_permisos_modulos p
		JOIN core_personas pe ON pe.id = p.persona_id
		JOIN core_modulos m ON m.id = p.modulo_id
		WHERE p.congregacion_id::text = ? AND m.activo = true
		ORDER BY p.modulo_id ASC, p.puesto ASC`, congregacionID).Scan(&lista)
	if res.Error != nil {
		return nil, res.Error
	}
	return lista, nil
}

// AsignarPuesto inserta el puesto y, en la misma transacción, la fila del
// historial. La congregacion_id se copia SIEMPRE de la fila de la persona.
// Devuelve 0 filas si hubo conflicto con los índices únicos (la persona ya
// tiene ese departamento, o el puesto ya está ocupado): en ese caso NO se
// escribe historial. Al resolverlo la base (no el código), no hay carrera
// entre dos pedidos simultáneos.
//
// actorID = persona que hace la asignación (puede ir vacío: queda sin dato).
// detalles = texto corto opcional, ya validado por el servicio.
// motivoID = motivo opcional ya validado; el historial guarda su id y una
// copia de su texto.
func (r *Repository) AsignarPuesto(personaID, moduloID, puesto string, nivel int, actorID, detalles string, motivoID *int64) (int64, error) {
	var filas int64
	err := r.db.Transaction(func(tx *gorm.DB) error {
		res := tx.Exec(`
			INSERT INTO core_permisos_modulos (persona_id, modulo_id, congregacion_id, nivel_acceso, puesto)
			SELECT p.id, ?::text, p.congregacion_id, ?::integer, ?::text
			FROM core_personas p
			WHERE p.id::text = ?
			ON CONFLICT DO NOTHING`,
			moduloID, nivel, puesto, personaID)
		if res.Error != nil {
			return res.Error
		}
		filas = res.RowsAffected
		if filas == 0 {
			return nil
		}
		return tx.Exec(`
			INSERT INTO core_puestos_historial
				(persona_id, modulo_id, congregacion_id, puesto, asignado_por, detalles,
				 motivo_asignar_id, motivo_asignar)
			SELECT p.id, ?::text, p.congregacion_id, ?::text,
			       (SELECT a.id FROM core_personas a WHERE a.id::text = ?),
			       NULLIF(?::text, ''),
			       ?::bigint,
			       (SELECT m.texto FROM core_puestos_motivos m WHERE m.id = ?::bigint)
			FROM core_personas p
			WHERE p.id::text = ?`,
			moduloID, puesto, actorID, detalles,
			motivoParam(motivoID), motivoParam(motivoID), personaID).Error
	})
	if err != nil {
		return 0, err
	}
	return filas, nil
}

// QuitarPuesto borra el permiso y, en la misma transacción, cierra la fila
// vigente del historial guardando quién lo quitó, el motivo (id y copia del
// texto) y el detalle opcional. Devuelve cuántas filas de permiso se borraron.
func (r *Repository) QuitarPuesto(personaID, moduloID, actorID, detalles string, motivoID *int64) (int64, error) {
	var filas int64
	err := r.db.Transaction(func(tx *gorm.DB) error {
		res := tx.Exec("DELETE FROM core_permisos_modulos WHERE persona_id::text = ? AND modulo_id = ?", personaID, moduloID)
		if res.Error != nil {
			return res.Error
		}
		filas = res.RowsAffected
		if filas == 0 {
			return nil
		}
		return tx.Exec(`
			UPDATE core_puestos_historial h
			SET fecha_fin = now(),
			    quitado_por = (SELECT a.id FROM core_personas a WHERE a.id::text = ?),
			    motivo_quitar_id = ?::bigint,
			    motivo_quitar = (SELECT m.texto FROM core_puestos_motivos m WHERE m.id = ?::bigint),
			    detalles_quitar = NULLIF(?::text, '')
			WHERE h.persona_id::text = ? AND h.modulo_id = ? AND h.fecha_fin IS NULL`,
			actorID, motivoParam(motivoID), motivoParam(motivoID), detalles,
			personaID, moduloID).Error
	})
	if err != nil {
		return 0, err
	}
	return filas, nil
}

// GetPuestoDe devuelve el puesto que la persona tiene en el departamento,
// o "" si no tiene ninguno.
func (r *Repository) GetPuestoDe(personaID, moduloID string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var puestos []string
	res := r.db.WithContext(ctx).Raw(
		"SELECT puesto FROM core_permisos_modulos WHERE persona_id::text = ? AND modulo_id = ? LIMIT 1",
		personaID, moduloID).Scan(&puestos)
	if res.Error != nil {
		return "", res.Error
	}
	if len(puestos) == 0 {
		return "", nil
	}
	return puestos[0], nil
}

// ListHistorialPuestos devuelve el historial de puestos de la congregación,
// del más reciente al más antiguo. moduloID y personaID son filtros
// opcionales ("" = sin filtro).
func (r *Repository) ListHistorialPuestos(congregacionID, moduloID, personaID string, limit, offset int) ([]models.HistorialPuesto, int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var total int64
	res := r.db.WithContext(ctx).Raw(`
		SELECT COUNT(*)
		FROM core_puestos_historial h
		WHERE h.congregacion_id::text = ?
		  AND (?::text = '' OR h.modulo_id = ?::text)
		  AND (?::text = '' OR h.persona_id::text = ?::text)`,
		congregacionID, moduloID, moduloID, personaID, personaID).Scan(&total)
	if res.Error != nil {
		return nil, 0, res.Error
	}

	lista := []models.HistorialPuesto{}
	res = r.db.WithContext(ctx).Raw(`
		SELECT h.id AS id,
		       h.modulo_id AS modulo_id,
		       h.persona_id AS persona_id,
		       COALESCE(pe.apellido_nombre, '') AS nombre_completo,
		       h.puesto AS puesto,
		       h.fecha_inicio AS fecha_inicio,
		       h.fecha_fin AS fecha_fin,
		       COALESCE(h.motivo_asignar, '') AS motivo_asignar,
		       COALESCE(h.detalles, '') AS detalles,
		       COALESCE(h.motivo_quitar, '') AS motivo_quitar,
		       COALESCE(h.detalles_quitar, '') AS detalles_quitar,
		       COALESCE(ap.apellido_nombre, '') AS asignado_por,
		       COALESCE(qp.apellido_nombre, '') AS quitado_por
		FROM core_puestos_historial h
		JOIN core_personas pe ON pe.id = h.persona_id
		LEFT JOIN core_personas ap ON ap.id = h.asignado_por
		LEFT JOIN core_personas qp ON qp.id = h.quitado_por
		WHERE h.congregacion_id::text = ?
		  AND (?::text = '' OR h.modulo_id = ?::text)
		  AND (?::text = '' OR h.persona_id::text = ?::text)
		ORDER BY h.fecha_inicio DESC, h.id DESC
		LIMIT ? OFFSET ?`,
		congregacionID, moduloID, moduloID, personaID, personaID, limit, offset).Scan(&lista)
	if res.Error != nil {
		return nil, 0, res.Error
	}
	return lista, total, nil
}
