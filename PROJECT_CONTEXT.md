# INFORME DE CONTEXTO - GESTIÓN LOCAL PREMIUM 2026

*   **ARCHIVO:** `PROJECT_CONTEXT.md`
*   **UBICACIÓN:** Carpeta Raíz (`/`)
*   **PROPÓSITO:** Documentación técnica estratégica que define la visión, arquitectura, reglas de negocio e infraestructura del ecosistema "Gestión Local Premium 2026". Actúa como la fuente de verdad para el alineamiento de ingenieros y el entrenamiento de IAs de desarrollo.

---

## 1. Visión General
Este proyecto es un ecosistema administrativo avanzado diseñado para la gestión integral de congregaciones. Se fundamenta en tres pilares:
1.  **Rendimiento:** Carga instantánea y animaciones fluidas (60 FPS).
2.  **Seguridad:** Blindaje de datos mediante JWT y validación MFA (Multi-Factor Authentication).
3.  **Inclusión Global:** Experiencia nativa para 56+ idiomas, con soporte automático para lectura de derecha a izquierda (RTL).

## 2. Arquitectura de Software (Evolucionada)
El sistema utiliza una arquitectura de capas desacopladas para garantizar el crecimiento sin deuda técnica:

### Backend (Capa de Lógica y Persistencia)
*   **Tecnología:** Go 1.23.
*   **Características:** Servidor RESTful unificado, uso de GORM para PostgreSQL y middleware de seguridad JWT.
*   **Documentación:** Swagger integrado para pruebas de endpoints.

### Frontend (Capa de Presentación y Estado)
*   **Tecnología:** React 19 + Vite + Tailwind CSS v4.
*   **Gestión de Estado:** Context API optimizada para reducir re-renders.
*   **Internacionalización:** `i18next` con detección dinámica de dirección (`dir="rtl/ltr"`) y lenguaje.
*   **Arquitectura de UI:** Implementación de **React Portals** para componentes flotantes (Modales) y **Hooks Personalizados** para lógica de animación.

## 3. Infraestructura de Red y Despliegue
*   **Orquestación:** El archivo `vercel.json` actúa como Proxy Maestro, redirigiendo el tráfico de `/api` al backend (Render) para eliminar colisiones de CORS.
*   **Hosting:** Frontend en Vercel (Edge computing) y Backend en Render.

## 4. Estructura de Carpetas (Estado: ÉLITE)
*   `/` (Raíz): Archivos de configuración de sistema (`vercel.json`, `REPORTS_HISTORY.md`).
*   `/backend`: Núcleo de servicios en Go.
*   `/frontend/src`:
    *   `/config`: **Matriz de Temas (`themeConfig.js`)**. ADN visual (colores e imágenes) separado de la lógica.
    *   `/context`: **Estado Global (`AppContext.jsx`)**. Solo gestiona Usuario y Preferencias (Limpio).
    *   `/hooks`: **Motores de UI (`useParallax.js`)**. Lógica de alto rendimiento extraída.
    *   `/components`: Componentes atómicos e inteligentes (Navbar, Footer, Modal).
    *   `/pages`: Vistas de usuario final con metadatos SEO.

## 5. Reglas de Negocio Críticas (Estándar 2026)
1.  **Identidad Centralizada:** Todo registro debe colgar de un ID en `core_personas`.
2.  **UX Adaptativa:** La interfaz debe mutar estéticamente según el horario local y el tema elegido, inyectando variables CSS dinámicas.
3.  **Soporte RTL Nativo:** Se prohíbe el uso de propiedades físicas (`ml-`, `pr-`, `text-left`). Es obligatorio usar **Propiedades Lógicas** (`ms-`, `pe-`, `text-start`) para compatibilidad total con Árabe y Hebreo.
4.  **SEO & Accesibilidad:** Cada página debe incluir un componente `<Helmet>` con etiquetas `lang` dinámicas y metadatos ARIA para cumplimiento de estándares internacionales.
5.  **Seguridad de Archivos:** No se procesan imágenes sin validación previa de tipo MIME y tamaño máximo (5MB) en el cliente.

## 6. Configuración de Base de Datos
*   **Motor:** PostgreSQL (Supabase).
*   **Conectividad:** Pooler de conexiones activado para alta disponibilidad.
*   **Esquema:** Documentado detalladamente en `SCHEMA.sql` y `DATABASE_DICTIONARY.md`.

---
*Última actualización de contexto: 2026-06-15 - Arquitectura Refactorizada.*