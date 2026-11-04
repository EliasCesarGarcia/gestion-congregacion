/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/repository/personas_rol.go
 * DESCRIPCIÓN: Roles de la aplicación y su historial (core_personas_roles_historial,
 * que es la fuente de verdad). core_personas.rol_app guarda el rol PRINCIPAL
 * (coordinador > secretario > servicio > publicador) y se recalcula siempre en
 * la misma transacción. Se bloquea la congregación en cada cambio; además dos
 * índices únicos de la base impiden dos titulares del mismo rol y el mismo rol
 * repetido en una persona.
 */

package repository

import (
	"errors"
	"strings"

	"gestion-congregacion/backend/internal/models"

	"gorm.io/gorm"
)

var (
	// ErrRolOcupado: otra persona de la congregación ya tiene ese rol.
	ErrRolOcupado = errors.New("rol ocupado")
	// ErrRolNoElegible: alguien no está en ALTA o no es Anciano.
	ErrRolNoElegible = errors.New("persona no elegible para el rol")
	// ErrRolesIncompletos: tras el cambio algún rol quedaría vacante o repetido.
	ErrRolesIncompletos = errors.New("roles incompletos")
)

var rolesEncargado = []string{"coordinador", "secretario", "servicio"}

func congregacionDePersonaRol(tx *gorm.DB, personaID int) (string, error) {
	var congs []string
	if err := tx.Raw(
		"SELECT COALESCE(congregacion_id::text, '') FROM core_personas WHERE id = ?::integer",
		personaID).Scan(&congs).Error; err != nil {
		return "", err
	}
	if len(congs) == 0 || congs[0] == "" {
		return "", ErrPersonaInexistente
	}
	return congs[0], nil
}

// bloquearCongregacionRoles: dos cambios de roles en la misma congregación se hacen de a uno.
func bloquearCongregacionRoles(tx *gorm.DB, cong string) error {
	var b []string
	if err := tx.Raw(
		"SELECT id::text FROM core_congregaciones WHERE id::text = ?::text FOR UPDATE",
		cong).Scan(&b).Error; err != nil {
		return err
	}
	if len(b) == 0 {
		return ErrPersonaInexistente
	}
	return nil
}

// recalcularRolPrincipal deja en rol_app el rol principal según el historial vigente.
func recalcularRolPrincipal(tx *gorm.DB, personaID int) error {
	return tx.Exec(`
		UPDATE core_personas SET rol_app = COALESCE((
			SELECT h.rol FROM core_personas_roles_historial h
			WHERE h.persona_id = ?::integer AND h.vigente = true
			ORDER BY CASE h.rol WHEN 'coordinador' THEN 1 WHEN 'secretario' THEN 2 ELSE 3 END
			LIMIT 1), 'publicador')
		WHERE id = ?::integer`, personaID, personaID).Error
}

func abrirRolPersona(tx *gorm.DB, personaID int, cong, rol, actorID string) error {
	if err := tx.Exec(`
		INSERT INTO core_personas_roles_historial
			(persona_id, congregacion_id, rol, fecha_inicio, asignado_por, vigente)
		VALUES (?::integer, ?::uuid, ?::text, now(), NULLIF(?::text,'')::integer, true)`,
		personaID, cong, rol, actorID).Error; err != nil {
		if strings.Contains(err.Error(), "23505") {
			return ErrRolOcupado // un índice único de la base lo frenó
		}
		return err
	}
	return nil
}

