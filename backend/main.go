package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"gestion-congregacion/backend/internal/handlers"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var db *gorm.DB

func main() {
	// 1. Cargar variables de entorno desde el archivo .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Aviso: No se pudo encontrar el archivo .env, usando variables del sistema")
	}

	// 2. Configurar la cadena de conexión (DSN)
	// Usamos el puerto 6543 y agregamos prepare_threshold=0 para que sea compatible con el Pooler de Supabase
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=require prepare_threshold=0",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	// 3. Abrir la conexión con GORM usando la configuración para el Pooler
	db, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // Crucial: evita el error "prepared statement already exists"
	}), &gorm.Config{})

	if err != nil {
		log.Fatal("❌ Error crítico al conectar a la base de datos:", err)
	}

	fmt.Println("✅ ¡Conexión exitosa a Supabase con GORM (Modo Pooler)!")

	// 4. Configurar las rutas (Mux)
	mux := http.NewServeMux()

	// Endpoints (Rutas) que llaman a las funciones que están en la carpeta internal/handlers
	mux.HandleFunc("/api/publicaciones", handlers.GetPublicaciones(db))
	mux.HandleFunc("/api/login", handlers.LoginHandler(db))
	mux.HandleFunc("/api/upload-foto", handlers.UploadFotoHandler(db))

	// 5. Configurar CORS (Permitir el acceso desde el frontend de React)
	handler := cors.AllowAll().Handler(mux)

	// 6. Iniciar el servidor
	// Usamos ":8080" para que escuche en todas las interfaces de red locales
	puerto := "8080"
	fmt.Println("🚀 Servidor Backend corriendo en el puerto " + puerto)
	
	err = http.ListenAndServe(":"+puerto, handler)
	if err != nil {
		log.Fatal("❌ Error al iniciar el servidor:", err)
	}
}