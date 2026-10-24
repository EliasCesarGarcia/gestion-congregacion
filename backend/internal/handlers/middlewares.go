/**
 * ARCHIVO: middlewares.go
 * UBICACIÓN: Backend/internal/handlers/middlewares.go
 * DESCRIPCIÓN: Interceptores de peticiones HTTP.
 * Valida el token JWT en cada solicitud protegida.
 */

package handlers

import (
	"context"
	"errors"
	"gestion-congregacion/backend/internal/auth"
	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/service"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// Añadimos cabeceras de blindaje industrial
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Si la URL empieza con /swagger, permitimos estilos e inline scripts.
		if strings.HasPrefix(r.URL.Path, "/swagger/") {
			w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://validator.swagger.io;")
		} else {
			// Blindaje total para el resto de la API
			w.Header().Set("Content-Security-Policy", "default-src 'self';")
		}

		// SEO 2026: Favorece la indexación de APIs rápidas
		w.Header().Set("X-Robots-Tag", "noindex")
		next.ServeHTTP(w, r)
	})
}

type ctxKey string

const personaIDKey ctxKey = "persona_id"

// PersonaIDFromContext devuelve el ID de persona firmado dentro del token.
// Los handlers protegidos deben usar ESTE valor y nunca el que mande el cliente.
func PersonaIDFromContext(r *http.Request) string {
	v, _ := r.Context().Value(personaIDKey).(string)
	return v
}

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Intentar obtener la cookie
		cookie, err := r.Cookie("auth_token")
		if err != nil {
			http.Error(w, "Sesión expirada o no autorizada", http.StatusUnauthorized)
			return
		}

		// 2. Validar el token
		token, err := auth.ValidarJWT(cookie.Value)
		if err != nil || !token.Valid {
			http.Error(w, "Token inválido", http.StatusUnauthorized)
			return
		}

		// 3. Solo se acepta un token de acceso (no uno de refresco) con persona
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok || claims["typ"] != "access" {
			http.Error(w, "Token inválido", http.StatusUnauthorized)
			return
		}
		personaID, _ := claims["pid"].(string)
		if personaID == "" {
			http.Error(w, "Token inválido", http.StatusUnauthorized)
			return
		}

		// 4. Guardar la persona para los handlers
		ctx := context.WithValue(r.Context(), personaIDKey, personaID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// EsSuperAdmin indica si la persona está en la lista SUPERADMIN_PERSONA_IDS
// (IDs separados por coma). Si la variable falta o está vacía, nadie lo es.
func EsSuperAdmin(personaID string) bool {
	if personaID == "" {
		return false
	}
	for _, id := range strings.Split(os.Getenv("SUPERADMIN_PERSONA_IDS"), ",") {
		if strings.TrimSpace(id) == personaID {
			return true
		}
	}
	return false
}

// SuperAdminMiddleware: deja pasar solo a los superadmins. Debe ir DENTRO de
// AuthMiddleware, porque lee la persona que ese middleware ya validó desde el
// token firmado.
func SuperAdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		personaID := PersonaIDFromContext(r)
		if !EsSuperAdmin(personaID) {
			log.Printf("⚠️ ADMIN RECHAZADO: persona '%s' intentó acceder a %s", personaID, r.URL.Path)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}


const actorKey ctxKey = "actor"

// ActorFromContext devuelve quién hace el pedido (congregación, rol, estado),
// leído de la base por ActorMiddleware. Usar ESTE dato para los permisos.
func ActorFromContext(r *http.Request) *models.Actor {
	a, _ := r.Context().Value(actorKey).(*models.Actor)
	return a
}

// ActorMiddleware: debe ir DENTRO de AuthMiddleware (usa la persona ya validada).
// Consulta la base en cada pedido, así un cambio de rol, una baja o una
// congregación desactivada se aplican enseguida.
func ActorMiddleware(s *service.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			personaID := PersonaIDFromContext(r)

			a, err := s.GetActor(personaID)
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					http.Error(w, "Sesión no válida", http.StatusUnauthorized)
					return
				}
				log.Printf("❌ actor (persona %s): %v", personaID, err)
				http.Error(w, "Servicio no disponible", http.StatusServiceUnavailable)
				return
			}

			if a.Estado != "ALTA" {
				log.Printf("⚠️ ACTOR RECHAZADO: persona '%s' con estado '%s'", personaID, a.Estado)
				http.Error(w, "Cuenta no activa", http.StatusForbidden)
				return
			}

			if !EsSuperAdmin(personaID) && (a.CongregacionID == "" || !a.CongActiva) {
				log.Printf("⚠️ ACTOR RECHAZADO: persona '%s' sin congregación activa", personaID)
				http.Error(w, "Congregación no activa", http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), actorKey, a)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}