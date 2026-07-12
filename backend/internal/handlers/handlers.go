/**
 * ARCHIVO: handlers.go
 * UBICACIÓN: internal/handlers/handlers.go
 * DESCRIPCIÓN: Controladores HTTP ultra-ligeros.
 */

package handlers

import (
	"encoding/json"
	"gestion-congregacion/backend/internal/service"
	"net/http"
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

		json.NewDecoder(r.Body).Decode(&req)

		// 1. PRIMERA CAPA: Validar CAPTCHA
		if !s.ValidarTurnstile(req.TurnstileToken) {
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "Seguridad: CAPTCHA no válido"})
			return
		}

		// 2. SEGUNDA CAPA: Autenticación normal
		user, token, err := s.Authenticate(req.Username, req.Password)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"user": user, "token": token})
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
		var req struct{ PersonaID, Campo, Valor string }
		json.NewDecoder(r.Body).Decode(&req)
		s.UpdateProfile(req.PersonaID, req.Campo, req.Valor)
		w.WriteHeader(http.StatusOK)
	}
}

// UploadFotoHandler: Actualiza la imagen de perfil
func UploadFotoHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var data struct {
			PersonaID string `json:"persona_id"`
			FotoURL   string `json:"foto_url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			http.Error(w, "Error", 400)
			return
		}

		if err := s.UpdateUserFoto(data.PersonaID, data.FotoURL); err != nil {
			http.Error(w, "Error al guardar foto", 500)
			return
		}
		w.WriteHeader(http.StatusOK)
	}
}

func SuspenderCuentaHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct{ PersonaID, UsuarioID string }
		json.NewDecoder(r.Body).Decode(&req)
		s.SuspendUser(req.PersonaID, req.UsuarioID)
		w.WriteHeader(http.StatusOK)
	}
}

// BroadcastSeguridadUpdateHandler: Lanza la difusión masiva
func BroadcastSeguridadUpdateHandler(s *service.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Titulo           string `json:"titulo"`
			DescripcionLarga string `json:"descripcion_larga"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", 400)
			return
		}

		if err := s.BroadcastSecurity(req.Titulo, req.DescripcionLarga); err != nil {
			http.Error(w, "Error en la difusión", 500)
			return
		}
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
	return func(w http.ResponseWriter, r *http.Request) {
		// Blindaje: No aceptamos más de 100KB para una info simple
		r.Body = http.MaxBytesReader(w, r.Body, 102400)

		var req struct {
			Contenido string `json:"contenido"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "JSON inválido", http.StatusBadRequest)
			return
		}

		// Delegamos al servicio
		if err := s.AddSecurityInfo(req.Contenido); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}
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
