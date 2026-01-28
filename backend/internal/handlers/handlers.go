package handlers

import (
	"encoding/json"
	"fmt" // <--- Agregado para fmt.Println
	"log" // <--- Agregado para log.Println
	"net/http"

	"gestion-congregacion/backend/internal/models"
	"gorm.io/gorm"
)

// Obtener catálogo de publicaciones
func GetPublicaciones(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var pubs []models.Publicacion
		// Forzamos el nombre de la tabla
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

// Procesar inicio de sesión con Triple JOIN
func LoginHandler(db *gorm.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Error en los datos", http.StatusBadRequest)
			return
		}

		var u models.Usuario
		
		// Consulta con JOIN para traer datos del Usuario, la Persona y la Congregación
		result := db.Table("core_usuarios").
			Select(`
				core_usuarios.*, 
				core_personas.apellido_nombre as nombre_completo, 
				core_personas.url_imagen as foto_url, 
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
			log.Println("Login fallido para", req.Username, ":", result.Error)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]string{"error": "Usuario o datos no encontrados"})
			return
		}

		// Ahora sí, fmt funcionará correctamente
		fmt.Println("✅ Login exitoso para:", u.NombreCompleto)
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(u)
	}
}