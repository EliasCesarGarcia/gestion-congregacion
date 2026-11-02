/**
 * ARCHIVO: personas_rol.go
 * UBICACIÓN: backend/internal/repository/personas_rol.go
 * DESCRIPCIÓN: Cambio del rol de la aplicación de una persona. Bloquea la
 * congregación para que dos cambios simultáneos no dejen dos titulares del
 * mismo rol.
 */

package repository

import (
	"errors"

	"gorm.io/gorm"
)

// ErrRolOcupado: otra persona de la congregación ya tiene ese rol.
var ErrRolOcupado = errors.New("rol ocupado")

// CambiarRolPersona cambia rol_app. Devuelve false si ya tenía ese rol.
// Un rol distinto de publicador solo puede tenerlo una persona por congregación.
func (r *Repository) CambiarRolPersona(personaID int, rol string) (bool, error) {
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
