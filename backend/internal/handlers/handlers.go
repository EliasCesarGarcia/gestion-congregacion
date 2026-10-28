/**
 * ARCHIVO: handlers.go
 * UBICACIÓN: internal/handlers/handlers.go
 * DESCRIPCIÓN: Controladores HTTP ultra-ligeros.
 */

package handlers

import (
	"encoding/json"
	"errors"
	"gestion-congregacion/backend/internal/auth"
	"gestion-congregacion/backend/internal/service"
	"log"
	"net"

	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/microcosm-cc/bluemonday"
)

func GetPublicaciones(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pubs, _ := s.GetCatalog()
		json.NewEncoder(w).Encode(pubs)
	}
}

func LoginFinalHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username       string `json:"username"`
			Password       string `json:"password"`
			TurnstileToken string `json:"turnstile_token"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", http.StatusBadRequest)
			return
		}

		// Obtener la IP real del usuario (considerando Cloudflare)
		ip := r.Header.Get("CF-Connecting-IP")
		if ip == "" {
			ip = r.Header.Get("X-Forwarded-For")
		}
		if ip == "" {
			var err error
			ip, _, err = net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				ip = r.RemoteAddr
			}
		}

		// Llamamos al nuevo Authenticate con IP y Token
		user, accessToken, refreshToken, err := s.Authenticate(req.Username, req.Password, req.TurnstileToken, ip)

		if err != nil {
			// Si el error contiene la palabra "SISTEMA", es un error de seguridad/captcha
			if strings.Contains(err.Error(), "SISTEMA") {
				w.WriteHeader(http.StatusForbidden)
			} else {
				w.WriteHeader(http.StatusUnauthorized)
			}
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		// La congregación tiene que estar habilitada (el superadmin queda exento)
		if !user.CongActiva && !EsSuperAdmin(strconv.Itoa(user.PersonaID)) {
			log.Printf("⚠️ LOGIN RECHAZADO: congregación no habilitada (persona %d)", user.PersonaID)
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "CONGREGACION_INACTIVA"})
			return
		}

		// Seteamos la Cookie de Acceso (Corta)
		http.SetCookie(w, &http.Cookie{
			Name:     "auth_token",
			Value:    accessToken,
			Expires:  time.Now().Add(15 * time.Minute),
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteNoneMode,
			Path:     "/",
		})

		// Seteamos la Cookie de Refresco (Larga)
		http.SetCookie(w, &http.Cookie{
			Name:     "refresh_token",
			Value:    refreshToken,
			Expires:  time.Now().Add(7 * 24 * time.Hour),
			HttpOnly: true,
			Secure:   true,
			SameSite: http.SameSiteNoneMode,
			Path:     "/",
		})

		json.NewEncoder(w).Encode(map[string]interface{}{"user": user})
	}
}

func IdentifyUserHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct{ Username string }
		json.NewDecoder(r.Body).Decode(&req)
		if err := s.IdentifyUser(req.Username); err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func RequestPinHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct{ Email, Username, Congregacion string }
		json.NewDecoder(r.Body).Decode(&req)
		s.ProcessPinRequest(req.Email, req.Username, req.Congregacion)
		w.WriteHeader(http.StatusOK)
	}
}

// VerifyPinHandler: Procesa la validación del PIN
func VerifyPinHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Pin string `json:"pin"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Datos inválidos", 400)
			return
		}

		if err := s.VerifyPin(req.Pin); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "PIN inválido o expirado"})
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func UpdateProfileDataHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var req struct {
			Campo string `json:"campo"`
			Valor string `json:"valor"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", http.StatusBadRequest)
			return
		}

		// La persona sale del token, nunca del cuerpo de la petición
		personaID := PersonaIDFromContext(r)

		if err := s.UpdateProfile(personaID, req.Campo, req.Valor); err != nil {
			switch {
			case errors.Is(err, service.ErrCampoInvalido), errors.Is(err, service.ErrValorInvalido):
				http.Error(w, err.Error(), http.StatusBadRequest)
			case errors.Is(err, service.ErrUsernameEnUso):
				http.Error(w, err.Error(), http.StatusConflict)
			default:
				log.Printf("❌ update-profile (persona %s, campo %s): %v", personaID, req.Campo, err)
				http.Error(w, "No se pudo guardar", http.StatusInternalServerError)
			}
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

// UploadFotoHandler: Actualiza la imagen de perfil de la persona del token
func UploadFotoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var data struct {
			FotoURL string `json:"foto_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			http.Error(w, "Error", 400)
			return
		}

		personaID := PersonaIDFromContext(r)

		if err := s.UpdateUserFoto(personaID, data.FotoURL); err != nil {
			if errors.Is(err, service.ErrFotoInvalida) {
				http.Error(w, "Foto no permitida", http.StatusBadRequest)
				return
			}
			log.Printf("❌ upload-foto (persona %s): %v", personaID, err)
			http.Error(w, "Error al guardar foto", 500)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

// SuspenderCuentaHandler: solo la propia cuenta (la persona sale del token)
func SuspenderCuentaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		personaID := PersonaIDFromContext(r)
		if err := s.SuspendUser(personaID); err != nil {
			log.Printf("❌ suspender-cuenta (persona %s): %v", personaID, err)
			http.Error(w, "No se pudo suspender la cuenta", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

// BroadcastSeguridadUpdateHandler: Lanza la difusión masiva (solo superadmins)
func BroadcastSeguridadUpdateHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 20480)
		var req struct {
			Titulo           string `json:"titulo"`
			DescripcionLarga string `json:"descripcion_larga"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", 400)
			return
		}

		personaID := PersonaIDFromContext(r)

		if err := s.BroadcastSecurity(req.Titulo, req.DescripcionLarga); err != nil {
			if errors.Is(err, service.ErrValorInvalido) {
				http.Error(w, "Título o descripción no válidos (máximo 150 y 5000 caracteres)", http.StatusBadRequest)
				return
			}
			log.Printf("❌ broadcast-seguridad (persona %s): %v", personaID, err)
			http.Error(w, "Error en la difusión", 500)
			return
		}
		log.Printf("📣 broadcast-seguridad enviado por la persona %s", personaID)
		w.WriteHeader(http.StatusAccepted)
	}
}

// GetSeguridadInfoHandler: Devuelve el boletín al frontend
func GetSeguridadInfoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		info, err := s.GetSecurityBulletin()
		if err != nil {
			http.Error(w, "No hay boletines", 404)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(info)
	}
}

/**
 * SaveSeguridadInfoHandler: Recibe y guarda nuevos boletines.
 * Mantiene la firma compatible con main.go (pide el servicio).
 */
func SaveSeguridadInfoHandler(s *service.Service) http.HandlerFunc {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 102400)
		var req struct {
			Contenido string `json:"contenido"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", http.StatusBadRequest)
			return
		}

		// Sanitización estricta.
		// Solo permite formato de texto seguro, elimina <script>, <iframe> y eventos JS.
		p := bluemonday.StrictPolicy()
		cleanContenido := p.Sanitize(req.Contenido)

		cleanContenido = strings.TrimSpace(cleanContenido)
		if cleanContenido == "" || len(cleanContenido) > 5000 {
			http.Error(w, "Contenido no válido", http.StatusBadRequest)
			return
		}

		if err := s.AddSecurityInfo(cleanContenido); err != nil {
			log.Printf("❌ save-seguridad-info (persona %s): %v", PersonaIDFromContext(r), err)
			http.Error(w, "No se pudo guardar", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	})
}

// RecoverByPersonaIDHandler: Recupera cuenta por ID o Teléfono
func RecoverByPersonaIDHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			PersonaID string `json:"persona_id"`
			NumCong   string `json:"numero_congregacion"`
			Telefono  string `json:"telefono"`
			Metodo    string `json:"metodo"`
		}
		json.NewDecoder(r.Body).Decode(&req)

		// Delegamos al servicio (Implementaremos la lógica en el siguiente paso)
		email, err := s.RecoverAccount(req.PersonaID, req.NumCong, req.Telefono, req.Metodo)
		if err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"email": email})
	}
}

