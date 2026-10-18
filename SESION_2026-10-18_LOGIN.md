# SESIÓN 2026-10-18 – Login y seguridad (Gestión Local Premium 2026)

> Subí este archivo al inicio de la próxima conversación, junto con `PROJECT_CONTEXT.md`.
> Sirve para retomar sin volver a explicar nada.

## 1. Estado actual

- El login **funciona en `npm run dev` y en la app de Vercel** tras los parches de abajo.
- Antes fallaba en un entorno cuando el otro estaba en uso, y se destrabó con el tiempo o al cerrar VS Code.
- **Causa probable (no confirmada):** agotamiento de conexiones al pooler de Supabase, más el circuit breaker (503 por 30 s) y un mensaje genérico en pantalla que mostraba "contraseña incorrecta" ante cualquier error. No se corrió la consulta `pg_stat_activity` para confirmarlo.

## 2. Cambios aplicados

| Archivo | Cambio |
|---|---|
| `backend/main.go` | Logger de GORM en nivel Error (sin valores), `PreferSimpleProtocol: true`, pool: 2 inactivas, 5 abiertas, vida 30 min, inactividad 1 min |
| `backend/internal/repository/repository.go` | Import `log` y registro del error de DB en `GetUserForLogin` (2 lugares) antes de `monitor.TripCircuit()` |
| `frontend/src/pages/LoginPage.jsx` | Mensajes distintos según estado HTTP (401, 403/429, 503, red) y reinicio del token de Turnstile en `finally` |
| `backend/internal/service/service.go` | `Authenticate` usa un contexto con timeout de 2 s para Redis |

**No aplicado todavía:** en `LoginPage.jsx`, cargar Turnstile con `?render=explicit` y dejar el div como `<div className="cf-turnstile"></div>` (hoy se renderiza dos veces).

## 3. Archivos ya revisados

`_clinerules`, `REPORTS_HISTORY.md`, `DATABASE_DICTIONARY.md`, `PROJECT_CONTEXT.md`, `SCHEMA.sql`, `vercel.json`, `vite.config.js`, `main.go`, `routes.go`, `handlers.go`, `middlewares.go`, `security_shield.go`, `circuit_breaker.go`, `breaker.go`, `service.go`, `token.go`, `repository.go`, `LoginPage.jsx`.

**Aún no compartidos:** `AppContext.jsx`, `models/usuario.go`, el resto del frontend, `ws`, `docs` (Swagger).

## 4. Pendientes, por prioridad

1. **Urgente:** `/api/reset-password` es público y no exige haber verificado un PIN. El PIN no está atado a ninguna cuenta, se envía al email que manda el cliente y `InvalidateOldPines` invalida los PIN de todos. Si hay usuarios reales, no dejarlo mucho tiempo así. Parche provisional: comentar esa ruta en `routes.go` hasta rehacer el flujo.
2. **Autorización:** `/api/suspender-cuenta`, `/api/broadcast-seguridad` y `/api/save-seguridad-info` solo exigen estar logueado, sin chequeo de admin ni de congregación. El texto del broadcast entra sin sanitizar en un email masivo.
3. **Verificar (1 minuto):** que `models.Usuario` tenga `json:"-"` en `PasswordHash`. En F12 → Network, la respuesta de `login-final` no debe incluir el hash.
4. **Supabase:** activar RLS en las tablas públicas (el frontend usa la clave anónima).
5. **Entornos:** separar base de datos, Redis y claves de Turnstile entre local y producción.
6. **Otros hallazgos menores:** token con `sub` vacío para personas que no están en `core_usuarios`; `clave_temporal` en la base; dos sistemas de contraseña (Supabase Auth y `password_hash` propio); Swagger público; IP tomada de cabeceras falsificables; el bloqueo de Redis se escribe pero nunca se lee; WebSocket vía rewrites de Vercel probablemente no funciona.
7. **Rediseño del login** (ver sección 5).

## 5. Requisitos del login futuro (decididos por el dueño)

- **No negociable:** si el usuario no existe previamente en la base de datos, no puede entrar. Los ancianos de cada congregación lo dan de alta primero.
- Hoy se identifica por código de usuario, número de congregación o teléfono, y luego un PIN por email habilita cambiar usuario y contraseña.
- Se quiere bloqueo tras intentos fallidos. Propuesta: temporal (15 min tras 5 fallos, captcha desde el 3.º) con desbloqueo por admin.
- Los usuarios no tienen email cargado: lo ingresan en el primer acceso.
- El dueño es superadmin y también usuario: ve todo menos las contraseñas (hasheadas).
- Propuesta de diseño: alta previa + código de activación aleatorio de un solo uso (con vencimiento) → la persona elige usuario y clave y verifica su email con un PIN → login con usuario y clave → recuperación por PIN al email registrado (el servidor lo busca), atado a la cuenta, con máximo de intentos y token de reseteo de un solo uso.
- Decisión pendiente: usar solo Supabase Auth o solo el login propio en Go.

## 6. Cómo trabajar (preferencias del dueño)

- Cambios en formato: **archivo → ubicación → código actual exacto → código nuevo**, un paso a la vez, con respaldo en Git antes.
- Nivel de programación del dueño: intermedio. Explicar con cuidado y evitar romper cosas.
- Nunca pegar claves ni valores reales del `.env`; solo nombres de variables.
- Una conversación por tarea.

## 7. Cómo empezar la próxima conversación

1. Subí este archivo y `PROJECT_CONTEXT.md`.
2. Decí qué tarea querés hacer (por ejemplo: "arreglar el flujo de recuperación de contraseña").
3. Subí **solo** los archivos que esa tarea necesita.
