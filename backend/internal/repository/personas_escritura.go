/**
 * ARCHIVO: personas_escritura.go
 * UBICACIÓN: backend/internal/repository/personas_escritura.go
 * DESCRIPCIÓN: Escritura del módulo de personas (tramo 2B): crear, editar
 * datos y cambiar situaciones. Cada operación escribe la persona y su
 * historial en UNA transacción: o quedan las dos cosas o ninguna.
 * Nunca se inventan fechas: una fecha desconocida se guarda como NULL.
 */

package repository

import (
	"errors"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

var (
	// ErrPersonaInexistente: la persona no está (se borró entre la validación y la escritura).
	ErrPersonaInexistente = errors.New("persona inexistente")
	// ErrFechaAnteriorInicio: el cambio de situación sería anterior a su inicio.
	ErrFechaAnteriorInicio = errors.New("la fecha es anterior al inicio de la situación vigente")
)

// paramGrupoPersona convierte el grupo opcional en un valor para la consulta (nil = NULL).
func paramGrupoPersona(g *int) interface{} {
	if g == nil {
		return nil
	}
	return *g
}

// columnaSituacionPersona: nombre de columna según el campo (1, 2 o 3).
// Nunca se arma con texto que venga de afuera.
func columnaSituacionPersona(campo int) (string, bool) {
	switch campo {
	case 1:
		return "situacion_1", true
	case 2:
		return "situacion_2", true
	case 3:
		return "situacion_3", true
	}
	return "", false
}

// CrearPersona inserta la persona en ALTA, su fila vigente de estado y una fila
// vigente por cada situación, todo en una transacción. Devuelve el id nuevo, o
// 0 (sin error) si la congregación no existe. Las situaciones empiezan en la
// fecha de alta.
func (r *Repository) CrearPersona(n models.NuevaPersona) (int, error) {
	nuevoID := 0
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var ids []int
		if err := tx.Raw(`
			INSERT INTO core_personas
				(congregacion_id, apellido, nombre, apellido_nombre, estado,
				 situacion_1, situacion_2, situacion_3, condicion, grupo, fecha_alta,
				 contacto, detalles, direccion, codigo_postal, pais, provincia_estado,
				 ciudad, partido)
			SELECT c.id, ?::text, ?::text, ?::text, 'ALTA',
			       ?::text, NULLIF(?::text,''), NULLIF(?::text,''),
			       NULLIF(?::text,'')::char(1), ?::integer, NULLIF(?::text,'')::date,
			       NULLIF(?::text,''), NULLIF(?::text,''), NULLIF(?::text,''),
			       NULLIF(?::text,''), NULLIF(?::text,''), NULLIF(?::text,''),
			       NULLIF(?::text,''), NULLIF(?::text,'')
			FROM core_congregaciones c
			WHERE c.id::text = ?::text
			RETURNING id`,
			n.Apellido, n.Nombre, n.ApellidoNombre,
			n.Situacion1, n.Situacion2, n.Situacion3,
			n.Condicion, paramGrupoPersona(n.Grupo), n.FechaAlta,
			n.Contacto, n.Detalles, n.Direccion, n.CodigoPostal, n.Pais, n.ProvinciaEstado,
			n.Ciudad, n.Partido,
			n.CongregacionID).Scan(&ids).Error; err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil // la congregación no existe
		}
		id := ids[0]

		if err := tx.Exec(`
			INSERT INTO core_personas_estado_historial (persona_id, fecha_alta, vigente, alta_por)
			VALUES (?::integer, NULLIF(?::text,'')::date, true, NULLIF(?::text,'')::integer)`,
			id, n.FechaAlta, n.ActorID).Error; err != nil {
			return err
		}

		situaciones := []struct {
			campo int
			valor string
		}{{1, n.Situacion1}, {2, n.Situacion2}, {3, n.Situacion3}}
		for _, s := range situaciones {
			if s.valor == "" {
				continue
			}
			if err := tx.Exec(`
				INSERT INTO core_personas_situaciones_historial
					(persona_id, campo, valor, fecha_inicio, asignado_por, vigente)
				VALUES (?::integer, ?::integer, ?::text, NULLIF(?::text,'')::date,
				        NULLIF(?::text,'')::integer, true)`,
				id, s.campo, s.valor, n.FechaAlta, n.ActorID).Error; err != nil {
				return err
			}
		}
		nuevoID = id
		return nil
	})
	if err != nil {
		return 0, err
	}
	return nuevoID, nil
}

