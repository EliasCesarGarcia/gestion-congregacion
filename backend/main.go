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

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Aviso: No se pudo encontrar el archivo .env")
	}

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=require prepare_threshold=0",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"), os.Getenv("DB_PORT"))

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN: dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{})

	if err != nil {
		log.Fatal("❌ Error al conectar a la base de datos:", err)
	}

	fmt.Println("✅ ¡Conexión exitosa a Supabase (Modo Pooler)!")

	mux := http.NewServeMux()

	// RUTAS
	mux.HandleFunc("/api/publicaciones", handlers.GetPublicaciones(db))
	mux.HandleFunc("/api/login", handlers.LoginHandler(db))
	mux.HandleFunc("/api/upload-foto", handlers.UploadFotoHandler(db))
	mux.HandleFunc("/api/check-username", handlers.CheckUsernameHandler(db)) // Nueva
	mux.HandleFunc("/api/request-pin", handlers.RequestPinHandler(db))     // Nueva
	mux.HandleFunc("/api/update-profile", handlers.UpdateProfileDataHandler(db))
	mux.HandleFunc("/api/seguridad-info", handlers.GetSeguridadInfoHandler(db))
	mux.HandleFunc("/api/suspender-cuenta", handlers.SuspenderCuentaHandler(db))
	mux.HandleFunc("/api/verify-pin", handlers.VerifyPinHandler(db))

	handler := cors.AllowAll().Handler(mux)

	puerto := "8080"
	fmt.Println("🚀 Servidor Backend en http://localhost:" + puerto)
	log.Fatal(http.ListenAndServe(":"+puerto, handler))
}