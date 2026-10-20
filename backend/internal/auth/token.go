/**
 * ARCHIVO: token.go
 * UBICACIÓN: Backend/internal/auth/token.go
 * DESCRIPCIÓN: Utilidades para la generación y validación de JSON Web Tokens (JWT).
 * Proporciona seguridad en las sesiones mediante firmas digitales.
 */

package auth

import (
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerarAccessToken crea una llave que dura solo 15 minutos.
// usuarioID puede ir vacío (personas que no están en core_usuarios).
// personaID es el que identifica de verdad a quien llama.
func GenerarAccessToken(usuarioID, personaID string) (string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"sub": usuarioID,
		"pid": personaID,
		"typ": "access",
		"exp": time.Now().Add(time.Minute * 15).Unix(),
		"iat": time.Now().Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

// GenerarRefreshToken crea una llave larga para renovar la corta (7 días)
func GenerarRefreshToken(usuarioID, personaID string) (string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"sub": usuarioID,
		"pid": personaID,
		"typ": "refresh",
		"exp": time.Now().Add(time.Hour * 24 * 7).Unix(),
		"iat": time.Now().Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

// ValidarJWT solo acepta tokens firmados con HS256.
func ValidarJWT(tokenString string) (*jwt.Token, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
}