/**
 * ARCHIVO: personas_baja.go
 * UBICACIÓN: backend/internal/repository/personas_baja.go
 * DESCRIPCIÓN: Bajas y reactivación de personas, y su catálogo de motivos.
 * Cada operación escribe todo en UNA transacción: estado, historial de estado,
 * situaciones y (en la baja) puestos. Nunca se inventan fechas.
 */

package repository

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

var (
	// ErrPersonaEstadoNoCorresponde: la persona no está en el estado que la operación necesita.
	ErrPersonaEstadoNoCorresponde = errors.New("la persona no está en el estado esperado")
	// ErrFechaAnteriorBaja: la reactivación sería anterior a su última baja.
	ErrFechaAnteriorBaja = errors.New("la fecha es anterior a la última baja de la persona")
)

// ErrTitularRol: la persona tiene uno o más roles (coordinador, secretario o
// servicio) y no se la puede dar de baja sin reemplazarla antes.
type ErrTitularRol struct{ Roles []string }

func (e *ErrTitularRol) Error() string {
	return "persona titular de rol: " + strings.Join(e.Roles, ", ")
}

// ---- Motivos de baja ----

// ListMotivosBaja: ordenados por orden y nombre. soloActivos oculta los desactivados.
func (r *Repository) ListMotivosBaja(soloActivos bool) ([]models.MotivoBaja, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.MotivoBaja{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT id AS id, nombre AS nombre, activo AS activo, orden AS orden
		FROM core_personas_motivos_baja
		WHERE (?::boolean = false OR activo = true)
		ORDER BY orden ASC, lower(nombre) ASC, id ASC`, soloActivos).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}

// GetMotivoBaja devuelve un motivo por id, o nil si no existe.
func (r *Repository) GetMotivoBaja(id int64) (*models.MotivoBaja, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var m models.MotivoBaja
	res := r.db.WithContext(ctx).Raw(`
		SELECT id AS id, nombre AS nombre, activo AS activo, orden AS orden
		FROM core_personas_motivos_baja WHERE id = ? LIMIT 1`, id).Scan(&m)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &m, nil
}

// CrearMotivoBaja inserta un motivo activo. ErrMotivoDuplicado si ya existe
// el mismo nombre (sin importar mayúsculas).
func (r *Repository) CrearMotivoBaja(nombre string, orden int) (*models.MotivoBaja, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var m models.MotivoBaja
	res := r.db.WithContext(ctx).Raw(`
		INSERT INTO core_personas_motivos_baja (nombre, orden)
		VALUES (?::text, ?::integer)
		ON CONFLICT DO NOTHING
		RETURNING id AS id, nombre AS nombre, activo AS activo, orden AS orden`,
		nombre, orden).Scan(&m)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, ErrMotivoDuplicado
	}
	return &m, nil
}

// EditarMotivoBaja cambia solo los campos que no son nil. Devuelve nil si no
// existe y ErrMotivoDuplicado si el nuevo nombre ya está en uso.
func (r *Repository) EditarMotivoBaja(id int64, nombre *string, orden *int, activo *bool) (*models.MotivoBaja, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var pNombre, pOrden, pActivo interface{}
	if nombre != nil {
		pNombre = *nombre
	}
	if orden != nil {
		pOrden = *orden
	}
	if activo != nil {
		pActivo = *activo
	}

	var m models.MotivoBaja
	res := r.db.WithContext(ctx).Raw(`
		UPDATE core_personas_motivos_baja SET
			nombre = COALESCE(?::text, nombre),
			orden  = COALESCE(?::integer, orden),
			activo = COALESCE(?::boolean, activo)
		WHERE id = ?
		RETURNING id AS id, nombre AS nombre, activo AS activo, orden AS orden`,
		pNombre, pOrden, pActivo, id).Scan(&m)
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

// ---- Baja y reactivación ----

// DarDeBajaPersona: en una transacción
//  1. bloquea la congregación y la persona, y exige que esté en ALTA;
//  2. rechaza la baja si es titular de algún rol (ErrTitularRol);
//  3. cierra su fila vigente de estado con fecha, motivo (id y copia del
//     texto), detalles y quién la dio de baja;
//  4. cierra sus situaciones vigentes (1, 2 y 3) con la fecha de baja;
//  5. le quita todos sus puestos (permiso + historial con el motivo "Baja de la
//     persona"), cerrándolos con la fecha de baja elegida (fechaHora);
//  6. deja la persona en BAJA, sin situación 2 ni 3 y con situación 1 Publicador.
//
// fecha va como AAAA-MM-DD, ya validada por el servicio. fechaHora es la misma
// fecha para las columnas con hora (puestos): nil = ahora (now()); si es una
// fecha pasada, las 12:00 UTC de ese día. Si algún puesto vigente empezó
// DESPUÉS de esa fecha, se rechaza con ErrFechaAnteriorPuesto (no se cierra un
// puesto antes de que empiece) y no se escribe nada.
func (r *Repository) DarDeBajaPersona(personaID int, fecha string, fechaHora *time.Time, motivoID *int64, detalles, actorID string) error {
	idTxt := strconv.Itoa(personaID)
	fechaSQL := fechaRolParam(fechaHora)
	return r.db.Transaction(func(tx *gorm.DB) error {
		cong, err := congregacionDePersonaRol(tx, personaID)
		if err != nil {
			return err
		}
		if err := bloquearCongregacionRoles(tx, cong); err != nil {
			return err
		}

		var estados []string
		if err := tx.Raw("SELECT estado FROM core_personas WHERE id = ?::integer FOR UPDATE", personaID).Scan(&estados).Error; err != nil {
			return err
		}
		if len(estados) == 0 {
			return ErrPersonaInexistente
		}
		if estados[0] != "ALTA" {
			return ErrPersonaEstadoNoCorresponde
		}

		var roles []string
		if err := tx.Raw(`
			SELECT rol FROM core_personas_roles_historial
			WHERE persona_id = ?::integer AND vigente = true ORDER BY rol`, personaID).Scan(&roles).Error; err != nil {
			return err
		}
		if len(roles) > 0 {
			return &ErrTitularRol{Roles: roles}
		}

		var posteriores []int64
		if err := tx.Raw(`
			SELECT id FROM core_personas_situaciones_historial
			WHERE persona_id = ?::integer AND vigente = true AND fecha_inicio > ?::date
			LIMIT 1`, personaID, fecha).Scan(&posteriores).Error; err != nil {
			return err
		}
		if len(posteriores) > 0 {
			return ErrFechaAnteriorInicio
		}

		var puestosPosteriores []int64
		if err := tx.Raw(`
			SELECT id FROM core_puestos_historial
			WHERE persona_id::text = ?::text AND fecha_fin IS NULL
			  AND fecha_inicio > COALESCE(?::timestamptz, now())
			LIMIT 1`, idTxt, fechaSQL).Scan(&puestosPosteriores).Error; err != nil {
			return err
		}
		if len(puestosPosteriores) > 0 {
			return ErrFechaAnteriorPuesto
		}

		res := tx.Exec(`
			UPDATE core_personas_estado_historial
			SET vigente = false,
			    fecha_baja = ?::date,
			    motivo_baja_id = ?::bigint,
			    motivo_baja = (SELECT m.nombre FROM core_personas_motivos_baja m WHERE m.id = ?::bigint),
			    detalles = NULLIF(?::text, ''),
			    baja_por = NULLIF(?::text, '')::integer
			WHERE persona_id = ?::integer AND vigente = true`,
			fecha, motivoParam(motivoID), motivoParam(motivoID), detalles, actorID, personaID)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			// No había fila vigente (no debería pasar): se deja la baja registrada igual.
			if err := tx.Exec(`
				INSERT INTO core_personas_estado_historial
					(persona_id, fecha_alta, fecha_baja, motivo_baja_id, motivo_baja, detalles, baja_por, vigente)
				SELECT p.id, p.fecha_alta, ?::date, ?::bigint,
				       (SELECT m.nombre FROM core_personas_motivos_baja m WHERE m.id = ?::bigint),
				       NULLIF(?::text, ''), NULLIF(?::text, '')::integer, false
				FROM core_personas p WHERE p.id = ?::integer`,
				fecha, motivoParam(motivoID), motivoParam(motivoID), detalles, actorID, personaID).Error; err != nil {
				return err
			}
		}

		if err := tx.Exec(`
			UPDATE core_personas_situaciones_historial
			SET vigente = false, fecha_fin = ?::date,
			    quitado_por = NULLIF(?::text, '')::integer
			WHERE persona_id = ?::integer AND vigente = true`,
			fecha, actorID, personaID).Error; err != nil {
			return err
		}

		if err := tx.Exec("DELETE FROM core_permisos_modulos WHERE persona_id::text = ?::text", idTxt).Error; err != nil {
			return err
		}
		if err := tx.Exec(`
			UPDATE core_puestos_historial
			SET fecha_fin = COALESCE(?::timestamptz, now()),
			    quitado_por = (SELECT a.id FROM core_personas a WHERE a.id::text = ?::text),
			    motivo_quitar = 'Baja de la persona'
			WHERE persona_id::text = ?::text AND fecha_fin IS NULL`,
			fechaSQL, actorID, idTxt).Error; err != nil {
			return err
		}

		return tx.Exec(`
			UPDATE core_personas
			SET estado = 'BAJA', fecha_baja = ?::date,
			    situacion_1 = 'Publicador', situacion_2 = NULL, situacion_3 = NULL
			WHERE id = ?::integer`, fecha, personaID).Error
	})
}

// ReactivarPersona: en una transacción, exige que la persona esté en BAJA,
// abre una fila nueva de estado (alta vigente) y la deja en ALTA con condición
// A, situación 1 Publicador (abierta desde la fecha) y sin situación 2 ni 3.
// Las situaciones que hubiera vigentes (personas dadas de baja antes de este
// módulo) se cierran con la fecha de reactivación.
func (r *Repository) ReactivarPersona(personaID int, fecha, actorID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var estados []string
		if err := tx.Raw("SELECT estado FROM core_personas WHERE id = ?::integer FOR UPDATE", personaID).Scan(&estados).Error; err != nil {
			return err
		}
		if len(estados) == 0 {
			return ErrPersonaInexistente
		}
		if estados[0] != "BAJA" {
			return ErrPersonaEstadoNoCorresponde
		}

		var bajas []int64
		if err := tx.Raw(`
			SELECT id FROM core_personas_estado_historial
			WHERE persona_id = ?::integer AND fecha_baja > ?::date LIMIT 1`, personaID, fecha).Scan(&bajas).Error; err != nil {
			return err
		}
		if len(bajas) > 0 {
			return ErrFechaAnteriorBaja
		}

		var posteriores []int64
		if err := tx.Raw(`
			SELECT id FROM core_personas_situaciones_historial
			WHERE persona_id = ?::integer AND vigente = true AND fecha_inicio > ?::date
			LIMIT 1`, personaID, fecha).Scan(&posteriores).Error; err != nil {
			return err
		}
		if len(posteriores) > 0 {
			return ErrFechaAnteriorInicio
		}

		if err := tx.Exec(`
			UPDATE core_personas_situaciones_historial
			SET vigente = false, fecha_fin = ?::date,
			    quitado_por = NULLIF(?::text, '')::integer
			WHERE persona_id = ?::integer AND vigente = true`,
			fecha, actorID, personaID).Error; err != nil {
			return err
		}

		if err := tx.Exec(`
			INSERT INTO core_personas_estado_historial (persona_id, fecha_alta, vigente, alta_por)
			VALUES (?::integer, ?::date, true, NULLIF(?::text, '')::integer)`,
			personaID, fecha, actorID).Error; err != nil {
			if strings.Contains(err.Error(), "23505") {
				return ErrPersonaEstadoNoCorresponde
			}
			return err
		}

		if err := tx.Exec(`
			INSERT INTO core_personas_situaciones_historial
				(persona_id, campo, valor, fecha_inicio, asignado_por, vigente)
			VALUES (?::integer, 1, 'Publicador', ?::date, NULLIF(?::text, '')::integer, true)`,
			personaID, fecha, actorID).Error; err != nil {
			return err
		}

		return tx.Exec(`
			UPDATE core_personas
			SET estado = 'ALTA', fecha_alta = ?::date, fecha_baja = NULL, condicion = 'A',
			    situacion_1 = 'Publicador', situacion_2 = NULL, situacion_3 = NULL
			WHERE id = ?::integer`, fecha, personaID).Error
	})
}
