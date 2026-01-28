package main

import (
	"fmt"
	"gestion-congregacion/backend/internal/handlers"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	godotenv.Load()
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=require prepare_threshold=0",
		os.Getenv("DB_HOST"), os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"), os.Getenv("DB_NAME"), os.Getenv("DB_PORT"))

	db, err := gorm.Open(postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true}), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/publicaciones", handlers.GetPublicaciones(db))
	mux.HandleFunc("/api/login", handlers.LoginHandler(db))

	handler := cors.AllowAll().Handler(mux)
	fmt.Println("🚀 Servidor en http://127.0.0.1:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", handler))
}
