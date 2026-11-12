/**
 * ARCHIVO: personas_estado_fechas.go
 * UBICACIÓN: backend/internal/repository/personas_estado_fechas.go
 * DESCRIPCIÓN: Tramo 2D, paso 5.4: modificar la fecha de alta y/o de baja de
 * una fila YA CARGADA del historial de estado (core_personas_estado_historial).
 * Aplica la regla 5: si la baja cambia de día, lo que se cerró ese mismo día
 * con la baja (situaciones y puestos) se mueve con ella, en la misma
 * transacción. Escribe modificado_por y modificado_at.
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
	// ErrBajaEnEstadoVigente: se pidió fecha de baja para una fila de alta vigente.
	ErrBajaEnEstadoVigente = errors.New("la persona está de alta: esa fila no tiene fecha de baja")
	// ErrFechaSolapaEstado: la fecha se superpone con otro período de alta de la persona.
	ErrFechaSolapaEstado = errors.New("la fecha se superpone con otro período de alta de la persona")
)

// ErrEstadoIncoherente: el cambio dejaría una situación, rol o puesto en una
// fecha incoherente. Detalle dice cuál.
type ErrEstadoIncoherente struct{ Detalle string }

func (e *ErrEstadoIncoherente) Error() string {
	return "el cambio deja filas incoherentes: " + e.Detalle
}

// ModificarFechasEstado cambia fecha_alta y/o fecha_baja de la fila `id`.
// alta o baja nil = esa fecha no se toca. alta ya viene validada (AAAA-MM-DD);
// baja es la fecha elegida (Dia para columnas date, Instante para puestos).
// Devuelve false si no había nada que cambiar.
func (r *Repository) ModificarFechasEstado(id int64, congregacionID string, todas bool, alta *string, baja *FechaElegida, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			PersonaID      int     `gorm:"column:persona_id"`
			CongregacionID string  `gorm:"column:congregacion_id"`
			Vigente        bool    `gorm:"column:vigente"`
			FechaAlta      *string `gorm:"column:fecha_alta"`
			FechaBaja      *string `gorm:"column:fecha_baja"`
		}
		const leer = `
			SELECT h.persona_id AS persona_id,
			       COALESCE(p.congregacion_id::text, '') AS congregacion_id,
			       h.vigente AS vigente,
			       to_char(h.fecha_alta, 'YYYY-MM-DD') AS fecha_alta,
			       to_char(h.fecha_baja, 'YYYY-MM-DD') AS fecha_baja
			FROM core_personas_estado_historial h
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
		personaID := filas[0].PersonaID
		idTxt := strconv.Itoa(personaID)

		// 2) Bloquear: primero la congregación y después la persona (el mismo
		// orden que DarDeBajaPersona), y volver a leer la fila.
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
		filas = nil
		if err := tx.Raw(leer, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 {
			return ErrFilaInexistente
		}
		f := filas[0]

		// 3) Valores nuevos (una fecha vacía siempre cambia al completarla).
		nuevaAlta := f.FechaAlta
		nuevaBaja := f.FechaBaja
		altaCambia, bajaCambia := false, false
		if alta != nil && (f.FechaAlta == nil || *f.FechaAlta != *alta) {
			nuevaAlta = alta
			altaCambia = true
		}
		if baja != nil {
			if f.Vigente {
				return ErrBajaEnEstadoVigente
			}
			if f.FechaBaja == nil || *f.FechaBaja != baja.Dia {
				d := baja.Dia
				nuevaBaja = &d
				bajaCambia = true
			}
		}
		if !altaCambia && !bajaCambia {
			return nil
		}

		// 4) Reglas. Las fechas AAAA-MM-DD se comparan como texto.
		if nuevaAlta != nil && nuevaBaja != nil && *nuevaBaja < *nuevaAlta {
			return ErrFechaInicioPosteriorFin
		}

		// Superposición con los otros períodos de alta de la persona
		// (tocarse el mismo día se permite). Solo si el período se puede comparar.
		if f.Vigente || nuevaBaja != nil {
			var solapes []int64
			if err := tx.Raw(`
				SELECT h.id
				FROM core_personas_estado_historial h
				WHERE h.id <> ?::bigint
				  AND h.persona_id = ?::integer
				  AND (h.vigente OR h.fecha_baja IS NOT NULL)
				  AND COALESCE(?::date, '-infinity'::date) < COALESCE(h.fecha_baja, 'infinity'::date)
				  AND COALESCE(?::date, 'infinity'::date) > COALESCE(h.fecha_alta, '-infinity'::date)
				LIMIT 1`,
				id, personaID, fechaTextoParam(nuevaAlta), fechaTextoParam(nuevaBaja)).Scan(&solapes).Error; err != nil {
				return err
			}
			if len(solapes) > 0 {
				return ErrFechaSolapaEstado
			}
		}

		// 5) Regla 5: la baja cambia de día -> se mueve lo que se cerró con ella.
		if bajaCambia && f.FechaBaja != nil {
			if err := moverCierresDeBaja(tx, personaID, idTxt, id, *f.FechaBaja, baja, actorID); err != nil {
				return err
			}
		}

		// 6) Escribir la fila de estado, con quién y cuándo.
		if err := tx.Exec(`
			UPDATE core_personas_estado_historial
			SET fecha_alta = ?::date,
			    fecha_baja = ?::date,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`,
			fechaTextoParam(nuevaAlta), fechaTextoParam(nuevaBaja), actorID, id).Error; err != nil {
			return err
		}

		// 7) core_personas: solo si esta es la última fila de estado de la persona.
		var posteriores []int64
		if err := tx.Raw(`
			SELECT h.id FROM core_personas_estado_historial h
			WHERE h.persona_id = ?::integer AND h.id <> ?::bigint
			  AND COALESCE(h.fecha_alta, '-infinity'::date) > COALESCE(?::date, '-infinity'::date)
			LIMIT 1`, personaID, id, fechaTextoParam(nuevaAlta)).Scan(&posteriores).Error; err != nil {
			return err
		}
		esUltima := len(posteriores) == 0
		if esUltima && altaCambia {
			if err := tx.Exec("UPDATE core_personas SET fecha_alta = ?::date WHERE id = ?::integer",
				fechaTextoParam(nuevaAlta), personaID).Error; err != nil {
				return err
			}
		}
		if esUltima && bajaCambia {
			if err := tx.Exec("UPDATE core_personas SET fecha_baja = ?::date WHERE id = ?::integer AND estado = 'BAJA'",
				fechaTextoParam(nuevaBaja), personaID).Error; err != nil {
				return err
			}
		}

		// 8) Red de seguridad: nada del período puede quedar fuera de [alta, baja].
		if err := verificarDependientesDelPeriodo(tx, personaID, idTxt, id,
			fechaTextoParam(f.FechaAlta), fechaTextoParam(f.FechaBaja),
			fechaTextoParam(nuevaAlta), fechaTextoParam(nuevaBaja)); err != nil {
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

// moverCierresDeBaja mueve a la fecha nueva de baja las situaciones y los
// puestos que se cerraron el día dOld con la baja. Si alguno queda incoherente
// (antes de su inicio o superpuesto con otro), devuelve ErrEstadoIncoherente.
func moverCierresDeBaja(tx *gorm.DB, personaID int, idTxt string, estadoID int64, dOld string, nueva *FechaElegida, actorID string) error {
	// --- Situaciones cerradas con la baja ---
	type sit struct {
		ID          int64   `gorm:"column:id"`
		Campo       int     `gorm:"column:campo"`
		Valor       string  `gorm:"column:valor"`
		FechaInicio *string `gorm:"column:fecha_inicio"`
	}
	var sits []sit
	if err := tx.Raw(`
		SELECT h.id AS id, h.campo AS campo, h.valor AS valor,
		       to_char(h.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
		FROM core_personas_situaciones_historial h
		WHERE h.persona_id = ?::integer
		  AND h.vigente = false
		  AND h.fecha_fin = ?::date
		  AND NOT EXISTS (
		        SELECT 1 FROM core_personas_situaciones_historial s
		        WHERE s.persona_id = h.persona_id AND s.campo = h.campo
		          AND s.id <> h.id AND s.fecha_inicio = ?::date
		          AND NOT EXISTS (
		                SELECT 1 FROM core_personas_estado_historial e
		                WHERE e.persona_id = h.persona_id AND e.id <> ?::bigint
		                  AND e.fecha_alta = ?::date))`,
		personaID, dOld, dOld, estadoID, dOld).Scan(&sits).Error; err != nil {
		return err
	}
	for _, s := range sits {
		if s.FechaInicio != nil && nueva.Dia < *s.FechaInicio {
			return &ErrEstadoIncoherente{Detalle: fmt.Sprintf(
				"la situación %d «%s» empieza el %s, después de la nueva fecha de baja (%s)",
				s.Campo, s.Valor, *s.FechaInicio, nueva.Dia)}
		}
		var solapes []int64
		if err := tx.Raw(`
			SELECT h.id
			FROM core_personas_situaciones_historial h
			WHERE h.id <> ?::bigint AND h.persona_id = ?::integer AND h.campo = ?::integer
			  AND (h.vigente OR h.fecha_fin IS NOT NULL)
			  AND COALESCE(?::date, '-infinity'::date) < COALESCE(h.fecha_fin, 'infinity'::date)
			  AND ?::date > COALESCE(h.fecha_inicio, '-infinity'::date)
			LIMIT 1`,
			s.ID, personaID, s.Campo, fechaTextoParam(s.FechaInicio), nueva.Dia).Scan(&solapes).Error; err != nil {
			return err
		}
		if len(solapes) > 0 {
			return &ErrEstadoIncoherente{Detalle: fmt.Sprintf(
				"la situación %d «%s» se superpondría con otro período de la misma situación al mover la baja al %s",
				s.Campo, s.Valor, nueva.Dia)}
		}
		if err := tx.Exec(`
			UPDATE core_personas_situaciones_historial
			SET fecha_fin = ?::date,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`, nueva.Dia, actorID, s.ID).Error; err != nil {
			return err
		}
	}

	// --- Puestos cerrados con la baja ---
	type puesto struct {
		ID             int64     `gorm:"column:id"`
		ModuloID       string    `gorm:"column:modulo_id"`
		Puesto         string    `gorm:"column:puesto"`
		CongregacionID string    `gorm:"column:congregacion_id"`
		FechaInicio    time.Time `gorm:"column:fecha_inicio"`
	}
	var puestos []puesto
	if err := tx.Raw(`
		SELECT h.id AS id, h.modulo_id AS modulo_id, h.puesto AS puesto,
		       COALESCE(h.congregacion_id::text, '') AS congregacion_id,
		       h.fecha_inicio AS fecha_inicio
		FROM core_puestos_historial h
		WHERE h.persona_id::text = ?::text
		  AND h.motivo_quitar = 'Baja de la persona'
		  AND h.fecha_fin IS NOT NULL
		  AND to_char(h.fecha_fin AT TIME ZONE 'UTC', 'YYYY-MM-DD') = ?::text`,
		idTxt, dOld).Scan(&puestos).Error; err != nil {
		return err
	}
	nuevoFin := nueva.Instante()
	for _, p := range puestos {
		if nuevoFin.Before(p.FechaInicio) {
			return &ErrEstadoIncoherente{Detalle: fmt.Sprintf(
				"el puesto «%s» del departamento «%s» empieza el %s, después de la nueva fecha de baja (%s)",
				p.Puesto, p.ModuloID, diaUTC(p.FechaInicio), nueva.Dia)}
		}
		var solapes []int64
		if err := tx.Raw(`
			SELECT h.id
			FROM core_puestos_historial h
			WHERE h.id <> ?::bigint
			  AND h.modulo_id = ?::text
			  AND (h.persona_id::text = ?::text
			       OR (h.puesto = ?::text AND h.congregacion_id::text = ?::text))
			  AND ?::timestamptz < COALESCE(h.fecha_fin, 'infinity'::timestamptz)
			  AND ?::timestamptz > h.fecha_inicio
			LIMIT 1`,
			p.ID, p.ModuloID, idTxt, p.Puesto, p.CongregacionID,
			p.FechaInicio, nuevoFin).Scan(&solapes).Error; err != nil {
			return err
		}
		if len(solapes) > 0 {
			return &ErrEstadoIncoherente{Detalle: fmt.Sprintf(
				"el puesto «%s» del departamento «%s» se superpondría con otra fila al mover la baja al %s",
				p.Puesto, p.ModuloID, nueva.Dia)}
		}
		if err := tx.Exec(`
			UPDATE core_puestos_historial
			SET fecha_fin = ?::timestamptz,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`, nuevoFin, actorID, p.ID).Error; err != nil {
			return err
		}
	}
	return nil
}

// verificarDependientesDelPeriodo: red de seguridad. Ninguna situación, rol ni
// puesto que pertenecía al período [oa, ob] puede quedar fuera de [na, nb].
// Se llama DESPUÉS de mover lo cerrado con la baja. Las filas que empiezan el
// mismo día que el alta de OTRO período no se consideran de este.
func verificarDependientesDelPeriodo(tx *gorm.DB, personaID int, idTxt string, estadoID int64, oa, ob, na, nb interface{}) error {
	const iniTS = "(h.fecha_inicio AT TIME ZONE 'UTC')::date"
	const finTS = "(h.fecha_fin AT TIME ZONE 'UTC')::date"
	const iniD = "h.fecha_inicio"
	const finD = "h.fecha_fin"

	revisar := func(tabla, etiqueta, ini, fin, vigente string) (string, error) {
		q := `
			SELECT ` + etiqueta + ` || ' (' || to_char(` + ini + `, 'YYYY-MM-DD') || ' a ' ||
			       COALESCE(to_char(` + fin + `, 'YYYY-MM-DD'), 'vigente') || ')' AS detalle
			FROM ` + tabla + ` h
			WHERE h.persona_id::text = ?::text
			  AND ` + ini + ` IS NOT NULL
			  AND ` + ini + ` >= COALESCE(?::date, '-infinity'::date)
			  AND ` + ini + ` <= COALESCE(?::date, 'infinity'::date)
			  AND NOT EXISTS (
			        SELECT 1 FROM core_personas_estado_historial e
			        WHERE e.persona_id = ?::integer AND e.id <> ?::bigint
			          AND e.fecha_alta = ` + ini + `)
			  AND ( ` + ini + ` < COALESCE(?::date, '-infinity'::date)
			        OR (?::date IS NOT NULL
			            AND (` + ini + ` > ?::date OR ` + fin + ` > ?::date OR ` + vigente + `)) )
			LIMIT 1`
		var det []string
		if err := tx.Raw(q, idTxt, oa, ob, personaID, estadoID, na, nb, nb, nb).Scan(&det).Error; err != nil {
			return "", err
		}
		if len(det) > 0 {
			return det[0], nil
		}
		return "", nil
	}

	if d, err := revisar("core_personas_situaciones_historial",
		"'la situación ' || h.campo || ' «' || h.valor || '»'", iniD, finD, "h.vigente"); err != nil {
		return err
	} else if d != "" {
		return &ErrEstadoIncoherente{Detalle: d + " quedaría fuera del período de alta: corríjala antes en su historial"}
	}
	if d, err := revisar("core_personas_roles_historial",
		"'el rol ' || h.rol", iniTS, finTS, "h.vigente"); err != nil {
		return err
	} else if d != "" {
		return &ErrEstadoIncoherente{Detalle: d + " quedaría fuera del período de alta: corríjalo antes en su historial"}
	}
	if d, err := revisar("core_puestos_historial",
		"'el puesto ' || h.puesto || ' de ' || h.modulo_id", iniTS, finTS, "h.fecha_fin IS NULL"); err != nil {
		return err
	} else if d != "" {
		return &ErrEstadoIncoherente{Detalle: d + " quedaría fuera del período de alta: corríjalo antes en su historial"}
	}
	return nil
}