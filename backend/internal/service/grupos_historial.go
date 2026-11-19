/**
 * ARCHIVO: grupos_historial.go
 * UBICACIÓN: backend/internal/service/grupos_historial.go
 * DESCRIPCIÓN: Historial de un grupo. Coordinador, secretario y servicio solo
 * ven grupos de su congregación; el superadmin, cualquiera. Un grupo de otra
 * congregación responde igual que uno inexistente (el permiso por rol lo
 * revisa el handler).
 */

package service

import (
	"gestion-congregacion/backend/internal/models"
)

// HistorialGrupo: los miembros y los encargados que tuvo el grupo.
func (s *Service) HistorialGrupo(a *models.Actor, esSuper bool, id int) (*models.HistorialGrupo, error) {
	g, err := s.grupoDelAlcance(a, esSuper, id)
	if err != nil {
		return nil, err
	}
	miembros, err := s.repo.ListHistorialMiembrosGrupo(g.ID)
	if err != nil {
		return nil, err
	}
	encargados, err := s.repo.ListHistorialEncargadosGrupo(g.ID)
	if err != nil {
		return nil, err
	}
	return &models.HistorialGrupo{
		Grupo: models.CabeceraGrupoHistorial{
			ID:          g.ID,
			Numero:      g.Numero,
			Activo:      g.Activo,
			FechaInicio: g.FechaInicio,
			FechaCierre: g.FechaCierre,
		},
		Miembros:   miembros,
		Encargados: encargados,
	}, nil
}