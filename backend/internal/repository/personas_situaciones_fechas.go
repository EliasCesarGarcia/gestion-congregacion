/**
 * ARCHIVO: personas_situaciones_fechas.go
 * UBICACIÓN: backend/internal/repository/personas_situaciones_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.3: modificar la fecha de inicio y/o de fin de
 * una fila YA CARGADA del historial de situaciones
 * (core_personas_situaciones_historial). Las fechas de esa tabla son `date`
 * (sin hora) y pueden ser NULL en filas antiguas. Todo en UNA transacción;
 * escribe modificado_por y modificado_at.
 * Esa tabla no tiene congregación propia: el alcance se decide por la
 * congregación de la persona, y lo que se bloquea es la fila de la persona
 * (igual que al cambiar una situación, dar de baja o reactivar).
 */

package repository

import (
	"errors"
	"strconv"
	"time"

	"gorm.io/gorm"
)

var (
	// ErrFinEnSituacionVigente: se pidió una fecha de fin para una situación que sigue vigente.
	ErrFinEnSituacionVigente = errors.New("la situación sigue vigente: no tiene fecha de fin")
	// ErrFechaSolapaSituacion: la fecha se superpone con otro período de la misma situación de la persona.
	ErrFechaSolapaSituacion = errors.New("la fecha se superpone con otro período de la misma situación de la persona")
)

// fechaTextoParam convierte una fecha opcional AAAA-MM-DD en un valor para la
// consulta (nil = NULL).
func fechaTextoParam(s *string) interface{} {
	if s == nil {
		return nil
	}
	return *s
}

// ModificarFechasSituacion cambia fecha_inicio y/o fecha_fin de la fila `id`.
// inicio o fin nil = esa fecha no se toca; si vienen, ya están validadas por el
// servicio (AAAA-MM-DD, no futuras). congregacionID es la del actor; todas=true
// (superadmin) permite cualquier congregación. Una fila de una persona de otra
// congregación responde igual que una inexistente (ErrFilaInexistente).
//
// Reglas: el inicio no es posterior al fin (el mismo día sí); el período cae
// dentro de un período de alta de la persona; no se superpone con otra fila de
// la misma persona y el mismo campo (tocarse el mismo día se permite); una
// situación vigente no tiene fin (se cierra cambiando la situación). Devuelve
// false si no había nada que cambiar. No cambia "vigente" ni core_personas.
func (r *Repository) ModificarFechasSituacion(id int64, congregacionID string, todas bool, inicio, fin *string, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			PersonaID      int     `gorm:"column:persona_id"`
			CongregacionID string  `gorm:"column:congregacion_id"`
			Campo          int     `gorm:"column:campo"`
			Vigente        bool    `gorm:"column:vigente"`
			FechaInicio    *string `gorm:"column:fecha_inicio"`
			FechaFin       *string `gorm:"column:fecha_fin"`
		}
		const leer = `
			SELECT h.persona_id AS persona_id,
			       COALESCE(p.congregacion_id::text, '') AS congregacion_id,
			       h.campo AS campo,
			       h.vigente AS vigente,
			       to_char(h.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
			       to_char(h.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
			FROM core_personas_situaciones_historial h
			JOIN core_personas p ON p.id = h.persona_id
			WHERE h.id = ?::bigint`

		// 1) Leer sin bloquear: la persona y el alcance.
		var filas []fila
		if err := tx.Raw(leer, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 || (!todas && filas[0].CongregacionID != congregacionID) {
			return ErrFilaInexistente
		}

		// 2) Bloquear a la persona y volver a leer la fila.
		var bloqueada []int
		if err := tx.Raw("SELECT id FROM core_personas WHERE id = ?::integer FOR UPDATE", filas[0].PersonaID).Scan(&bloqueada).Error; err != nil {
			return err
		}
		if len(bloqueada) == 0 {
			return ErrFilaInexistente
		}
		filas = nil
		if err := tx.Raw(leer, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 {
			return ErrFilaInexistente
		}
		f := filas[0]

		// 3) Valores nuevos (una fecha vacía siempre cambia al completarla).
		nuevoIni := f.FechaInicio
		nuevoFin := f.FechaFin
		hayCambio := false
		if inicio != nil && (f.FechaInicio == nil || *f.FechaInicio != *inicio) {
			nuevoIni = inicio
			hayCambio = true
		}
		if fin != nil {
			if f.Vigente {
				return ErrFinEnSituacionVigente
			}
			if f.FechaFin == nil || *f.FechaFin != *fin {
				nuevoFin = fin
				hayCambio = true
			}
		}
		if !hayCambio {
			return nil
		}

		// 4) Reglas. Las fechas AAAA-MM-DD se comparan como texto.
		if nuevoIni != nil && nuevoFin != nil && *nuevoFin < *nuevoIni {
			return ErrFechaInicioPosteriorFin
		}

		personaTxt := strconv.Itoa(f.PersonaID)
		switch {
		case nuevoIni != nil:
			ini, err := time.Parse("2006-01-02", *nuevoIni)
			if err != nil {
				return err
			}
			var finT *time.Time
			if nuevoFin != nil {
				t, err := time.Parse("2006-01-02", *nuevoFin)
				if err != nil {
					return err
				}
				finT = &t
			}
			if err := verificarPeriodoDeAlta(tx, personaTxt, ini, finT); err != nil {
				return err
			}
		case nuevoFin != nil:
			t, err := time.Parse("2006-01-02", *nuevoFin)
			if err != nil {
				return err
			}
			if err := verificarPeriodoDeAlta(tx, personaTxt, t, nil); err != nil {
				return err
			}
		}

		// Superposición: solo si el período se puede comparar (vigente, o con fin).
		if f.Vigente || nuevoFin != nil {
			var solapes []int64
			if err := tx.Raw(`
				SELECT h.id
				FROM core_personas_situaciones_historial h
				WHERE h.id <> ?::bigint
				  AND h.persona_id = ?::integer
				  AND h.campo = ?::integer
				  AND (h.vigente OR h.fecha_fin IS NOT NULL)
				  AND COALESCE(?::date, '-infinity'::date) < COALESCE(h.fecha_fin, 'infinity'::date)
				  AND COALESCE(?::date, 'infinity'::date) > COALESCE(h.fecha_inicio, '-infinity'::date)
				LIMIT 1`,
				id, f.PersonaID, f.Campo,
				fechaTextoParam(nuevoIni), fechaTextoParam(nuevoFin)).Scan(&solapes).Error; err != nil {
				return err
			}
			if len(solapes) > 0 {
				return ErrFechaSolapaSituacion
			}
		}

		// 5) Escribir, con quién y cuándo.
		if err := tx.Exec(`
			UPDATE core_personas_situaciones_historial
			SET fecha_inicio = ?::date,
			    fecha_fin = ?::date,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`,
			fechaTextoParam(nuevoIni), fechaTextoParam(nuevoFin), actorID, id).Error; err != nil {
			return err
		}
		cambio = true
		return nil
	})
	if err != nil {
		return false, err
	}
	return cambio, nil
}
