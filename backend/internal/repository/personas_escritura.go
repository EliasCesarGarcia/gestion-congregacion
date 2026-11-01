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
// grupo, condición, detalles, dirección y fecha de alta). Los textos vacíos
// quedan en NULL. Si la persona está de alta, la fecha también se copia a su
// fila vigente de estado. Devuelve cuántas personas se modificaron.
func (r *Repository) EditarPersona(id int, d models.DatosPersona) (int64, error) {
	var filas int64
	err := r.db.Transaction(func(tx *gorm.DB) error {
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
				partido          = NULLIF(?::text,''),
				fecha_alta       = NULLIF(?::text,'')::date
			WHERE id = ?::integer`,
			d.Apellido, d.Nombre, d.ApellidoNombre, d.Contacto, paramGrupoPersona(d.Grupo),
			d.Condicion, d.Detalles, d.Direccion, d.CodigoPostal, d.Pais, d.ProvinciaEstado,
			d.Ciudad, d.Partido, d.FechaAlta, id)
		if res.Error != nil {
			return res.Error
		}
		filas = res.RowsAffected
		if filas == 0 {
			return nil
		}
		return tx.Exec(`
			UPDATE core_personas_estado_historial
			SET fecha_alta = NULLIF(?::text,'')::date
			WHERE persona_id = ?::integer AND vigente = true`,
			d.FechaAlta, id).Error
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