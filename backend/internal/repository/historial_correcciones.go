/**
 * ARCHIVO: historial_correcciones.go
 * UBICACIÓN: backend/internal/repository/historial_correcciones.go
 * DESCRIPCIÓN: Tramo 3.6. Corregir lo que se escribió mal en una fila YA
 * CARGADA de un historial de la persona: motivos, detalles y (en situaciones)
 * el valor. Las FECHAS se corrigen con las rutas de fechas que ya existen.
 * Cada corrección escribe una sola fila, con quién y cuándo (modificado_por y
 * modificado_at), en UNA transacción. Una fila de otra congregación responde
 * igual que una inexistente (ErrFilaInexistente). Devuelven false si no había
 * nada que cambiar.
 */

package repository

import (
	"errors"

	"gorm.io/gorm"
)

var (
	// ErrSalidaEnMovimientoVigente: se pidió corregir la salida de una pertenencia que sigue abierta.
	ErrSalidaEnMovimientoVigente = errors.New("la persona sigue en ese grupo: esa fila no tiene salida")
	// ErrCorreccionSalidaPorBaja: la salida se registró con la baja de la persona.
	ErrCorreccionSalidaPorBaja = errors.New("la salida de ese grupo se registró con la baja de la persona")
	// ErrSituacionOtroCampo: la fila no es de la situación que se dijo.
	ErrSituacionOtroCampo = errors.New("la fila no corresponde a esa situación")
	// ErrTitularRolSituacion: la persona es titular de un rol y debe seguir siendo anciano.
	ErrTitularRolSituacion = errors.New("la persona es titular de un rol y debe seguir siendo anciano")
	// ErrExcepcionSinMotivo: un cargo en excepción no puede quedar sin motivo.
	ErrExcepcionSinMotivo = errors.New("una excepción necesita su motivo")
)

