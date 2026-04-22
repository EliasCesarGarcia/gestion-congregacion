/**
 * ARCHIVO: handlers.go
 * UBICACIÓN: Backend/internal/handlers/handlers.go
 * DESCRIPCIÓN: Controlador central de lógica de negocio para la API de Gestión Local.
 * Contiene los manejadores de peticiones (handlers) para el catálogo de publicaciones,
 * procesos de autenticación con JWT, seguridad por PIN, gestión de perfiles de usuario
 * y notificaciones push en tiempo real mediante WebSockets.
 *
 * FUNCIONES IMPLICADAS:
 * - GetPublicaciones: Recupera el listado optimizado de publicaciones.
 * - LoginFinalHandler: Autenticación definitiva con emisión de pases JWT.
 * - IdentifyUserHandler: Verificación previa de existencia de cuenta.
 * - RequestPinHandler / VerifyPinHandler: Flujo de validación de identidad.
 * - BroadcastSeguridadUpdateHandler: Difusión masiva (Email + WebSocket).
 * - UpdateProfileDataHandler / UploadFotoHandler: Administración de identidad del usuario.
 */

package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"gestion-congregacion/backend/internal/auth"
	"gestion-congregacion/backend/internal/models"
	"gestion-congregacion/backend/internal/ws"

	"github.com/resend/resend-go/v2"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// --- SECCIÓN: MÓDULO DE PUBLICACIONES ---

// @Summary Obtener catálogo de publicaciones
// @Description Retorna una lista de todos los libros y revistas disponibles
// @Tags Publicaciones
// @Produce json
// @Success 200 {array} models.Publicacion
// @Router /api/publicaciones [get]
func GetPublicaciones(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// SEO 2026: Cache-Control public para optimizar la velocidad de carga en buscadores
		w.Header().Set("Cache-Control", "public, max-age=3600, s-maxage=7200")

		var pubs []models.Publicacion
		result := db.Table("pub_catalogo").Find(&pubs)
		if result.Error != nil {
			log.Println("Error consulta publicaciones:", result.Error)
			http.Error(w, "Error al obtener datos", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pubs)
	}
}

// --- SECCIÓN: MÓDULO DE AUTENTICACIÓN Y SEGURIDAD ---

// LoginHandler gestiona el inicio de sesión inicial (Versión de compatibilidad)
func LoginHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Error en datos", http.StatusBadRequest)
			return
		}
		var u models.Usuario
		result := db.Table("core_usuarios").
			Select(`core_usuarios.*, core_personas.apellido_nombre as nombre_completo, core_personas.url_imagen as foto_url, core_personas.email as email, core_congregaciones.nombre as congregacion_nombre, core_congregaciones.numero_congregacion, core_congregaciones.ciudad, core_congregaciones.partido, core_congregaciones.provincia_estado as provincia, core_congregaciones.direccion, core_congregaciones.pais`).
			Joins("JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
			Joins("JOIN core_congregaciones ON core_congregaciones.id = core_usuarios.congregacion_id").
			Where("core_usuarios.username_temp = ?", req.Username).
			First(&u)
		if result.Error != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Acceso denegado"})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(u)
	}
}

// CheckUsernameAvailabilityHandler verifica la disponibilidad de un alias y ofrece sugerencias automáticas
func CheckUsernameAvailabilityHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		username := r.URL.Query().Get("username")
		personaID := r.URL.Query().Get("persona_id")

		var countUsuarios int64
		var countPersonas int64

		db.Table("core_usuarios").Where("username_temp = ?", username).Count(&countUsuarios)
		db.Table("core_personas").Where("username_temp = ? AND id != ?", username, personaID).Count(&countPersonas)

		exists := (countUsuarios > 0 || countPersonas > 0)
		response := map[string]interface{}{"exists": exists}

		if exists {
			var persona struct {
				ApellidoNombre string
				Id             int
			}
			db.Table("core_personas").Select("apellido_nombre, id").Where("id = ?", personaID).First(&persona)

			parts := strings.Split(strings.ToLower(persona.ApellidoNombre), " ")
			ape := parts[0]
			nom := ""
			if len(parts) > 1 {
				nom = parts[1]
			}

			response["suggestions"] = []string{
				fmt.Sprintf("%s.%s.%d", nom, ape, persona.Id),
				fmt.Sprintf("%s.%s.talar", ape, nom),
				fmt.Sprintf("%s_%s_2026", nom, ape),
			}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// CheckUsernameHandler realiza una verificación rápida de existencia de alias
func CheckUsernameHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		username := r.URL.Query().Get("username")
		var count int64
		db.Table("core_usuarios").Where("username_temp = ?", username).Count(&count)
		json.NewEncoder(w).Encode(map[string]bool{"exists": count > 0})
	}
}

