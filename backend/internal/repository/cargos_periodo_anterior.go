/**
 * ARCHIVO: cargos_periodo_anterior.go
 * UBICACIÓN: backend/internal/repository/cargos_periodo_anterior.go
 * DESCRIPCIÓN: Carga un período PASADO y ya cerrado de un cargo en
 * core_personas_roles_historial (por ejemplo, un coordinador interino entre dos
 * titulares que ya están cargados). "Cambiar cargos" solo abre períodos hacia
 * adelante; esta es la única forma de insertar uno en el medio.
 * Todo en UNA transacción, con la congregación bloqueada como en el resto de
 * los cambios de roles.
 */

package repository

import (
	"errors"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

// ErrPeriodoCargoIndice: un índice único de la base frenó la carga del período.
var ErrPeriodoCargoIndice = errors.New("un índice único de la base impidió cargar el período del cargo")

// InsertarPeriodoAnteriorCargo inserta un período cerrado (vigente = false) del
// rol `rol` para la persona. Reglas (el servicio ya validó formato, motivos y
// fechas no futuras):
//   - la persona es de la congregación, está en ALTA hoy y es Anciano hoy
//     (no se compara con fechas: puede haber sido Anciano desde antes de llegar);
//   - el inicio no es posterior al fin;
//   - el período cae dentro de un período de alta de la persona;
//   - no se superpone con ningún período de ese rol: ni de la misma persona
//     (ErrFechaSolapaRol) ni de otra de la congregación (ErrFechaSolapaRolCargo);
//     tocarse en el mismo instante se permite.
//
// Como el período está cerrado, no cambia los cargos vigentes: no se recalcula rol_app.
func (r *Repository) InsertarPeriodoAnteriorCargo(congregacionID, rol string, personaID int, ini, fin FechaElegida, alta, baja MotivoRol, actorID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := bloquearCongregacionRoles(tx, congregacionID); err != nil {
			return err
		}

		// 1) La persona: de la congregación, en ALTA y Anciano hoy.
		type persona struct {
			Estado     string `gorm:"column:estado"`
			Situacion2 string `gorm:"column:situacion_2"`
		}
		var ps []persona
		if err := tx.Raw(`
			SELECT estado AS estado, COALESCE(situacion_2, '') AS situacion_2
			FROM core_personas
			WHERE id = ?::integer AND congregacion_id::text = ?::text
			FOR UPDATE`, personaID, congregacionID).Scan(&ps).Error; err != nil {
			return err
		}
		if len(ps) == 0 {
			return ErrPersonaInexistente // no existe o es de otra congregación
		}
		if ps[0].Estado != "ALTA" || ps[0].Situacion2 != "Anciano" {
			return ErrRolNoElegible
		}

		// 2) Fechas: inicio no posterior al fin y dentro de un período de alta.
		iniT := ini.Instante()
		finT := fin.Instante()
		if finT.Before(iniT) {
			return ErrFechaInicioPosteriorFin
		}
		if err := verificarPeriodoDeAlta(tx, strconv.Itoa(personaID), iniT, &finT); err != nil {
			return err
		}

		// 3) Superposición con cualquier período de ese rol (misma persona u otra).
		type solape struct {
			MismaPersona bool `gorm:"column:misma_persona"`
		}
		var solapes []solape
		if err := tx.Raw(`
			SELECT (h.persona_id = ?::integer) AS misma_persona
			FROM core_personas_roles_historial h
			WHERE h.rol = ?::text
			  AND (h.persona_id = ?::integer OR h.congregacion_id::text = ?::text)
			  AND (h.vigente OR h.fecha_fin IS NOT NULL)
			  AND ?::timestamptz < COALESCE(h.fecha_fin, 'infinity'::timestamptz)
			  AND ?::timestamptz > COALESCE(h.fecha_inicio, '-infinity'::timestamptz)
			ORDER BY (h.persona_id = ?::integer) DESC
			LIMIT 1`,
			personaID, rol, personaID, congregacionID, iniT, finT, personaID).Scan(&solapes).Error; err != nil {
			return err
		}
		if len(solapes) > 0 {
			if solapes[0].MismaPersona {
				return ErrFechaSolapaRol
			}
			return ErrFechaSolapaRolCargo
		}

		// 4) Insertar el período ya cerrado, con motivos y detalles de inicio y de fin.
		if err := tx.Exec(`
			INSERT INTO core_personas_roles_historial
				(persona_id, congregacion_id, rol, fecha_inicio, fecha_fin,
				 asignado_por, quitado_por, vigente,
				 motivo_inicio_id, motivo_inicio, detalles_inicio,
				 motivo_fin_id, motivo_fin, detalles_fin)
			VALUES (?::integer, ?::uuid, ?::text, ?::timestamptz, ?::timestamptz,
			        NULLIF(?::text,'')::integer, NULLIF(?::text,'')::integer, false,
			        ?::integer, (SELECT mo.nombre FROM core_motivos mo WHERE mo.id = ?::integer), NULLIF(?::text,''),
			        ?::integer, (SELECT mo.nombre FROM core_motivos mo WHERE mo.id = ?::integer), NULLIF(?::text,''))`,
			personaID, congregacionID, rol, iniT, finT,
			actorID, actorID,
			motivoRolParam(alta.ID), motivoRolParam(alta.ID), alta.Detalles,
			motivoRolParam(baja.ID), motivoRolParam(baja.ID), baja.Detalles).Error; err != nil {
			if strings.Contains(err.Error(), "23505") {
				return ErrPeriodoCargoIndice
			}
			return err
		}
		return nil
	})
}
