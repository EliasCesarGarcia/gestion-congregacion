/**
 * ARCHIVO: puestos.go
 * UBICACIÓN: backend/internal/repository/puestos.go
 * DESCRIPCIÓN: Consultas de los puestos de cada departamento (encargado,
 * auxiliar, segundo auxiliar) sobre core_permisos_modulos.
 */

package repository

import (
	"context"
	"time"

	"gestion-congregacion/backend/internal/models"
)

// ListAsignaciones devuelve quién ocupa cada puesto en los departamentos
// ACTIVOS de la congregación indicada. Incluye personas dadas de baja para
// que se les pueda quitar el puesto.
func (r *Repository) ListAsignaciones(congregacionID string) ([]models.AsignacionPuesto, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.AsignacionPuesto{}
	res := r.db.WithContext(ctx).Raw(`
		SELECT p.modulo_id AS modulo_id,
		       p.persona_id AS persona_id,
		       COALESCE(pe.apellido_nombre, '') AS nombre_completo,
		       p.puesto AS puesto
		FROM core_permisos_modulos p
		JOIN core_personas pe ON pe.id = p.persona_id
		JOIN core_modulos m ON m.id = p.modulo_id
		WHERE p.congregacion_id::text = ? AND m.activo = true
		ORDER BY p.modulo_id ASC, p.puesto ASC`, congregacionID).Scan(&lista)
	if res.Error != nil {
		return nil, res.Error
	}
	return lista, nil
}

// AsignarPuesto inserta el puesto. La congregacion_id se copia SIEMPRE de la
// fila de la persona. Devuelve 0 filas si hubo conflicto con los índices únicos:
// la persona ya tiene ese departamento, o el puesto ya está ocupado en la
// congregación. Al resolverlo la base (no el código), no hay carrera entre dos
// pedidos simultáneos.
func (r *Repository) AsignarPuesto(personaID, moduloID, puesto string, nivel int) (int64, error) {
	res := r.db.Exec(`
		INSERT INTO core_permisos_modulos (persona_id, modulo_id, congregacion_id, nivel_acceso, puesto)
		SELECT p.id, ?::text, p.congregacion_id, ?::integer, ?::text
		FROM core_personas p
		WHERE p.id::text = ?
		ON CONFLICT DO NOTHING`,
		moduloID, nivel, puesto, personaID)
	return res.RowsAffected, res.Error
}

// GetPuestoDe devuelve el puesto que la persona tiene en el departamento,
// o "" si no tiene ninguno.
func (r *Repository) GetPuestoDe(personaID, moduloID string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var puestos []string
	res := r.db.WithContext(ctx).Raw(
		"SELECT puesto FROM core_permisos_modulos WHERE persona_id::text = ? AND modulo_id = ? LIMIT 1",
		personaID, moduloID).Scan(&puestos)
	if res.Error != nil {
		return "", res.Error
	}
	if len(puestos) == 0 {
		return "", nil
	}
	return puestos[0], nil
}
