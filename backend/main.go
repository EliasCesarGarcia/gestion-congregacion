package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// 1. Modelo de la tabla pub_catalogo
type Publicacion struct {
	ID                string `gorm:"primaryKey" json:"id"`
	NombrePublicacion string `json:"nombre_publicacion"`
	Tipo              string `json:"tipo"`
	Siglas            string `json:"siglas"`
	URLPortada        string `json:"url_portada"`
}

// Variable global para la base de datos
var db *gorm.DB

func main() {
	// 2. Cargar el archivo .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Aviso: No se pudo encontrar el archivo .env, usando variables del sistema")
	}

	// 3. Construir la cadena de conexión (DSN)
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=require",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	// 4. Abrir la conexión con GORM
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Error al conectar a la base de datos:", err)
	}

	fmt.Println("✅ ¡Conexión exitosa a Supabase con GORM!")

	// 5. Configurar las rutas (Endpoints)
	mux := http.NewServeMux()

	// Ruta para que React pida las publicaciones
	mux.HandleFunc("/api/publicaciones", getPublicaciones)

	// 6. Configurar CORS (Permitir todo para desarrollo)
	handler := cors.AllowAll().Handler(mux)

	// 7. INICIAR EL SERVIDOR (Configuración de IP fija para el Proxy)
	// Forzamos 127.0.0.1 en lugar de ":" para evitar conflictos en Windows
	direccion := "127.0.0.1:8080"
	fmt.Println("🚀 Servidor Backend corriendo en http://" + direccion)

	err = http.ListenAndServe(direccion, handler)
	if err != nil {
		log.Fatal("❌ Error al iniciar el servidor:", err)
	}
}

// Función que responde a la petición de React
func getPublicaciones(w http.ResponseWriter, r *http.Request) {
	var publicaciones []Publicacion

	// GORM busca en la tabla "pub_catalogo"
	result := db.Table("pub_catalogo").Find(&publicaciones)

	if result.Error != nil {
		log.Println("Error en la consulta:", result.Error)
		http.Error(w, "Error al obtener datos", http.StatusInternalServerError)
		return
	}

	// Enviar los datos en formato JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(publicaciones)
}