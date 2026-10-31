/**
 * ARCHIVO: congregaciones.go
 * UBICACIÓN: backend/internal/service/congregaciones.go
 * DESCRIPCIÓN: Reglas del panel de congregaciones. Solo el superadmin accede
 * (lo exige la ruta).
 *
 * REGLAS (las hace cumplir el backend):
 *  - Una congregación nueva nace DESHABILITADA.
 *  - Obligatorios: nombre, país, provincia o estado, ciudad, número y zona
 *    horaria. Opcionales: región, partido, dirección y circuito.
 *  - No se repite el número dentro del mismo país.
 *  - Habilitar exige coordinador, secretario y servicio en estado ALTA.
 *    Deshabilitar siempre se puede.
 *  - Eliminar de verdad: solo si está deshabilitada, no tiene ningún dato
 *    asociado y se escribe su número como confirmación. Si no, se deshabilita.
 *  - Todo cambio queda en core_congregaciones_historial.
 */

package service

import (
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	_ "time/tzdata" // base de zonas horarias dentro del programa (no depende del servidor)

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

var (
	ErrCongregacionDatos         = errors.New("datos de la congregación no válidos: nombre, país, provincia o estado, ciudad, número y zona horaria son obligatorios (máximo 100 caracteres; dirección hasta 200)")
	ErrCongregacionIDInvalido    = errors.New("id de congregación no válido")
	ErrCongregacionNoExiste      = errors.New("la congregación no existe")
	ErrCongregacionExiste        = errors.New("ya existe una congregación con ese número en ese país")
	ErrCongregacionSinCambios    = errors.New("no se indicó ningún campo para modificar")
	ErrCongregacionFiltro        = errors.New("filtro de estado no válido (todas, activas o deshabilitadas)")
	ErrCongregacionSinEncargados = errors.New("para habilitarla faltan coordinador, secretario o servicio en estado ALTA")
	ErrCongregacionActiva        = errors.New("deshabilite la congregación antes de eliminarla")
	ErrCongregacionEnUso         = errors.New("la congregación tiene datos asociados: no se puede eliminar, solo deshabilitar")
	ErrConfirmacionNumero        = errors.New("el número de confirmación no coincide con el de la congregación")
)

const (
	maxCongregacionTexto     = 100
	maxCongregacionDireccion = 200
	maxCongregacionNumero    = 20
	maxCongregacionZona      = 64
	maxCongregacionCircuito  = 20
	maxBusquedaCongregacion  = 100
	limitePorDefectoCong     = 20
	limiteMaximoCong         = 50
	maxPaginaCong            = 100000
	maxDetalleHistorialCong  = 100
)

var reUUIDCongregacion = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func normalizarIDCongregacion(id string) (string, error) {
	id = strings.ToLower(strings.TrimSpace(id))
	if !reUUIDCongregacion.MatchString(id) {
		return "", ErrCongregacionIDInvalido
	}
	return id, nil
}

// limpiarTextoCongregacion recorta espacios y valida largo y caracteres.
func limpiarTextoCongregacion(t string, max int, obligatorio bool) (string, error) {
	t = strings.TrimSpace(t)
	if !utf8.ValidString(t) {
		return "", ErrCongregacionDatos
	}
	for _, c := range t {
		if unicode.IsControl(c) {
			return "", ErrCongregacionDatos
		}
	}
	if obligatorio && t == "" {
		return "", ErrCongregacionDatos
	}
	if utf8.RuneCountInString(t) > max {
		return "", ErrCongregacionDatos
	}
	return t, nil
}

func zonaHorariaValida(z string) bool {
	if z == "" || strings.EqualFold(z, "local") {
		return false
	}
	_, err := time.LoadLocation(z)
	return err == nil
}

func truncarRunasCong(t string, max int) string {
	r := []rune(t)
	if len(r) <= max {
		return t
	}
	return string(r[:max])
}

func paginarCongregaciones(page, limit int) (int, int, int) {
	if limit <= 0 {
		limit = limitePorDefectoCong
	}
	if limit > limiteMaximoCong {
		limit = limiteMaximoCong
	}
	if page < 1 {
		page = 1
	}
	if page > maxPaginaCong {
		page = maxPaginaCong
	}
	return page, limit, (page - 1) * limit
}

// ListCongregaciones: q busca en nombre, número y ciudad. estado es
// "", "todas", "activas" o "deshabilitadas".
func (s *Service) ListCongregaciones(q, estado string, page, limit int) (*models.CongregacionesPagina, error) {
	q = strings.TrimSpace(q)
	if utf8.RuneCountInString(q) > maxBusquedaCongregacion {
		q = truncarRunasCong(q, maxBusquedaCongregacion)
	}
	if !utf8.ValidString(q) || strings.ContainsRune(q, 0) {
		q = ""
	}
	// Los comodines de LIKE escritos por la persona se toman como texto común.
	q = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q)

	filtro := ""
	switch strings.ToLower(strings.TrimSpace(estado)) {
	case "", "todas":
	case "activas":
		filtro = "true"
	case "deshabilitadas":
		filtro = "false"
	default:
		return nil, ErrCongregacionFiltro
	}

	page, limit, offset := paginarCongregaciones(page, limit)
	lista, total, err := s.repo.ListCongregaciones(q, filtro, limit, offset)
	if err != nil {
		return nil, err
	}
	return &models.CongregacionesPagina{Congregaciones: lista, Total: total, Page: page, Limit: limit}, nil
}

