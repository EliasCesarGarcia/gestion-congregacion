/**
 * ARCHIVO: grupos_encargados.go
 * UBICACIÓN: backend/internal/service/grupos_encargados.go
 * DESCRIPCIÓN: Reglas para elegir, reemplazar o quitar el superintendente y el
 * auxiliar de un grupo.
 *
 * REGLAS (las hace cumplir el backend; el permiso por rol lo revisa el handler):
 *  - Coordinador, secretario y servicio gestionan solo grupos de SU
 *    congregación; el superadmin los de cualquiera.
 *  - Cargos: "superintendente" y "auxiliar". Un solo titular vigente por cargo.
 *    persona_id 0 = quitar al titular y dejar el cargo vacante.
 *  - La persona debe estar en ALTA, ser miembro vigente de ESE grupo y no ser
 *    ya encargada de ningún grupo (ni del otro cargo).
 *  - Por defecto debe tener situación 2 Anciano o Siervo Ministerial. Excepción
 *    (extraordinaria): excepcion=true con el motivo en detalles, y solo si
 *    ningún miembro libre del grupo cumple el requisito. Queda marcada.
 *  - La situación 3 de las personas se cierra y se abre sola, con la misma
 *    fecha. No se cambia por ningún otro camino.
 *  - La fecha es obligatoria, no futura, y no puede ser anterior al alta de la
 *    persona, al inicio del grupo, a su pertenencia al grupo ni al inicio del
 *    encargado que sale. Nunca se inventan fechas.
 */

package service

import (
	"errors"
	"strings"

	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
)

// traducirErrorEncargado traduce los errores de encargados de grupo y deja el
// resto al traductor de movimientos.
func traducirErrorEncargado(err error) error {
	switch {
	case errors.Is(err, repository.ErrPersonaFueraDelGrupo):
		return errDatosPersona("la persona no es miembro de ese grupo: primero hay que pasarla al grupo")
	case errors.Is(err, repository.ErrEncargadoNoCumple):
		return errDatosPersona("la persona no es Anciano ni Siervo Ministerial: solo se la puede habilitar como excepción (excepcion: true y el motivo en detalles) cuando ningún miembro libre del grupo cumple el requisito")
	case errors.Is(err, repository.ErrExcepcionSinDetalles):
		return errDatosPersona("la excepción exige escribir el motivo en detalles")
	case errors.Is(err, repository.ErrExcepcionNoCorresponde):
		return errDatosPersona("hay miembros del grupo que cumplen el requisito (Anciano o Siervo Ministerial) y están libres: la excepción solo se admite cuando ninguno cumple")
	case errors.Is(err, repository.ErrFechaAnteriorEncargado):
		return errDatosPersona("la fecha es anterior al inicio de un período de la persona, del grupo o del encargado actual")
	}
	return traducirErrorMovimiento(err)
}

// CambiarEncargadoGrupo: cargo "superintendente" o "auxiliar"; personaID 0 =
// quitar al titular. excepcion y detalles solo se usan si la persona no cumple
// el requisito por defecto.
func (s *Service) CambiarEncargadoGrupo(a *models.Actor, esSuper bool, grupoID int, cargo string, personaID int, fecha string, excepcion bool, detalles string) error {
	cargo = strings.ToLower(strings.TrimSpace(cargo))
	if cargo != "superintendente" && cargo != "auxiliar" {
		return errDatosPersona("el cargo debe ser superintendente o auxiliar")
	}
	if personaID < 0 {
		return errDatosPersona("la persona no es válida")
	}
	f, err := fechaPersona(fecha, true)
	if err != nil {
		return err
	}
	detalles, err = normalizarDetalles(detalles)
	if err != nil {
		return err
	}

	g, err := s.grupoDelAlcance(a, esSuper, grupoID)
	if err != nil {
		return err
	}
	if !g.Activo {
		return ErrGrupoCerrado
	}
	if g.FechaInicio != nil && f < *g.FechaInicio {
		return errDatosPersona("la fecha es anterior al inicio del grupo")
	}

	if personaID > 0 {
		ficha, err := s.fichaParaEscribir(a, esSuper, personaID, true)
		if err != nil {
			return err
		}
		if ficha.CongregacionID != g.CongregacionID {
			return errDatosPersona("la persona no es de la congregación del grupo")
		}
		if ficha.FechaAlta != nil && f < *ficha.FechaAlta {
			return errDatosPersona("la fecha es anterior a la fecha de alta de la persona")
		}
	}

	cambio, err := s.repo.CambiarEncargadoGrupo(grupoID, cargo, personaID, f, excepcion, detalles, a.PersonaID)
	if err != nil {
		return traducirErrorEncargado(err)
	}
	if !cambio {
		return ErrPersonaSinCambio
	}
	return nil
}
