/**
 * ARCHIVO: grupos_encargados_fechas.go
 * UBICACIÓN: backend/internal/repository/grupos_encargados_fechas.go
 * DESCRIPCIÓN: Tramo A7.2: modificar la fecha de inicio y/o de fin de una fila
 * YA CARGADA del historial de encargados (core_grupos_encargados_historial).
 * Todo en UNA transacción; escribe modificado_por y modificado_at.
 * La situación 3 espejo del cargo (misma persona, campo 3, mismas fechas) se
 * mueve en la misma transacción. Orden de bloqueos: congregación, persona, grupo.
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
	// ErrFinEnEncargadoVigente: se pidió fecha de fin para un cargo vigente.
	ErrFinEnEncargadoVigente = errors.New("el cargo sigue vigente: no tiene fecha de fin")
	// ErrFechaSolapaEncargado: la fecha se superpone con otro cargo.
	ErrFechaSolapaEncargado = errors.New("la fecha se superpone con otro período del mismo cargo del grupo o de la persona")
	// ErrSituacion3DesdeCargo: la situación 3 se corrige desde el cargo.
	ErrSituacion3DesdeCargo = errors.New("la situación 3 se corrige desde el cargo del grupo")
)

// ModificarFechasEncargado cambia fecha_inicio y/o fecha_fin de la fila `id`.
// inicio o fin nil = esa fecha no se toca (ya vienen validadas por el servicio).
// Devuelve false si no había nada que cambiar.
func (r *Repository) ModificarFechasEncargado(id int64, congregacionID string, todas bool, inicio, fin *string, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			PersonaID      int     `gorm:"column:persona_id"`
			CongregacionID string  `gorm:"column:congregacion_id"`
			GrupoID        int     `gorm:"column:grupo_id"`
			NumeroGrupo    int     `gorm:"column:numero_grupo"`
			Cargo          string  `gorm:"column:cargo"`
			Vigente        bool    `gorm:"column:vigente"`
			FechaInicio    *string `gorm:"column:fecha_inicio"`
			FechaFin       *string `gorm:"column:fecha_fin"`
		}
		const leer = `
			SELECT e.persona_id AS persona_id,
			       COALESCE(p.congregacion_id::text, '') AS congregacion_id,
			       e.grupo_id AS grupo_id,
			       g.numero AS numero_grupo,
			       e.cargo AS cargo,
			       e.vigente AS vigente,
			       to_char(e.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
			       to_char(e.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
			FROM core_grupos_encargados_historial e
			JOIN core_personas p ON p.id = e.persona_id
			JOIN core_grupos g ON g.id = e.grupo_id
			WHERE e.id = ?::bigint`

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
				return ErrFinEnEncargadoVigente
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

		// Superposición: con otros cargos de la misma persona, o del mismo
		// cargo en el mismo grupo (tocarse el mismo día se permite).
		if f.Vigente || nuevoFin != nil {
			var solapes []int64
			if err := tx.Raw(`
				SELECT e.id
				FROM core_grupos_encargados_historial e
				WHERE e.id <> ?::bigint
				  AND (e.persona_id = ?::integer
				       OR (e.grupo_id = ?::integer AND e.cargo = ?::text))
				  AND (e.vigente OR e.fecha_fin IS NOT NULL)
				  AND COALESCE(?::date, '-infinity'::date) < COALESCE(e.fecha_fin, 'infinity'::date)
				  AND COALESCE(?::date, 'infinity'::date) > COALESCE(e.fecha_inicio, '-infinity'::date)
				LIMIT 1`,
				id, personaID, grupoID, f.Cargo,
				fechaTextoParam(nuevoIni), fechaTextoParam(nuevoFin)).Scan(&solapes).Error; err != nil {
				return err
			}
			if len(solapes) > 0 {
				return ErrFechaSolapaEncargado
			}
		}

		// El cargo debe caer dentro de una pertenencia de la persona a este
		// grupo. Si no hay ninguna pertenencia registrada (datos viejos), no se comprueba.
		type pert struct {
			FechaInicio *string `gorm:"column:fecha_inicio"`
			FechaFin    *string `gorm:"column:fecha_fin"`
		}
		var perts []pert
		if err := tx.Raw(`
			SELECT to_char(m.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
			       to_char(m.fecha_fin, 'YYYY-MM-DD') AS fecha_fin
			FROM core_grupos_movimientos m
			WHERE m.persona_id = ?::integer AND m.grupo_id = ?::integer`,
			personaID, grupoID).Scan(&perts).Error; err != nil {
			return err
		}
		if len(perts) > 0 {
			dentro := false
			for _, p := range perts {
				if cargoDentroDePertenencia(p.FechaInicio, p.FechaFin, nuevoIni, nuevoFin) {
					dentro = true
					break
				}
			}
			if !dentro {
				return &ErrEstadoIncoherente{Detalle: fmt.Sprintf(
					"el cargo de %s del grupo %d (%s a %s) quedaría fuera de la pertenencia de la persona al grupo: corrija primero las fechas de la pertenencia",
					f.Cargo, f.NumeroGrupo,
					textoFechaGrupo(nuevoIni, "sin fecha"), textoFechaGrupo(nuevoFin, "vigente"))}
			}
		}

		// Fila espejo de la situación 3 (con las fechas VIEJAS del cargo).
		var espejos []int64
		if err := tx.Raw(`
			SELECT s.id FROM core_personas_situaciones_historial s
			WHERE s.persona_id = ?::integer AND s.campo = 3 AND s.vigente = ?::boolean
			  AND s.fecha_inicio IS NOT DISTINCT FROM ?::date
			  AND s.fecha_fin IS NOT DISTINCT FROM ?::date
			ORDER BY s.id DESC LIMIT 1`,
			personaID, f.Vigente, fechaTextoParam(f.FechaInicio), fechaTextoParam(f.FechaFin)).Scan(&espejos).Error; err != nil {
			return err
		}

		// 5) Escribir el cargo y su espejo, con quién y cuándo.
		if err := tx.Exec(`
			UPDATE core_grupos_encargados_historial
			SET fecha_inicio = ?::date,
			    fecha_fin = ?::date,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`,
			fechaTextoParam(nuevoIni), fechaTextoParam(nuevoFin), actorID, id).Error; err != nil {
			return err
		}
		if len(espejos) > 0 {
			if err := tx.Exec(`
				UPDATE core_personas_situaciones_historial
				SET fecha_inicio = ?::date,
				    fecha_fin = ?::date,
				    modificado_por = NULLIF(?::text, '')::integer,
				    modificado_at = now()
				WHERE id = ?::bigint`,
				fechaTextoParam(nuevoIni), fechaTextoParam(nuevoFin), actorID, espejos[0]).Error; err != nil {
				return err
			}
		}
		cambio = true
		return nil
	})
	if err != nil {
		return false, err
	}
	return cambio, nil
}