// CambiarRolPersona (solo superadmin, el servicio lo exige):
//   - rol "publicador": le quita TODOS sus roles.
//   - quitar = true: le quita ese rol (el rol queda vacante).
//   - si no: le agrega ese rol; si otra persona lo tiene, ErrRolOcupado.
//
// Devuelve false si no había nada que cambiar.
func (r *Repository) CambiarRolPersona(personaID int, rol string, quitar bool, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		cong, err := congregacionDePersonaRol(tx, personaID)
		if err != nil {
			return err
		}
		if err := bloquearCongregacionRoles(tx, cong); err != nil {
			return err
		}
		var fila []int
		if err := tx.Raw("SELECT id FROM core_personas WHERE id = ?::integer FOR UPDATE", personaID).Scan(&fila).Error; err != nil {
			return err
		}
		if len(fila) == 0 {
			return ErrPersonaInexistente
		}

		if rol == "publicador" || quitar {
			sql := `UPDATE core_personas_roles_historial
				SET vigente = false, fecha_fin = now(),
				    quitado_por = NULLIF(?::text,'')::integer
				WHERE persona_id = ?::integer AND vigente = true`
			args := []interface{}{actorID, personaID}
			if rol != "publicador" {
				sql += " AND rol = ?::text"
				args = append(args, rol)
			}
			res := tx.Exec(sql, args...)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return nil
			}
			if err := recalcularRolPrincipal(tx, personaID); err != nil {
				return err
			}
			cambio = true
			return nil
		}

		var ocupantes []int
		if err := tx.Raw(`
			SELECT persona_id FROM core_personas_roles_historial
			WHERE congregacion_id::text = ?::text AND rol = ?::text AND vigente = true
			LIMIT 1`, cong, rol).Scan(&ocupantes).Error; err != nil {
			return err
		}
		if len(ocupantes) > 0 {
			if ocupantes[0] == personaID {
				return nil // ya lo tiene
			}
			return ErrRolOcupado
		}
		if err := abrirRolPersona(tx, personaID, cong, rol, actorID); err != nil {
			return err
		}
		if err := recalcularRolPrincipal(tx, personaID); err != nil {
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

// RotarRolesPersonas: titulares = nuevo titular de cada rol que cambia
// (rol -> id de persona). En UNA transacción: cada rol se le quita a su titular
// actual y se le da al nuevo (nunca queda vacante en el medio), se recalcula
// rol_app de los afectados y al final se exige que coordinador, secretario y
// servicio tengan cada uno exactamente un titular en ALTA. Los nuevos titulares
// deben ser de la congregación, estar en ALTA y ser Anciano. Devuelve false si
// no había nada que cambiar.
func (r *Repository) RotarRolesPersonas(congregacionID string, titulares map[string]int, actorID string) (bool, error) {
	hecho := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := bloquearCongregacionRoles(tx, congregacionID); err != nil {
			return err
		}

		ids := []int{}
		visto := map[int]bool{}
		for _, rol := range rolesEncargado {
			if id, ok := titulares[rol]; ok && !visto[id] {
				visto[id] = true
				ids = append(ids, id)
			}
		}
		if len(ids) == 0 {
			return nil
		}

		type fila struct {
			ID         int    `gorm:"column:id"`
			Estado     string `gorm:"column:estado"`
			Situacion2 string `gorm:"column:situacion_2"`
		}
		var filas []fila
		if err := tx.Raw(`
			SELECT id AS id, estado AS estado, COALESCE(situacion_2, '') AS situacion_2
			FROM core_personas
			WHERE id IN ? AND congregacion_id::text = ?::text
			ORDER BY id FOR UPDATE`, ids, congregacionID).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) != len(ids) {
			return ErrPersonaInexistente // alguna no existe o es de otra congregación
		}
		for _, f := range filas {
			if f.Estado != "ALTA" || f.Situacion2 != "Anciano" {
				return ErrRolNoElegible
			}
		}

		afectadas := map[int]bool{}
		for _, rol := range rolesEncargado {
			nuevo, ok := titulares[rol]
			if !ok {
				continue
			}
			var actuales []int
			if err := tx.Raw(`
				SELECT persona_id FROM core_personas_roles_historial
				WHERE congregacion_id::text = ?::text AND rol = ?::text AND vigente = true
				LIMIT 1`, congregacionID, rol).Scan(&actuales).Error; err != nil {
				return err
			}
			if len(actuales) > 0 {
				if actuales[0] == nuevo {
					continue // ya es el titular
				}
				if err := tx.Exec(`
					UPDATE core_personas_roles_historial
					SET vigente = false, fecha_fin = now(),
					    quitado_por = NULLIF(?::text,'')::integer
					WHERE congregacion_id::text = ?::text AND rol = ?::text AND vigente = true`,
					actorID, congregacionID, rol).Error; err != nil {
					return err
				}
				afectadas[actuales[0]] = true
			}
			if err := abrirRolPersona(tx, nuevo, congregacionID, rol, actorID); err != nil {
				return err
			}
			afectadas[nuevo] = true
			hecho = true
		}
		if !hecho {
			return nil
		}
		for id := range afectadas {
			if err := recalcularRolPrincipal(tx, id); err != nil {
				return err
			}
		}

		// Control final: los tres roles cubiertos, uno por rol, en ALTA.
		type conteo struct {
			Rol   string `gorm:"column:rol"`
			Total int64  `gorm:"column:total"`
			Altas int64  `gorm:"column:altas"`
		}
		var cs []conteo
		if err := tx.Raw(`
			SELECT h.rol AS rol, count(*) AS total,
			       count(*) FILTER (WHERE p.estado = 'ALTA') AS altas
			FROM core_personas_roles_historial h
			JOIN core_personas p ON p.id = h.persona_id
			WHERE h.vigente = true AND h.congregacion_id::text = ?::text
			GROUP BY h.rol`, congregacionID).Scan(&cs).Error; err != nil {
			return err
		}
		por := map[string]conteo{}
		for _, c := range cs {
			por[c.Rol] = c
		}
		for _, rol := range rolesEncargado {
			if c, ok := por[rol]; !ok || c.Total != 1 || c.Altas != 1 {
				return ErrRolesIncompletos
			}
		}
		return nil
	})
	if err != nil {
		return false, err
	}
	return hecho, nil
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
