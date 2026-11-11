/**
 * ARCHIVO: personas_rol_fechas.go
 * UBICACIÓN: backend/internal/repository/personas_rol_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.2: modificar la fecha de inicio y/o de fin de
 * una fila YA CARGADA del historial de roles (core_personas_roles_historial).
 * Todo en UNA transacción; escribe modificado_por y modificado_at.
 * Las fechas de esa tabla pueden ser NULL (roles anteriores al historial): una
 * fecha vacía no limita ni se compara.
 */

package repository

import (
	"errors"
	"strconv"
	"time"

	"gorm.io/gorm"
)

var (
	// ErrFinEnRolVigente: se pidió una fecha de fin para un rol que sigue vigente.
	ErrFinEnRolVigente = errors.New("el rol sigue vigente: no tiene fecha de fin")
	// ErrFechaSolapaRolCargo: la fecha se superpone con un período de OTRA persona en ese mismo rol.
	ErrFechaSolapaRolCargo = errors.New("la fecha se superpone con un período de otra persona en ese rol")
)

// ModificarFechasRol cambia fecha_inicio y/o fecha_fin de la fila `id` del
// historial de roles. inicio o fin nil = esa fecha no se toca. congregacionID
// es la del actor; todas=true (superadmin) permite cualquier congregación. Una
// fila de otra congregación responde igual que una inexistente.
//
// Reglas: el inicio no es posterior al fin (el mismo día sí); el período cae
// dentro de un período de alta de la persona; no se superpone con otra fila de
// la misma persona en ese rol (ErrFechaSolapaRol) ni con una de otra persona en
// ese rol de la congregación (ErrFechaSolapaRolCargo); tocarse en el mismo
// instante se permite; un rol vigente no tiene fin (se cierra con la rotación).
// Si una fecha cae en el mismo día que la que ya tiene, no se cambia (se
// conserva la hora). Devuelve false si no había nada que cambiar.
// No cambia "vigente", así que rol_app no hay que recalcularlo.
func (r *Repository) ModificarFechasRol(id int64, congregacionID string, todas bool, inicio, fin *FechaElegida, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			PersonaID      int        `gorm:"column:persona_id"`
			CongregacionID string     `gorm:"column:congregacion_id"`
			Rol            string     `gorm:"column:rol"`
			Vigente        bool       `gorm:"column:vigente"`
			FechaInicio    *time.Time `gorm:"column:fecha_inicio"`
			FechaFin       *time.Time `gorm:"column:fecha_fin"`
		}
		const leer = `
			SELECT persona_id AS persona_id,
			       COALESCE(congregacion_id::text, '') AS congregacion_id,
			       rol AS rol,
			       vigente AS vigente,
			       fecha_inicio AS fecha_inicio,
			       fecha_fin AS fecha_fin
			FROM core_personas_roles_historial
			WHERE id = ?::bigint`

		// 1) Leer sin bloquear: congregación y alcance.
		var filas []fila
		if err := tx.Raw(leer, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 || (!todas && filas[0].CongregacionID != congregacionID) {
			return ErrFilaInexistente
		}

		// 2) Bloquear la congregación y volver a leer la fila ya bloqueada.
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

		// 3) Valores nuevos (solo si el DÍA cambia; una fecha vacía siempre cambia).
		nuevoIni := f.FechaInicio
		nuevoFin := f.FechaFin
		hayCambio := false
		if inicio != nil && (f.FechaInicio == nil || diaUTC(*f.FechaInicio) != inicio.Dia) {
			t := inicio.Instante()
			nuevoIni = &t
			hayCambio = true
		}
		if fin != nil {
			if f.Vigente {
				return ErrFinEnRolVigente
			}
			if f.FechaFin == nil || diaUTC(*f.FechaFin) != fin.Dia {
				t := fin.Instante()
				nuevoFin = &t
				hayCambio = true
			}
		}
		if !hayCambio {
			return nil
		}

		// 4) Reglas.
		if nuevoIni != nil && nuevoFin != nil && nuevoFin.Before(*nuevoIni) {
			return ErrFechaInicioPosteriorFin
		}
		personaTxt := strconv.Itoa(f.PersonaID)
		switch {
		case nuevoIni != nil:
			if err := verificarPeriodoDeAlta(tx, personaTxt, *nuevoIni, nuevoFin); err != nil {
				return err
			}
		case nuevoFin != nil:
			if err := verificarPeriodoDeAlta(tx, personaTxt, *nuevoFin, nil); err != nil {
				return err
			}
		}

		// Superposición: solo si el período se puede comparar (vigente, o con fin).
		if f.Vigente || nuevoFin != nil {
			type solape struct {
				MismaPersona bool `gorm:"column:misma_persona"`
			}
			var solapes []solape
			if err := tx.Raw(`
				SELECT (h.persona_id = ?::integer) AS misma_persona
				FROM core_personas_roles_historial h
				WHERE h.id <> ?::bigint
				  AND h.rol = ?::text
				  AND (h.persona_id = ?::integer OR h.congregacion_id::text = ?::text)
				  AND (h.vigente OR h.fecha_fin IS NOT NULL)
				  AND COALESCE(?::timestamptz, '-infinity'::timestamptz) < COALESCE(h.fecha_fin, 'infinity'::timestamptz)
				  AND COALESCE(?::timestamptz, 'infinity'::timestamptz) > COALESCE(h.fecha_inicio, '-infinity'::timestamptz)
				ORDER BY (h.persona_id = ?::integer) DESC
				LIMIT 1`,
				f.PersonaID, id, f.Rol, f.PersonaID, f.CongregacionID,
				fechaRolParam(nuevoIni), fechaRolParam(nuevoFin), f.PersonaID).Scan(&solapes).Error; err != nil {
				return err
			}
			if len(solapes) > 0 {
				if solapes[0].MismaPersona {
					return ErrFechaSolapaRol
				}
				return ErrFechaSolapaRolCargo
			}
		}

		// 5) Escribir, con quién y cuándo.
		if err := tx.Exec(`
			UPDATE core_personas_roles_historial
			SET fecha_inicio = ?::timestamptz,
			    fecha_fin = ?::timestamptz,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`,
			fechaRolParam(nuevoIni), fechaRolParam(nuevoFin), actorID, id).Error; err != nil {
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
