/**
* ARCHIVO: grupos_mover.go
* UBICACIÓN: backend/internal/repository/grupos_mover.go
* DESCRIPCIÓN: Mover una persona de un grupo a otro (o dejarla sin grupo), o
* varias a la vez. Todo en UNA transacción: cierra su pertenencia vigente
* (core_grupos_movimientos), abre la nueva y actualiza core_personas
* (grupo_id). Nunca se inventan fechas.
* Con varias personas es todo o nada: si una falla, no se mueve ninguna.
* Orden de bloqueos: congregación, persona y grupo destino (el mismo que usan
* la baja y los cambios de roles). Las personas se mueven en orden de id.
 */

package repository

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

var (
	// ErrPersonaEncargadoGrupo: la persona es superintendente o auxiliar vigente de un grupo.
	ErrPersonaEncargadoGrupo = errors.New("la persona es superintendente o auxiliar de su grupo")
	// ErrFechaAnteriorMovimiento: la fecha es anterior al inicio (o al fin) de un movimiento de la persona.
	ErrFechaAnteriorMovimiento = errors.New("la fecha es anterior al inicio de la pertenencia actual de la persona al grupo")
	// ErrFechaAnteriorIngresoGrupo: la fecha es anterior al inicio del grupo destino.
	ErrFechaAnteriorIngresoGrupo = errors.New("la fecha es anterior al inicio del grupo destino")
	// ErrFechaAnteriorAltaPersona: la fecha es anterior a la fecha de alta de la persona.
	ErrFechaAnteriorAltaPersona = errors.New("la fecha es anterior a la fecha de alta de la persona")
)

// ErrMovimientoPersona: al mover varias personas, dice cuál falló y por qué.
// Err es el error de fondo (se puede consultar con errors.Is).
type ErrMovimientoPersona struct {
	PersonaID int
	Nombre    string // "APELLIDO Nombre"; vacío si no se pudo leer
	Err       error
}

func (e *ErrMovimientoPersona) Error() string { return e.Err.Error() }
func (e *ErrMovimientoPersona) Unwrap() error { return e.Err }

// envolverErrorMovimiento agrega a un error el nombre de la persona que lo
// causó. Leer el nombre es opcional: si falla, queda solo el id.
func envolverErrorMovimiento(tx *gorm.DB, personaID int, err error) error {
	nombre := ""
	var nombres []string
	if e := tx.Raw("SELECT COALESCE(apellido_nombre, '') FROM core_personas WHERE id = ?::integer", personaID).Scan(&nombres).Error; e == nil && len(nombres) > 0 {
		nombre = nombres[0]
	}
	return &ErrMovimientoPersona{PersonaID: personaID, Nombre: nombre, Err: err}
}

// MoverPersonaDeGrupo pasa a la persona al grupo grupoID (nil = sin grupo) en
// la fecha dada (AAAA-MM-DD, ya validada por el servicio). motivoID (ya
// validado contra el uso personas.grupo) y detalles quedan como salida del
// grupo viejo y como entrada al nuevo. Devuelve false si no había nada que
// cambiar (ya estaba en ese grupo, o ya no tenía grupo).
func (r *Repository) MoverPersonaDeGrupo(personaID int, grupoID *int, fecha string, motivoID *int64, detalles, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		cong, err := congregacionDePersonaRol(tx, personaID)
		if err != nil {
			return err
		}
		if err := bloquearCongregacionRoles(tx, cong); err != nil {
			return err
		}
		c, err := moverPersonaDeGrupoTx(tx, cong, personaID, grupoID, fecha, motivoID, detalles, actorID)
		if err != nil {
			return err
		}
		cambio = c
		return nil
	})
	if err != nil {
		return false, err
	}
	return cambio, nil
}

// MoverPersonasDeGrupo pasa a varias personas (todas de la misma congregación,
// ya ordenadas por id y sin repetidas) al grupo grupoID (nil = sin grupo), con
// una sola fecha, motivo y detalle, en UNA transacción: si una persona falla,
// no se mueve ninguna y el error (ErrMovimientoPersona) dice cuál fue.
// Devuelve cuántas se movieron y cuántas ya estaban en ese destino (esas no
// cambian ni dejan registro).
func (r *Repository) MoverPersonasDeGrupo(personaIDs []int, grupoID *int, fecha string, motivoID *int64, detalles, actorID string) (int, int, error) {
	if len(personaIDs) == 0 {
		return 0, 0, nil
	}
	movidas, sinCambio := 0, 0
	err := r.db.Transaction(func(tx *gorm.DB) error {
		movidas, sinCambio = 0, 0
		cong, err := congregacionDePersonaRol(tx, personaIDs[0])
		if err != nil {
			return envolverErrorMovimiento(tx, personaIDs[0], err)
		}
		if err := bloquearCongregacionRoles(tx, cong); err != nil {
			return err
		}

		for _, id := range personaIDs {
			// Todas deben ser de la misma congregación (la que se bloqueó).
			cp, err := congregacionDePersonaRol(tx, id)
			if err != nil {
				return envolverErrorMovimiento(tx, id, err)
			}
			if !strings.EqualFold(cp, cong) {
				return envolverErrorMovimiento(tx, id, ErrPersonaInexistente)
			}

			// La fecha no puede ser anterior al alta de la persona.
			var tempranas []int64
			if err := tx.Raw(`
				SELECT id FROM core_personas
				WHERE id = ?::integer AND fecha_alta > ?::date`, id, fecha).Scan(&tempranas).Error; err != nil {
				return err
			}
			if len(tempranas) > 0 {
				return envolverErrorMovimiento(tx, id, ErrFechaAnteriorAltaPersona)
			}

			cambio, err := moverPersonaDeGrupoTx(tx, cong, id, grupoID, fecha, motivoID, detalles, actorID)
			if err != nil {
				return envolverErrorMovimiento(tx, id, err)
			}
			if cambio {
				movidas++
			} else {
				sinCambio++
			}
		}
		return nil
	})
	if err != nil {
		return 0, 0, err
	}
	return movidas, sinCambio, nil
}

