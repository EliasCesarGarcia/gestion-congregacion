/**
 * ARCHIVO: token.go
 * UBICACIÓN: Backend/internal/auth/token.go
 * DESCRIPCIÓN: Utilidades para la generación y validación de JSON Web Tokens (JWT).
 * Proporciona seguridad en las sesiones mediante firmas digitales.
 */

package auth

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerarJWT crea un token firmado para un usuario específico
func GenerarJWT(usuarioID string) (string, error) {
	// Obtenemos la clave secreta del .env
	secret := []byte(os.Getenv("JWT_SECRET"))
	if len(secret) == 0 {
		secret = []byte("clave_teocratica_secreta_2026") // Respaldo por seguridad
	}

	// Definimos los "Claims" (datos que viajan dentro del token)
	claims := jwt.MapClaims{
		"sub": usuarioID,                             // ID del usuario
		"exp": time.Now().Add(time.Hour * 24).Unix(), // Expira en 24 horas
		"iat": time.Now().Unix(),                     // Fecha de emisión
	}

	// Creamos el token con el algoritmo de firma HS256
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Firmamos el token con nuestra clave secreta
	return token.SignedString(secret)
}

// ValidarJWT verifica si un token es auténtico y no ha expirado
func ValidarJWT(tokenString string) (*jwt.Token, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))

	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Validamos que el método de firma sea el esperado
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("método de firma inválido")
		}
		return secret, nil
	})
}
