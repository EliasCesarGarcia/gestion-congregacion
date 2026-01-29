package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"gestion-congregacion/backend/internal/models"
	"gorm.io/gorm"
)

// Obtener catálogo de publicaciones
func GetPublicaciones(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var pubs []models.Publicacion
		result := db.Table("pub_catalogo").Find(&pubs)
		if result.Error != nil {
			log.Println("Error en consulta de publicaciones:", result.Error)
			http.Error(w, "Error al obtener datos", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pubs)
	}
}

// Procesar inicio de sesión con Triple JOIN (Usuarios + Personas + Congregaciones)
func LoginHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Error en los datos recibidos", http.StatusBadRequest)
			return
		}

		var u models.Usuario
		
		// Realizamos el JOIN para traer la información completa del perfil
		result := db.Table("core_usuarios").
			Select(`
				core_usuarios.*, 
				core_personas.apellido_nombre as nombre_completo, 
				core_personas.url_imagen as foto_url, 
				core_personas.email as email,
				core_congregaciones.nombre as congregacion_nombre, 
				core_congregaciones.numero_congregacion, 
				core_congregaciones.ciudad, 
				core_congregaciones.partido, 
				core_congregaciones.provincia_estado as provincia, 
				core_congregaciones.direccion, 
				core_congregaciones.pais
			`).
			Joins("JOIN core_personas ON core_personas.id = core_usuarios.persona_id").
			Joins("JOIN core_congregaciones ON core_congregaciones.id = core_usuarios.congregacion_id").
			Where("core_usuarios.username_temp = ?", req.Username).
			First(&u)

		if result.Error != nil {
			log.Println("Login fallido para:", req.Username)
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Usuario o datos no encontrados"})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(u)
	}
}

// Actualizar el nombre del archivo de imagen en la base de datos
func UploadFotoHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var data struct {
			PersonaID string `json:"persona_id"`
			FotoURL   string `json:"foto_url"`
		}

		if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
			log.Println("Error decodificando JSON de foto:", err)
			http.Error(w, "Datos inválidos", http.StatusBadRequest)
			return
		}

		// Actualizamos el campo url_imagen en la tabla core_personas
		err := db.Table("core_personas").Where("id = ?", data.PersonaID).Update("url_imagen", data.FotoURL).Error
		if err != nil {
			log.Println("Error al actualizar URL de imagen en DB:", err)
			http.Error(w, "Error al actualizar base de datos", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success", 
			"foto_url": data.FotoURL,
		})
	}
}