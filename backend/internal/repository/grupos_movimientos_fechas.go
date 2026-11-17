/**
 * ARCHIVO: grupos_movimientos_fechas.go
 * UBICACIÓN: backend/internal/repository/grupos_movimientos_fechas.go
 * DESCRIPCIÓN: Tramo A7.1: modificar la fecha de inicio y/o de fin de una fila
 * YA CARGADA del historial de pertenencia a grupos (core_grupos_movimientos).
 * Las fechas son `date` y pueden ser NULL. Todo en UNA transacción; escribe
 * modificado_por y modificado_at.
 * Esa tabla no tiene congregación propia: el alcance sale de la persona.
 * Orden de bloqueos: congregación, persona y grupo.
 * Regla propia: todo cargo de encargado de esa persona en ese grupo tiene que
 * seguir cayendo dentro de una pertenencia de la persona a ese mismo grupo.
 */

package repository

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm"
)

var (
	// ErrFinEnMovimientoVigente: se pidió fecha de fin para una pertenencia vigente.
	ErrFinEnMovimientoVigente = errors.New("la pertenencia sigue vigente: no tiene fecha de fin")
	// ErrFechaSolapaMovimiento: la fecha se superpone con otra pertenencia de la persona.
	ErrFechaSolapaMovimiento = errors.New("la fecha se superpone con otra pertenencia de la persona a un grupo")
)

// textoFechaGrupo: una fecha opcional para los mensajes.
func textoFechaGrupo(f *string, vacio string) string {
	if f == nil {
		return vacio
	}
	return *f
}

// cargoDentroDePertenencia dice si el cargo [ci, cf] cae dentro de la
// pertenencia [mi, mf]. Una fecha vacía de la pertenencia no limita; una fecha
// de inicio vacía del cargo tampoco. Las fechas AAAA-MM-DD se comparan como texto.
func cargoDentroDePertenencia(mi, mf, ci, cf *string) bool {
	if mi != nil && ci != nil && *ci < *mi {
		return false
	}
	if mf != nil {
		if cf == nil || *cf > *mf {
			return false
		}
	}
	return true
}

