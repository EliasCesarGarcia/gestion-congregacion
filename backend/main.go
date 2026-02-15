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
	// Intentamos cargar el .env (solo fallará en producción, lo cual es normal)
	err := godotenv.Load()
	if err != nil {
		log.Println("Aviso: No se pudo encontrar el archivo .env (Ignorar si estás en Render)")
	}

	// 1. Construimos la cadena de conexión (Usamos el puerto 6543 del Pooler)
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=require&prepare_threshold=0",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"))

	// 2. Conexión a la base de datos
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})

	if err != nil {
		log.Fatal("❌ Error al conectar a la base de datos:", err)
	}

	// --- NUEVO: CONFIGURACIÓN DE POOL DE CONEXIONES ---
	// Esto evita el error de "Max client connections reached"
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(2)    // Máximo de conexiones inactivas
		sqlDB.SetMaxOpenConns(3)    // Máximo de conexiones abiertas totales
		sqlDB.SetConnMaxLifetime(0) // Las conexiones no expiran por tiempo
	}
	// --------------------------------------------------

	fmt.Println("✅ ¡Conexión exitosa a Supabase!")

	// 3. Registro de Rutas
	mux := http.NewServeMux()

	// Ruta de salud mejorada para que Render sepa que despertamos rápido
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	mux.HandleFunc("/api/publicaciones", handlers.GetPublicaciones(db))
	mux.HandleFunc("/api/login-final", handlers.LoginFinalHandler(db))
	mux.HandleFunc("/api/identify-user", handlers.IdentifyUserHandler(db))
	mux.HandleFunc("/api/request-pin", handlers.RequestPinHandler(db))
	mux.HandleFunc("/api/verify-pin", handlers.VerifyPinHandler(db))
	mux.HandleFunc("/api/reset-password", handlers.ResetPasswordHandler(db))
	mux.HandleFunc("/api/recover-user-id", handlers.RecoverByPersonaIDHandler(db))
	mux.HandleFunc("/api/send-username-real", handlers.SendUsernameRealHandler(db))
	mux.HandleFunc("/api/update-profile", handlers.UpdateProfileDataHandler(db))
	mux.HandleFunc("/api/upload-foto", handlers.UploadFotoHandler(db))
	mux.HandleFunc("/api/seguridad-info", handlers.GetSeguridadInfoHandler(db))
	mux.HandleFunc("/api/save-seguridad-info", handlers.SaveSeguridadInfoHandler(db))
	mux.HandleFunc("/api/suspender-cuenta", handlers.SuspenderCuentaHandler(db))
	mux.HandleFunc("/api/broadcast-seguridad", handlers.BroadcastSeguridadUpdateHandler(db))

	// 4. Configuración de CORS
	handler := cors.AllowAll().Handler(mux)

	// 5. Configuración del puerto para Render
	puerto := os.Getenv("PORT")
	if puerto == "" {
		puerto = "8080"
	}

	fmt.Println("🚀 Servidor Backend corriendo en el puerto: " + puerto)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+puerto, handler))
}
