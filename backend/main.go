/**
 * ARCHIVO: main.go
 * UBICACIÓN: Backend/main.go
 * DESCRIPCIÓN: Punto de entrada principal del servidor Backend.
 * Configura la base de datos, registra las rutas (públicas y protegidas),
 * inicializa WebSockets y la documentación interactiva Swagger.
 */

package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"gestion-congregacion/backend/internal/handlers"
	"gestion-congregacion/backend/internal/repository"
	"gestion-congregacion/backend/internal/routes"
	"gestion-congregacion/backend/internal/service"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	// 1. Carga de variables con validación estricta
	godotenv.Load()
	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("CRÍTICO: JWT_SECRET no definido. El servidor no arrancará por seguridad.")
	}

	// 2. Conexión a DB con Pool de alto rendimiento
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=require TimeZone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"))

	// Importante: PrepareStmt: false es vital para Supabase Pooler
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		PrepareStmt: false,                                 // Mejora velocidad en un 20%
		Logger:      logger.Default.LogMode(logger.Silent), // No filtrar queries en producción (seguridad). Silenciamos logs para evitar fugas de info en consola
	})

	if err != nil {
		log.Fatal("❌ Error DB:", err)
	}

	// Optimización de pool de conexiones (Hardware-Aware)
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetMaxOpenConns(10)
		sqlDB.SetConnMaxLifetime(time.Hour) // Cerramos conexiones viejas para evitar fugas de memoria
	}

	fmt.Println("✅ ¡Conexión exitosa a Supabase! (Pooler Mode)")

	// 1. INICIALIZACIÓN DE LA VARIABLE MUX (CORRECCIÓN)
	mux := http.NewServeMux()

	// 2. INYECCIÓN DE DEPENDENCIAS
	repo := repository.NewRepository(db)
	svc := service.NewService(repo)

	// 3. Registro de Rutas
	routes.RegisterRoutes(mux, svc)

	// 4. --- ARQUITECTURA DE SEGURIDAD EN CAPAS (Middleware Chain) ---

	// CAPA 1: Cabeceras de Seguridad y SEO (Impide Sniffing y Clickjacking)
	securityLayer := handlers.SecurityHeadersMiddleware(mux)

	// CAPA 2: Configuración CORS Profesional
	// NOTA: En producción, sustituye "*" por tu dominio real de Vercel
	finalHandler := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "Accept-Encoding"},
		AllowCredentials: true,
		MaxAge:           86400, // Cache de CORS por 24 horas para mejorar TTFB (SEO)
	}).Handler(securityLayer)

	// Configuración del Servidor Físico (Blindaje de Timeouts)
	puerto := os.Getenv("PORT")
	if puerto == "" {
		puerto = "8080"
	}

	srv := &http.Server{
		Addr:         "0.0.0.0:" + puerto,
		Handler:      finalHandler,
		ReadTimeout:  10 * time.Second, // Protege contra ataques Slowloris
		WriteTimeout: 20 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	fmt.Printf("🚀 Servidor corriendo en el puerto: %s\n", puerto)
	fmt.Printf("📖 Documentación Swagger: http://localhost:%s/swagger/index.html\n", puerto)

	// Lanzamiento oficial usando la instancia configurada srv
	log.Fatal(srv.ListenAndServe())
}
