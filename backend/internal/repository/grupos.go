/**
 * ARCHIVO: grupos.go
 * UBICACIÓN: backend/internal/repository/grupos.go
 * DESCRIPCIÓN: Gestión de los grupos de servicio (core_grupos): listar con sus
 * números y encargados, crear, cambiar el número y cerrar. Un grupo nunca se
 * borra. Cada cambio bloquea la fila del grupo, así dos operaciones
 * simultáneas (por ejemplo cerrarlo y pasarle gente) no se pisan.
 */

package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

var (
	// ErrGrupoInexistente: el grupo no existe.
	ErrGrupoInexistente = errors.New("el grupo no existe")
	// ErrGrupoNumeroDuplicado: ya hay un grupo activo con ese número en la congregación.
	ErrGrupoNumeroDuplicado = errors.New("ya hay un grupo activo con ese número")
	// ErrGrupoConGente: el grupo tiene personas o encargados vigentes.
	ErrGrupoConGente = errors.New("el grupo tiene personas o encargados vigentes")
	// ErrGrupoCerrado: el grupo ya está cerrado.
	ErrGrupoCerrado = errors.New("el grupo está cerrado")
	// ErrFechaAnteriorGrupo: la fecha de cierre sería anterior al inicio del grupo o a algún movimiento.
	ErrFechaAnteriorGrupo = errors.New("la fecha es anterior al inicio del grupo o a algún movimiento de sus integrantes")
)

// ListGrupos devuelve los grupos de la congregación (todas = solo superadmin)
// con sus conteos y encargados vigentes, y cuántas personas en ALTA no tienen
// grupo. Los grupos cerrados solo se incluyen si incluirCerrados es true.
func (r *Repository) ListGrupos(congregacionID string, todas, incluirCerrados bool) (*models.GruposLista, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	grupos := []models.GrupoFila{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT g.id AS id,
		       g.congregacion_id::text AS congregacion_id,
		       g.numero AS numero,
		       g.activo AS activo,
		       to_char(g.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
		       to_char(g.fecha_cierre, 'YYYY-MM-DD') AS fecha_cierre,
		       (SELECT count(*) FROM core_grupos_movimientos m
		         WHERE m.grupo_id = g.id AND m.vigente) AS miembros,
		       (SELECT count(*) FROM core_grupos_movimientos m
		          JOIN core_personas p ON p.id = m.persona_id
		         WHERE m.grupo_id = g.id AND m.vigente AND p.condicion = 'A') AS activos,
		       (SELECT count(*) FROM core_grupos_movimientos m
		          JOIN core_personas p ON p.id = m.persona_id
		         WHERE m.grupo_id = g.id AND m.vigente AND p.condicion = 'I') AS inactivos
		FROM core_grupos g
		WHERE (?::boolean OR g.congregacion_id::text = ?::text)
		  AND (?::boolean OR g.activo)
		ORDER BY g.congregacion_id::text ASC, g.activo DESC, g.numero ASC, g.id ASC`,
		todas, congregacionID, incluirCerrados).Scan(&grupos).Error; err != nil {
		return nil, err
	}

	type filaEncargado struct {
		GrupoID   int    `gorm:"column:grupo_id"`
		Cargo     string `gorm:"column:cargo"`
		PersonaID int    `gorm:"column:persona_id"`
		Apellido  string `gorm:"column:apellido"`
		Nombre    string `gorm:"column:nombre"`
		Excepcion bool   `gorm:"column:excepcion"`
	}
	encargados := []filaEncargado{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT e.grupo_id AS grupo_id,
		       e.cargo AS cargo,
		       e.persona_id AS persona_id,
		       p.apellido AS apellido,
		       p.nombre AS nombre,
		       e.excepcion AS excepcion
		FROM core_grupos_encargados_historial e
		JOIN core_grupos g ON g.id = e.grupo_id
		JOIN core_personas p ON p.id = e.persona_id
		WHERE e.vigente
		  AND (?::boolean OR g.congregacion_id::text = ?::text)
		  AND (?::boolean OR g.activo)`,
		todas, congregacionID, incluirCerrados).Scan(&encargados).Error; err != nil {
		return nil, err
	}
	pos := map[int]int{}
	for i := range grupos {
		pos[grupos[i].ID] = i
	}
	for _, e := range encargados {
		i, ok := pos[e.GrupoID]
		if !ok {
			continue
		}
		enc := &models.EncargadoGrupo{PersonaID: e.PersonaID, Apellido: e.Apellido, Nombre: e.Nombre, Excepcion: e.Excepcion}
		switch e.Cargo {
		case "superintendente":
			grupos[i].Superintendente = enc
		case "auxiliar":
			grupos[i].Auxiliar = enc
		}
	}

	var sin int64
	if err := r.db.WithContext(ctx).Raw(`
		SELECT count(*) FROM core_personas p
		WHERE p.estado = 'ALTA' AND p.grupo_id IS NULL
		  AND (?::boolean OR p.congregacion_id::text = ?::text)`,
		todas, congregacionID).Scan(&sin).Error; err != nil {
		return nil, err
	}
	return &models.GruposLista{Grupos: grupos, SinGrupo: sin}, nil
}

// GetGrupo devuelve un grupo, o nil si no existe. La congregación NO se
// comprueba acá: lo hace el servicio.
func (r *Repository) GetGrupo(id int) (*models.GrupoBase, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var g models.GrupoBase
	res := r.db.WithContext(ctx).Raw(`
		SELECT g.id AS id,
		       g.congregacion_id::text AS congregacion_id,
		       g.numero AS numero,
		       g.activo AS activo,
		       to_char(g.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
		       to_char(g.fecha_cierre, 'YYYY-MM-DD') AS fecha_cierre
		FROM core_grupos g
		WHERE g.id = ?::integer
		LIMIT 1`, id).Scan(&g)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &g, nil
}

// bloquearGrupo bloquea la fila del grupo y dice si está activo.
// ErrGrupoInexistente si no existe.
func bloquearGrupo(tx *gorm.DB, id int) (bool, error) {
	type fila struct {
		Activo bool `gorm:"column:activo"`
	}
	var fs []fila
	if err := tx.Raw("SELECT activo AS activo FROM core_grupos WHERE id = ?::integer FOR UPDATE", id).Scan(&fs).Error; err != nil {
		return false, err
	}
	if len(fs) == 0 {
		return false, ErrGrupoInexistente
	}
	return fs[0].Activo, nil
}

// CrearGrupo inserta un grupo activo. fechaInicio va como AAAA-MM-DD, o ""
// si no se conoce. Devuelve el id nuevo, o 0 (sin error) si la congregación no
// existe. ErrGrupoNumeroDuplicado si ya hay un grupo activo con ese número.
func (r *Repository) CrearGrupo(congregacionID string, numero int, fechaInicio, actorID string) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var ids []int
	if err := r.db.WithContext(ctx).Raw(`
		INSERT INTO core_grupos (congregacion_id, numero, fecha_inicio, creado_por)
		SELECT c.id, ?::integer, NULLIF(?::text, '')::date, NULLIF(?::text, '')::integer
		FROM core_congregaciones c
		WHERE c.id::text = ?::text
		RETURNING id`, numero, fechaInicio, actorID, congregacionID).Scan(&ids).Error; err != nil {
		if strings.Contains(err.Error(), "23505") {
			return 0, ErrGrupoNumeroDuplicado
		}
		return 0, err
	}
	if len(ids) == 0 {
		return 0, nil
	}
	return ids[0], nil
}