// EditarPersona reemplaza los datos editables (apellido, nombre, contacto,
// grupo, condición, detalles y dirección). Los textos vacíos quedan en NULL.
// La fecha de alta ya NO se escribe directo: si cambió, se modifica la última
// fila de estado de la persona con la misma lógica de la ruta de fechas del
// historial (superposición, situaciones, roles y puestos que quedarían fuera),
// que también sincroniza core_personas.fecha_alta. Todo en UNA transacción.
// Devuelve cuántas personas se modificaron.
func (r *Repository) EditarPersona(id int, d models.DatosPersona, actorID string) (int64, error) {
	var filas int64
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type actual struct {
			FechaAlta *string `gorm:"column:fecha_alta"`
		}
		var as []actual
		if err := tx.Raw(`
			SELECT to_char(fecha_alta, 'YYYY-MM-DD') AS fecha_alta
			FROM core_personas WHERE id = ?::integer`, id).Scan(&as).Error; err != nil {
			return err
		}
		if len(as) == 0 {
			return nil // no existe: filas queda en 0
		}

		// La fecha de alta va PRIMERO: así se bloquea en el mismo orden que la
		// baja (congregación y después persona) y no hay bloqueos cruzados.
		if d.FechaAlta != "" && (as[0].FechaAlta == nil || *as[0].FechaAlta != d.FechaAlta) {
			var ultimas []int64
			if err := tx.Raw(`
				SELECT id FROM core_personas_estado_historial
				WHERE persona_id = ?::integer
				ORDER BY vigente DESC, fecha_alta DESC NULLS LAST, id DESC
				LIMIT 1`, id).Scan(&ultimas).Error; err != nil {
				return err
			}
			alta := d.FechaAlta
			cambio := false
			if len(ultimas) > 0 {
				c, err := modificarFechasEstadoTx(tx, ultimas[0], "", true, &alta, nil, actorID)
				if err != nil {
					return err
				}
				cambio = c
			}
			if !cambio {
				// Sin filas de estado, o la fila ya tenía esa fecha: solo se
				// alinea la ficha.
				if err := tx.Exec("UPDATE core_personas SET fecha_alta = ?::date WHERE id = ?::integer",
					alta, id).Error; err != nil {
					return err
				}
			}
		}

		res := tx.Exec(`
			UPDATE core_personas SET
				apellido         = ?::text,
				nombre           = ?::text,
				apellido_nombre  = ?::text,
				contacto         = NULLIF(?::text,''),
				grupo            = ?::integer,
				condicion        = NULLIF(?::text,'')::char(1),
				detalles         = NULLIF(?::text,''),
				direccion        = NULLIF(?::text,''),
				codigo_postal    = NULLIF(?::text,''),
				pais             = NULLIF(?::text,''),
				provincia_estado = NULLIF(?::text,''),
				ciudad           = NULLIF(?::text,''),
				partido          = NULLIF(?::text,'')
			WHERE id = ?::integer`,
			d.Apellido, d.Nombre, d.ApellidoNombre, d.Contacto, paramGrupoPersona(d.Grupo),
			d.Condicion, d.Detalles, d.Direccion, d.CodigoPostal, d.Pais, d.ProvinciaEstado,
			d.Ciudad, d.Partido, id)
		if res.Error != nil {
			return res.Error
		}
		filas = res.RowsAffected
		return nil
	})
	if err != nil {
		return 0, err
	}
	return filas, nil
}

// CambiarSituacionPersona cierra la situación vigente del campo (con fecha y
// quién la quitó), abre la nueva (si nuevo != "") y actualiza la columna de
// core_personas. Devuelve false si no había nada que cambiar (mismo valor, o
// quitar algo que ya no está). Bloquea la fila de la persona para que dos
// cambios simultáneos no se pisen. fecha va como AAAA-MM-DD, ya validada.
func (r *Repository) CambiarSituacionPersona(personaID, campo int, nuevo, fecha, actorID string) (bool, error) {
	columna, ok := columnaSituacionPersona(campo)
	if !ok {
		return false, errors.New("campo de situación no válido")
	}

	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var bloqueada []int
		if err := tx.Raw("SELECT id FROM core_personas WHERE id = ?::integer FOR UPDATE", personaID).Scan(&bloqueada).Error; err != nil {
			return err
		}
		if len(bloqueada) == 0 {
			return ErrPersonaInexistente
		}

		type vigente struct {
			Valor       string  `gorm:"column:valor"`
			FechaInicio *string `gorm:"column:fecha_inicio"`
		}
		var vs []vigente
		if err := tx.Raw(`
			SELECT valor AS valor, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio
			FROM core_personas_situaciones_historial
			WHERE persona_id = ?::integer AND campo = ?::integer AND vigente = true
			LIMIT 1`, personaID, campo).Scan(&vs).Error; err != nil {
			return err
		}

		if len(vs) > 0 {
			if vs[0].Valor == nuevo {
				return nil // ya tiene ese valor
			}
			if vs[0].FechaInicio != nil && fecha < *vs[0].FechaInicio {
				return ErrFechaAnteriorInicio // las fechas AAAA-MM-DD se comparan como texto
			}
			if err := tx.Exec(`
				UPDATE core_personas_situaciones_historial
				SET vigente = false, fecha_fin = ?::date,
				    quitado_por = NULLIF(?::text,'')::integer
				WHERE persona_id = ?::integer AND campo = ?::integer AND vigente = true`,
				fecha, actorID, personaID, campo).Error; err != nil {
				return err
			}
		} else if nuevo == "" {
			return nil // nada vigente y nada que abrir
		}

		if nuevo != "" {
			if err := tx.Exec(`
				INSERT INTO core_personas_situaciones_historial
					(persona_id, campo, valor, fecha_inicio, asignado_por, vigente)
				VALUES (?::integer, ?::integer, ?::text, ?::date,
				        NULLIF(?::text,'')::integer, true)`,
				personaID, campo, nuevo, fecha, actorID).Error; err != nil {
				return err
			}
		}

		// "columna" sale de columnaSituacionPersona (solo 1, 2 o 3), nunca del cliente.
		if err := tx.Exec("UPDATE core_personas SET "+columna+" = NULLIF(?::text,'') WHERE id = ?::integer",
			nuevo, personaID).Error; err != nil {
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
