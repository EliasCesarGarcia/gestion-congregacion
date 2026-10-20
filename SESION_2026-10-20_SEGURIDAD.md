# SESIÓN 2026-10-20 – Seguridad: reset-password y persona dentro del token (Gestión Local Premium 2026)

> Subí este archivo al inicio de la próxima conversación, junto con `PROJECT_CONTEXT.md` y `SESION_2026-10-18_LOGIN.md`.
> Sirve para retomar sin volver a explicar nada. Continúa el trabajo del archivo del 2026-10-18.

## 1. Estado actual

- El login funciona (probado después de los cambios de esta sesión). Los tokens viejos dejaron de servir a propósito: cada usuario tuvo que volver a iniciar sesión una vez.
- `/api/reset-password` está **desactivado**: respondió `404 page not found` desde el propio servidor Go, probado directo contra Render.
- **Roto a propósito, hasta el paso 2c:** "Modificar contraseña" en `ProfilePage.jsx`, porque esa pantalla llama a `/api/reset-password`. La pantalla "olvidé mi contraseña" también falla hasta rehacer el flujo.
- Direcciones: backend en `https://gestion-teocratica-backend.onrender.com`, app en `https://gestion-congregacion.vercel.app`.
- **Probar siempre directo contra Render.** En el dominio de Vercel, `/api/...` (incluso `/api/publicaciones`) responde `404 NOT_FOUND` de Vercel y no llega al backend. Sin explicar todavía (ver pendiente 8).

## 2. Cambios aplicados en esta sesión

| Archivo | Cambio |
|---|---|
| `backend/internal/routes/routes.go` | Línea de `/api/reset-password` comentada |
| `backend/internal/auth/token.go` | Archivo reemplazado. `GenerarAccessToken(usuarioID, personaID)` y `GenerarRefreshToken(usuarioID, personaID)`. Los tokens llevan los campos `pid` (persona) y `typ` (`access` o `refresh`). `ValidarJWT` solo acepta HS256 |
| `backend/internal/service/service.go` | `Authenticate` calcula `personaID` desde `u.PersonaID` (error si es 0) y se lo pasa a los dos generadores |
| `backend/internal/handlers/handlers.go` | `RefreshTokenHandler` exige `typ == "refresh"` y `pid`, usa la firma nueva y maneja el error al generar el token |
| `backend/internal/handlers/middlewares.go` | `AuthMiddleware` exige `typ == "access"` y `pid`, y guarda la persona en el contexto. Nueva función `PersonaIDFromContext(r)` en el paquete `handlers` |

**Regla nueva para todo handler protegido:** la persona sale de `handlers.PersonaIDFromContext(r)`. Nunca se usa el `persona_id` ni el `usuario_id` que manda el cliente.

Pruebas hechas: `go build ./...`, login nuevo y cambio de avatar (pasa por `AuthMiddleware`) funcionaron.

## 3. Verificación de los videos de seguridad (resumen)

**Punto 1 – Rate limit / DDoS**
- `ShieldMiddleware` (100 por minuto por IP) envuelve todo el servidor (confirmado en `main.go`).
- Blacklist: solo funciona la copia en memoria local, que no expira y se pierde al reiniciar Render. La copia en Redis se escribe y nunca se lee.
- IP: usa `CF-Connecting-IP` (Render pone Cloudflare en su entrada, probablemente confiable) y `X-Forwarded-For` (manipulable). Si el tráfico pasa por el proxy de Vercel, puede llegar la IP de Vercel. El mismo código está duplicado en `LoginFinalHandler`.
- Modo pánico: cuenta "IPs únicas" con esa IP manipulable. Una sola máquina con cabeceras falsas puede activarlo y dejar la API caída 30 s.
- Circuit breaker y Turnstile existen. No hace falta un API Gateway para este proyecto.

**Punto 2 – Broken Authentication**
- Bcrypt bien. `PasswordHash` tiene `json:"-"` (confirmado).
- Access de 15 min y refresh de 7 días. Ahora no se pueden intercambiar. El refresh no se puede revocar, no revisa si la cuenta está suspendida y el logout solo borra cookies.
- No hay límite de intentos real: solo pide captcha desde el 3.º fallo por IP, y un captcha válido permite seguir probando. No cuenta los intentos con usuario inexistente.
- No hay doble factor (solo PIN por email), aunque `PROJECT_CONTEXT.md` habla de MFA.
- `JWT_SECRET`: `main.go` no arranca si está vacío, y está definido en Render. Falta confirmar que tenga 32 caracteres o más.

**Punto 3 – Revisar antes de lanzar**
- Endpoints abiertos: ver pendientes 1, 3 y 4.
- Paginación: hoy no hace falta (el único listado es `publicaciones`). Será obligatoria al agregar listas de personas, siempre filtradas por congregación.
- Errores crudos: `save-seguridad-info` devuelve `err.Error()` al cliente, y varios handlers ignoran errores y responden 200. Swagger es público.

## 4. Pendientes, por prioridad

