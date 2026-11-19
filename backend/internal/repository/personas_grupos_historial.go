/**
 * ARCHIVO: personas_grupos_historial.go
 * UBICACIÓN: backend/internal/repository/personas_grupos_historial.go
 * DESCRIPCIÓN: Lectura de los historiales de grupos de una persona: sus
 * pertenencias a grupos (core_grupos_movimientos) y sus cargos de
 * superintendente o auxiliar (core_grupos_encargados_historial). La
 * congregación NO se comprueba acá: lo hace el servicio.
 */

package repository

import (
	"context"
	"time"

	"gestion-congregacion/backend/internal/models"
)

// ListHistorialGruposPersona: las pertenencias a grupos de la persona, la
// vigente primero y después de la más nueva a la más antigua.
func (r *Repository) ListHistorialGruposPersona(id int) ([]models.HistorialGrupoPersona, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.HistorialGrupoPersona{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT m.id AS id,
		       m.grupo_id AS grupo_id,
		       COALESCE(m.numero_grupo, g.numero, 0) AS numero_grupo,
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
		LEFT JOIN core_grupos g ON g.id = m.grupo_id
		LEFT JOIN core_motivos me ON me.id = m.motivo_entrada_id
		LEFT JOIN core_motivos ms ON ms.id = m.motivo_salida_id
		LEFT JOIN core_personas ap ON ap.id = m.asignado_por
		LEFT JOIN core_personas qp ON qp.id = m.quitado_por
		WHERE m.persona_id = ?::integer
		ORDER BY m.vigente DESC, m.fecha_inicio DESC NULLS LAST, m.id DESC
		LIMIT 200`, id).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}

// ListHistorialEncargadosPersona: los cargos de la persona en grupos, el
// vigente primero y después del más nuevo al más antiguo.
func (r *Repository) ListHistorialEncargadosPersona(id int) ([]models.HistorialEncargadoPersona, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.HistorialEncargadoPersona{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT e.id AS id,
		       e.grupo_id AS grupo_id,
		       COALESCE(g.numero, 0) AS numero_grupo,
		       e.cargo AS cargo,
		       to_char(e.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
		       to_char(e.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
		       e.vigente AS vigente,
		       e.excepcion AS excepcion,
		       COALESCE(e.detalles, '') AS detalles,
		       COALESCE(ap.apellido || ' ' || ap.nombre, '') AS asignado_por,
		       COALESCE(qp.apellido || ' ' || qp.nombre, '') AS quitado_por
		FROM core_grupos_encargados_historial e
		LEFT JOIN core_grupos g ON g.id = e.grupo_id
		LEFT JOIN core_personas ap ON ap.id = e.asignado_por
		LEFT JOIN core_personas qp ON qp.id = e.quitado_por
		WHERE e.persona_id = ?::integer
		ORDER BY e.vigente DESC, e.fecha_inicio DESC NULLS LAST, e.id DESC
		LIMIT 200`, id).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}