// CrearCongregacion valida y crea la congregación deshabilitada.
func (s *Service) CrearCongregacion(in models.DatosCongregacion, actorID int) (*models.CongregacionAdmin, error) {
	var d models.DatosCongregacion
	var err error
	if d.Nombre, err = limpiarTextoCongregacion(in.Nombre, maxCongregacionTexto, true); err != nil {
		return nil, err
	}
	if d.Pais, err = limpiarTextoCongregacion(in.Pais, maxCongregacionTexto, true); err != nil {
		return nil, err
	}
	if d.ProvinciaEstado, err = limpiarTextoCongregacion(in.ProvinciaEstado, maxCongregacionTexto, true); err != nil {
		return nil, err
	}
	if d.Ciudad, err = limpiarTextoCongregacion(in.Ciudad, maxCongregacionTexto, true); err != nil {
		return nil, err
	}
	if d.Numero, err = limpiarTextoCongregacion(in.Numero, maxCongregacionNumero, true); err != nil {
		return nil, err
	}
	if d.ZonaHoraria, err = limpiarTextoCongregacion(in.ZonaHoraria, maxCongregacionZona, true); err != nil {
		return nil, err
	}
	if !zonaHorariaValida(d.ZonaHoraria) {
		return nil, ErrCongregacionDatos
	}
	if d.Region, err = limpiarTextoCongregacion(in.Region, maxCongregacionTexto, false); err != nil {
		return nil, err
	}
	if d.Partido, err = limpiarTextoCongregacion(in.Partido, maxCongregacionTexto, false); err != nil {
		return nil, err
	}
	if d.Direccion, err = limpiarTextoCongregacion(in.Direccion, maxCongregacionDireccion, false); err != nil {
		return nil, err
	}
	if d.Circuito, err = limpiarTextoCongregacion(in.Circuito, maxCongregacionCircuito, false); err != nil {
		return nil, err
	}

	id, err := s.repo.CrearCongregacion(d, actorID)
	if errors.Is(err, repository.ErrCongregacionDuplicada) {
		return nil, ErrCongregacionExiste
	}
	if err != nil {
		return nil, err
	}
	return s.repo.GetCongregacion(id)
}

