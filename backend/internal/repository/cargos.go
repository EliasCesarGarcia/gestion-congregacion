/**
 * ARCHIVO: cargos.go
 * UBICACIÓN: backend/internal/repository/cargos.go
 * DESCRIPCIÓN: Consultas de la pantalla de cargos de la congregación
 * (coordinador, secretario y servicio), solo superadmin. El cambio de titulares
 * lo hace RotarRolesPersonasConMotivos (personas_rol.go); acá están la lectura
 * de los períodos, los titulares actuales y la corrección de motivos y detalles.
 */

package repository

import (
	"errors"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

// ExisteCongregacionCargos: la congregación existe (habilitada o no).
func (r *Repository) ExisteCongregacionCargos(id string) (bool, error) {
	var ids []string
	if err := r.db.Raw(
		"SELECT id::text FROM core_congregaciones WHERE id::text = ?::text LIMIT 1", id).Scan(&ids).Error; err != nil {
		return false, err
	}
	return len(ids) > 0, nil
}

// TitularesCargos: rol -> id de la persona que lo tiene vigente en la congregación.
func (r *Repository) TitularesCargos(congregacionID string) (map[string]int, error) {
	type fila struct {
		Rol       string `gorm:"column:rol"`
		PersonaID int    `gorm:"column:persona_id"`
	}
	var filas []fila
	if err := r.db.Raw(`
		SELECT rol AS rol, persona_id AS persona_id
		FROM core_personas_roles_historial
		WHERE congregacion_id::text = ?::text AND vigente = true`, congregacionID).Scan(&filas).Error; err != nil {
		return nil, err
	}
	res := map[string]int{}
	for _, f := range filas {
		res[f.Rol] = f.PersonaID
	}
	return res, nil
}

// ListHistorialCargos: todos los períodos de los tres cargos de la congregación,
// por cargo, con el vigente primero y después del más nuevo al más antiguo.
func (r *Repository) ListHistorialCargos(congregacionID string) ([]models.FilaCargo, error) {
	lista := []models.FilaCargo{}
	if err := r.db.Raw(`
		SELECT h.id AS id,
		       h.rol AS rol,
		       h.persona_id AS persona_id,
		       COALESCE(p.apellido, '') AS apellido,
		       COALESCE(p.nombre, '') AS nombre,
		       COALESCE(p.contacto, '') AS contacto,
		       to_char(h.fecha_inicio AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS fecha_inicio,
		       to_char(h.fecha_fin AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS fecha_fin,
		       h.vigente AS vigente,
		       h.motivo_inicio AS motivo_inicio,
		       h.detalles_inicio AS detalles_inicio,
		       h.motivo_fin AS motivo_fin,
		       h.detalles_fin AS detalles_fin,
		       COALESCE(ap.apellido || ' ' || ap.nombre, '') AS asignado_por,
		       COALESCE(qp.apellido || ' ' || qp.nombre, '') AS quitado_por
		FROM core_personas_roles_historial h
		JOIN core_personas p ON p.id = h.persona_id
		LEFT JOIN core_personas ap ON ap.id = h.asignado_por
		LEFT JOIN core_personas qp ON qp.id = h.quitado_por
		WHERE h.congregacion_id::text = ?::text
		ORDER BY h.rol, h.vigente DESC, h.fecha_inicio DESC NULLS LAST, h.id DESC
		LIMIT 600`, congregacionID).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}

// CorregirCargo corrige motivos y detalles de una fila del historial de roles.
// Cada dato en nil no se toca. motivoIni y motivoFin ya vienen validados por el
// servicio (activos y del uso correcto); un texto vacío en los detalles los
// borra. Los datos de fin solo se corrigen si el período ya está cerrado (las
// FECHAS se corrigen con /api/personas/roles/fechas). Anota quién y cuándo.
// Devuelve false si no había nada que cambiar.
func (r *Repository) CorregirCargo(id int64, motivoIni *int64, detIni *string, motivoFin *int64, detFin *string, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			Vigente        bool   `gorm:"column:vigente"`
			MotivoInicioID *int64 `gorm:"column:motivo_inicio_id"`
			DetallesInicio string `gorm:"column:detalles_inicio"`
			MotivoFinID    *int64 `gorm:"column:motivo_fin_id"`
			DetallesFin    string `gorm:"column:detalles_fin"`
		}
		var filas []fila
		if err := tx.Raw(`
			SELECT vigente AS vigente,
			       motivo_inicio_id::bigint AS motivo_inicio_id,
			       COALESCE(detalles_inicio, '') AS detalles_inicio,
			       motivo_fin_id::bigint AS motivo_fin_id,
			       COALESCE(detalles_fin, '') AS detalles_fin
			FROM core_personas_roles_historial
			WHERE id = ?::bigint
			FOR UPDATE`, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 {
			return ErrFilaInexistente
		}
		f := filas[0]

		if (motivoFin != nil || detFin != nil) && f.Vigente {
			return ErrFinEnRolVigente
		}

		cambiaMotivoIni := motivoIni != nil && (f.MotivoInicioID == nil || *f.MotivoInicioID != *motivoIni)
		cambiaDetIni := detIni != nil && *detIni != f.DetallesInicio
		cambiaMotivoFin := motivoFin != nil && (f.MotivoFinID == nil || *f.MotivoFinID != *motivoFin)
		cambiaDetFin := detFin != nil && *detFin != f.DetallesFin
		if !cambiaMotivoIni && !cambiaDetIni && !cambiaMotivoFin && !cambiaDetFin {
			return nil
		}

		if cambiaMotivoIni {
			if err := tx.Exec(`
				UPDATE core_personas_roles_historial
				SET motivo_inicio_id = ?::integer,
				    motivo_inicio = (SELECT mo.nombre FROM core_motivos mo WHERE mo.id = ?::integer)
				WHERE id = ?::bigint`, *motivoIni, *motivoIni, id).Error; err != nil {
				return err
			}
		}
		if cambiaDetIni {
			if err := tx.Exec(`
				UPDATE core_personas_roles_historial
				SET detalles_inicio = NULLIF(?::text, '')
				WHERE id = ?::bigint`, *detIni, id).Error; err != nil {
				return err
			}
		}
		if cambiaMotivoFin {
			if err := tx.Exec(`
				UPDATE core_personas_roles_historial
				SET motivo_fin_id = ?::integer,
				    motivo_fin = (SELECT mo.nombre FROM core_motivos mo WHERE mo.id = ?::integer)
				WHERE id = ?::bigint`, *motivoFin, *motivoFin, id).Error; err != nil {
				return err
			}
		}
		if cambiaDetFin {
			if err := tx.Exec(`
				UPDATE core_personas_roles_historial
				SET detalles_fin = NULLIF(?::text, '')
				WHERE id = ?::bigint`, *detFin, id).Error; err != nil {
				return err
			}
		}
		if err := tx.Exec(`
			UPDATE core_personas_roles_historial
			SET modificado_por = NULLIF(?::text, '')::integer, modificado_at = now()
			WHERE id = ?::bigint`, actorID, id).Error; err != nil {
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

// errCargosNoUsado evita un aviso del compilador si se quita algún error de arriba.
var _ = errors.New