/**
 * ARCHIVO: fechas_historial.go
 * UBICACIÓN: backend/internal/repository/fechas_historial.go
 * DESCRIPCIÓN: Piezas comunes del tramo 2D, paso 5 (modificar la fecha de una
 * fila ya cargada del historial): la fecha elegida, los errores compartidos y
 * la comprobación de que una fecha cae dentro de un período de alta de la
 * persona (reglas 1 a 6 del archivo del 09/11).
 */

package repository

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

var (
	// ErrFilaInexistente: la fila del historial no existe (o es de otra congregación).
	ErrFilaInexistente = errors.New("la fila del historial no existe")
	// ErrFechaInicioPosteriorFin: el inicio quedaría después del fin.
	ErrFechaInicioPosteriorFin = errors.New("el inicio no puede ser posterior al fin")
	// ErrFechaFueraDeAlta: la fecha queda fuera de todo período de alta de la persona.
	ErrFechaFueraDeAlta = errors.New("la fecha queda fuera de un período de alta de la persona")
)

// FechaElegida: una fecha elegida por el usuario, ya validada por el servicio.
// Dia es AAAA-MM-DD (en UTC). Hora es lo que se guarda en las columnas con
// hora: nil = la fecha es hoy y se usa el instante actual; si es una fecha
// pasada, las 12:00 UTC de ese día.
type FechaElegida struct {
	Dia  string
	Hora *time.Time
}

// Instante devuelve el valor a guardar en una columna timestamptz.
func (f FechaElegida) Instante() time.Time {
	if f.Hora != nil {
		return *f.Hora
	}
	return time.Now().UTC()
}

// diaUTC devuelve el día (AAAA-MM-DD) de un instante, en UTC.
func diaUTC(t time.Time) string {
	return t.UTC().Format("2006-01-02")
}

// verificarPeriodoDeAlta exige que el período [ini, fin] (fin nil = abierto)
// caiga dentro de UN período de alta de la persona: no anterior a su alta ni
// posterior a su baja. Una fecha de alta o de baja vacía (personas antiguas)
// no limita. Si la persona no tiene filas de estado, no se comprueba nada.
func verificarPeriodoDeAlta(tx *gorm.DB, personaID string, ini time.Time, fin *time.Time) error {
	type periodo struct {
		Alta *string `gorm:"column:alta"`
		Baja *string `gorm:"column:baja"`
	}
	var ps []periodo
	if err := tx.Raw(`
		SELECT to_char(fecha_alta, 'YYYY-MM-DD') AS alta,
		       to_char(fecha_baja, 'YYYY-MM-DD') AS baja
		FROM core_personas_estado_historial
		WHERE persona_id::text = ?::text`, personaID).Scan(&ps).Error; err != nil {
		return err
	}
	if len(ps) == 0 {
		return nil
	}
	d1 := diaUTC(ini)
	d2 := ""
	if fin != nil {
		d2 = diaUTC(*fin)
	}
	for _, p := range ps {
		if p.Alta != nil && d1 < *p.Alta {
			continue
		}
		if p.Baja != nil && d1 > *p.Baja {
			continue
		}
		if fin != nil && p.Baja != nil && d2 > *p.Baja {
			continue
		}
		return nil
	}
	return ErrFechaFueraDeAlta
}
