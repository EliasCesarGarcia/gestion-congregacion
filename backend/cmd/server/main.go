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

// 1. Modelo de la tabla pub_catalogo (Debe coincidir con tus columnas de Postgres)
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
		log.Fatal("Error: No se pudo encontrar el archivo .env")
	}

	// 3. Construir la cadena de conexión (DSN) usando los datos del .env
	// Usamos sslmode=require porque Supabase lo exige para conexiones seguras
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

	// 6. Configurar CORS (Permitir que React se conecte desde otro puerto)
	handler := cors.Default().Handler(mux)

	// 7. Iniciar el servidor en el puerto 8080
	port := ":8080"
	fmt.Println("🚀 Servidor Backend corriendo en http://localhost" + port)
	log.Fatal(http.ListenAndServe(port, handler))
}

// Función que responde a la petición de React
func getPublicaciones(w http.ResponseWriter, r *http.Request) {
	var publicaciones []Publicacion

	// GORM busca automáticamente en la tabla "pub_catalogo"
	// Si el nombre de la tabla fuera distinto, usaríamos .Table("nombre")
	result := db.Table("pub_catalogo").Find(&publicaciones)

	if result.Error != nil {
		http.Error(w, "Error al obtener datos: "+result.Error.Error(), http.StatusInternalServerError)
		return
	}

	// Enviar los datos en formato JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(publicaciones)
}
