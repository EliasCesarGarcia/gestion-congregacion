/**
 * ARCHIVO: routes.go
 * UBICACIÓN: backend/internal/routes/routes.go
 * DESCRIPCIÓN: Registro centralizado de endpoints.
 * Conecta las URLs con sus respectivos Handlers.
 */

package routes

import (
	"gestion-congregacion/backend/internal/handlers"
	"gestion-congregacion/backend/internal/service"
	"net/http"

	_ "gestion-congregacion/backend/docs"
	"gestion-congregacion/backend/internal/ws"

	httpSwagger "github.com/swaggo/http-swagger"
)

// RegisterRoutes organiza todos los puntos de entrada de la API
func RegisterRoutes(mux *http.ServeMux, svc *service.Service) {

	// --- DOCUMENTACIÓN Y TIEMPO REAL ---
	mux.Handle("/swagger/", httpSwagger.WrapHandler)
	mux.HandleFunc("/ws", ws.WsHandler)

	// --- RUTAS PÚBLICAS ---
	mux.HandleFunc("/api/publicaciones", handlers.GetPublicaciones(svc))
	mux.HandleFunc("/api/login-final", handlers.LoginFinalHandler(svc))
	mux.HandleFunc("/api/identify-user", handlers.IdentifyUserHandler(svc))
	mux.HandleFunc("/api/request-pin", handlers.RequestPinHandler(svc))
	mux.HandleFunc("/api/verify-pin", handlers.VerifyPinHandler(svc))
	mux.HandleFunc("/api/recover-user-id", handlers.RecoverByPersonaIDHandler(svc))
	mux.HandleFunc("/api/send-username-real", handlers.SendUsernameRealHandler(svc))
	mux.HandleFunc("/api/seguridad-info", handlers.GetSeguridadInfoHandler(svc))

	// CAMBIO DE CONTRASEÑA (2026-10-20): exige sesión y la contraseña actual; la persona
	// sale del token. El nombre de la ruta se mantiene porque el frontend la usa.
	// "Olvidé mi contraseña" sigue SIN ruta hasta rehacer ese flujo.
	mux.Handle("POST /api/reset-password", handlers.AuthMiddleware(http.HandlerFunc(handlers.ChangePasswordHandler(svc))))

	// --- RUTAS PROTEGIDAS (Middleware Aplicado) ---
	// Perfil
	mux.Handle("/api/update-profile", handlers.AuthMiddleware(http.HandlerFunc(handlers.UpdateProfileDataHandler(svc))))
	mux.Handle("/api/upload-foto", handlers.AuthMiddleware(http.HandlerFunc(handlers.UploadFotoHandler(svc))))
	mux.Handle("/api/suspender-cuenta", handlers.AuthMiddleware(http.HandlerFunc(handlers.SuspenderCuentaHandler(svc))))

	mux.HandleFunc("/api/logout", handlers.LogoutHandler)

		// Administración de Seguridad (2026-10-21): solo superadmins.
	// Orden: primero AuthMiddleware (valida sesión), después SuperAdminMiddleware.
	mux.Handle("/api/broadcast-seguridad", handlers.AuthMiddleware(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.BroadcastSeguridadUpdateHandler(svc)))))
	mux.Handle("/api/save-seguridad-info", handlers.AuthMiddleware(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.SaveSeguridadInfoHandler(svc)))))

	// Utilitarios
	mux.HandleFunc("/api/upload-backend", handlers.HandleFileUpload(svc))
	mux.HandleFunc("POST /api/refresh", handlers.RefreshTokenHandler(svc))
}