// ModificarFechasMovimiento cambia fecha_inicio y/o fecha_fin de la fila `id`.
// inicio o fin nil = esa fecha no se toca; si vienen, ya están validadas por el
// servicio (AAAA-MM-DD, no futuras). congregacionID es la del actor; todas=true
// (superadmin) permite cualquier congregación. Una fila de otra congregación
// responde igual que una inexistente (ErrFilaInexistente). Devuelve false si
// no había nada que cambiar. No cambia "vigente" ni core_personas.
func (r *Repository) ModificarFechasMovimiento(id int64, congregacionID string, todas bool, inicio, fin *string, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			PersonaID      int     `gorm:"column:persona_id"`
			CongregacionID string  `gorm:"column:congregacion_id"`
			GrupoID        int     `gorm:"column:grupo_id"`
			NumeroGrupo    int     `gorm:"column:numero_grupo"`
			Vigente        bool    `gorm:"column:vigente"`
			FechaInicio    *string `gorm:"column:fecha_inicio"`
			FechaFin       *string `gorm:"column:fecha_fin"`
		}
		const leer = `
			SELECT m.persona_id AS persona_id,
			       COALESCE(p.congregacion_id::text, '') AS congregacion_id,
			       m.grupo_id AS grupo_id,
			       m.numero_grupo AS numero_grupo,
			       m.vigente AS vigente,
			       to_char(m.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
			       to_char(m.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
			FROM core_grupos_movimientos m
			JOIN core_personas p ON p.id = m.persona_id
			WHERE m.id = ?::bigint`

		// 1) Leer sin bloquear: la persona, el grupo y el alcance.
		var filas []fila
		if err := tx.Raw(leer, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 || (!todas && filas[0].CongregacionID != congregacionID) {
			return ErrFilaInexistente
		}
		personaID := filas[0].PersonaID
		grupoID := filas[0].GrupoID

		// 2) Bloquear en orden: congregación, persona, grupo. Y volver a leer.
		if filas[0].CongregacionID != "" {
			if err := bloquearCongregacionRoles(tx, filas[0].CongregacionID); err != nil {
				return err
			}
		}
		var bloqueada []int
		if err := tx.Raw("SELECT id FROM core_personas WHERE id = ?::integer FOR UPDATE", personaID).Scan(&bloqueada).Error; err != nil {
			return err
		}
		if len(bloqueada) == 0 {
			return ErrFilaInexistente
		}
		if _, err := bloquearGrupo(tx, grupoID); err != nil {
			return err
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
				return ErrFinEnMovimientoVigente
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

		// No antes del inicio del grupo (si se conoce).
		if nuevoIni != nil {
			type gi struct {
				FechaInicio *string `gorm:"column:fecha_inicio"`
			}
			var gs []gi
			if err := tx.Raw(`
				SELECT to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
				FROM core_grupos WHERE id = ?::integer`, grupoID).Scan(&gs).Error; err != nil {
				return err
			}
			if len(gs) > 0 && gs[0].FechaInicio != nil && *nuevoIni < *gs[0].FechaInicio {
				return ErrFechaAnteriorIngresoGrupo
			}
		}

		// Dentro de un período de alta de la persona.
		personaTxt := strconv.Itoa(personaID)
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

		// Superposición con otras pertenencias de la misma persona (tocarse el
		// mismo día se permite). Solo si el período se puede comparar.
		if f.Vigente || nuevoFin != nil {
			var solapes []int64
			if err := tx.Raw(`
				SELECT m.id
				FROM core_grupos_movimientos m
				WHERE m.id <> ?::bigint
				  AND m.persona_id = ?::integer
				  AND (m.vigente OR m.fecha_fin IS NOT NULL)
				  AND COALESCE(?::date, '-infinity'::date) < COALESCE(m.fecha_fin, 'infinity'::date)
				  AND COALESCE(?::date, 'infinity'::date) > COALESCE(m.fecha_inicio, '-infinity'::date)
				LIMIT 1`,
				id, personaID, fechaTextoParam(nuevoIni), fechaTextoParam(nuevoFin)).Scan(&solapes).Error; err != nil {
				return err
			}
			if len(solapes) > 0 {
				return ErrFechaSolapaMovimiento
			}
		}

		// Los cargos de la persona en ESTE grupo deben seguir dentro de alguna
		// pertenencia de la persona a este grupo (la nueva o las otras).
		type cargo struct {
			ID          int64   `gorm:"column:id"`
			Cargo       string  `gorm:"column:cargo"`
			FechaInicio *string `gorm:"column:fecha_inicio"`
			FechaFin    *string `gorm:"column:fecha_fin"`
		}
		var cargos []cargo
		if err := tx.Raw(`
			SELECT e.id AS id, e.cargo AS cargo,
			       to_char(e.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
			       to_char(e.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
			FROM core_grupos_encargados_historial e
			WHERE e.persona_id = ?::integer AND e.grupo_id = ?::integer`,
			personaID, grupoID).Scan(&cargos).Error; err != nil {
			return err
		}
		if len(cargos) > 0 {
			type otra struct {
				FechaInicio *string `gorm:"column:fecha_inicio"`
				FechaFin    *string `gorm:"column:fecha_fin"`
			}
			var otras []otra
			if err := tx.Raw(`
				SELECT to_char(m.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
				       to_char(m.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
				FROM core_grupos_movimientos m
				WHERE m.persona_id = ?::integer AND m.grupo_id = ?::integer AND m.id <> ?::bigint`,
				personaID, grupoID, id).Scan(&otras).Error; err != nil {
				return err
			}
			for _, c := range cargos {
				dentro := cargoDentroDePertenencia(nuevoIni, nuevoFin, c.FechaInicio, c.FechaFin)
				for _, o := range otras {
					if !dentro && cargoDentroDePertenencia(o.FechaInicio, o.FechaFin, c.FechaInicio, c.FechaFin) {
						dentro = true
					}
				}
				if !dentro {
					return &ErrEstadoIncoherente{Detalle: fmt.Sprintf(
						"el cargo de %s del grupo %d (%s a %s) quedaría fuera de la pertenencia de la persona al grupo: corrija primero las fechas del cargo",
						c.Cargo, f.NumeroGrupo,
						textoFechaGrupo(c.FechaInicio, "sin fecha"), textoFechaGrupo(c.FechaFin, "vigente"))}
				}
			}
		}

		// 5) Escribir, con quién y cuándo.
		if err := tx.Exec(`
			UPDATE core_grupos_movimientos
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