// RenumerarGrupo cambia el número de un grupo activo. Los movimientos viejos
// conservan el número que tenía el grupo en su momento.
func (r *Repository) RenumerarGrupo(id, numero int, actorID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		activo, err := bloquearGrupo(tx, id)
		if err != nil {
			return err
		}
		if !activo {
			return ErrGrupoCerrado
		}
		if err := tx.Exec(`
			UPDATE core_grupos
			SET numero = ?::integer,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::integer`, numero, actorID, id).Error; err != nil {
			if strings.Contains(err.Error(), "23505") {
				return ErrGrupoNumeroDuplicado
			}
			return err
		}
		return nil
	})
}

// CerrarGrupo cierra un grupo activo con fecha (AAAA-MM-DD, ya validada). Solo
// si no tiene personas ni encargados vigentes, y la fecha no puede ser
// anterior al inicio del grupo ni a ningún movimiento de sus integrantes.
func (r *Repository) CerrarGrupo(id int, fecha, actorID string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		activo, err := bloquearGrupo(tx, id)
		if err != nil {
			return err
		}
		if !activo {
			return ErrGrupoCerrado
		}

		var gente []int64
		if err := tx.Raw(`
			SELECT id FROM core_grupos_movimientos
			WHERE grupo_id = ?::integer AND vigente LIMIT 1`, id).Scan(&gente).Error; err != nil {
			return err
		}
		if len(gente) > 0 {
			return ErrGrupoConGente
		}
		var encargados []int64
		if err := tx.Raw(`
			SELECT id FROM core_grupos_encargados_historial
			WHERE grupo_id = ?::integer AND vigente LIMIT 1`, id).Scan(&encargados).Error; err != nil {
			return err
		}
		if len(encargados) > 0 {
			return ErrGrupoConGente
		}

		var posteriores []int64
		if err := tx.Raw(`
			SELECT g.id FROM core_grupos g
			WHERE g.id = ?::integer AND g.fecha_inicio > ?::date
			UNION ALL
			SELECT m.id FROM core_grupos_movimientos m
			WHERE m.grupo_id = ?::integer AND (m.fecha_inicio > ?::date OR m.fecha_fin > ?::date)
			UNION ALL
			SELECT e.id FROM core_grupos_encargados_historial e
			WHERE e.grupo_id = ?::integer AND (e.fecha_inicio > ?::date OR e.fecha_fin > ?::date)
			LIMIT 1`,
			id, fecha, id, fecha, fecha, id, fecha, fecha).Scan(&posteriores).Error; err != nil {
			return err
		}
		if len(posteriores) > 0 {
			return ErrFechaAnteriorGrupo
		}

		return tx.Exec(`
			UPDATE core_grupos
			SET activo = false,
			    fecha_cierre = ?::date,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::integer`, fecha, actorID, id).Error
	})
}
