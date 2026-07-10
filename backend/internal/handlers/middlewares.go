/**
 * ARCHIVO: middlewares.go
 * UBICACIÓN: Backend/internal/handlers/middlewares.go
 * DESCRIPCIÓN: Interceptores de peticiones HTTP.
 * Valida el token JWT en cada solicitud protegida.
 */

package handlers

import (
	//"context"
	"gestion-congregacion/backend/internal/auth"
	"net/http"
	"strings"
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

// AuthMiddleware protege las rutas verificando el token en el Header 'Authorization'
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Obtener el header Authorization: Bearer <token>
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Acceso no autorizado", http.StatusUnauthorized)
			return
		}

		// 2. Limpiar el prefijo "Bearer "
		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		// 3. Validar el token
		token, err := auth.ValidarJWT(tokenStr)
		if err != nil || !token.Valid {
			http.Error(w, "Token inválido o expirado", http.StatusUnauthorized)
			return
		}

		// 4. Extraer el Usuario ID y meterlo en el contexto de la petición
		// Esto sirve para saber quién está haciendo la petición en los handlers
		next.ServeHTTP(w, r)
	})
}
