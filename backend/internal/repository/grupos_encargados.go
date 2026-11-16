/**
 * ARCHIVO: grupos_encargados.go
 * UBICACIÓN: backend/internal/repository/grupos_encargados.go
 * DESCRIPCIÓN: Superintendente y auxiliar de cada grupo
 * (core_grupos_encargados_historial). Elegir, reemplazar o quitar un encargado
 * se hace en UNA transacción que también cierra y abre la situación 3 de las
 * personas (historial y core_personas.situacion_3): la situación 3 NO se
 * cambia por otro camino. Nunca se inventan fechas.
 *
 * Requisito por defecto: el encargado es miembro del grupo y tiene situación 2
 * Anciano o Siervo Ministerial. Excepción (extraordinaria): solo si NINGÚN
 * miembro del grupo que cumpla el requisito está libre (que no tenga ya el
 * otro cargo), y con el motivo escrito. Queda marcada en el historial.
 * Orden de bloqueos: congregación, persona y grupo (el mismo que usan la baja
 * y los movimientos de grupo).
 */

package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	// ErrPersonaFueraDelGrupo: la persona no tiene pertenencia vigente a ese grupo.
	ErrPersonaFueraDelGrupo = errors.New("la persona no es miembro de ese grupo")
	// ErrEncargadoNoCumple: no es Anciano ni Siervo Ministerial y no se pidió excepción.
	ErrEncargadoNoCumple = errors.New("la persona no es Anciano ni Siervo Ministerial")
	// ErrExcepcionSinDetalles: la excepción exige escribir el motivo.
	ErrExcepcionSinDetalles = errors.New("la excepción exige escribir el motivo")
	// ErrExcepcionNoCorresponde: hay miembros libres que sí cumplen el requisito.
	ErrExcepcionNoCorresponde = errors.New("hay miembros del grupo que cumplen el requisito")
	// ErrFechaAnteriorEncargado: la fecha es anterior al inicio de algún período involucrado.
	ErrFechaAnteriorEncargado = errors.New("la fecha es anterior al inicio de un período de la persona, del grupo o del encargado actual")
)

// valorSituacion3 traduce el cargo del grupo al valor de la situación 3.
var valorSituacion3 = map[string]string{
	"superintendente": "Superintendente",
	"auxiliar":        "Auxiliar de Grupo",
}

// EncargadoDePersona dice si la persona es superintendente o auxiliar vigente
// de algún grupo y, si lo es, si fue habilitada por excepción.
func (r *Repository) EncargadoDePersona(personaID int) (existe bool, excepcion bool, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	type fila struct {
		Excepcion bool `gorm:"column:excepcion"`
	}
	var fs []fila
	if err := r.db.WithContext(ctx).Raw(`
		SELECT excepcion AS excepcion
		FROM core_grupos_encargados_historial
		WHERE persona_id = ?::integer AND vigente
		LIMIT 1`, personaID).Scan(&fs).Error; err != nil {
		return false, false, err
	}
	if len(fs) == 0 {
		return false, false, nil
	}
	return true, fs[0].Excepcion, nil
}

