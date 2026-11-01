/**
 * ARCHIVO: personas.go
 * UBICACIÓN: backend/internal/repository/personas.go
 * DESCRIPCIÓN: Consultas de lectura del módulo de personas: búsqueda con
 * filtros, conteos, ficha e historiales. Nunca devuelven password_hash ni
 * username_temp. La búsqueda no distingue mayúsculas, tildes ni la ñ y no
 * necesita extensiones de la base.
 */

package repository

import (
	"context"
	"strings"
	"time"

	"gestion-congregacion/backend/internal/models"
)

// sinTildes envuelve una expresión SQL para compararla en minúsculas y sin
// tildes (á→a, ñ→n, ü→u), tanto en mayúsculas como en minúsculas.
func sinTildes(expr string) string {
	return "lower(translate(" + expr + ", 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'))"
}

// Texto donde se busca lo que escribe la persona: apellido, nombre y las
// tres situaciones.
const pajarPersonas = "concat_ws(' ', p.apellido, p.nombre, p.situacion_1, p.situacion_2, p.situacion_3)"

// alcancePersonasSQL: la regla de oro. todas=true solo lo usa el superadmin.
const alcancePersonasSQL = "(?::boolean OR p.congregacion_id::text = ?::text)"

// filtroPersonasSQL arma el WHERE y sus argumentos, en el mismo orden que los
// signos ?. Cada palabra escrita debe aparecer en el texto de búsqueda.
func filtroPersonasSQL(congregacionID string, todas bool, f models.FiltroPersonas) (string, []interface{}) {
	var sb strings.Builder
	args := []interface{}{todas, congregacionID}
	sb.WriteString(" WHERE " + alcancePersonasSQL)

	if f.Estado != "" {
		sb.WriteString(" AND p.estado = ?::text")
		args = append(args, f.Estado)
	}
	if f.Condicion != "" {
		sb.WriteString(" AND p.condicion::text = ?::text")
		args = append(args, f.Condicion)
	}
	if f.Situacion1 != "" {
		sb.WriteString(" AND p.situacion_1 = ?::text")
		args = append(args, f.Situacion1)
	}
	if f.Situacion2 == "sin" {
		sb.WriteString(" AND p.situacion_2 IS NULL")
	} else if f.Situacion2 != "" {
		sb.WriteString(" AND p.situacion_2 = ?::text")
		args = append(args, f.Situacion2)
	}
	if f.Situacion3 == "sin" {
		sb.WriteString(" AND p.situacion_3 IS NULL")
	} else if f.Situacion3 != "" {
		sb.WriteString(" AND p.situacion_3 = ?::text")
		args = append(args, f.Situacion3)
	}
	if f.Grupo == "sin" {
		sb.WriteString(" AND p.grupo IS NULL")
	} else if f.Grupo != "" {
		sb.WriteString(" AND p.grupo = ?::integer")
		args = append(args, f.Grupo)
	}
	for _, palabra := range f.Palabras {
		sb.WriteString(" AND " + sinTildes(pajarPersonas) + " LIKE '%' || " + sinTildes("?::text") + " || '%'")
		args = append(args, palabra)
	}
	return sb.String(), args
}

const selectPersonaFila = `
SELECT p.id AS id,
       COALESCE(p.congregacion_id::text, '') AS congregacion_id,
       p.apellido AS apellido,
       p.nombre AS nombre,
       p.estado AS estado,
       COALESCE(p.condicion::text, '') AS condicion,
       p.grupo AS grupo,
       p.situacion_1 AS situacion_1,
       COALESCE(p.situacion_2, '') AS situacion_2,
       COALESCE(p.situacion_3, '') AS situacion_3,
       COALESCE(p.url_imagen, '') AS foto_url
FROM core_personas p`