// RequestPinHandler gestiona la generación y envío de códigos de identidad por email
func RequestPinHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Email        string `json:"email"`
			Username     string `json:"username"`
			Congregacion string `json:"congregacion"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		var nombreReal string
		db.Table("core_congregaciones").Select("nombre").Where("numero_congregacion = ?", req.Congregacion).Scan(&nombreReal)

		if nombreReal == "" {
			db.Table("core_congregaciones").
				Select("core_congregaciones.nombre").
				Joins("JOIN core_usuarios ON core_usuarios.congregacion_id = core_congregaciones.id").
				Where("core_usuarios.username_temp = ?", req.Username).
				Scan(&nombreReal)
		}

		rand.Seed(time.Now().UnixNano())
		pin := fmt.Sprintf("%06d", rand.Intn(1000000))

		db.Exec("DELETE FROM core_verificaciones")
		db.Table("core_verificaciones").Create(map[string]interface{}{
			"pin": pin, "tipo": "SECURITY_CHECK", "utilizado": false, "expira_at": time.Now().UTC().Add(15 * time.Minute),
		})

		apiKey := os.Getenv("RESEND_API_KEY")
		client := resend.NewClient(apiKey)

		htmlContent := fmt.Sprintf(`
            <div style="font-family: 'Open Sans', Arial, sans-serif; background-color: #f5f5f5; padding: 20px; color: #1a1a1a;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border-top: 6px solid #214382; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                    <div style="padding: 25px; background-color: #1a335a; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 18px; text-transform: uppercase; font-weight: 800;">Gestión Local Teocrática</h1>
                        <p style="color: #cbd5e1; margin: 5px 0 0 0; font-style: italic; font-size: 16px; font-weight: 400;">Congregación %s</p>
                    </div>
                    <div style="padding: 35px; line-height: 1.6;">
                        <p style="font-size: 16px;">Usted solicitó este código para comprobar la identidad de su cuenta:</p>
                        <p style="font-weight: bold; font-size: 18px; color: #1a335a;">%s</p>
                        <div style="margin: 30px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: 800;">Código de verificación</p>
                            <h2 style="margin: 0; font-size: 36px; color: #214382; letter-spacing: 8px; white-space: nowrap; font-family: monospace;">%s</h2>
                        </div>
                        <p style="font-size: 13px; color: #94a3b8; font-style: italic;">Si usted no solicitó esto, por seguridad cambie su contraseña.</p>
                    </div>
                </div>
            </div>`, nombreReal, req.Username, pin)

		params := &resend.SendEmailRequest{
			From:    "Gestion Local <onboarding@resend.dev>",
			To:      []string{req.Email},
			Subject: fmt.Sprintf("Código: %s", pin),
			Html:    htmlContent,
		}
		client.Emails.SendWithContext(context.Background(), params)
		w.WriteHeader(http.StatusOK)
	}
}

// VerifyPinHandler valida la vigencia y exactitud del código PIN ingresado
func VerifyPinHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Pin string `json:"pin"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		var v struct {
			Id       int
			ExpiraAt time.Time
		}
		result := db.Table("core_verificaciones").Where("pin = ? AND utilizado = false", req.Pin).First(&v)
		if result.Error != nil || time.Now().UTC().After(v.ExpiraAt) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		db.Table("core_verificaciones").Where("id = ?", v.Id).Update("utilizado", true)
		w.WriteHeader(http.StatusOK)
	}
}