// EditarCongregacion cambia solo los campos enviados. En los opcionales una
// cadena vacía borra el dato.
func (s *Service) EditarCongregacion(id string, in models.CambiosCongregacion, actorID int) (*models.CongregacionAdmin, error) {
	id, err := normalizarIDCongregacion(id)
	if err != nil {
		return nil, err
	}

	var c models.CambiosCongregacion
	campos := []string{}
	limpiar := func(origen *string, destino **string, nombre string, max int, obligatorio bool) error {
		if origen == nil {
			return nil
		}
		t, err := limpiarTextoCongregacion(*origen, max, obligatorio)
		if err != nil {
			return err
		}
		*destino = &t
		campos = append(campos, nombre)
		return nil
	}

	if err := limpiar(in.Nombre, &c.Nombre, "nombre", maxCongregacionTexto, true); err != nil {
		return nil, err
	}
	if err := limpiar(in.Pais, &c.Pais, "país", maxCongregacionTexto, true); err != nil {
		return nil, err
	}
	if err := limpiar(in.ProvinciaEstado, &c.ProvinciaEstado, "provincia", maxCongregacionTexto, true); err != nil {
		return nil, err
	}
	if err := limpiar(in.Ciudad, &c.Ciudad, "ciudad", maxCongregacionTexto, true); err != nil {
		return nil, err
	}
	if err := limpiar(in.Numero, &c.Numero, "número", maxCongregacionNumero, true); err != nil {
		return nil, err
	}
	if err := limpiar(in.ZonaHoraria, &c.ZonaHoraria, "zona horaria", maxCongregacionZona, true); err != nil {
		return nil, err
	}
	if c.ZonaHoraria != nil && !zonaHorariaValida(*c.ZonaHoraria) {
		return nil, ErrCongregacionDatos
	}
	if err := limpiar(in.Region, &c.Region, "región", maxCongregacionTexto, false); err != nil {
		return nil, err
	}
	if err := limpiar(in.Partido, &c.Partido, "partido", maxCongregacionTexto, false); err != nil {
		return nil, err
	}
	if err := limpiar(in.Direccion, &c.Direccion, "dirección", maxCongregacionDireccion, false); err != nil {
		return nil, err
	}
	if err := limpiar(in.Circuito, &c.Circuito, "circuito", maxCongregacionCircuito, false); err != nil {
		return nil, err
	}
	if len(campos) == 0 {
		return nil, ErrCongregacionSinCambios
	}

	detalle := truncarRunasCong("campos: "+strings.Join(campos, ", "), maxDetalleHistorialCong)
	existe, err := s.repo.EditarCongregacion(id, c, detalle, actorID)
	if errors.Is(err, repository.ErrCongregacionDuplicada) {
		return nil, ErrCongregacionExiste
	}
	if err != nil {
		return nil, err
	}
	if !existe {
		return nil, ErrCongregacionNoExiste
	}
	return s.repo.GetCongregacion(id)
}

// CambiarEstadoCongregacion habilita (activa=true) o deshabilita. Si ya está
// en ese estado no cambia nada ni escribe historial.
func (s *Service) CambiarEstadoCongregacion(id string, activa bool, actorID int) (*models.CongregacionAdmin, error) {
	id, err := normalizarIDCongregacion(id)
	if err != nil {
		return nil, err
	}
	actual, err := s.repo.GetCongregacion(id)
	if err != nil {
		return nil, err
	}
	if actual == nil {
		return nil, ErrCongregacionNoExiste
	}
	if actual.Activa == activa {
		return actual, nil
	}
	if activa && !(actual.TieneCoordinador && actual.TieneSecretario && actual.TieneServicio) {
		return nil, ErrCongregacionSinEncargados
	}

	accion := "deshabilitar"
	if activa {
		accion = "habilitar"
	}
	existe, err := s.repo.CambiarEstadoCongregacion(id, activa, accion, actorID)
	if err != nil {
		return nil, err
	}
	if !existe {
		return nil, ErrCongregacionNoExiste
	}
	return s.repo.GetCongregacion(id)
}

// EliminarCongregacion borra de verdad. Exige: deshabilitada, sin datos
// asociados y el número de la congregación escrito como confirmación (una
// congregación sin número no se puede borrar hasta cargarle uno).
func (s *Service) EliminarCongregacion(id, numeroConfirmacion string, actorID int) error {
	id, err := normalizarIDCongregacion(id)
	if err != nil {
		return err
	}
	actual, err := s.repo.GetCongregacion(id)
	if err != nil {
		return err
	}
	if actual == nil {
		return ErrCongregacionNoExiste
	}
	if actual.Activa {
		return ErrCongregacionActiva
	}
	numeroConfirmacion = strings.TrimSpace(numeroConfirmacion)
	if numeroConfirmacion == "" || numeroConfirmacion != actual.NumeroCongregacion {
		return ErrConfirmacionNumero
	}

	err = s.repo.EliminarCongregacion(id, actorID)
	if errors.Is(err, repository.ErrCongregacionReferenciada) {
		return ErrCongregacionEnUso
	}
	return err
}

// ListHistorialCongregaciones: id "" = todas las congregaciones.
func (s *Service) ListHistorialCongregaciones(id string, page, limit int) (*models.HistorialCongregacionesPagina, error) {
	id = strings.TrimSpace(id)
	if id != "" {
		var err error
		if id, err = normalizarIDCongregacion(id); err != nil {
			return nil, err
		}
	}
	page, limit, offset := paginarCongregaciones(page, limit)
	lista, total, err := s.repo.ListHistorialCongregaciones(id, limit, offset)
	if err != nil {
		return nil, err
	}
	return &models.HistorialCongregacionesPagina{Historial: lista, Total: total, Page: page, Limit: limit}, nil
}