// SendUsernameRealHandler: Envía datos de acceso por correo
func SendUsernameRealHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct{ Email string }
		json.NewDecoder(r.Body).Decode(&req)

		if err := s.SendAccessData(req.Email); err != nil {
			http.Error(w, "Error al enviar correo", 500)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

// HandleFileUpload: Firma actualizada para ser consistente con el resto de la arquitectura
func HandleFileUpload(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Aquí irá la lógica de subida de archivos en el futuro
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ready_for_upload"})
	}
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	// Borramos la de acceso
	http.SetCookie(w, &http.Cookie{
		Name: "auth_token", Value: "", Path: "/", Expires: time.Unix(0, 0),
		HttpOnly: true, Secure: true, SameSite: http.SameSiteNoneMode,
	})
	// Borramos la de refresco
	http.SetCookie(w, &http.Cookie{
		Name: "refresh_token", Value: "", Path: "/", Expires: time.Unix(0, 0),
		HttpOnly: true, Secure: true, SameSite: http.SameSiteNoneMode,
	})
	w.WriteHeader(http.StatusOK)
}

func RefreshTokenHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("refresh_token")
		if err != nil {
			http.Error(w, "No hay llave de refresco", http.StatusUnauthorized)
			return
		}

		token, err := auth.ValidarJWT(cookie.Value)
		if err != nil || !token.Valid {
			http.Error(w, "Llave de refresco inválida", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok || claims["typ"] != "refresh" {
			http.Error(w, "Llave de refresco inválida", http.StatusUnauthorized)
			return
		}
		userID, _ := claims["sub"].(string)
		personaID, _ := claims["pid"].(string)
		if personaID == "" {
			http.Error(w, "Llave de refresco inválida", http.StatusUnauthorized)
			return
		}

		// Generamos nueva llave corta
		newAccess, err := auth.GenerarAccessToken(userID, personaID)
		if err != nil {
			http.Error(w, "No se pudo renovar la sesión", http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     "auth_token",
			Value:    newAccess,
			Expires:  time.Now().Add(15 * time.Minute),
			HttpOnly: true, Secure: true, SameSite: http.SameSiteNoneMode, Path: "/",
		})

		w.WriteHeader(http.StatusOK)
	}
}