// CambiarEncargadoGrupo pone a personaID como superintendente o auxiliar
// (cargo) del grupo desde la fecha dada (AAAA-MM-DD, ya validada). personaID 0
// = quitar al titular actual y dejar el cargo vacante. Si ya había un titular,
// se le cierra el cargo y su situación 3 en esa misma fecha. excepcion y
// detalles solo cuentan si la persona no cumple el requisito. Devuelve false
// si no había nada que cambiar.
func (r *Repository) CambiarEncargadoGrupo(grupoID int, cargo string, personaID int, fecha string, excepcion bool, detalles, actorID string) (bool, error) {
	valor, ok := valorSituacion3[cargo]
	if !ok {
		return false, errors.New("cargo de grupo no válido")
	}

	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		// 1) Congregación del grupo (sin bloquear todavía).
		type grupo struct {
			CongregacionID string `gorm:"column:congregacion_id"`
		}
		var gs []grupo
		if err := tx.Raw("SELECT congregacion_id::text AS congregacion_id FROM core_grupos WHERE id = ?::integer", grupoID).Scan(&gs).Error; err != nil {
			return err
		}
		if len(gs) == 0 {
			return ErrGrupoInexistente
		}
		cong := gs[0].CongregacionID

		// 2) Bloqueos en orden: congregación, persona, grupo.
		if err := bloquearCongregacionRoles(tx, cong); err != nil {
			return err
		}
		sit2 := ""
		if personaID > 0 {
			type persona struct {
				Estado         string `gorm:"column:estado"`
				CongregacionID string `gorm:"column:congregacion_id"`
				Situacion2     string `gorm:"column:situacion_2"`
			}
			var ps []persona
			if err := tx.Raw(`
				SELECT estado AS estado,
				       COALESCE(congregacion_id::text, '') AS congregacion_id,
				       COALESCE(situacion_2, '') AS situacion_2
				FROM core_personas WHERE id = ?::integer FOR UPDATE`, personaID).Scan(&ps).Error; err != nil {
				return err
			}
			if len(ps) == 0 || !strings.EqualFold(ps[0].CongregacionID, cong) {
				return ErrPersonaInexistente
			}
			if ps[0].Estado != "ALTA" {
				return ErrPersonaEstadoNoCorresponde
			}
			sit2 = ps[0].Situacion2
		}
		activo, err := bloquearGrupo(tx, grupoID)
		if err != nil {
			return err
		}
		if !activo {
			return ErrGrupoCerrado
		}

		// 3) Titular actual del cargo.
		type titular struct {
			ID          int64   `gorm:"column:id"`
			PersonaID   int     `gorm:"column:persona_id"`
			FechaInicio *string `gorm:"column:fecha_inicio"`
		}
		var ts []titular
		if err := tx.Raw(`
			SELECT id AS id, persona_id AS persona_id, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
			FROM core_grupos_encargados_historial
			WHERE grupo_id = ?::integer AND cargo = ?::text AND vigente
			LIMIT 1`, grupoID, cargo).Scan(&ts).Error; err != nil {
			return err
		}
		if personaID == 0 && len(ts) == 0 {
			return nil // el cargo ya estaba vacante
		}
		if personaID > 0 && len(ts) > 0 && ts[0].PersonaID == personaID {
			return nil // ya es el titular
		}

		// Inicio de la situación 3 vigente de una persona (nil si no hay o no se conoce).
		type inicio struct {
			FechaInicio *string `gorm:"column:fecha_inicio"`
		}
		inicioSit3 := func(pid int) (*string, error) {
			var is []inicio
			if err := tx.Raw(`
				SELECT to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
				FROM core_personas_situaciones_historial
				WHERE persona_id = ?::integer AND campo = 3 AND vigente
				LIMIT 1`, pid).Scan(&is).Error; err != nil {
				return nil, err
			}
			if len(is) == 0 {
				return nil, nil
			}
			return is[0].FechaInicio, nil
		}

		// 4) Comprobaciones del titular que sale (las fechas AAAA-MM-DD se comparan como texto).
		if len(ts) > 0 {
			if ts[0].FechaInicio != nil && fecha < *ts[0].FechaInicio {
				return ErrFechaAnteriorEncargado
			}
			ini, err := inicioSit3(ts[0].PersonaID)
			if err != nil {
				return err
			}
			if ini != nil && fecha < *ini {
				return ErrFechaAnteriorEncargado
			}
		}

		// 5) Comprobaciones de la persona que entra.
		requiereExcepcion := false
		if personaID > 0 {
			var ms []inicio
			if err := tx.Raw(`
				SELECT to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
				FROM core_grupos_movimientos
				WHERE persona_id = ?::integer AND grupo_id = ?::integer AND vigente
				LIMIT 1`, personaID, grupoID).Scan(&ms).Error; err != nil {
				return err
			}
			if len(ms) == 0 {
				return ErrPersonaFueraDelGrupo
			}
			if ms[0].FechaInicio != nil && fecha < *ms[0].FechaInicio {
				return ErrFechaAnteriorEncargado
			}

			var yaEncargado []int64
			if err := tx.Raw(`
				SELECT id FROM core_grupos_encargados_historial
				WHERE persona_id = ?::integer AND vigente LIMIT 1`, personaID).Scan(&yaEncargado).Error; err != nil {
				return err
			}
			if len(yaEncargado) > 0 {
				return ErrPersonaEncargadoGrupo
			}

			requiereExcepcion = sit2 != "Anciano" && sit2 != "Siervo Ministerial"
			if requiereExcepcion {
				if !excepcion {
					return ErrEncargadoNoCumple
				}
				if strings.TrimSpace(detalles) == "" {
					return ErrExcepcionSinDetalles
				}
				// Candidatos libres: miembros del grupo que cumplen el requisito y no
				// tienen el otro cargo. Quien ocupa este mismo cargo sí cuenta.
				var libres []int
				if err := tx.Raw(`
					SELECT m.persona_id
					FROM core_grupos_movimientos m
					JOIN core_personas p ON p.id = m.persona_id
					WHERE m.grupo_id = ?::integer AND m.vigente AND p.estado = 'ALTA'
					  AND p.situacion_2 IN ('Anciano', 'Siervo Ministerial')
					  AND NOT EXISTS (
					        SELECT 1 FROM core_grupos_encargados_historial e
					        WHERE e.persona_id = p.id AND e.vigente AND e.cargo <> ?::text)
					LIMIT 1`, grupoID, cargo).Scan(&libres).Error; err != nil {
					return err
				}
				if len(libres) > 0 {
					return ErrExcepcionNoCorresponde
				}
			}

			var cerrados []int64
			if err := tx.Raw(`
				SELECT id FROM core_grupos_encargados_historial
				WHERE persona_id = ?::integer AND NOT vigente AND fecha_fin > ?::date
				LIMIT 1`, personaID, fecha).Scan(&cerrados).Error; err != nil {
				return err
			}
			if len(cerrados) > 0 {
				return ErrFechaAnteriorEncargado
			}
			var sit3Cerradas []int64
			if err := tx.Raw(`
				SELECT id FROM core_personas_situaciones_historial
				WHERE persona_id = ?::integer AND campo = 3 AND NOT vigente AND fecha_fin > ?::date
				LIMIT 1`, personaID, fecha).Scan(&sit3Cerradas).Error; err != nil {
				return err
			}
			if len(sit3Cerradas) > 0 {
				return ErrFechaAnteriorEncargado
			}
			ini, err := inicioSit3(personaID)
			if err != nil {
				return err
			}
			if ini != nil && fecha < *ini {
				return ErrFechaAnteriorEncargado
			}
		}

		// 6) Escrituras. Primero sale el titular actual (si lo hay).
		if len(ts) > 0 {
			if err := tx.Exec(`
				UPDATE core_grupos_encargados_historial
				SET vigente = false, fecha_fin = ?::date,
				    quitado_por = NULLIF(?::text, '')::integer
				WHERE id = ?::bigint`, fecha, actorID, ts[0].ID).Error; err != nil {
				return err
			}
			if err := tx.Exec(`
				UPDATE core_personas_situaciones_historial
				SET vigente = false, fecha_fin = ?::date,
				    quitado_por = NULLIF(?::text, '')::integer
				WHERE persona_id = ?::integer AND campo = 3 AND vigente`,
				fecha, actorID, ts[0].PersonaID).Error; err != nil {
				return err
			}
			if err := tx.Exec("UPDATE core_personas SET situacion_3 = NULL WHERE id = ?::integer", ts[0].PersonaID).Error; err != nil {
				return err
			}
		}

		if personaID > 0 {
			// Una situación 3 vigente que no vino de un grupo (datos viejos) se cierra.
			if err := tx.Exec(`
				UPDATE core_personas_situaciones_historial
				SET vigente = false, fecha_fin = ?::date,
				    quitado_por = NULLIF(?::text, '')::integer
				WHERE persona_id = ?::integer AND campo = 3 AND vigente`,
				fecha, actorID, personaID).Error; err != nil {
				return err
			}
			if err := tx.Exec(`
				INSERT INTO core_grupos_encargados_historial
					(grupo_id, cargo, persona_id, fecha_inicio, vigente, excepcion, detalles, asignado_por)
				VALUES (?::integer, ?::text, ?::integer, ?::date, true, ?::boolean,
				        NULLIF(?::text, ''), NULLIF(?::text, '')::integer)`,
				grupoID, cargo, personaID, fecha, requiereExcepcion, detalles, actorID).Error; err != nil {
				return err
			}
			if err := tx.Exec(`
				INSERT INTO core_personas_situaciones_historial
					(persona_id, campo, valor, fecha_inicio, asignado_por, vigente)
				VALUES (?::integer, 3, ?::text, ?::date, NULLIF(?::text, '')::integer, true)`,
				personaID, valor, fecha, actorID).Error; err != nil {
				return err
			}
			if err := tx.Exec("UPDATE core_personas SET situacion_3 = ?::text WHERE id = ?::integer", valor, personaID).Error; err != nil {
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
