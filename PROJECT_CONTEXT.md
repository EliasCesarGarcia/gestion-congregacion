# Informe General del Proyecto: GESTIÓN LOCAL PREMIUM 2026

## 1. Visión General
Este proyecto es un ecosistema administrativo avanzado para congregaciones. Está diseñado bajo estándares de alto rendimiento, seguridad de grado bancario (JWT + PIN) y una experiencia de usuario adaptativa basada en el horario local del usuario.

## 2. Arquitectura de Software
El sistema utiliza una arquitectura desacoplada:
- **Backend:** Go 1.23. Servidor RESTful unificado, WebSockets para notificaciones push y GORM para persistencia.
- **Frontend:** React 19 + Vite. UI construida con Tailwind CSS v4, Framer Motion para animaciones y `i18next` para soporte de 58 idiomas.
- **Base de Datos:** PostgreSQL alojado en Supabase.
- **Seguridad:** Autenticación vía JWT con "MFA Lite" (Validación de identidad por PIN de 6 dígitos enviado por email).

## 3. Infraestructura de Red y Despliegue (CEO 2026)
- **Frontend (Vercel):** Gestiona el renderizado de la UI y los activos estáticos.
- **Backend (Render):** Procesa la lógica de negocio y las conexiones a la base de datos.
- **Proxy Orquestador:** El archivo `vercel.json` en la raíz actúa como puente para redirigir las peticiones `/api` al backend de Render, eliminando problemas de CORS.

## 4. Estructura de Carpetas (Estado: OPTIMIZADO)
- `/` (Raíz): Archivos de configuración maestra (`vercel.json`, `.clinerules`, `SCHEMA.sql`, `DATABASE_DICTIONARY.md`).
- `/backend`:
    - `main.go`: **Punto de entrada único** del servidor (incluye rutas, middleware y Swagger).
    - `/internal/auth`: Lógica de generación y validación de tokens JWT.
    - `/internal/handlers`: Controladores de lógica de negocio (Autenticación, Publicaciones, Perfil).
    - `/internal/models`: Definición de estructuras GORM y JSON.
    - `/internal/ws`: Gestión de conexiones WebSocket (Hub).
    - `/docs`: Documentación interactiva de la API (Swagger).
- `/frontend`:
    - `/src/context/AppContext.jsx`: Cerebro del frontend (gestiona sesiones y temas dinámicos).
    - `/src/pages`: Vistas principales (Dashboard, Perfil, Publicaciones, Seguridad).
    - `/public`: Activos públicos (Avatars .webp, Temas visuales y archivos de traducción).

## 5. Reglas de Negocio Críticas
1. **Identidad:** La tabla `core_personas` es el eje central. Todo registro (pedidos, entregas, usuarios) debe estar vinculado a un ID de persona.
2. **Interfaz Adaptativa:** El sistema lee la `zona_horaria` de la congregación para aplicar temas de Mañana, Tarde o Noche.
3. **Optimización de Medios:** No se permiten imágenes en formatos pesados. Todo nuevo recurso visual debe ser `.webp` con `loading="lazy"`.
4. **SEO:** Se utiliza `react-helmet-async` para asegurar que cada página tenga metadatos únicos para indexación por IAs y buscadores.

## 6. Configuración de Base de Datos
- **Pooler:** Se utiliza el puerto 6543 de Supabase con `PrepareStmt: false` para evitar errores de conexión persistente.
- **Esquema:** Documentado detalladamente en `SCHEMA.sql` y `DATABASE_DICTIONARY.md`.