// BuscarPersonas devuelve una página y el total que cumple el filtro,
// ordenado por apellido y nombre.
func (r *Repository) BuscarPersonas(congregacionID string, todas bool, f models.FiltroPersonas, limit, offset int) ([]models.PersonaFila, int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	where, args := filtroPersonasSQL(congregacionID, todas, f)

	var total int64
	if err := r.db.WithContext(ctx).Raw("SELECT count(*) FROM core_personas p"+where, args...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	argsLista := append(append([]interface{}{}, args...), limit, offset)
	lista := []models.PersonaFila{}
	if err := r.db.WithContext(ctx).Raw(
		selectPersonaFila+where+" ORDER BY lower(p.apellido) ASC, lower(p.nombre) ASC, p.id ASC LIMIT ? OFFSET ?",
		argsLista...).Scan(&lista).Error; err != nil {
		return nil, 0, err
	}
	return lista, total, nil
}

// ConteosPersonas devuelve los números del módulo: por estado y condición,
// por situación y por grupo. Situaciones y grupos cuentan solo personas en ALTA.
func (r *Repository) ConteosPersonas(congregacionID string, todas bool) (*models.ConteosPersonas, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var c models.ConteosPersonas
	if err := r.db.WithContext(ctx).Raw(`
		SELECT count(*) AS total,
		       count(*) FILTER (WHERE p.estado = 'ALTA') AS alta,
		       count(*) FILTER (WHERE p.estado = 'ALTA' AND p.condicion = 'A') AS activos,
		       count(*) FILTER (WHERE p.estado = 'ALTA' AND p.condicion = 'I') AS inactivos,
		       count(*) FILTER (WHERE p.estado = 'ALTA' AND p.condicion IS NULL) AS sin_condicion,
		       count(*) FILTER (WHERE p.estado = 'BAJA') AS bajas
		FROM core_personas p
		WHERE `+alcancePersonasSQL, todas, congregacionID).Scan(&c).Error; err != nil {
		return nil, err
	}

	c.Situaciones = []models.ConteoSituacion{}
	if err := r.db.WithContext(ctx).Raw(`
		WITH base AS (
			SELECT p.situacion_1, p.situacion_2, p.situacion_3
			FROM core_personas p
			WHERE p.estado = 'ALTA' AND `+alcancePersonasSQL+`
		)
		SELECT campo, valor, count(*) AS total FROM (
			SELECT 1 AS campo, situacion_1 AS valor FROM base
			UNION ALL SELECT 2, situacion_2 FROM base WHERE situacion_2 IS NOT NULL
			UNION ALL SELECT 3, situacion_3 FROM base WHERE situacion_3 IS NOT NULL
		) s
		GROUP BY campo, valor
		ORDER BY campo ASC, valor ASC`, todas, congregacionID).Scan(&c.Situaciones).Error; err != nil {
		return nil, err
	}

	c.Grupos = []models.ConteoGrupo{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT p.grupo AS grupo,
		       count(*) AS total,
		       count(*) FILTER (WHERE p.condicion = 'A') AS activos,
		       count(*) FILTER (WHERE p.condicion = 'I') AS inactivos,
		       COALESCE(string_agg(p.apellido || ' ' || p.nombre, ', ' ORDER BY p.apellido, p.nombre)
		                FILTER (WHERE p.situacion_3 = 'Superintendente'), '') AS superintendente,
		       COALESCE(string_agg(p.apellido || ' ' || p.nombre, ', ' ORDER BY p.apellido, p.nombre)
		                FILTER (WHERE p.situacion_3 = 'Auxiliar de Grupo'), '') AS auxiliar
		FROM core_personas p
		WHERE p.estado = 'ALTA' AND `+alcancePersonasSQL+`
		GROUP BY p.grupo
		ORDER BY p.grupo ASC NULLS LAST`, todas, congregacionID).Scan(&c.Grupos).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

// GetFichaPersona devuelve los datos de una persona, o nil si no existe. La
// congregación NO se comprueba acá: lo hace el servicio.
func (r *Repository) GetFichaPersona(id int) (*models.PersonaFicha, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var f models.PersonaFicha
	res := r.db.WithContext(ctx).Raw(`
		SELECT p.id AS id,
		       COALESCE(p.congregacion_id::text, '') AS congregacion_id,
		       p.apellido AS apellido,
		       p.nombre AS nombre,
		       p.estado AS estado,
		       COALESCE(p.condicion::text, '') AS condicion,
		       p.grupo AS grupo,
		       p.situacion_1 AS situacion_1,
		       COALESCE(p.situacion_2, '') AS situacion_2,
		       COALESCE(p.situacion_3, '') AS situacion_3,
		       to_char(p.fecha_alta, 'YYYY-MM-DD') AS fecha_alta,
		       to_char(p.fecha_baja, 'YYYY-MM-DD') AS fecha_baja,
		       COALESCE(p.contacto, '') AS contacto,
		       COALESCE(p.email, '') AS email,
		       COALESCE(p.detalles, '') AS detalles,
		       COALESCE(p.url_imagen, '') AS foto_url,
		       COALESCE(p.rol_app, 'publicador') AS rol_app,
		       COALESCE(p.direccion, '') AS direccion,
		       COALESCE(p.ciudad, '') AS ciudad,
		       COALESCE(p.partido, '') AS partido,
		       COALESCE(p.provincia_estado, '') AS provincia_estado,
		       COALESCE(p.pais, '') AS pais,
		       COALESCE(p.codigo_postal, '') AS codigo_postal
		FROM core_personas p
		WHERE p.id = ?::integer
		LIMIT 1`, id).Scan(&f)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}
	return &f, nil
}

// ListHistorialEstadoPersona: todas las altas y bajas de la persona, la
// vigente primero y después de la más nueva a la más antigua.
func (r *Repository) ListHistorialEstadoPersona(id int) ([]models.HistorialEstadoPersona, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.HistorialEstadoPersona{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT h.id AS id,
		       to_char(h.fecha_alta, 'YYYY-MM-DD') AS fecha_alta,
		       to_char(h.fecha_baja, 'YYYY-MM-DD') AS fecha_baja,
		       h.vigente AS vigente,
		       COALESCE(m.nombre, '') AS motivo_baja,
		       COALESCE(h.detalles, '') AS detalles,
		       COALESCE(ap.apellido || ' ' || ap.nombre, '') AS alta_por,
		       COALESCE(bp.apellido || ' ' || bp.nombre, '') AS baja_por
		FROM core_personas_estado_historial h
		LEFT JOIN core_personas_motivos_baja m ON m.id = h.motivo_baja_id
		LEFT JOIN core_personas ap ON ap.id = h.alta_por
		LEFT JOIN core_personas bp ON bp.id = h.baja_por
		WHERE h.persona_id = ?::integer
		ORDER BY h.vigente DESC, h.fecha_alta DESC NULLS LAST, h.id DESC
		LIMIT 200`, id).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}

// ListHistorialSituacionesPersona: los períodos de cada situación (1, 2 y 3).
func (r *Repository) ListHistorialSituacionesPersona(id int) ([]models.HistorialSituacionPersona, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	lista := []models.HistorialSituacionPersona{}
	if err := r.db.WithContext(ctx).Raw(`
		SELECT h.id AS id,
		       h.campo AS campo,
		       h.valor AS valor,
		       to_char(h.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
		       to_char(h.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
		       h.vigente AS vigente,
		       COALESCE(ap.apellido || ' ' || ap.nombre, '') AS asignado_por,
		       COALESCE(qp.apellido || ' ' || qp.nombre, '') AS quitado_por
		FROM core_personas_situaciones_historial h
		LEFT JOIN core_personas ap ON ap.id = h.asignado_por
		LEFT JOIN core_personas qp ON qp.id = h.quitado_por
		WHERE h.persona_id = ?::integer
		ORDER BY h.campo ASC, h.vigente DESC, h.fecha_inicio DESC NULLS LAST, h.id DESC
		LIMIT 200`, id).Scan(&lista).Error; err != nil {
		return nil, err
	}
	return lista, nil
}