1. **Paso 2b, urgente: `update-profile`, `upload-foto` y `suspender-cuenta`.** Hoy cualquier usuario logueado puede cambiar cualquier columna de cualquier persona, porque `persona_id` y `campo` vienen del cliente.
   - Usar `PersonaIDFromContext(r)` en los tres.
   - Lista blanca de `campo` en `update-profile`: `username`, `email`, `contacto` (la contraseña va por el 2c).
   - Para `username`: comprobar que no lo use otra persona, en `core_usuarios` y `core_personas`. Hoy no hay control y el frontend llama a `/api/check-username`, que no existe en `routes.go`.
   - `suspender-cuenta`: solo la propia cuenta (el frontend la usa en "eliminar cuenta"). El `usuario_id` debe buscarse en el servidor.
   - `upload-foto`: validar que `foto_url` sea `perfil_<id>.jpg` de esa persona o una ruta que empiece con `/avatars/`.
2. **Paso 2c: cambio de contraseña seguro.** Volver a registrar la ruta detrás de `AuthMiddleware`, con la persona tomada del token y verificando `current_password` con bcrypt (el frontend ya la envía). Debe validar la fuerza de la nueva clave en el servidor y responder `401` si la actual es incorrecta (el frontend muestra el mensaje `profile_error_pass` con 401). El frontend no cambia.
3. **Autorización de administración.** `broadcast-seguridad` y `save-seguridad-info` solo exigen estar logueado, sin chequeo de admin ni de congregación. El texto del broadcast entra sin sanitizar en un email masivo.
4. **Rutas públicas peligrosas.**
   - `/api/recover-user-id` devuelve el email completo de una persona.
   - `/api/request-pin` manda un correo a la dirección que envíe el cliente, sin límite (abuso de la cuenta de Resend), e invalida los PIN de todos.
   - `/api/send-username-real` envía usuario e ID por correo.
   - `/api/identify-user` confirma si un usuario existe.
   - El PIN no está atado a ninguna cuenta, y el servidor no exige PIN para `update-profile`.
5. **IP confiable, modo pánico y blacklist.** Resolver la IP de forma confiable, rehacer el modo pánico, dar expiración al blacklist y leerlo de Redis. Límite de login por cuenta y por IP (propuesta: 5 intentos en 15 min), contando también los usuarios inexistentes.
6. **Logout real y refresh revocable.** Lista de revocación en Redis y revisión del estado de la cuenta al refrescar.
7. **CSRF.** Las cookies usan `SameSite=None` y los handlers aceptan JSON sin comprobar el `Content-Type`. Evaluar `SameSite=Lax` si todo pasa por el dominio de Vercel mediante los rewrites.
8. **Vercel sin explicar.** `/api/...` en el dominio de Vercel da `NOT_FOUND`. Sospecha: el Root Directory del proyecto es `frontend` y por eso se ignora el `vercel.json` de la raíz. Falta ver si el frontend llama a `/api` o directo a `onrender.com`. El `VITE_API_URL` del `.env` de la carpeta `backend` no lo lee Vite.
9. **Otros hallazgos menores.** `clave_temporal` en la base; dos sistemas de contraseña (Supabase Auth y `password_hash` propio); Swagger público; RLS de Supabase; separar base de datos, Redis y claves de Turnstile entre local y producción; WebSocket vía rewrites de Vercel; Turnstile con `?render=explicit` (pendiente de la sesión anterior); `sub` vacío en el token para personas fuera de `core_usuarios` (la identificación ya no depende de él, pero sigue vacío).
10. **Rediseño del login.** Sin cambios: ver la sección 5 de `SESION_2026-10-18_LOGIN.md`.

## 5. Archivos revisados

Los de la sesión anterior (`_clinerules`, `REPORTS_HISTORY.md`, `DATABASE_DICTIONARY.md`, `PROJECT_CONTEXT.md`, `SCHEMA.sql`, `circuit_breaker.go`, `breaker.go`, `LoginPage.jsx`) y, en esta sesión: `vercel.json`, `vite.config.js`, `routes.go`, `handlers.go`, `security_shield.go`, `token.go`, `service.go`, `repository.go`, `models.go`, `middlewares.go`, `main.go`, `AppContext.jsx`, `ProfilePage.jsx`.

**Aún no compartidos:** `ws`, `docs` (Swagger), el resto del frontend y los nombres de variables del `.env` (nunca los valores).

## 6. Cómo trabajar (preferencias del dueño)

- Cambios en formato: **archivo → ubicación → código actual exacto → código nuevo**, un paso a la vez, con respaldo en Git antes.
- Nivel de programación del dueño: intermedio. Explicar con cuidado y evitar romper cosas.
- Nunca pegar claves ni valores reales del `.env`; solo nombres de variables.
- Una conversación por tarea.
- La terminal es **Git Bash** (MINGW64) en Windows. Los comandos `curl` van con comillas simples y **sin espacios** dentro de la dirección.
- Antes de subir cambios del backend: `go build ./...` dentro de la carpeta `backend`. Después de subir, esperar a que Render diga **Live**.
- Las pruebas de rutas se hacen directo contra Render, y quien prueba pega la primera línea de la respuesta (`HTTP/...`) y el texto final.

## 7. Cómo empezar la próxima conversación

1. Subí este archivo, `SESION_2026-10-18_LOGIN.md` y `PROJECT_CONTEXT.md`.
2. Decí la tarea. Por ejemplo: "Hacer el paso 2b: update-profile, upload-foto y suspender-cuenta con la persona del token y lista blanca de campos".
3. Subí **solo** los archivos que esa tarea necesita. Para el 2b y el 2c: `routes.go`, `handlers.go`, `middlewares.go`, `service.go`, `repository.go`, `models.go` y `ProfilePage.jsx`.