// CorregirEstadoPersona corrige motivos y detalles de una fila del historial
// de altas y bajas (core_personas_estado_historial). Cada dato en nil no se
// toca. motivoAlta y motivoBaja ya vienen validados por el servicio (activos y
// del uso correcto); un texto vacío en los detalles los borra. Los datos de
// baja solo se corrigen si la fila ya no es vigente.
func (r *Repository) CorregirEstadoPersona(id int64, congregacionID string, todas bool,
	motivoAlta *int64, detallesAlta *string, motivoBaja *int64, detallesBaja *string, actorID string) (bool, error) {

	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			CongregacionID string `gorm:"column:congregacion_id"`
			Vigente        bool   `gorm:"column:vigente"`
			MotivoAltaID   *int64 `gorm:"column:motivo_alta_id"`
			DetallesAlta   string `gorm:"column:detalles_alta"`
			MotivoBajaID   *int64 `gorm:"column:motivo_baja_id"`
			DetallesBaja   string `gorm:"column:detalles_baja"`
		}
		var filas []fila
		if err := tx.Raw(`
			SELECT COALESCE(p.congregacion_id::text, '') AS congregacion_id,
			       h.vigente AS vigente,
			       h.motivo_alta_id::bigint AS motivo_alta_id,
			       COALESCE(h.detalles_alta, '') AS detalles_alta,
			       h.motivo_baja_id::bigint AS motivo_baja_id,
			       COALESCE(h.detalles, '') AS detalles_baja
			FROM core_personas_estado_historial h
			JOIN core_personas p ON p.id = h.persona_id
			WHERE h.id = ?::bigint
			FOR UPDATE OF h`, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 || (!todas && filas[0].CongregacionID != congregacionID) {
			return ErrFilaInexistente
		}
		f := filas[0]

		// Los datos de baja solo existen en una fila cerrada.
		if (motivoBaja != nil || detallesBaja != nil) && f.Vigente {
			return ErrBajaEnEstadoVigente
		}

		cambiaMotivoAlta := motivoAlta != nil && (f.MotivoAltaID == nil || *f.MotivoAltaID != *motivoAlta)
		cambiaDetallesAlta := detallesAlta != nil && *detallesAlta != f.DetallesAlta
		cambiaMotivoBaja := motivoBaja != nil && (f.MotivoBajaID == nil || *f.MotivoBajaID != *motivoBaja)
		cambiaDetallesBaja := detallesBaja != nil && *detallesBaja != f.DetallesBaja
		if !cambiaMotivoAlta && !cambiaDetallesAlta && !cambiaMotivoBaja && !cambiaDetallesBaja {
			return nil
		}

		if cambiaMotivoAlta {
			if err := tx.Exec(`
				UPDATE core_personas_estado_historial
				SET motivo_alta_id = ?::integer,
				    motivo_alta = (SELECT m.nombre FROM core_motivos m WHERE m.id = ?::integer)
				WHERE id = ?::bigint`, *motivoAlta, *motivoAlta, id).Error; err != nil {
				return err
			}
		}
		if cambiaDetallesAlta {
			if err := tx.Exec(`
				UPDATE core_personas_estado_historial
				SET detalles_alta = NULLIF(?::text, '')
				WHERE id = ?::bigint`, *detallesAlta, id).Error; err != nil {
				return err
			}
		}
		if cambiaMotivoBaja {
			if err := tx.Exec(`
				UPDATE core_personas_estado_historial
				SET motivo_baja_id = ?::integer,
				    motivo_baja = (SELECT m.nombre FROM core_motivos m WHERE m.id = ?::integer)
				WHERE id = ?::bigint`, *motivoBaja, *motivoBaja, id).Error; err != nil {
				return err
			}
		}
		if cambiaDetallesBaja {
			if err := tx.Exec(`
				UPDATE core_personas_estado_historial
				SET detalles = NULLIF(?::text, '')
				WHERE id = ?::bigint`, *detallesBaja, id).Error; err != nil {
				return err
			}
		}
		if err := tx.Exec(`
			UPDATE core_personas_estado_historial
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

// CorregirSituacionPersona corrige el VALOR de una fila del historial de
// situaciones (campo 1 o 2), de cualquier período. Si la fila es la vigente,
// también se corrige la columna de core_personas. Bloquea en el mismo orden
// que las bajas: congregación y después persona. valor ya viene validado
// contra la lista del campo.
func (r *Repository) CorregirSituacionPersona(id int64, campo int, valor, congregacionID string, todas bool, actorID string) (bool, error) {
	columna, ok := columnaSituacionPersona(campo)
	if !ok {
		return false, errors.New("campo de situación no válido")
	}

	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			PersonaID      int    `gorm:"column:persona_id"`
			CongregacionID string `gorm:"column:congregacion_id"`
			Campo          int    `gorm:"column:campo"`
			Valor          string `gorm:"column:valor"`
			Vigente        bool   `gorm:"column:vigente"`
		}
		const leer = `
			SELECT h.persona_id AS persona_id,
			       COALESCE(p.congregacion_id::text, '') AS congregacion_id,
			       h.campo AS campo,
			       h.valor AS valor,
			       h.vigente AS vigente
			FROM core_personas_situaciones_historial h
			JOIN core_personas p ON p.id = h.persona_id
			WHERE h.id = ?::bigint`

		// 1) Leer sin bloquear: la persona y el alcance.
		var filas []fila
		if err := tx.Raw(leer, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 || (!todas && filas[0].CongregacionID != congregacionID) {
			return ErrFilaInexistente
		}
		personaID := filas[0].PersonaID

		// 2) Bloquear (congregación, persona) y volver a leer la fila.
		if filas[0].CongregacionID != "" {
			if err := bloquearCongregacionRoles(tx, filas[0].CongregacionID); err != nil {
				return err
			}
		}
		var bloqueada []int
		if err := tx.Raw("SELECT id FROM core_personas WHERE id = ?::integer FOR UPDATE", personaID).Scan(&bloqueada).Error; err != nil {
			return err
		}
		if len(bloqueada) == 0 {
			return ErrFilaInexistente
		}
		filas = nil
		if err := tx.Raw(leer, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 {
			return ErrFilaInexistente
		}
		f := filas[0]

		// 3) Reglas.
		if f.Campo != campo {
			return ErrSituacionOtroCampo
		}
		if f.Valor == valor {
			return nil // ya tiene ese valor
		}
		if campo == 2 && f.Vigente && valor != "Anciano" {
			var roles []int64
			if err := tx.Raw(`
				SELECT id FROM core_personas_roles_historial
				WHERE persona_id = ?::integer AND vigente = true
				LIMIT 1`, personaID).Scan(&roles).Error; err != nil {
				return err
			}
			if len(roles) > 0 {
				return ErrTitularRolSituacion
			}
		}

		// 4) Escribir la fila, con quién y cuándo; y la persona si es la vigente.
		if err := tx.Exec(`
			UPDATE core_personas_situaciones_historial
			SET valor = ?::text,
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`, valor, actorID, id).Error; err != nil {
			return err
		}
		if f.Vigente {
			// "columna" sale de columnaSituacionPersona (solo 1, 2 o 3), nunca del cliente.
			if err := tx.Exec("UPDATE core_personas SET "+columna+" = ?::text WHERE id = ?::integer",
				valor, personaID).Error; err != nil {
				return err
			}
		}
		cambio = true
		return nil
	})
	if err != nil {
		return false, err
	}
	return cambio, nil
}

// CorregirMovimientoGrupo corrige motivos y detalles de entrada y de salida de
// una fila del historial de pertenencia a grupos (core_grupos_movimientos).
// Cada dato en nil no se toca. Los datos de salida solo se corrigen si la fila
// ya no es vigente y no se cerró con la baja de la persona (esa salida se
// corrige en el historial de altas y bajas).
func (r *Repository) CorregirMovimientoGrupo(id int64, congregacionID string, todas bool,
	motivoEntrada *int64, detallesEntrada *string, motivoSalida *int64, detallesSalida *string, actorID string) (bool, error) {

	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			CongregacionID   string `gorm:"column:congregacion_id"`
			Vigente          bool   `gorm:"column:vigente"`
			MotivoEntradaID  *int64 `gorm:"column:motivo_entrada_id"`
			DetallesEntrada  string `gorm:"column:detalles_entrada"`
			MotivoSalidaID   *int64 `gorm:"column:motivo_salida_id"`
			MotivoSalidaTxt  string `gorm:"column:motivo_salida_txt"`
			DetallesSalida   string `gorm:"column:detalles_salida"`
		}
		var filas []fila
		if err := tx.Raw(`
			SELECT COALESCE(p.congregacion_id::text, '') AS congregacion_id,
			       m.vigente AS vigente,
			       m.motivo_entrada_id::bigint AS motivo_entrada_id,
			       COALESCE(m.detalles_entrada, '') AS detalles_entrada,
			       m.motivo_salida_id::bigint AS motivo_salida_id,
			       COALESCE(m.motivo_salida, '') AS motivo_salida_txt,
			       COALESCE(m.detalles_salida, '') AS detalles_salida
			FROM core_grupos_movimientos m
			JOIN core_personas p ON p.id = m.persona_id
			WHERE m.id = ?::bigint
			FOR UPDATE OF m`, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 || (!todas && filas[0].CongregacionID != congregacionID) {
			return ErrFilaInexistente
		}
		f := filas[0]

		if motivoSalida != nil || detallesSalida != nil {
			if f.Vigente {
				return ErrSalidaEnMovimientoVigente
			}
			if f.MotivoSalidaID == nil && f.MotivoSalidaTxt == "Baja de la persona" {
				return ErrCorreccionSalidaPorBaja
			}
		}

		cambiaMotivoEntrada := motivoEntrada != nil && (f.MotivoEntradaID == nil || *f.MotivoEntradaID != *motivoEntrada)
		cambiaDetallesEntrada := detallesEntrada != nil && *detallesEntrada != f.DetallesEntrada
		cambiaMotivoSalida := motivoSalida != nil && (f.MotivoSalidaID == nil || *f.MotivoSalidaID != *motivoSalida)
		cambiaDetallesSalida := detallesSalida != nil && *detallesSalida != f.DetallesSalida
		if !cambiaMotivoEntrada && !cambiaDetallesEntrada && !cambiaMotivoSalida && !cambiaDetallesSalida {
			return nil
		}

		if cambiaMotivoEntrada {
			if err := tx.Exec(`
				UPDATE core_grupos_movimientos
				SET motivo_entrada_id = ?::integer,
				    motivo_entrada = (SELECT m.nombre FROM core_motivos m WHERE m.id = ?::integer)
				WHERE id = ?::bigint`, *motivoEntrada, *motivoEntrada, id).Error; err != nil {
				return err
			}
		}
		if cambiaDetallesEntrada {
			if err := tx.Exec(`
				UPDATE core_grupos_movimientos
				SET detalles_entrada = NULLIF(?::text, '')
				WHERE id = ?::bigint`, *detallesEntrada, id).Error; err != nil {
				return err
			}
		}
		if cambiaMotivoSalida {
			if err := tx.Exec(`
				UPDATE core_grupos_movimientos
				SET motivo_salida_id = ?::integer,
				    motivo_salida = (SELECT m.nombre FROM core_motivos m WHERE m.id = ?::integer)
				WHERE id = ?::bigint`, *motivoSalida, *motivoSalida, id).Error; err != nil {
				return err
			}
		}
		if cambiaDetallesSalida {
			if err := tx.Exec(`
				UPDATE core_grupos_movimientos
				SET detalles_salida = NULLIF(?::text, '')
				WHERE id = ?::bigint`, *detallesSalida, id).Error; err != nil {
				return err
			}
		}
		if err := tx.Exec(`
			UPDATE core_grupos_movimientos
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

// CorregirEncargadoGrupo corrige los detalles de una fila del historial de
// cargos de encargado (core_grupos_encargados_historial). Si el cargo es una
// excepción, los detalles son su motivo y no pueden quedar vacíos. detalles
// ya viene normalizado por el servicio.
func (r *Repository) CorregirEncargadoGrupo(id int64, congregacionID string, todas bool, detalles, actorID string) (bool, error) {
	cambio := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		type fila struct {
			CongregacionID string `gorm:"column:congregacion_id"`
			Excepcion      bool   `gorm:"column:excepcion"`
			Detalles       string `gorm:"column:detalles"`
		}
		var filas []fila
		if err := tx.Raw(`
			SELECT COALESCE(p.congregacion_id::text, '') AS congregacion_id,
			       COALESCE(e.excepcion, false) AS excepcion,
			       COALESCE(e.detalles, '') AS detalles
			FROM core_grupos_encargados_historial e
			JOIN core_personas p ON p.id = e.persona_id
			WHERE e.id = ?::bigint
			FOR UPDATE OF e`, id).Scan(&filas).Error; err != nil {
			return err
		}
		if len(filas) == 0 || (!todas && filas[0].CongregacionID != congregacionID) {
			return ErrFilaInexistente
		}
		f := filas[0]

		if f.Excepcion && detalles == "" {
			return ErrExcepcionSinMotivo
		}
		if f.Detalles == detalles {
			return nil
		}

		if err := tx.Exec(`
			UPDATE core_grupos_encargados_historial
			SET detalles = NULLIF(?::text, ''),
			    modificado_por = NULLIF(?::text, '')::integer,
			    modificado_at = now()
			WHERE id = ?::bigint`, detalles, actorID, id).Error; err != nil {
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
