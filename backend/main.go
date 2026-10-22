/**
 * ARCHIVO: main.go
 * UBICACIÓN: Backend/main.go
 * DESCRIPCIÓN: Punto de entrada principal del servidor Backend.
 * Configura la base de datos, registra las rutas (públicas y protegidas),
 * inicializa WebSockets y la documentación interactiva Swagger.
 */

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"gestion-congregacion/backend/internal/handlers"
	"gestion-congregacion/backend/internal/repository"
	"gestion-congregacion/backend/internal/routes"
	"gestion-congregacion/backend/internal/service"

	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/rs/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	godotenv.Load()

	// 1. VALIDACIÓN DE SECRETOS (Alerta 1)
	requiredEnvs := []string{"JWT_SECRET", "DB_PASSWORD", "ALLOWED_ORIGINS", "REDIS_URL"}
	for _, env := range requiredEnvs {
		if os.Getenv(env) == "" {
			log.Fatalf("CRÍTICO: Variable de entorno %s no definida.", env)
		}
	}

	// 2. Conexión a DB con Pool de alto rendimiento
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=require TimeZone=UTC",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"))

	// Importante: PrepareStmt: false es vital para Supabase Pooler
	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			LogLevel:                  logger.Error, // solo muestra errores reales
			IgnoreRecordNotFoundError: true,         // "no encontrado" no es un error
			ParameterizedQueries:      true,         // no imprime valores (usuarios, claves) en los logs
		},
	)

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // necesario con el pooler de transacciones de Supabase
	}), &gorm.Config{
		PrepareStmt: false,
		Logger:      newLogger,
	})

	if err != nil {
		log.Fatal("❌ Error DB:", err)
	}

	// Optimización de pool de conexiones (Hardware-Aware)
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(2)
		sqlDB.SetMaxOpenConns(5)
		sqlDB.SetConnMaxLifetime(30 * time.Minute)
		sqlDB.SetConnMaxIdleTime(1 * time.Minute) // libera conexiones que no se usan // Cerramos conexiones viejas para evitar fugas de memoria
	}

	fmt.Println("✅ ¡Conexión exitosa a Supabase! (Pooler Mode)")

	// 1. INICIALIZACIÓN DE LA VARIABLE MUX (CORRECCIÓN)
	mux := http.NewServeMux()

	// --- INICIALIZACIÓN DE SEGURIDAD ---
	// 1. Conex
	// ión a Redis para el Escudo de Seguridad
	redisURL := os.Getenv("REDIS_URL")
	opt, errRedis := redis.ParseURL(redisURL)
	if errRedis != nil {
		log.Fatalf("CRÍTICO: REDIS_URL no tiene un formato válido: %v", errRedis)
	}
	rdb := redis.NewClient(opt)

	ctxPing, cancelPing := context.WithTimeout(context.Background(), 3*time.Second)
	if errPing := rdb.Ping(ctxPing).Err(); errPing != nil {
		log.Printf("⚠️ Redis no responde: %v", errPing)
	} else {
		fmt.Println("✅ Redis conectado")
	}
	cancelPing()

	// 2. Inyección de Dependencias (Repository -> Service con Redis)
	repo := repository.NewRepository(db)
	svc := service.NewService(repo, rdb) // <--- Ahora le pasamos rdb al servicio
	// 3. Registro de Rutas
	routes.RegisterRoutes(mux, svc)

	// 4. --- ARQUITECTURA DE SEGURIDAD EN CAPAS (Middleware Chain) ---

	// ARQUITECTURA DE SEGURIDAD EN CAPAS (Orden Crítico)

	// Capa 1: El Escudo (Rate Limit + Blacklist) - Lo más externo posible
	highLoadLayer := handlers.ShieldMiddleware(mux)

	// Capa 2: Circuit Breaker - Detiene peticiones si el sistema falla
	systemHealthLayer := handlers.CircuitBreakerMiddleware(highLoadLayer)

	// Capa 3: Cabeceras de Seguridad
	securityLayer := handlers.SecurityHeadersMiddleware(systemHealthLayer)

	// CAPA 4: Configuración CORS Profesional
	// NOTA: En producción, sustituye "*" por tu dominio real de Vercel
	// En el .env, ALLOWED_ORIGINS debe ser "https://tu-app.vercel.app"
	// Cargamos orígenes permitidos desde el ENV (ej: https://app.vercel.app,https://admin.com)
	// 1. Obtener la variable de entorno
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")

	// 2. Si por alguna razón la variable está vacía, poner un fallback de seguridad
	if allowedOrigins == "" {
		allowedOrigins = "https://gestion-congregacion.vercel.app"
	}

	originsList := strings.Split(allowedOrigins, ",")

	finalHandler := cors.New(cors.Options{
		AllowedOrigins:   originsList,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type", "Accept", "X-Requested-With"},
		AllowCredentials: true,
		MaxAge:           86400,
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
