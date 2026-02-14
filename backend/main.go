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

	// 1. Construimos la cadena de conexión en formato URI (Más robusta para la nube)
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=require",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"))

	// 2. Conexión a la base de datos (Una sola vez)
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // Importante para Supabase Pooler
	}), &gorm.Config{})

	if err != nil {
		log.Fatal("❌ Error al conectar a la base de datos:", err)
	}

	fmt.Println("✅ ¡Conexión exitosa a Supabase!")

	// 3. Registro de Rutas
	mux := http.NewServeMux()

	// Ruta de prueba para confirmar que el backend está vivo
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("🚀 Backend de Gestión Teocrática funcionando correctamente"))
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