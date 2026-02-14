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

	"gestion-congregacion/backend/internal/models"

	"github.com/resend/resend-go/v2"
	"gorm.io/gorm"

	"golang.org/x/crypto/bcrypt" // <--- Agregado
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

func CheckUsernameAvailabilityHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		username := r.URL.Query().Get("username")
		personaID := r.URL.Query().Get("persona_id")

		var countUsuarios int64
		var countPersonas int64

		// Buscar en ambas tablas para evitar duplicados globales
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

			// Limpieza de nombre para sugerencias
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
			Congregacion string `json:"congregacion"` // Aquí recibimos el NÚMERO (ej: 9738)
		}
		json.NewDecoder(r.Body).Decode(&req)

		// --- NUEVA LÓGICA: Buscar el nombre real de la congregación ---
		var nombreReal string
		db.Table("core_congregaciones").
			Select("nombre").
			Where("numero_congregacion = ?", req.Congregacion).
			Scan(&nombreReal)

		// Si no encuentra el nombre por número, intentamos buscar por el usuario
		if nombreReal == "" {
			db.Table("core_congregaciones").
				Select("core_congregaciones.nombre").
				Joins("JOIN core_usuarios ON core_usuarios.congregacion_id = core_congregaciones.id").
				Where("core_usuarios.username_temp = ?", req.Username).
				Scan(&nombreReal)
		}
		// --- FIN DE BÚSQUEDA ---

		rand.Seed(time.Now().UnixNano())
		pin := fmt.Sprintf("%06d", rand.Intn(1000000))

		db.Exec("DELETE FROM core_verificaciones")
		db.Table("core_verificaciones").Create(map[string]interface{}{
			"pin": pin, "tipo": "SECURITY_CHECK", "utilizado": false, "expira_at": time.Now().UTC().Add(15 * time.Minute),
		})

		apiKey := os.Getenv("RESEND_API_KEY")
		client := resend.NewClient(apiKey)

		// DISEÑO CORREGIDO: Usamos nombreReal y aclaramos el color del texto
		htmlContent := fmt.Sprintf(`
			<div style="font-family: 'Open Sans', Arial, sans-serif; background-color: #f5f5f5; padding: 20px; color: #1a1a1a;">
				<div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border-top: 6px solid #214382; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
					<div style="padding: 25px; background-color: #1a335a; text-align: center;">
						<h1 style="color: #ffffff; margin: 0; font-size: 18px; text-transform: uppercase; font-weight: 800;">Gestión Local Teocrática</h1>
						<!-- COLOR ACLARADO (#cbd5e1) PARA MÁXIMA LEGIBILIDAD -->
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
			</div>`, nombreReal, req.Username, pin) // <-- Aquí pasamos nombreReal

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

// --- PASO 3: VERIFICAR PIN ---
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

func LoginFinalHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Datos inválidos", http.StatusBadRequest)
			return
		}

		var u models.Usuario
		// 1. Intentar Admin (Traemos TODO de la congregación)
		result := db.Table("core_usuarios").
			Select(`core_usuarios.*, 
                    core_personas.apellido_nombre as nombre_completo, 
                    core_personas.url_imagen as foto_url, 
                    core_personas.email, 
                    core_personas.contacto, 
                    core_personas.estado, 
                    core_congregaciones.nombre as congregacion_nombre, 
                    core_congregaciones.numero_congregacion,
                    core_congregaciones.region,
                    core_congregaciones.pais,
                    core_congregaciones.provincia_estado as provincia,
                    core_congregaciones.partido,
                    core_congregaciones.ciudad,
                    core_congregaciones.direccion`).
			Joins("JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
			Joins("JOIN core_congregaciones ON core_congregaciones.id = core_usuarios.congregacion_id").
			Where("core_usuarios.username_temp = ? AND core_personas.estado = 'ALTA'", req.Username).First(&u)

		// 2. Intentar Persona normal si no es admin
		if result.Error != nil {
			result = db.Table("core_personas").
				Select(`core_personas.id as persona_id, 
                        core_personas.apellido_nombre as nombre_completo, 
                        core_personas.email, 
                        core_personas.contacto, 
                        core_personas.url_imagen as foto_url, 
                        core_personas.username_temp as username, 
                        core_personas.password_hash, 
                        core_personas.estado, 
                        core_congregaciones.nombre as congregacion_nombre, 
                        core_congregaciones.numero_congregacion,
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

		// Validación Bcrypt / Texto plano
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

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(u)
	}
}

// --- RESET PASSWORD (CON VALIDACIÓN DE CLAVE ACTUAL) ---
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

		// 1. Obtener la contraseña guardada actualmente
		var storedHash string

		// Simplemente ejecutamos la consulta sin guardarla en una variable "result"
		db.Table("core_usuarios").Select("password_hash").Where("persona_id = ?", req.PersonaID).Scan(&storedHash)

		if storedHash == "" {
			db.Table("core_personas").Select("password_hash").Where("id = ?", req.PersonaID).Scan(&storedHash)
		}

		// 2. Verificar si la contraseña actual coincide
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

		// 3. Si es correcta, encriptar la NUEVA
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "Error interno", 500)
			return
		}

		// 4. Actualizar en ambas tablas
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

// handlers.go

// handlers.go

// --- IDENTIFICAR USUARIO (Login Directo) ---
func IdentifyUserHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		var u models.Usuario
		err := db.Table("core_usuarios").Where("username_temp = ?", req.Username).First(&u).Error
		if err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

// Función para obtener los últimos 8 dígitos del teléfono guardado
func formatLast8(phone string) string {
	re := regexp.MustCompile(`\D`)
	nums := re.ReplaceAllString(phone, "")
	if len(nums) < 8 {
		return nums
	}
	return nums[len(nums)-8:]
}

// --- RECUPERAR IDENTIDAD (ID+CONG o TELÉFONO) ---
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

// --- ENVIAR DATOS FINALES (USUARIO, ID, CONG) ---
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

// Recuperar el nombre de usuario (después del PIN)
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

// --- UPDATE PROFILE (CORREGIDO PARA EVITAR ERROR UUID VACÍO) ---
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

		// Limpiar el valor si es teléfono
		if req.Campo == "contacto" {
			re := regexp.MustCompile(`\D`)
			req.Valor = re.ReplaceAllString(req.Valor, "")
		}

		// USAMOS PersonaID COMO ANCLA PRINCIPAL PARA EVITAR ERRORES DE UUID
		if req.Campo == "username" {
			// Actualizar en core_personas
			db.Table("core_personas").Where("id = ?", req.PersonaID).Update("username_temp", req.Valor)
			// Actualizar en core_usuarios (si existe el registro ahí también)
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
		// Agregamos OrderBy para traer siempre el registro más reciente por fecha
		result := db.Table("core_seguridad_info").Order("updated_at desc").First(&info)

		if result.Error != nil {
			http.Error(w, "No hay información disponible", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(info)
	}
}

func SaveSeguridadInfoHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Contenido string `json:"contenido"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		// Insertamos un registro NUEVO (no editamos el viejo para tener historial)
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

// --- SUSPENDER CUENTA (CAMBIO DE ESTADO EN PERSONAS) ---
func SuspenderCuentaHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PersonaID string `json:"persona_id"`
			UsuarioID string `json:"usuario_id"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		// 1. Cambiamos el estado en core_personas a BAJA (Impacto principal)
		db.Table("core_personas").Where("id = ?", req.PersonaID).Update("estado", "BAJA")

		// 2. Si tiene registro de administrador, también suspendemos la cuenta
		if req.UsuarioID != "" {
			db.Table("core_usuarios").Where("id = ?", req.UsuarioID).Update("estado_cuenta", "suspendida")
		}

		fmt.Printf("🚫 Cuenta desactivada por el usuario: Persona ID %s\n", req.PersonaID)
		w.WriteHeader(http.StatusOK)
	}
}

// --- DIFUSIÓN MASIVA DE SEGURIDAD PERSONALIZADA ---
// --- DIFUSIÓN MASIVA DE SEGURIDAD CON SALTOS DE LÍNEA Y PERSONALIZACIÓN ---
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

		// 1. Guardar en Base de Datos (Esto actualiza la web)
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

		// 2. Procesar el texto para el Email (Convertir "Enters" en saltos de línea HTML)
		// Esto soluciona el problema de que el texto llegue todo en un solo renglón.
		descripcionHTML := strings.ReplaceAll(req.DescripcionLarga, "\n", "<br/>")

		// 3. Obtener destinatarios activos con sus datos de congregación
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

		// 4. Configurar cliente Resend
		apiKey := os.Getenv("RESEND_API_KEY")
		client := resend.NewClient(apiKey)
		fechaActual := time.Now().Format("02/01/2006")

		// 5. Enviar correos personalizados
		for _, u := range lista {
			// Asunto dinámico para evitar filtros de SPAM
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

		fmt.Println("📢 Difusión masiva completada con éxito.")
		w.WriteHeader(http.StatusOK)
	}
}
