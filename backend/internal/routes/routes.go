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

	// protegida = sesión válida (AuthMiddleware) + actor leído de la base (ActorMiddleware)
	protegida := func(h http.Handler) http.Handler {
		return handlers.AuthMiddleware(handlers.ActorMiddleware(svc)(h))
	}

	// --- DOCUMENTACIÓN Y TIEMPO REAL ---
	mux.Handle("/swagger/", httpSwagger.WrapHandler)
	mux.HandleFunc("/ws", ws.WsHandler)

	// --- RUTAS PÚBLICAS ---
	mux.HandleFunc("/api/publicaciones", handlers.GetPublicaciones(svc))
	mux.HandleFunc("/api/login-final", handlers.LoginFinalHandler(svc))

	// Recuperación de cuenta CERRADA (2026-10-21) hasta rehacer el login:
	// estas rutas filtraban emails, mandaban correos sin límite y el PIN no
	// estaba atado a ninguna cuenta. Se reabren con el flujo nuevo.
	rutaCerrada := func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Función temporalmente deshabilitada", http.StatusServiceUnavailable)
	}
	mux.HandleFunc("/api/request-pin", rutaCerrada)
	mux.HandleFunc("/api/verify-pin", rutaCerrada)
	mux.HandleFunc("/api/recover-user-id", rutaCerrada)
	mux.HandleFunc("/api/send-username-real", rutaCerrada)
	mux.HandleFunc("/api/identify-user", rutaCerrada)

	mux.HandleFunc("/api/seguridad-info", handlers.GetSeguridadInfoHandler(svc))

	// CAMBIO DE CONTRASEÑA (2026-10-20): exige sesión y la contraseña actual; la persona
	// sale del token. El nombre de la ruta se mantiene porque el frontend la usa.
	// "Olvidé mi contraseña" sigue SIN ruta hasta rehacer ese flujo.
	mux.Handle("POST /api/reset-password", protegida(http.HandlerFunc(handlers.ChangePasswordHandler(svc))))

	// --- RUTAS PROTEGIDAS (Middleware Aplicado) ---
	// Perfil
	mux.Handle("/api/update-profile", protegida(http.HandlerFunc(handlers.UpdateProfileDataHandler(svc))))
	mux.Handle("/api/upload-foto", protegida(http.HandlerFunc(handlers.UploadFotoHandler(svc))))
	mux.Handle("/api/suspender-cuenta", protegida(http.HandlerFunc(handlers.SuspenderCuentaHandler(svc))))

	// Personas de mi congregación (2026-10-24): coordinador, secretario, servicio o superadmin
	mux.Handle("GET /api/personas", protegida(http.HandlerFunc(handlers.ListPersonasHandler(svc))))

	// Módulo de personas (2026-11-01), lectura: encargados generales y superadmin.
	mux.Handle("GET /api/personas/buscar", protegida(http.HandlerFunc(handlers.BuscarPersonasHandler(svc))))
	mux.Handle("GET /api/personas/conteos", protegida(http.HandlerFunc(handlers.ConteosPersonasHandler(svc))))
	mux.Handle("GET /api/personas/ficha", protegida(http.HandlerFunc(handlers.FichaPersonaHandler(svc))))
	mux.Handle("GET /api/personas/historial", protegida(http.HandlerFunc(handlers.HistorialPersonaHandler(svc))))
	// Módulo de personas (2026-11-01), escritura: encargados generales y superadmin.
	mux.Handle("POST /api/personas/crear", protegida(http.HandlerFunc(handlers.CrearPersonaHandler(svc))))
	mux.Handle("POST /api/personas/editar", protegida(http.HandlerFunc(handlers.EditarPersonaHandler(svc))))
	mux.Handle("POST /api/personas/situacion", protegida(http.HandlerFunc(handlers.CambiarSituacionPersonaHandler(svc))))
	mux.Handle("POST /api/personas/situaciones/fechas", protegida(http.HandlerFunc(handlers.ModificarFechasSituacionHandler(svc))))
	// Rol de la aplicación (2026-11-01): solo superadmin asigna coordinador, secretario y servicio.
	mux.Handle("POST /api/admin/personas/rol", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.CambiarRolPersonaHandler(svc)))))
	// Rotación de roles (2026-11-03): los tres encargados, solo en su congregación.
	mux.Handle("POST /api/personas/roles/rotar", protegida(http.HandlerFunc(handlers.RotarRolesPersonasHandler(svc))))
	mux.Handle("POST /api/personas/roles/fechas", protegida(http.HandlerFunc(handlers.ModificarFechasRolHandler(svc))))
	// Bajas, reactivación y motivos de baja (2026-11-06).
	mux.Handle("POST /api/personas/baja", protegida(http.HandlerFunc(handlers.DarDeBajaPersonaHandler(svc))))
	mux.Handle("POST /api/personas/reactivar", protegida(http.HandlerFunc(handlers.ReactivarPersonaHandler(svc))))
	mux.Handle("GET /api/personas/motivos-baja", protegida(http.HandlerFunc(handlers.ListMotivosBajaHandler(svc))))
	mux.Handle("GET /api/admin/personas/motivos-baja", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.ListMotivosBajaAdminHandler(svc)))))
	mux.Handle("POST /api/admin/personas/motivos-baja/crear", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.CrearMotivoBajaHandler(svc)))))
	mux.Handle("POST /api/admin/personas/motivos-baja/editar", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.EditarMotivoBajaHandler(svc)))))
	// Lo propio de cada persona: solo su ficha y sus historiales.
	mux.Handle("GET /api/me/ficha", protegida(http.HandlerFunc(handlers.MiFichaHandler(svc))))
	mux.Handle("GET /api/me/historial", protegida(http.HandlerFunc(handlers.MiHistorialHandler(svc))))

	// Módulos y encargados (2026-10-24): ver los míos; asignar y quitar solo encargados generales o superadmin
	mux.Handle("GET /api/me", protegida(http.HandlerFunc(handlers.MeHandler())))
	mux.Handle("GET /api/mis-modulos", protegida(http.HandlerFunc(handlers.MisModulosHandler(svc))))
	mux.Handle("GET /api/modulos/asignaciones", protegida(http.HandlerFunc(handlers.ListAsignacionesHandler(svc))))
	mux.Handle("POST /api/modulos/asignar", protegida(http.HandlerFunc(handlers.AsignarPuestoHandler(svc))))
	mux.Handle("GET /api/modulos/historial", protegida(http.HandlerFunc(handlers.ListHistorialPuestosHandler(svc))))
	mux.Handle("POST /api/modulos/quitar", protegida(http.HandlerFunc(handlers.QuitarPuestoHandler(svc))))
	mux.Handle("POST /api/modulos/historial/fechas", protegida(http.HandlerFunc(handlers.ModificarFechasPuestoHandler(svc))))
	mux.Handle("GET /api/modulos/motivos", protegida(http.HandlerFunc(handlers.ListMotivosHandler(svc))))

	// Administración de módulos (2026-10-25): solo superadmins.
	mux.Handle("GET /api/admin/modulos", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.ListModulosAdminHandler(svc)))))
	mux.Handle("POST /api/admin/modulos/crear", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.CrearModuloHandler(svc)))))
	mux.Handle("POST /api/admin/modulos/editar", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.EditarModuloHandler(svc)))))
	mux.Handle("POST /api/admin/modulos/eliminar", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.EliminarModuloHandler(svc)))))
	// Motivos de puestos (2026-10-29): solo superadmins gestionan el catálogo.
	mux.Handle("GET /api/admin/motivos", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.ListMotivosAdminHandler(svc)))))
	mux.Handle("POST /api/admin/motivos/crear", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.CrearMotivoHandler(svc)))))
	mux.Handle("POST /api/admin/motivos/editar", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.EditarMotivoHandler(svc)))))

	// Congregaciones (2026-10-30): solo superadmins.
	mux.Handle("GET /api/admin/congregaciones", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.ListCongregacionesAdminHandler(svc)))))
	mux.Handle("POST /api/admin/congregaciones/crear", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.CrearCongregacionHandler(svc)))))
	mux.Handle("POST /api/admin/congregaciones/editar", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.EditarCongregacionHandler(svc)))))
	mux.Handle("POST /api/admin/congregaciones/estado", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.EstadoCongregacionHandler(svc)))))
	mux.Handle("POST /api/admin/congregaciones/eliminar", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.EliminarCongregacionHandler(svc)))))
	mux.Handle("GET /api/admin/congregaciones/historial", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.ListHistorialCongregacionesHandler(svc)))))

	mux.HandleFunc("/api/logout", handlers.LogoutHandler)

	// Administración de Seguridad (2026-10-21): solo superadmins.
	// Orden: primero AuthMiddleware (valida sesión), después SuperAdminMiddleware.
	mux.Handle("/api/broadcast-seguridad", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.BroadcastSeguridadUpdateHandler(svc)))))
	mux.Handle("/api/save-seguridad-info", protegida(handlers.SuperAdminMiddleware(http.HandlerFunc(handlers.SaveSeguridadInfoHandler(svc)))))

	// Utilitarios
	mux.HandleFunc("/api/upload-backend", handlers.HandleFileUpload(svc))
	mux.HandleFunc("POST /api/refresh", handlers.RefreshTokenHandler(svc))
}
