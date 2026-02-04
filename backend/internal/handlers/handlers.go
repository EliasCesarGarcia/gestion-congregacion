package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"gestion-congregacion/backend/internal/models"

	"github.com/resend/resend-go/v2"
	"gorm.io/gorm"
)

func GetPublicaciones(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

// NUEVO: Verificar si el username existe
func CheckUsernameHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		username := r.URL.Query().Get("username")
		var count int64
		db.Table("core_usuarios").Where("username_temp = ?", username).Count(&count)
		json.NewEncoder(w).Encode(map[string]bool{"exists": count > 0})
	}
}

func RequestPinHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Email        string `json:"email"`
			Username     string `json:"username"`
			Congregacion string `json:"congregacion"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		rand.Seed(time.Now().UnixNano())
		pin := fmt.Sprintf("%06d", rand.Intn(1000000))

		// Guardar en DB
		db.Exec("DELETE FROM core_verificaciones")
		db.Table("core_verificaciones").Create(map[string]interface{}{
			"pin":       pin,
			"tipo":      "SECURITY_CHECK",
			"utilizado": false,
			"expira_at": time.Now().UTC().Add(15 * time.Minute),
		})

		apiKey := os.Getenv("RESEND_API_KEY")
		client := resend.NewClient(apiKey)

		// --- DISEÑO MEJORADO ESTILO JW ---
		htmlContent := fmt.Sprintf(`
			<div style="font-family: 'Open Sans', Arial, sans-serif; background-color: #f5f5f5; padding: 20px; color: #1a1a1a;">
				<div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-top: 6px solid #214382;">
					
					<div style="padding: 25px; background-color: #1a335a; text-align: center;">
						<h1 style="color: #ffffff; margin: 0; font-size: 18px; letter-spacing: 1px; text-transform: uppercase; font-weight: 800;">Gestión Local Teocrática</h1>
						<!-- COLOR MÁS CLARO (#cbd5e1) para que se lea bien sobre el azul oscuro -->
						<p style="color: #cbd5e1; margin: 5px 0 0 0; font-style: italic; font-size: 15px; font-weight: 400;">Congregación %s</p>
					</div>

					<div style="padding: 35px; line-height: 1.6; text-align: left;">
						<p style="font-size: 16px; color: #444;">Usted solicitó este código para comprobar la identidad de su cuenta:</p>
						<p style="font-weight: bold; font-size: 18px; color: #1a335a; margin-top: 5px;">%s</p>
						
						<div style="margin: 30px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
							<p style="margin: 0 0 10px 0; color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: 800; letter-spacing: 1px;">Código de verificación</p>
							<!-- Ajuste de letter-spacing y nowrap para que entre en una línea en móviles -->
							<h2 style="margin: 0; font-size: 36px; color: #214382; letter-spacing: 4px; white-space: nowrap; font-family: monospace;">%s</h2>
						</div>

						<p style="font-size: 14px; color: #64748b;">Este código de un solo uso es válido durante <b>15 minutos</b>.</p>
						
						<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
							<p style="font-size: 12px; color: #94a3b8; font-style: italic; line-height: 1.4;">
								Si usted no ha solicitado este código, es posible que alguien tenga sus datos de acceso. Para proteger su cuenta, cambie la contraseña inmediatamente.
							</p>
						</div>
					</div>

					<div style="padding: 20px; background-color: #f8fafc; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
						Este es un mensaje automático. Por favor, no responda a este correo.
					</div>
				</div>
			</div>
		`, req.Congregacion, req.Username, pin)

		// --- ASUNTO ÚNICO PARA EVITAR AGRUPAMIENTO ---
		// Agregamos el PIN al asunto para que cada mail sea una conversación nueva
		asunto := fmt.Sprintf("Código de verificación: %s - %s", pin, req.Congregacion)

		params := &resend.SendEmailRequest{
			From:    "Gestión Local <onboarding@resend.dev>",
			To:      []string{req.Email},
			Subject: asunto,
			Html:    htmlContent,
		}

		sent, err := client.Emails.SendWithContext(context.Background(), params)
		if err != nil {
			log.Println("❌ Error Resend:", err)
			http.Error(w, "Error de envío", http.StatusInternalServerError)
			return
		}

		fmt.Printf("✅ Email real enviado. ID: %s | PIN: %s\n", sent.Id, pin)
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "sent"})
	}
}

func VerifyPinHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Pin string `json:"pin"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		var v struct {
			Id        int
			Pin       string
			ExpiraAt  time.Time
			Utilizado bool
		}

		// 1. Buscamos el PIN ignorando el tiempo en el SQL para evitar errores de zona horaria
		result := db.Table("core_verificaciones").
			Where("pin = ? AND utilizado = ?", req.Pin, false).
			First(&v)

		if result.Error != nil {
			log.Println("PIN no encontrado en DB:", req.Pin)
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "El código no existe"})
			return
		}

		// 2. Validamos el tiempo aquí en Go (más seguro)
		if time.Now().UTC().After(v.ExpiraAt) {
			log.Println("PIN expirado. Expira:", v.ExpiraAt, "Ahora UTC:", time.Now().UTC())
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "El código ha expirado"})
			return
		}

		// 3. Marcar como usado
		db.Table("core_verificaciones").Where("id = ?", v.Id).Update("utilizado", true)

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "verified"})
	}
}

func UpdateProfileDataHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PersonaID string `json:"persona_id"`
			UsuarioID string `json:"usuario_id"`
			Campo     string `json:"campo"`
			Valor     string `json:"valor"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.Campo == "email" {
			db.Table("core_personas").Where("id = ?", req.PersonaID).Update("email", req.Valor)
		} else if req.Campo == "username" {
			db.Table("core_usuarios").Where("id = ?", req.UsuarioID).Update("username_temp", req.Valor)
		}
		w.WriteHeader(http.StatusOK)
	}
}

func UploadFotoHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var data struct {
			PersonaID string `json:"persona_id"`
			FotoURL   string `json:"foto_url"`
		}
		json.NewDecoder(r.Body).Decode(&data)
		db.Table("core_personas").Where("id = ?", data.PersonaID).Update("url_imagen", data.FotoURL)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
}

func GetSeguridadInfoHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var info struct {
			Contenido string    `json:"contenido"`
			UpdatedAt time.Time `json:"updated_at"`
		}
		db.Table("core_seguridad_info").First(&info)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(info)
	}
}

func SuspenderCuentaHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UsuarioID string `json:"usuario_id"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		db.Table("core_usuarios").Where("id = ?", req.UsuarioID).Update("estado_cuenta", "suspendida")
		w.WriteHeader(http.StatusOK)
	}
}
