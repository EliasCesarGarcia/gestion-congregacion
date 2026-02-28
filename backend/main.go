/**
 * ARCHIVO: main.go
 * UBICACIÓN: Backend/cmd/server/main.go
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

	"gestion-congregacion/backend/internal/handlers"
	"gestion-congregacion/backend/internal/ws"

	_ "gestion-congregacion/backend/docs" // <--- EL GUION BAJO (_) ES VITAL AQUÍ

	httpSwagger "github.com/swaggo/http-swagger"

	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// @title API de Gestión Local Teocrática
// @version 1.0
// @description Servidor de alto rendimiento para la gestión de congregaciones.
// @host localhost:8080
// @BasePath /
func main() {
	// Intentamos cargar el .env
	err := godotenv.Load()
	if err != nil {
		log.Println("Aviso: No se pudo encontrar el archivo .env (Ignorar si estás en Render)")
	}

	// 1. Configuración de la base de datos
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=require&prepare_threshold=0",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"))

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{PrepareStmt: false})
	if err != nil {
		log.Fatal("❌ Error al conectar a la base de datos:", err)
	}

	// Optimización de pool de conexiones
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetMaxOpenConns(10)
		sqlDB.SetConnMaxLifetime(0)
	}

	fmt.Println("✅ ¡Conexión exitosa a Supabase!")

	// 2. Registro de Rutas
	mux := http.NewServeMux()

	// Ruta de salud
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// --- RUTAS PÚBLICAS ---
	mux.HandleFunc("/api/publicaciones", handlers.GetPublicaciones(db))
	mux.HandleFunc("/api/login-final", handlers.LoginFinalHandler(db))
	mux.HandleFunc("/api/identify-user", handlers.IdentifyUserHandler(db))
	mux.HandleFunc("/api/request-pin", handlers.RequestPinHandler(db))
	mux.HandleFunc("/api/verify-pin", handlers.VerifyPinHandler(db))
	mux.HandleFunc("/api/recover-user-id", handlers.RecoverByPersonaIDHandler(db))
	mux.HandleFunc("/api/send-username-real", handlers.SendUsernameRealHandler(db))
	mux.HandleFunc("/api/seguridad-info", handlers.GetSeguridadInfoHandler(db))

	// WebSocket (Público para la conexión inicial)
	mux.HandleFunc("/ws", ws.WsHandler)

	// DOCUMENTACIÓN (Swagger)
	mux.Handle("/swagger/", httpSwagger.WrapHandler)

	// --- RUTAS PROTEGIDAS (Requieren Token JWT) ---
	// Usamos AuthMiddleware para envolver la lógica de los handlers
	mux.Handle("/api/update-profile", handlers.AuthMiddleware(http.HandlerFunc(handlers.UpdateProfileDataHandler(db))))
	mux.Handle("/api/broadcast-seguridad", handlers.AuthMiddleware(http.HandlerFunc(handlers.BroadcastSeguridadUpdateHandler(db))))
	mux.Handle("/api/upload-foto", handlers.AuthMiddleware(http.HandlerFunc(handlers.UploadFotoHandler(db))))
	mux.Handle("/api/suspender-cuenta", handlers.AuthMiddleware(http.HandlerFunc(handlers.SuspenderCuentaHandler(db))))
	mux.Handle("/api/save-seguridad-info", handlers.AuthMiddleware(http.HandlerFunc(handlers.SaveSeguridadInfoHandler(db))))

	// Ruta para pruebas de subida al backend
	mux.HandleFunc("/api/upload-backend", handlers.HandleFileUpload)

	// 3. Middlewares Globales (CORS + Headers SEO)
	applyGlobalHeaders := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Vary", "Accept-Encoding")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			next.ServeHTTP(w, r)
		})
	}

	handler := cors.AllowAll().Handler(applyGlobalHeaders(mux))

	// 4. Inicio del Servidor
	puerto := os.Getenv("PORT")
	if puerto == "" {
		puerto = "8080"
	}

	fmt.Println("🚀 Servidor Backend corriendo en el puerto: " + puerto)
	fmt.Println("📖 Documentación Swagger en: http://localhost:" + puerto + "/swagger/index.html")
	log.Fatal(http.ListenAndServe("0.0.0.0:"+puerto, handler))
}
