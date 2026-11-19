/**
 * ARCHIVO: grupos_historial.go
 * UBICACIÓN: backend/internal/repository/grupos_historial.go
 * DESCRIPCIÓN: Lectura del historial de un grupo: las pertenencias de todas
 * las personas que pasaron por él y sus encargados (superintendente y
 * auxiliar). La congregación NO se comprueba acá: lo hace el servicio.
 */

package repository

import (
	"context"
	"time"

	"gestion-congregacion/backend/internal/models"
)

// ListHistorialMiembrosGrupo: las pertenencias al grupo, la vigente primero y
// después de la más nueva a la más antigua.
func (r *Repository) ListHistorialMiembrosGrupo(grupoID int) ([]models.MiembroHistorialGrupo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.MiembroHistorialGrupo{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT m.id AS id,
		       m.persona_id AS persona_id,
		       COALESCE(p.apellido, '') AS apellido,
		       COALESCE(p.nombre, '') AS nombre,
		       to_char(m.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
		       to_char(m.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
		       m.vigente AS vigente,
		       COALESCE(m.motivo_entrada, me.nombre, '') AS motivo_entrada,
		       COALESCE(m.detalles_entrada, '') AS detalles_entrada,
		       COALESCE(m.motivo_salida, ms.nombre, '') AS motivo_salida,
		       COALESCE(m.detalles_salida, '') AS detalles_salida,
		       COALESCE(ap.apellido || ' ' || ap.nombre, '') AS asignado_por,
		       COALESCE(qp.apellido || ' ' || qp.nombre, '') AS quitado_por
		FROM core_grupos_movimientos m
		JOIN core_personas p ON p.id = m.persona_id
		LEFT JOIN core_motivos me ON me.id = m.motivo_entrada_id
		LEFT JOIN core_motivos ms ON ms.id = m.motivo_salida_id
		LEFT JOIN core_personas ap ON ap.id = m.asignado_por
		LEFT JOIN core_personas qp ON qp.id = m.quitado_por
		WHERE m.grupo_id = ?::integer
		ORDER BY m.vigente DESC, m.fecha_inicio DESC NULLS LAST, m.id DESC
		LIMIT 1000`, grupoID).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}

// ListHistorialEncargadosGrupo: los cargos del grupo, el vigente primero y
// después del más nuevo al más antiguo.
func (r *Repository) ListHistorialEncargadosGrupo(grupoID int) ([]models.EncargadoHistorialGrupo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.EncargadoHistorialGrupo{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT e.id AS id,
		       e.persona_id AS persona_id,
		       COALESCE(p.apellido, '') AS apellido,
		       COALESCE(p.nombre, '') AS nombre,
		       e.cargo AS cargo,
		       to_char(e.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
		       to_char(e.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
		       e.vigente AS vigente,
		       e.excepcion AS excepcion,
		       COALESCE(e.detalles, '') AS detalles,
		       COALESCE(ap.apellido || ' ' || ap.nombre, '') AS asignado_por,
		       COALESCE(qp.apellido || ' ' || qp.nombre, '') AS quitado_por
		FROM core_grupos_encargados_historial e
		JOIN core_personas p ON p.id = e.persona_id
		LEFT JOIN core_personas ap ON ap.id = e.asignado_por
		LEFT JOIN core_personas qp ON qp.id = e.quitado_por
		WHERE e.grupo_id = ?::integer
		ORDER BY e.vigente DESC, e.fecha_inicio DESC NULLS LAST, e.id DESC
		LIMIT 1000`, grupoID).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}