// moverPersonaDeGrupoTx hace el movimiento de UNA persona dentro de una
// transacción abierta, con la congregación ya bloqueada (cong). Devuelve false
// si no había nada que cambiar.
func moverPersonaDeGrupoTx(tx *gorm.DB, cong string, personaID int, grupoID *int, fecha string, motivoID *int64, detalles, actorID string) (bool, error) {
	var estados []string
	if err := tx.Raw("SELECT estado FROM core_personas WHERE id = ?::integer FOR UPDATE", personaID).Scan(&estados).Error; err != nil {
		return false, err
	}
	if len(estados) == 0 {
		return false, ErrPersonaInexistente
	}
	if estados[0] != "ALTA" {
		return false, ErrPersonaEstadoNoCorresponde
	}

	type actual struct {
		ID          int64   `gorm:"column:id"`
		GrupoID     int     `gorm:"column:grupo_id"`
		FechaInicio *string `gorm:"column:fecha_inicio"`
	}
	var act []actual
	if err := tx.Raw(`
		SELECT id AS id, grupo_id AS grupo_id, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
		FROM core_grupos_movimientos
		WHERE persona_id = ?::integer AND vigente
		LIMIT 1`, personaID).Scan(&act).Error; err != nil {
		return false, err
	}
	if len(act) > 0 && grupoID != nil && act[0].GrupoID == *grupoID {
		return false, nil // ya está en ese grupo
	}
	if len(act) == 0 && grupoID == nil {
		return false, nil // ya no tenía grupo
	}

	// Los encargados (superintendente y auxiliar) no se mueven: primero se los reemplaza.
	var encargados []int64
	if err := tx.Raw(`
		SELECT id FROM core_grupos_encargados_historial
		WHERE persona_id = ?::integer AND vigente LIMIT 1`, personaID).Scan(&encargados).Error; err != nil {
		return false, err
	}
	if len(encargados) > 0 {
		return false, ErrPersonaEncargadoGrupo
	}

	// Grupo destino: se bloquea y se comprueba.
	numero := 0
	if grupoID != nil {
		type destino struct {
			CongregacionID string  `gorm:"column:congregacion_id"`
			Numero         int     `gorm:"column:numero"`
			Activo         bool    `gorm:"column:activo"`
			FechaInicio    *string `gorm:"column:fecha_inicio"`
		}
		var ds []destino
		if err := tx.Raw(`
			SELECT congregacion_id::text AS congregacion_id,
			       numero AS numero,
			       activo AS activo,
			       to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
			FROM core_grupos WHERE id = ?::integer FOR UPDATE`, *grupoID).Scan(&ds).Error; err != nil {
			return false, err
		}
		if len(ds) == 0 || !strings.EqualFold(ds[0].CongregacionID, cong) {
			return false, ErrGrupoInexistente
		}
		if !ds[0].Activo {
			return false, ErrGrupoCerrado
		}
		if ds[0].FechaInicio != nil && fecha < *ds[0].FechaInicio {
			return false, ErrFechaAnteriorIngresoGrupo
		}
		numero = ds[0].Numero
	}

	// La fecha no puede ser anterior al fin de un movimiento ya cerrado ni al
	// inicio del vigente (las fechas AAAA-MM-DD se comparan como texto).
	var posteriores []int64
	if err := tx.Raw(`
		SELECT id FROM core_grupos_movimientos
		WHERE persona_id = ?::integer AND NOT vigente AND fecha_fin > ?::date
		LIMIT 1`, personaID, fecha).Scan(&posteriores).Error; err != nil {
		return false, err
	}
	if len(posteriores) > 0 {
		return false, ErrFechaAnteriorMovimiento
	}

	if len(act) > 0 {
		if act[0].FechaInicio != nil && fecha < *act[0].FechaInicio {
			return false, ErrFechaAnteriorMovimiento
		}
		if err := tx.Exec(`
			UPDATE core_grupos_movimientos
			SET vigente = false,
			    fecha_fin = ?::date,
			    motivo_salida_id = ?::integer,
			    motivo_salida = (SELECT m.nombre FROM core_motivos m WHERE m.id = ?::integer),
			    detalles_salida = NULLIF(?::text, ''),
			    quitado_por = NULLIF(?::text, '')::integer
			WHERE id = ?::bigint`,
			fecha, motivoParam(motivoID), motivoParam(motivoID), detalles, actorID, act[0].ID).Error; err != nil {
			return false, err
		}
	}

	var nuevoGrupo interface{}
	if grupoID != nil {
		if err := tx.Exec(`
			INSERT INTO core_grupos_movimientos
				(persona_id, grupo_id, numero_grupo, fecha_inicio, vigente,
				 motivo_entrada_id, motivo_entrada, detalles_entrada, asignado_por)
			VALUES (?::integer, ?::integer, ?::integer, ?::date, true,
			        ?::integer, (SELECT m.nombre FROM core_motivos m WHERE m.id = ?::integer),
			        NULLIF(?::text, ''), NULLIF(?::text, '')::integer)`,
			personaID, *grupoID, numero, fecha,
			motivoParam(motivoID), motivoParam(motivoID), detalles, actorID).Error; err != nil {
			return false, err
		}
		nuevoGrupo = *grupoID
	}

	if err := tx.Exec(
		"UPDATE core_personas SET grupo_id = ?::integer WHERE id = ?::integer",
		nuevoGrupo, personaID).Error; err != nil {
		return false, err
	}
	return true, nil
}
