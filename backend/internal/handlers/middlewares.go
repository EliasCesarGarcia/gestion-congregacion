/**
 * ARCHIVO: middlewares.go
 * UBICACIÓN: Backend/internal/handlers/middlewares.go
 * DESCRIPCIÓN: Interceptores de peticiones HTTP.
 * Valida el token JWT en cada solicitud protegida.
 */

package handlers

import (
	"context"
	"gestion-congregacion/backend/internal/auth"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
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