// @Summary Iniciar Sesión (Login)
// @Description Autentica al usuario y entrega un Token JWT. CORRECCIÓN: Paso 1 (Mapeo nativo de GORM).
// @Tags Autenticación
// @Accept json
// @Produce json
// @Param login body models.LoginRequest true "Credenciales de usuario"
// @Success 200 {object} map[string]interface{}
// @Router /api/login-final [post]
func LoginFinalHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")

		var req models.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Datos inválidos", http.StatusBadRequest)
			return
		}

		var u models.Usuario
		// Intento 1: Administradores (Mapeo optimizado eliminando alias conflictivos)
		result := db.Table("core_usuarios").
			Select(`core_usuarios.*, 
                    core_personas.apellido_nombre as nombre_completo, 
                    core_personas.url_imagen as foto_url, 
                    core_personas.email, 
                    core_personas.contacto, 
                    core_personas.estado, 
                    core_congregaciones.nombre as congregacion_nombre, 
                    core_congregaciones.numero_congregacion,
                    core_congregaciones.zona_horaria,
                    core_congregaciones.region,
                    core_congregaciones.pais,
                    core_congregaciones.provincia_estado as provincia,
                    core_congregaciones.partido,
                    core_congregaciones.ciudad,
                    core_congregaciones.direccion`).
			Joins("JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
			Joins("JOIN core_congregaciones ON core_congregaciones.id = core_usuarios.congregacion_id").
			Where("core_usuarios.username_temp = ? AND core_personas.estado = 'ALTA'", req.Username).First(&u)

		// Intento 2: Persona normal (Se elimina alias para permitir mapeo por struct tags)
		if result.Error != nil {
			result = db.Table("core_personas").
				Select(`core_personas.id as persona_id, 
                        core_personas.apellido_nombre as nombre_completo, 
                        core_personas.email, 
                        core_personas.contacto, 
                        core_personas.url_imagen as foto_url, 
                        core_personas.username_temp, 
                        core_personas.password_hash, 
                        core_personas.estado, 
                        core_congregaciones.nombre as congregacion_nombre, 
                        core_congregaciones.numero_congregacion,
                        core_congregaciones.zona_horaria,
                        core_congregaciones.region,
                        core_congregaciones.pais,
                        core_congregaciones.provincia_estado as provincia,
                        core_congregaciones.partido,
                        core_congregaciones.ciudad,
                        core_congregaciones.direccion`).
				Joins("JOIN core_congregaciones ON core_congregaciones.id = core_personas.congregacion_id").
				Where("core_personas.username_temp = ? AND core_personas.estado = 'ALTA'", req.Username).First(&u)
		}

		if result.Error != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Cuenta inactiva o no encontrada"})
			return
		}

		isValid := false
		if strings.HasPrefix(u.PasswordHash, "$2a$") {
			err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password))
			isValid = (err == nil)
		} else {
			isValid = (u.PasswordHash == req.Password)
		}

		if !isValid {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Clave incorrecta"})
			return
		}

		token, err := auth.GenerarJWT(u.ID)
		if err != nil {
			log.Println("Error generando token:", err)
			http.Error(w, "Error interno del servidor", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"user":  u,
			"token": token,
		})
	}
}

