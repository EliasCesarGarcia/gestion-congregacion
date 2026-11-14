/**
 * ARCHIVO: motivos_catalogo.go
 * UBICACIÓN: backend/internal/service/motivos_catalogo.go
 * DESCRIPCIÓN: Reglas del catálogo único de motivos.
 *
 * REGLAS (las hace cumplir el backend):
 *  - Un motivo existe una sola vez y sirve para uno o más USOS con código
 *    "modulo.operacion": personas.alta, personas.baja, personas.grupo...
 *  - Solo el superadmin crea, renombra o activa y desactiva usos (lo exige la ruta).
 *  - Un motivo no se borra: se desactiva su uso (uno por uno).
 *  - Crear un motivo con un nombre que ya existe le suma los usos nuevos.
 *  - Renombrar no cambia el historial viejo (cada fila guarda su copia del texto).
 *  - Al dar de alta, de baja o mover de grupo, el motivo es opcional; si se
 *    envía, debe existir y estar activo para ESE uso.
 */

package service

import (
	"errors"
	"strings"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// ErrMotivoUsoInvalido: el uso falta o no es uno de los que existen (400).
var ErrMotivoUsoInvalido = errors.New("uso de motivo no válido o ausente (por ahora: personas.alta, personas.baja, personas.grupo)")

// Usos que existen hoy. Cuando otro módulo tenga altas o bajas con motivos
// propios se agrega acá su código ("modulo.operacion"); la base no cambia.
var usosMotivoValidos = map[string]bool{
	"personas.alta":  true,
	"personas.baja":  true,
	"personas.grupo": true,
}

// EntradaUsoMotivo: un uso que se pide al crear un motivo.
type EntradaUsoMotivo struct {
	Uso   string `json:"uso"`
	Orden int    `json:"orden"`
}

// usoMotivoCanonico valida el código completo ("personas.alta").
func usoMotivoCanonico(uso string) (string, error) {
	u := strings.ToLower(strings.TrimSpace(uso))
	if !usosMotivoValidos[u] {
		return "", ErrMotivoUsoInvalido
	}
	return u, nil
}

// usoMotivoPersonas convierte "alta", "baja" o "grupo" en "personas.alta", etc.
func usoMotivoPersonas(corto string) (string, error) {
	c := strings.ToLower(strings.TrimSpace(corto))
	switch c {
	case "alta", "baja", "grupo":
		return "personas." + c, nil
	}
	return "", ErrMotivoUsoInvalido
}

// ListOpcionesMotivoPersonas: motivos activos para el desplegable de
// personas. corto = "alta", "baja" o "grupo".
func (s *Service) ListOpcionesMotivoPersonas(corto string) ([]models.OpcionMotivo, error) {
	uso, err := usoMotivoPersonas(corto)
	if err != nil {
		return nil, err
	}
	return s.repo.ListOpcionesMotivo(uso)
}

// ListCatalogoMotivos: todo el catálogo con sus usos (solo superadmin).
func (s *Service) ListCatalogoMotivos() ([]models.MotivoCatalogo, error) {
	return s.repo.ListCatalogoMotivos()
}

// CrearMotivoCatalogo: crea el motivo o, si el nombre ya existe, le suma los
// usos. Al menos un uso es obligatorio. Solo superadmin (lo comprueba la ruta).
func (s *Service) CrearMotivoCatalogo(nombre string, usos []EntradaUsoMotivo) (*models.MotivoCatalogo, error) {
	nombre, err := normalizarTextoMotivo(nombre)
	if err != nil {
		return nil, err
	}
	if len(usos) == 0 {
		return nil, ErrMotivoUsoInvalido
	}

	lista := make([]models.UsoMotivo, 0, len(usos))
	visto := map[string]bool{}
	for _, u := range usos {
		uso, err := usoMotivoCanonico(u.Uso)
		if err != nil {
			return nil, err
		}
		if u.Orden < 0 || u.Orden > maxOrdenMotivo {
			return nil, ErrMotivoDatos
		}
		if visto[uso] {
			continue
		}
		visto[uso] = true
		lista = append(lista, models.UsoMotivo{Uso: uso, Orden: u.Orden})
	}

	id, err := s.repo.CrearMotivoCatalogo(nombre, lista)
	if errors.Is(err, repository.ErrMotivoDuplicado) {
		return nil, ErrMotivoExiste
	}
	if err != nil {
		return nil, err
	}
	return s.repo.GetMotivoCatalogo(id)
}

// EditarMotivoCatalogo: cambia el nombre. Solo superadmin.
func (s *Service) EditarMotivoCatalogo(id int64, nombre string) (*models.MotivoCatalogo, error) {
	if id <= 0 {
		return nil, ErrMotivoNoExiste
	}
	nombre, err := normalizarTextoMotivo(nombre)
	if err != nil {
		return nil, err
	}
	existe, err := s.repo.RenombrarMotivoCatalogo(id, nombre)
	if errors.Is(err, repository.ErrMotivoDuplicado) {
		return nil, ErrMotivoExiste
	}
	if err != nil {
		return nil, err
	}
	if !existe {
		return nil, ErrMotivoNoExiste
	}
	return s.repo.GetMotivoCatalogo(id)
}

// GuardarUsoMotivo: agrega un uso al motivo, o cambia su orden o su estado
// (activo = false lo "elimina" de ese desplegable). Solo superadmin.
func (s *Service) GuardarUsoMotivo(id int64, uso string, orden *int, activo *bool) (*models.MotivoCatalogo, error) {
	if id <= 0 {
		return nil, ErrMotivoNoExiste
	}
	u, err := usoMotivoCanonico(uso)
	if err != nil {
		return nil, err
	}
	if orden != nil && (*orden < 0 || *orden > maxOrdenMotivo) {
		return nil, ErrMotivoDatos
	}
	existe, err := s.repo.GuardarUsoMotivo(id, u, orden, activo)
	if err != nil {
		return nil, err
	}
	if !existe {
		return nil, ErrMotivoNoExiste
	}
	return s.repo.GetMotivoCatalogo(id)
}

// validarMotivoDeUso: motivoID 0 = sin motivo (opcional). Si viene, debe
// existir y estar activo para ese uso. Devuelve el id a guardar en el
// historial, o nil si no hay motivo.
func (s *Service) validarMotivoDeUso(motivoID int64, uso string) (*int64, error) {
	if motivoID == 0 {
		return nil, nil
	}
	if motivoID < 0 {
		return nil, ErrMotivoInvalido
	}
	_, sirve, err := s.repo.NombreMotivoDeUso(motivoID, uso)
	if err != nil {
		return nil, err
	}
	if !sirve {
		return nil, ErrMotivoInvalido
	}
	return &motivoID, nil
}