// ChangePasswordHandler: cambio de contraseña de la persona del token.
// Exige la contraseña actual. Ignora cualquier usuario o persona que mande el cliente.
func ChangePasswordHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var req struct {
			CurrentPassword string `json:"current_password"`
			NewPassword     string `json:"new_password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", http.StatusBadRequest)
			return
		}

		personaID := PersonaIDFromContext(r)

		err := s.ChangePassword(personaID, req.CurrentPassword, req.NewPassword)
		switch {
		case err == nil:
			w.WriteHeader(http.StatusOK)
		case errors.Is(err, service.ErrClaveActualIncorrecta):
			http.Error(w, "Contraseña actual incorrecta", http.StatusUnauthorized)
		case errors.Is(err, service.ErrClaveDebil):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, service.ErrDemasiadosIntentos):
			http.Error(w, err.Error(), http.StatusTooManyRequests)
		default:
			log.Printf("❌ cambio de contraseña (persona %s): %v", personaID, err)
			http.Error(w, "No se pudo cambiar la contraseña", http.StatusInternalServerError)
		}
	}
}

// esEncargadoGeneral: coordinador, secretario o servicio (ven todo su congregación).
func esEncargadoGeneral(rol string) bool {
	return rol == "coordinador" || rol == "secretario" || rol == "servicio"
}

// ListPersonasHandler: lista paginada de personas de la congregación del actor.
// Solo coordinador, secretario, servicio o superadmin. Solo el superadmin ve
// todas las congregaciones.
func ListPersonasHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}

		esSuper := EsSuperAdmin(a.PersonaID)
		if !esSuper && !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ personas RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}

		page, _ := strconv.Atoi(r.URL.Query().Get("page"))
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

		res, err := s.ListPersonas(a, esSuper, r.URL.Query().Get("q"), page, limit)
		if err != nil {
			log.Printf("❌ listar personas (persona %s): %v", a.PersonaID, err)
			http.Error(w, "No se pudo obtener la lista", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(res)
	}
}

// responderErrorModulos traduce los errores del service a códigos HTTP.
func responderErrorModulos(w http.ResponseWriter, err error, accion, personaID string) {
	switch {
	case errors.Is(err, service.ErrNivelInvalido),
		errors.Is(err, service.ErrModuloComun),
		errors.Is(err, service.ErrPersonaIDInvalid),
		errors.Is(err, service.ErrModuloIDInvalido),
		errors.Is(err, service.ErrNombreModulo),
		errors.Is(err, service.ErrDescripcionModulo),
		errors.Is(err, service.ErrModuloSinCambios),
		errors.Is(err, service.ErrPuestoInvalido):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, service.ErrModuloNoExiste),
		errors.Is(err, service.ErrPersonaNoValida),
		errors.Is(err, service.ErrSinAsignacion):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, service.ErrModuloExiste),
		errors.Is(err, service.ErrModuloEnUso),
		errors.Is(err, service.ErrComunConAsignacion),
		errors.Is(err, service.ErrPuestoOcupado),
		errors.Is(err, service.ErrPersonaYaTienePuesto):
		http.Error(w, err.Error(), http.StatusConflict)
	default:
		log.Printf("❌ %s (persona %s): %v", accion, personaID, err)
		http.Error(w, "No se pudo completar la operación", http.StatusInternalServerError)
	}
}

// MisModulosHandler: módulos comunes + los asignados a mí. Coordinador,
// secretario, servicio y superadmin ven todos.
func MisModulosHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}

		todos := EsSuperAdmin(a.PersonaID) || esEncargadoGeneral(a.RolApp)
		lista, err := s.MisModulos(a, todos)
		if err != nil {
			log.Printf("❌ mis-modulos (persona %s): %v", a.PersonaID, err)
			http.Error(w, "No se pudo obtener la lista", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"modulos": lista})
	}
}

// MeHandler: devuelve quién soy según la base de datos (no según el navegador).
// El frontend lo usa solo para mostrar u ocultar pantallas; la seguridad real
// sigue en cada ruta (SuperAdminMiddleware, ActorFromContext).
func MeHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"rol_app":              a.RolApp,
			"es_superadmin":        EsSuperAdmin(a.PersonaID),
			"es_encargado_general": esEncargadoGeneral(a.RolApp),
		})
	}
}

// AsignarModuloHandler: solo coordinador, secretario, servicio o superadmin.
func AsignarModuloHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		esSuper := EsSuperAdmin(a.PersonaID)
		if !esSuper && !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ asignar-modulo RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var req struct {
			PersonaID   int    `json:"persona_id"`
			ModuloID    string `json:"modulo_id"`
			NivelAcceso int    `json:"nivel_acceso"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", http.StatusBadRequest)
			return
		}

		if err := s.AsignarModulo(a, esSuper, req.PersonaID, req.ModuloID, req.NivelAcceso); err != nil {
			responderErrorModulos(w, err, "asignar-modulo", a.PersonaID)
			return
		}
		log.Printf("🔑 módulo '%s' (nivel %d) asignado a persona %d por persona %s", req.ModuloID, req.NivelAcceso, req.PersonaID, a.PersonaID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// QuitarModuloHandler: solo coordinador, secretario, servicio o superadmin.
func QuitarModuloHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		a := ActorFromContext(r)
		if a == nil {
			http.Error(w, "Sesión no válida", http.StatusUnauthorized)
			return
		}
		esSuper := EsSuperAdmin(a.PersonaID)
		if !esSuper && !esEncargadoGeneral(a.RolApp) {
			log.Printf("⚠️ quitar-modulo RECHAZADO: persona '%s' con rol '%s'", a.PersonaID, a.RolApp)
			http.Error(w, "No autorizado", http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, 4096)
		var req struct {
			PersonaID int    `json:"persona_id"`
			ModuloID  string `json:"modulo_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", http.StatusBadRequest)
			return
		}

		if err := s.QuitarModulo(a, esSuper, req.PersonaID, req.ModuloID); err != nil {
			responderErrorModulos(w, err, "quitar-modulo", a.PersonaID)
			return
		}
		log.Printf("🔑 módulo '%s' quitado a persona %d por persona %s", req.ModuloID, req.PersonaID, a.PersonaID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// --- ADMINISTRACIÓN DE MÓDULOS (solo superadmin: la ruta va dentro de SuperAdminMiddleware) ---

// leerJSONAdmin: exige Content-Type JSON, limita el tamaño y decodifica.
func leerJSONAdmin(w http.ResponseWriter, r *http.Request, destino interface{}) bool {
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "Content-Type debe ser application/json", http.StatusUnsupportedMediaType)
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	if err := json.NewDecoder(r.Body).Decode(destino); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return false
	}
	return true
}

func ListModulosAdminHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		lista, err := s.ListModulosAdmin()
		if err != nil {
			log.Printf("❌ listar módulos admin (persona %s): %v", PersonaIDFromContext(r), err)
			http.Error(w, "No se pudo obtener la lista", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"modulos": lista})
	}
}

func CrearModuloHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID          string `json:"id"`
			Nombre      string `json:"nombre"`
			Descripcion string `json:"descripcion"`
			EsComun     bool   `json:"es_comun"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		if err := s.CrearModulo(req.ID, req.Nombre, req.Descripcion, req.EsComun); err != nil {
			responderErrorModulos(w, err, "crear-modulo", PersonaIDFromContext(r))
			return
		}
		log.Printf("🧩 módulo %q creado por persona %s", req.ID, PersonaIDFromContext(r))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func EditarModuloHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID          string  `json:"id"`
			Nombre      *string `json:"nombre"`
			Descripcion *string `json:"descripcion"`
			EsComun     *bool   `json:"es_comun"`
			Activo      *bool   `json:"activo"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		if err := s.EditarModulo(req.ID, req.Nombre, req.Descripcion, req.EsComun, req.Activo); err != nil {
			responderErrorModulos(w, err, "editar-modulo", PersonaIDFromContext(r))
			return
		}
		log.Printf("🧩 módulo %q modificado por persona %s", req.ID, PersonaIDFromContext(r))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

func EliminarModuloHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			ID string `json:"id"`
		}
		if !leerJSONAdmin(w, r, &req) {
			return
		}
		if err := s.EliminarModulo(req.ID); err != nil {
			responderErrorModulos(w, err, "eliminar-modulo", PersonaIDFromContext(r))
			return
		}
		log.Printf("🧩 módulo %q eliminado por persona %s", req.ID, PersonaIDFromContext(r))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
