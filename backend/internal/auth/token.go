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

// GenerarAccessToken crea una llave que dura solo 15 minutos (Seguridad Proactiva)
func GenerarAccessToken(usuarioID string) (string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"sub": usuarioID,
		"exp": time.Now().Add(time.Minute * 15).Unix(), // 15 minutos
		"iat": time.Now().Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

// GenerarRefreshToken crea una llave larga para renovar la corta (7 días)
func GenerarRefreshToken(usuarioID string) (string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	claims := jwt.MapClaims{
		"sub": usuarioID,
		"exp": time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 días
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func ValidarJWT(tokenString string) (*jwt.Token, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	return jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return secret, nil
	})
}
