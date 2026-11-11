/**
 * ARCHIVO: puestos_fechas.go
 * UBICACIÓN: backend/internal/repository/puestos_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.1: modificar la fecha de inicio y/o de fin de
 * una fila YA CARGADA del historial de puestos (core_puestos_historial).
 * Todo en UNA transacción; escribe modificado_por y modificado_at.
 */

package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

// ErrFinEnPuestoVigente: se pidió una fecha de fin para un puesto que sigue vigente.
var ErrFinEnPuestoVigente = errors.New("el puesto sigue vigente: no tiene fecha de fin")

// ModificarFechasPuesto cambia fecha_inicio y/o fecha_fin de la fila `id`.
// inicio o fin nil = esa fecha no se toca. congregacionID es la del actor;
// todas=true (superadmin) permite filas de cualquier congregación. Una fila de
// otra congregación responde igual que una inexistente (ErrFilaInexistente).
//
// Reglas: el inicio no es posterior al fin (el mismo día sí); el período cae
// dentro de un período de alta de la persona; no se superpone con otra fila de
// la misma persona en ese departamento ni del mismo puesto en ese departamento
// de la congregación (tocarse en el mismo instante sí se permite); un puesto
// vigente no tiene fin (se cierra con quitar). Si una fecha cae en el mismo día
// que la que ya tiene, no se cambia (se conserva la hora). Devuelve false si no
// había nada que cambiar.
func (r *Repository) ModificarFechasPuesto(id int64, congregacionID string, todas bool, inicio, fin *FechaElegida, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			PersonaID      string     `gorm:"column:persona_id"`
			ModuloID       string     `gorm:"column:modulo_id"`
			Puesto         string     `gorm:"column:puesto"`
			CongregacionID string     `gorm:"column:congregacion_id"`
			FechaInicio    time.Time  `gorm:"column:fecha_inicio"`
			FechaFin       *time.Time `gorm:"column:fecha_fin"`
		}
		const leer = `
			SELECT persona_id::text AS persona_id,
			       modulo_id AS modulo_id,
			       puesto AS puesto,
			       COALESCE(congregacion_id::text, '') AS congregacion_id,
			       fecha_inicio AS fecha_inicio,
			       fecha_fin AS fecha_fin
			FROM core_puestos_historial
			WHERE id = ?::bigint`

		// 1) Leer sin bloquear, para saber la congregación y comprobar el alcance.
		var filas []fila
		if err := tx.Raw(leer, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 || (!todas && filas[0].CongregacionID != congregacionID) {
			return ErrFilaInexistente
		}

		// 2) Bloquear la congregación (los cambios de una misma congregación se
		// hacen de a uno) y volver a leer la fila ya bloqueada.
		if filas[0].CongregacionID != "" {
			if err := bloquearCongregacionRoles(tx, filas[0].CongregacionID); err != nil {
				return err
			}
		}
		filas = nil
		if err := tx.Raw(leer+" FOR UPDATE", id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 {
			return ErrFilaInexistente
		}
		f := filas[0]

		// 3) Valores nuevos (solo si el DÍA cambia).
		nuevoIni := f.FechaInicio
		nuevoFin := f.FechaFin
		hayCambio := false
		if inicio != nil && diaUTC(f.FechaInicio) != inicio.Dia {
			nuevoIni = inicio.Instante()
			hayCambio = true
		}
		if fin != nil {
			if f.FechaFin == nil {
				return ErrFinEnPuestoVigente
			}
			if diaUTC(*f.FechaFin) != fin.Dia {
				t := fin.Instante()
				nuevoFin = &t
				hayCambio = true
			}
		}
		if !hayCambio {
			return nil
		}

		// 4) Reglas.
		if nuevoFin != nil && nuevoFin.Before(nuevoIni) {
			return ErrFechaInicioPosteriorFin
		}
		if err := verificarPeriodoDeAlta(tx, f.PersonaID, nuevoIni, nuevoFin); err != nil {
			return err
		}

		type solape struct {
			MismaPersona bool `gorm:"column:misma_persona"`
		}
		var solapes []solape
		if err := tx.Raw(`
			SELECT (h.persona_id::text = ?::text) AS misma_persona
			FROM core_puestos_historial h
			WHERE h.id <> ?::bigint
			  AND h.modulo_id = ?::text
			  AND (h.persona_id::text = ?::text
			       OR (h.puesto = ?::text AND h.congregacion_id::text = ?::text))
			  AND ?::timestamptz < COALESCE(h.fecha_fin, 'infinity'::timestamptz)
			  AND COALESCE(?::timestamptz, 'infinity'::timestamptz) > h.fecha_inicio
			ORDER BY (h.persona_id::text = ?::text) DESC
			LIMIT 1`,
			f.PersonaID, id, f.ModuloID, f.PersonaID, f.Puesto, f.CongregacionID,
			nuevoIni, fechaRolParam(nuevoFin), f.PersonaID).Scan(&solapes).Error; err != nil {
			return err
		}
		if len(solapes) > 0 {
			if solapes[0].MismaPersona {
				return ErrFechaSolapaPuestoPersona
			}
			return ErrFechaSolapaPuestoCargo
		}

		// 5) Escribir, con quién y cuándo.
		if err := tx.Exec(`
			UPDATE core_puestos_historial
			SET fecha_inicio = ?::timestamptz,
			    fecha_fin = ?::timestamptz,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`,
			nuevoIni, fechaRolParam(nuevoFin), actorID, id).Error; err != nil {
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