// ResetPasswordHandler gestiona el cambio seguro de contraseñas
func ResetPasswordHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username        string `json:"username"`
			CurrentPassword string `json:"current_password"`
			NewPassword     string `json:"new_password"`
			PersonaID       string `json:"persona_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Datos inválidos", http.StatusBadRequest)
			return
		}

		var storedHash string
		db.Table("core_usuarios").Select("password_hash").Where("persona_id = ?", req.PersonaID).Scan(&storedHash)
		if storedHash == "" {
			db.Table("core_personas").Select("password_hash").Where("id = ?", req.PersonaID).Scan(&storedHash)
		}

		isCorrect := false
		if strings.HasPrefix(storedHash, "$2a$") {
			err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.CurrentPassword))
			isCorrect = (err == nil)
		} else {
			isCorrect = (storedHash == req.CurrentPassword)
		}

		if !isCorrect {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "La contraseña actual no es correcta"})
			return
		}

		hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Error interno", 500)
			return
		}

		db.Table("core_usuarios").Where("persona_id = ?", req.PersonaID).Updates(map[string]interface{}{
			"password_hash":       string(hashed),
			"password_changed_at": time.Now(),
		})
		db.Table("core_personas").Where("id = ?", req.PersonaID).Updates(map[string]interface{}{
			"password_hash":       string(hashed),
			"password_changed_at": time.Now(),
		})

		w.WriteHeader(http.StatusOK)
	}
}

// IdentifyUserHandler verifica la existencia de un usuario antes de iniciar procesos de recuperación
func IdentifyUserHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Error en datos", http.StatusBadRequest)
			return
		}

		var count int64
		db.Table("core_usuarios").Where("username_temp = ?", req.Username).Count(&count)
		if count == 0 {
			db.Table("core_personas").Where("username_temp = ?", req.Username).Count(&count)
		}

		if count == 0 {
			log.Printf("⚠️ Usuario no encontrado: %s", req.Username)
			w.WriteHeader(http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusOK)
	}
}

// formatLast8 normaliza formatos telefónicos para comparaciones de seguridad
func formatLast8(phone string) string {
	re := regexp.MustCompile(`\D`)
	nums := re.ReplaceAllString(phone, "")
	if len(nums) < 8 {
		return nums
	}
	return nums[len(nums)-8:]
}

// RecoverByPersonaIDHandler recupera la cuenta utilizando identificadores personales o telefonía
func RecoverByPersonaIDHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PersonaID string `json:"persona_id"`
			NumCong   string `json:"numero_congregacion"`
			Telefono  string `json:"telefono"`
			Metodo    string `json:"metodo"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		var p models.Usuario
		if req.Metodo == "id_cong" {
			err := db.Table("core_personas").
				Select("core_personas.email, core_personas.id as persona_id").
				Joins("JOIN core_congregaciones ON core_congregaciones.id = core_personas.congregacion_id").
				Where("core_personas.id = ? AND core_congregaciones.numero_congregacion = ?", req.PersonaID, req.NumCong).
				First(&p).Error
			if err != nil {
				w.WriteHeader(http.StatusNotFound)
				return
			}
		} else {
			var todas []struct {
				Email    string
				Contacto string
				Id       int
			}
			db.Table("core_personas").Select("email, contacto, id").Scan(&todas)
			found := false
			for _, v := range todas {
				if formatLast8(v.Contacto) == req.Telefono {
					p.Email = v.Email
					p.PersonaID = v.Id
					found = true
					break
				}
			}
			if !found {
				w.WriteHeader(http.StatusNotFound)
				return
			}
		}
		json.NewEncoder(w).Encode(map[string]string{"email": p.Email})
	}
}

// SendUsernameRealHandler envía los datos de acceso institucionales al correo del usuario
func SendUsernameRealHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct{ Email string }
		json.NewDecoder(r.Body).Decode(&req)

		var u models.Usuario
		db.Table("core_usuarios").
			Select("core_usuarios.username_temp, core_personas.id as persona_id, core_congregaciones.numero_congregacion, core_congregaciones.nombre as congregacion_nombre").
			Joins("JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
			Joins("JOIN core_congregaciones ON core_congregaciones.id = core_usuarios.congregacion_id").
			Where("core_personas.email = ?", req.Email).First(&u)

		apiKey := os.Getenv("RESEND_API_KEY")
		client := resend.NewClient(apiKey)

		htmlContent := fmt.Sprintf(`
            <div style="font-family: sans-serif; background-color: #f5f5f5; padding: 20px;">
                <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; border-top: 6px solid #214382; padding: 30px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #1a335a; text-align: center;">DATOS DE ACCESO</h2>
                    <p>Aquí tienes la información solicitada para <b>%s</b>:</p>
                    <div style="background: #f0f2f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><b>Usuario:</b> %s</p>
                        <p><b>ID Usuario:</b> %d</p>
                        <p><b>Congregación:</b> %s</p>
                    </div>
                    <p style="font-size: 11px; color: #999;">Por seguridad, elimine este correo una vez memorizados los datos.</p>
                </div>
            </div>`, u.CongregacionNombre, u.Username, u.PersonaID, u.NumeroCongregacion)

		params := &resend.SendEmailRequest{
			From:    "Gestion Local <onboarding@resend.dev>",
			To:      []string{req.Email},
			Subject: "Recuperación de cuenta",
			Html:    htmlContent,
		}
		client.Emails.SendWithContext(context.Background(), params)
		w.WriteHeader(http.StatusOK)
	}
}

// RecoverUsernameHandler obtiene el alias del usuario asociado a una cuenta de correo
func RecoverUsernameHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		email := r.URL.Query().Get("email")
		var u models.Usuario
		db.Table("core_usuarios").
			Joins("JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
			Where("core_personas.email = ?", email).First(&u)

		json.NewEncoder(w).Encode(map[string]string{"username": u.Username})
	}
}

// --- SECCIÓN: MÓDULO DE GESTIÓN DE PERFIL ---

