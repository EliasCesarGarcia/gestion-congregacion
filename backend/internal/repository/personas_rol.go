/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/repository/personas_rol.go
 * DESCRIPCIÓN: Cambio del rol de la aplicación de una persona y su historial
 * (core_personas_roles_historial). El rol y el historial se escriben SIEMPRE
 * en la misma transacción. Se bloquea la congregación para que dos cambios
 * simultáneos no dejen dos titulares del mismo rol; además un índice único de
 * la base lo impide.
 */

package repository

import (
	"errors"
	"strings"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

// ErrRolOcupado: otra persona de la congregación ya tiene ese rol.
var ErrRolOcupado = errors.New("rol ocupado")

// CambiarRolPersona cambia rol_app: cierra el período vigente del historial
// (con fecha y quién lo quitó) y abre uno nuevo si el rol no es publicador.
// Devuelve false si ya tenía ese rol. Un rol distinto de publicador solo puede
// tenerlo una persona por congregación. actorID = quién lo hace (superadmin).
func (r *Repository) CambiarRolPersona(personaID int, rol, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var congs []string
		if err := tx.Raw(
			"SELECT COALESCE(congregacion_id::text, '') FROM core_personas WHERE id = ?::integer",
			personaID).Scan(&congs).Error; err != nil {
			return err
		}
		if len(congs) == 0 || congs[0] == "" {
			return ErrPersonaInexistente
		}
		cong := congs[0]

		// Se bloquea la congregación y recién después se lee el rol actual.
		var bloqueo []string
		if err := tx.Raw(
			"SELECT id::text FROM core_congregaciones WHERE id::text = ?::text FOR UPDATE",
			cong).Scan(&bloqueo).Error; err != nil {
			return err
		}

		var actuales []string
		if err := tx.Raw(
			"SELECT rol_app FROM core_personas WHERE id = ?::integer FOR UPDATE",
			personaID).Scan(&actuales).Error; err != nil {
			return err
		}
		if len(actuales) == 0 {
			return ErrPersonaInexistente
		}
		if actuales[0] == rol {
			return nil
		}

		if rol != "publicador" {
			var otros []int
			if err := tx.Raw(`
				SELECT id FROM core_personas
				WHERE congregacion_id::text = ?::text AND rol_app = ?::text AND id <> ?::integer
				LIMIT 1`, cong, rol, personaID).Scan(&otros).Error; err != nil {
				return err
			}
			if len(otros) > 0 {
				return ErrRolOcupado
			}
		}

		// Cierra el período vigente (si hay: los roles cargados a mano antes
		// de este historial quedan migrados como vigentes).
		if err := tx.Exec(`
			UPDATE core_personas_roles_historial
			SET vigente = false, fecha_fin = now(),
			    quitado_por = NULLIF(?::text,'')::integer
			WHERE persona_id = ?::integer AND vigente = true`,
			actorID, personaID).Error; err != nil {
			return err
		}

		if rol != "publicador" {
			if err := tx.Exec(`
				INSERT INTO core_personas_roles_historial
					(persona_id, congregacion_id, rol, fecha_inicio, asignado_por, vigente)
				VALUES (?::integer, ?::uuid, ?::text, now(), NULLIF(?::text,'')::integer, true)`,
				personaID, cong, rol, actorID).Error; err != nil {
				if strings.Contains(err.Error(), "23505") {
					return ErrRolOcupado // el índice único de la base lo frenó
				}
				return err
			}
		}

		if err := tx.Exec("UPDATE core_personas SET rol_app = ?::text WHERE id = ?::integer",
			rol, personaID).Error; err != nil {
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

// ListHistorialRolesPersona: los períodos de rol de la persona, el vigente
// primero y después del más nuevo al más antiguo.
func (r *Repository) ListHistorialRolesPersona(id int) ([]models.HistorialRolPersona, error) {
	lista := []models.HistorialRolPersona{}
	if err := r.db.Raw(`
		SELECT h.id AS id,
		       h.rol AS rol,
		       to_char(h.fecha_inicio AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS fecha_inicio,
		       to_char(h.fecha_fin AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS fecha_fin,
		       h.vigente AS vigente,
		       COALESCE(ap.apellido || ' ' || ap.nombre, '') AS asignado_por,
		       COALESCE(qp.apellido || ' ' || qp.nombre, '') AS quitado_por
		FROM core_personas_roles_historial h
		LEFT JOIN core_personas ap ON ap.id = h.asignado_por
		LEFT JOIN core_personas qp ON qp.id = h.quitado_por
		WHERE h.persona_id = ?::integer
		ORDER BY h.vigente DESC, h.fecha_inicio DESC NULLS LAST, h.id DESC
		LIMIT 200`, id).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}