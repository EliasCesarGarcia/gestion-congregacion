/**
 * ARCHIVO: service.go
 * UBICACIÓN: internal/service/service.go
 * DESCRIPCIÓN: Capa de lógica de negocio. Orquesta la comunicación entre el
 * repositorio y servicios externos (Bcrypt, Resend, JWT).
 */

package service

import (
	"errors"
	"strings"

	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"time"

	"gestion-congregacion/backend/internal/auth"
	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
	"gestion-congregacion/backend/internal/ws"

	"github.com/microcosm-cc/bluemonday"
	"github.com/redis/go-redis/v9"
	"github.com/resend/resend-go/v2"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo *repository.Repository
	rdb  *redis.Client
}

func NewService(repo *repository.Repository, rdb *redis.Client) *Service {
	return &Service{repo: repo, rdb: rdb}
}

// --- LÓGICA DE IDENTIDAD ---

// Authenticate: Lógica de Login Blindada con Sistema de Doble Llave (Refresh Tokens)
func (s *Service) Authenticate(username, password, captchaToken, ip string) (*models.Usuario, string, string, error) {
	username = strings.TrimSpace(strings.ToLower(username))
	ctx := context.Background()

	// 1. LÓGICA DE CAPTCHA DINÁMICO
	failedAttempts, _ := s.rdb.Get(ctx, "failed_login:"+ip).Int()

	if failedAttempts >= 3 {
		if captchaToken == "" {
			return nil, "", "", errors.New("SISTEMA: Comportamiento sospechoso. Resuelva el CAPTCHA.")
		}
		if !s.ValidarTurnstile(captchaToken) {
			return nil, "", "", errors.New("SISTEMA: CAPTCHA no válido o expirado.")
		}
	}

	// 2. BUSCAR USUARIO
	u, err := s.repo.GetUserForLogin(username)
	if err != nil {
		return nil, "", "", errors.New("el usuario o la contraseña no son correctos")
	}

	// 3. VALIDAR CONTRASEÑA (BLINDAJE NIVEL DIOS: Solo Bcrypt permitido)
	// Eliminamos el 'if/else' anterior para prohibir texto plano.
	err = bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	if err != nil {
		// Incrementamos fallos en Redis para disparar el CAPTCHA en el próximo intento
		s.rdb.Incr(ctx, "failed_login:"+ip)
		s.rdb.Expire(ctx, "failed_login:"+ip, 30*time.Minute)
		return nil, "", "", errors.New("el usuario o la contraseña no son correctos")
	}

	// SI EL LOGIN ES EXITOSO: Reseteamos los fallos de esta IP
	s.rdb.Del(ctx, "failed_login:"+ip)

	// 4. GENERACIÓN DE LLAVES (Tokens)
	accessToken, err := auth.GenerarAccessToken(u.ID)
	if err != nil {
		return nil, "", "", errors.New("error al generar llave de acceso")
	}

	refreshToken, err := auth.GenerarRefreshToken(u.ID)
	if err != nil {
		return nil, "", "", errors.New("error al generar llave de refresco")
	}

	return u, accessToken, refreshToken, nil
}

func (s *Service) RecoverAccount(pID, num, tel, met string) (string, error) {
	if met == "id_cong" {
		return s.repo.FindEmailByIDAndCong(pID, num)
	}
	contactos, _ := s.repo.GetAllContactsForRecovery()
	for _, v := range contactos {
		re := regexp.MustCompile(`\D`)
		nums := re.ReplaceAllString(v.Contacto, "")
		if len(nums) >= 8 && nums[len(nums)-8:] == tel {
			return v.Email, nil
		}
	}
	return "", errors.New("no encontrado")
}

func (s *Service) SendAccessData(email string) error {
	u, err := s.repo.GetUserByEmail(email)
	if err != nil {
		return err
	}
	go func() {
		client := resend.NewClient(os.Getenv("RESEND_API_KEY"))
		html := fmt.Sprintf("<h2>Acceso:</h2><p>Usuario: %s</p><p>ID: %d</p>", u.Username, u.PersonaID)
		params := &resend.SendEmailRequest{From: "Seguridad <onboarding@resend.dev>", To: []string{email}, Subject: "Datos de Acceso", Html: html}
		client.Emails.Send(params)
	}()
	return nil
}

// --- SEGURIDAD DIGITAL ---

func (s *Service) ProcessPinRequest(email, user, cong string) error {
	pinNum, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	pin := fmt.Sprintf("%06d", pinNum)
	s.repo.InvalidateOldPines()
	s.repo.SavePin(pin)
	go func() {
		client := resend.NewClient(os.Getenv("RESEND_API_KEY"))
		html := fmt.Sprintf("<h1>Código de Verificación</h1><p>Su código es: <b>%s</b></p>", pin)
		params := &resend.SendEmailRequest{From: "Seguridad <onboarding@resend.dev>", To: []string{email}, Subject: "Código: " + pin, Html: html}
		client.Emails.Send(params)
	}()
	return nil
}