// @Summary Actualizar Perfil
// @Description Modifica datos del usuario (Email, Teléfono, etc). Requiere Token JWT.
// @Tags Usuario
// @Security ApiKeyAuth
// @Accept json
// @Produce json
// @Success 200
// @Router /api/update-profile [post]
func UpdateProfileDataHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PersonaID string `json:"persona_id"`
			UsuarioID string `json:"usuario_id"`
			Campo     string `json:"campo"`
			Valor     string `json:"valor"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Error en datos", http.StatusBadRequest)
			return
		}

		if req.Campo == "contacto" {
			re := regexp.MustCompile(`\D`)
			req.Valor = re.ReplaceAllString(req.Valor, "")
		}

		if req.Campo == "username" {
			db.Table("core_personas").Where("id = ?", req.PersonaID).Update("username_temp", req.Valor)
			db.Table("core_usuarios").Where("persona_id = ?", req.PersonaID).Update("username_temp", req.Valor)
		} else if req.Campo == "email" {
			db.Table("core_personas").Where("id = ?", req.PersonaID).Update("email", req.Valor)
		} else if req.Campo == "contacto" {
			db.Table("core_personas").Where("id = ?", req.PersonaID).Update("contacto", req.Valor)
		}

		fmt.Printf("✅ Campo %s actualizado para Persona ID %s\n", req.Campo, req.PersonaID)
		w.WriteHeader(http.StatusOK)
	}
}

// UploadFotoHandler actualiza la URL de la imagen de perfil
func UploadFotoHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var data struct {
			PersonaID string `json:"persona_id"`
			FotoURL   string `json:"foto_url"`
		}
		json.NewDecoder(r.Body).Decode(&data)

		// --- AGREGA ESTA LÍNEA PARA ASEGURAR EL NOMBRE CORRECTO DEL BUCKET ---
        // Esto reemplaza "PEOPLE_PROFILE" por "People_profile" si viniera mal desde el frontend
        fixedURL := strings.Replace(data.FotoURL, "PEOPLE_PROFILE", "People_profile", -1)

        db.Table("core_personas").Where("id = ?", data.PersonaID).Update("url_imagen", fixedURL)

		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success", "url": fixedURL})
	}
}

// GetSeguridadInfoHandler recupera los boletines de seguridad más recientes
func GetSeguridadInfoHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=600")

		var info struct {
			Contenido string    `json:"contenido"`
			UpdatedAt time.Time `json:"updated_at"`
		}
		result := db.Table("core_seguridad_info").Order("updated_at desc").First(&info)

		if result.Error != nil {
			http.Error(w, "No hay información disponible", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(info)
	}
}

// SaveSeguridadInfoHandler registra nuevas recomendaciones de seguridad
func SaveSeguridadInfoHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Contenido string `json:"contenido"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		err := db.Table("core_seguridad_info").Create(map[string]interface{}{
			"contenido":  req.Contenido,
			"updated_at": time.Now(),
		}).Error

		if err != nil {
			http.Error(w, "Error al guardar", 500)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

// SuspenderCuentaHandler marca una cuenta para baja inmediata por petición del usuario
func SuspenderCuentaHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PersonaID string `json:"persona_id"`
			UsuarioID string `json:"usuario_id"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		db.Table("core_personas").Where("id = ?", req.PersonaID).Update("estado", "BAJA")

		if req.UsuarioID != "" {
			db.Table("core_usuarios").Where("id = ?", req.UsuarioID).Update("estado_cuenta", "suspendida")
		}

		fmt.Printf("🚫 Cuenta desactivada por el usuario: Persona ID %s\n", req.PersonaID)
		w.WriteHeader(http.StatusOK)
	}
}

// BroadcastSeguridadUpdateHandler distribuye avisos críticos vía email y notificaciones push (WS)
func BroadcastSeguridadUpdateHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Titulo           string `json:"titulo"`
			DescripcionLarga string `json:"descripcion_larga"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Datos inválidos", http.StatusBadRequest)
			return
		}

		err := db.Table("core_seguridad_info").Create(map[string]interface{}{
			"contenido":         req.Titulo,
			"descripcion_larga": req.DescripcionLarga,
			"updated_at":        time.Now(),
		}).Error
		if err != nil {
			log.Println("❌ Error al guardar en BD:", err)
			http.Error(w, "Error interno", 500)
			return
		}

		descripcionHTML := strings.ReplaceAll(req.DescripcionLarga, "\n", "<br/>")

		type Destinatario struct {
			Email              string
			NombreCompleto     string
			Username           string
			CongregacionNombre string
		}
		var lista []Destinatario
		db.Table("core_personas").
			Select("core_personas.email, core_personas.apellido_nombre as nombre_completo, core_personas.username_temp as username, core_congregaciones.nombre as congregacion_nombre").
			Joins("JOIN core_congregaciones ON core_congregaciones.id = core_personas.congregacion_id").
			Where("core_personas.estado = 'ALTA' AND core_personas.email IS NOT NULL AND core_personas.email != ''").
			Scan(&lista)

		apiKey := os.Getenv("RESEND_API_KEY")
		client := resend.NewClient(apiKey)
		fechaActual := time.Now().Format("02/01/2006")

		for _, u := range lista {
			asunto := fmt.Sprintf("⚠️ %s [%s - %s]", req.Titulo, u.Username, u.CongregacionNombre)

			htmlContent := fmt.Sprintf(`
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f9; padding: 30px; color: #1a202c;">
                    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid #1e3a8a;">
                        <div style="padding: 25px; background-color: #1e3a8a; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">Aviso de Seguridad</h1>
                            <p style="color: #93c5fd; margin: 5px 0 0 0; font-style: italic; font-size: 14px;">Congregación %s</p>
                        </div>
                        <div style="padding: 40px; line-height: 1.7;">
                            <p style="font-size: 16px;">Hola, hermano/a <b>%s</b>:</p>
                            <p style="font-size: 15px; color: #4a5568;">Le informamos sobre una nueva actualización importante en los recordatorios de seguridad:</p>
                            
                            <div style="margin: 25px 0; padding: 25px; border-radius: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
                                <h2 style="margin: 0 0 15px 0; color: #1e3a8a; font-size: 18px; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px;">%s</h2>
                                <div style="font-size: 14px; color: #2d3748;">
                                    %s
                                </div>
                            </div>

                            <p style="font-size: 14px; color: #4a5568;">Para ver más detalles, por favor ingrese al sitio y consulte la sección <b>Administración de Cuenta</b>.</p>
                            
                            <p style="margin-top: 30px; font-size: 15px; color: #1e3a8a; font-weight: bold;">Saludos afectuosos,<br><span style="font-weight: normal; color: #718096;">Gestión Local Teocrática</span></p>
                            
                            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #edf2f7; text-align: center;">
                                <p style="font-size: 11px; color: #a0aec0;">
                                    Revisión: %s | Destinatario: %s (%s)
                                </p>
                                <p style="font-size: 12px; color: #e53e3e; font-weight: bold; margin-top: 15px;">
                                    AVISO: No responda a este mensaje. Esta casilla de correo es automática y no es monitoreada.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>`, u.CongregacionNombre, u.NombreCompleto, req.Titulo, descripcionHTML, fechaActual, u.Username, u.CongregacionNombre)

			params := &resend.SendEmailRequest{
				From:    "Gestión Local Teocrática <onboarding@resend.dev>",
				To:      []string{u.Email},
				Subject: asunto,
				Html:    htmlContent,
			}

			_, err := client.Emails.SendWithContext(context.Background(), params)
			if err != nil {
				log.Printf("⚠️ No se pudo enviar correo a %s: %v", u.Email, err)
			}
		}

		// DIFUSIÓN EN TIEMPO REAL VÍA WEBSOCKET
		ws.Broadcast(map[string]string{
			"tipo":   "ALERTA_SEGURIDAD",
			"titulo": req.Titulo,
			"msg":    "Se ha publicado una nueva actualización de seguridad.",
		})

		fmt.Println("📢 Difusión masiva y WebSocket completados con éxito.")
		w.WriteHeader(http.StatusOK)
	}
}

// HandleFileUpload gestiona la recepción de binarios enviados directamente al backend
func HandleFileUpload(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(10 << 20) // Límite de 10MB
	file, handler, err := r.FormFile("foto")
	if err != nil {
		http.Error(w, "Error al recibir archivo", 400)
		return
	}
	defer file.Close()

	fmt.Printf("Archivo recibido: %v, Tamaño: %v\n", handler.Filename, handler.Size)
	w.WriteHeader(http.StatusOK)
}
