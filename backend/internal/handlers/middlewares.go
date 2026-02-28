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

// AuthMiddleware protege las rutas verificando el token en el Header 'Authorization'
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Obtener el header Authorization: Bearer <token>
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Se requiere token de autenticación", http.StatusUnauthorized)
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