// BroadcastSecurity: Guarda boletín, avisa por WebSocket y envía Emails masivos
func (s *Service) BroadcastSecurity(titulo, desc string) error {
	// 1. Persistencia en base de datos
	if err := s.repo.SaveSecurityLog(titulo, desc); err != nil {
		return err
	}

	// 2. Notificación Push en tiempo real vía WebSocket
	ws.Broadcast(map[string]string{
		"tipo":   "ALERTA_SEGURIDAD",
		"titulo": titulo,
		"msg":    "Se ha publicado una nueva actualización de seguridad.",
	})

	// 3. Notificación por Email Masivo (Asíncrona)
	go func() {
		lista, err := s.repo.GetActiveMembersForBroadcast()
		if err != nil {
			log.Println("❌ Error al obtener destinatarios:", err)
			return
		}

		client := resend.NewClient(os.Getenv("RESEND_API_KEY"))
		for _, u := range lista {
			// Usamos tu template profesional de aviso de seguridad
			html := fmt.Sprintf(`<h3>Aviso de Seguridad</h3><p>Hola <b>%s</b>,</p><p>%s</p>`, u.NombreCompleto, desc)

			params := &resend.SendEmailRequest{
				From:    "Seguridad Local <onboarding@resend.dev>",
				To:      []string{u.Email},
				Subject: "⚠️ " + titulo,
				Html:    html,
			}
			client.Emails.Send(params)
			time.Sleep(150 * time.Millisecond) // Blindaje anti-spam
		}
	}()

	return nil
}

func (s *Service) UpdateUserFoto(personaID, url string) error {
	fixedURL := strings.Replace(url, "PEOPLE_PROFILE", "People_profile", -1)
	return s.repo.UpdateFoto(personaID, fixedURL)
}

func (s *Service) AddSecurityInfo(cont string) error { return s.repo.SaveSecurityLog(cont, "") }

// GetSecurityBulletin: Trae la info más reciente
func (s *Service) GetSecurityBulletin() (map[string]interface{}, error) {
	return s.repo.GetLatestSecurityInfo()
}

func (s *Service) GetCatalog() ([]models.Publicacion, error) { return s.repo.GetPublicaciones() }

func (s *Service) UpdateProfile(pID, campo, valor string) error {
	// SANITIZACIÓN INDUSTRIAL: No confiamos en lo que envíe el cliente
	p := bluemonday.StrictPolicy()
	cleanValue := p.Sanitize(valor)

	// Bloqueo preventivo de inyección de etiquetas comunes en campos de texto
	if strings.Contains(cleanValue, "javascript:") {
		return errors.New("intento de inyección detectado")
	}

	return s.repo.UpdateProfileField(pID, campo, cleanValue)
}

func (s *Service) SuspendUser(pID, uID string) error { return s.repo.SuspendAccount(pID, uID) }

// VerifyPin: Valida y consume el PIN (lo marca como usado)
func (s *Service) VerifyPin(pin string) error {
	if pin == "" {
		return errors.New("el PIN es obligatorio")
	}
	return s.repo.ConsumePin(pin)
}

func (s *Service) IdentifyUser(user string) error {
	if s.repo.UserExists(user) {
		return nil
	}
	return errors.New("no encontrado")
}

/**
 * NUEVA FUNCIÓN EN EL SERVICE
 * ValidarTurnstile verifica el token con los servidores de Cloudflare.
 */
/**
 * ValidarTurnstile: Verifica el token con Cloudflare.
 * Incluye logs detallados para depuración en tiempo real.
 */
func (s *Service) ValidarTurnstile(token string) bool {
	secretKey := os.Getenv("TURNSTILE_SECRET_KEY")

	if secretKey == "" {
		log.Println("⚠️  ALERTA SEGURIDAD: TURNSTILE_SECRET_KEY no encontrada en .env")
		return false
	}

	// Usamos url.Values para codificar correctamente los parámetros
	data := url.Values{}
	data.Set("secret", secretKey)
	data.Set("response", token)

	resp, err := http.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", data)
	if err != nil {
		log.Println("❌ ERROR de red al validar con Cloudflare:", err)
		return false
	}
	defer resp.Body.Close()

	var result struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
		Hostname   string   `json:"hostname"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Println("❌ ERROR al leer respuesta de Cloudflare:", err)
		return false
	}

	if !result.Success {
		log.Printf("🚫 Captcha RECHAZADO. Errores: %v | Hostname: %s", result.ErrorCodes, result.Hostname)
		return false
	}

	log.Println("✅ Captcha VALIDADO correctamente por Cloudflare")
	return true
}

func (s *Service) UpdatePasswordByUsername(username, newPassword string) error {
    // 1. Cifrar la nueva contraseña
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
    if err != nil {
        return err
    }

    // 2. Buscar al usuario para obtener su PersonaID
    u, err := s.repo.GetUserForLogin(username)
    if err != nil {
        return fmt.Errorf("el usuario %s no existe", username)
    }

    // 3. Actualizar en la base de datos usando el repositorio (página 96 del PDF)
    return s.repo.UpdatePassword(fmt.Sprintf("%d", u.PersonaID), string(hashedPassword))
}