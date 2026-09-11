/**
 * ARCHIVO: personas_fechas.go
 * UBICACIÓN: backend/internal/service/personas_fechas.go
 * DESCRIPCIÓN: Ayudante de fechas elegibles del módulo de personas (tramo 2D)
 * para las tablas que guardan fecha y hora (roles y puestos).
 */

package service

import (
	"strings"
	"time"
)

// fechaHoraPersona convierte la fecha elegida (AAAA-MM-DD) en el valor que se
// guarda en una columna timestamptz.
//   - "" o la fecha de hoy (UTC) o posterior: devuelve nil, que significa "usar
//     la hora real del servidor" (now()).
//   - Una fecha pasada: devuelve las 12:00 UTC de ese día, para que no cambie
//     de día según el huso horario.
//
// La validación (formato, no futura) la hace fechaPersona.
func fechaHoraPersona(valor string) (*time.Time, error) {
	v := strings.TrimSpace(valor)
	if v == "" {
		return nil, nil
	}
	dia, err := fechaPersona(v, true)
	if err != nil {
		return nil, err
	}
	t, err := time.Parse("2006-01-02", dia)
	if err != nil {
		return nil, errDatosPersona("fecha no válida: use AAAA-MM-DD")
	}
	hoy := time.Now().UTC().Truncate(24 * time.Hour)
	if !t.Before(hoy) {
		return nil, nil
	}
	mediodia := t.Add(12 * time.Hour)
	return &mediodia, nil
}