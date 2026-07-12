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

	//"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"time"

	"gestion-congregacion/backend/internal/auth"
	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/repository"
	"gestion-congregacion/backend/internal/ws"

	"github.com/resend/resend-go/v2"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- LÓGICA DE IDENTIDAD ---

// Authenticate: Lógica de Login Blindada
// Authenticate verifica las credenciales y devuelve el usuario con su token
func (s *Service) Authenticate(username, password string) (*models.Usuario, string, error) {
	// Sanitización de entrada
	username = strings.TrimSpace(strings.ToLower(username))

	// Buscamos el usuario en el repositorio
	u, err := s.repo.GetUserForLogin(username)
	if err != nil {
		return nil, "", errors.New("el usuario o la contraseña no son correctos")
	}

	// Validación de password con soporte para legacy (texto plano) y seguridad (bcrypt)
	isValid := false
	if strings.HasPrefix(u.PasswordHash, "$2a$") {
		err = bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
		isValid = (err == nil)
	} else {
		isValid = (u.PasswordHash == password)
	}

	if !isValid {
		return nil, "", errors.New("el usuario o la contraseña no son correctos")
	}

	token, _ := auth.GenerarJWT(u.ID)
	return u, token, nil
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
	return s.repo.UpdateProfileField(pID, campo, valor)
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
func (s *Service) ValidarTurnstile(token string) bool {
	secretKey := os.Getenv("TURNSTILE_SECRET_KEY") // Debes ponerla en tu .env
	
	// Si estamos en desarrollo local, podemos saltarlo (opcional)
	if token == "XXX" { return true }

	postData := fmt.Sprintf("secret=%s&response=%s", secretKey, token)
	resp, err := http.Post("https://challenges.cloudflare.com/turnstile/v0/siteverify", 
		"application/x-www-form-urlencoded", 
		strings.NewReader(postData))
	
	if err != nil { return false }
	defer resp.Body.Close()

	var result struct {
		Success bool `json:"success"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Success
}