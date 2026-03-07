# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

Guía Técnica de Referencia (Documentada)

Esta es la documentación siguiendo el formato de tus otros archivos para que sepas qué hace cada línea:

ARCHIVO: vercel.json
UBICACIÓN: /frontend/vercel.json
DESCRIPCIÓN: Archivo de configuración de despliegue. Resuelve el problema de las "Rutas SPA". En aplicaciones de React, cuando el usuario refresca la página (F5) en una ruta como /perfil, el servidor busca un archivo físico llamado perfil y, al no encontrarlo, da error 404. Este archivo redirige todas esas peticiones al index.html para que React Router tome el control.

- rewrites: Es un arreglo de reglas de reescritura de URL.
- source: "/(.*)": Es una expresión regular que significa "cualquier ruta que el usuario escriba en la barra de direcciones".
- destination: "/index.html": Le dice a Vercel: "No importa lo que el usuario pida, entrégale siempre el archivo principal de la app".

¿Por qué esto es vital para el SEO 2026?

- Métrica de Disponibilidad: Los motores de búsqueda penalizan los sitios que devuelven errores 404 accidentales. Este archivo garantiza que todas tus rutas (/configuracion, /publicaciones, etc.) sean accesibles tanto para humanos como para los bots de Google y las IAs de indexación.
- Experiencia de Usuario (UX): Evita que el usuario vea una pantalla de error del servidor si decide compartir un enlace directo a una sección específica de tu programa.


/**
 * ARCHIVO: vercel.json
 * UBICACIÓN: / (Carpeta raíz del proyecto GESTION-CONGREGACION)
 * DESCRIPCIÓN: Configuración de orquestación de red para Vercel. 
 * Actúa como un "Traffic Manager" (Gestor de Tráfico) que decide qué hacer 
 * con cada petición que llega al dominio. Es el puente final que conecta 
 * el Frontend (React) con el Backend (Go) y los activos de SEO.
 * 
 * FUNCIONALIDADES CLAVE:
 * - Proxy de API: Redirige peticiones al servidor de Render (Backend Go).
 * - Protección de SEO: Asegura que los motores de búsqueda lean sitemaps y robots.
 * - Soporte SPA: Evita errores 404 al recargar rutas de React Router.
 */

1. "version": 2
   - Indica el uso de la arquitectura más moderna de Vercel (Serverless Functions 2.0).

2. "rewrites": [ ... ]
   - Define reglas de reescritura de URL. A diferencia de un "Redirect", 
     el navegador no cambia la dirección en la barra, lo que mantiene una 
     experiencia de usuario limpia (SEO 2026: Estabilidad de URL).

   A. { "source": "/api/(.*)", "destination": "https://.../api/$1" }
      - PROXY CRÍTICO: Cuando React pide algo a "/api/usuarios", Vercel lo 
        envía por detrás al backend de Go en Render.
      - BENEFICIO: Elimina problemas de CORS (Seguridad) y permite que 
        ambas partes hablen como si estuvieran en el mismo lugar.

   B. { "source": "/sitemap.xml", "destination": "/sitemap.xml" }
      - SEO 2026: Fuerza al servidor a entregar el archivo de mapa del sitio. 
        Esto permite que Google e IAs indexen todas tus páginas de gestión.

   C. { "source": "/robots.txt", "destination": "/robots.txt" }
      - REGLA DE ACCESIBILIDAD: Indica a los bots qué partes de la congregación 
        pueden leer y qué partes (como /perfil) son privadas.

   D. { "source": "/(.*)", "destination": "/index.html" }
      - SPA FALLBACK: Si el usuario pide una ruta que no es API ni archivos 
        de SEO (ej: /configuracion), Vercel entrega el index.html.
      - IMPORTANCIA: Es el "seguro de vida" para que React Router funcione 
        y el usuario no vea nunca una pantalla blanca de error 404.

        
Efectivamente, tenemos el mismo inconveniente técnico: el estándar JSON no permite comentarios. Si agregas texto explicativo dentro del archivo, Vercel no podrá leerlo y el sitio dará un error de despliegue.
Para cumplir con tu pedido, te entrego la solución en dos partes:
El código limpio: Lo que debes copiar y pegar en tu archivo vercel.json real.
La documentación técnica: Una guía detallada siguiendo el formato de tus otros archivos para que la guardes en tus registros de desarrollo.
1. Código para el archivo vercel.json (Limpio)
Copia y pega esto íntegramente en el archivo ubicado en la raíz GESTION-CONGREGACION:
code
JSON
{
  "version": 2,
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://gestion-teocratica-backend.onrender.com/api/$1" },
    { "source": "/sitemap.xml", "destination": "/sitemap.xml" },
    { "source": "/robots.txt", "destination": "/robots.txt" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
2. Guía Técnica de Referencia (Documentada)
Esta es la explicación detallada de cada línea bajo los estándares de CEO 2026.
code
Text
/**
 * ARCHIVO: vercel.json
 * UBICACIÓN: / (Carpeta raíz del proyecto GESTION-CONGREGACION)
 * DESCRIPCIÓN: Configuración de orquestación de red para Vercel. 
 * Actúa como un "Traffic Manager" (Gestor de Tráfico) que decide qué hacer 
 * con cada petición que llega al dominio. Es el puente final que conecta 
 * el Frontend (React) con el Backend (Go) y los activos de SEO.
 * 
 * FUNCIONALIDADES CLAVE:
 * - Proxy de API: Redirige peticiones al servidor de Render (Backend Go).
 * - Protección de SEO: Asegura que los motores de búsqueda lean sitemaps y robots.
 * - Soporte SPA: Evita errores 404 al recargar rutas de React Router.
 */

1. "version": 2
   - Indica el uso de la arquitectura más moderna de Vercel (Serverless Functions 2.0).

2. "rewrites": [ ... ]
   - Define reglas de reescritura de URL. A diferencia de un "Redirect", 
     el navegador no cambia la dirección en la barra, lo que mantiene una 
     experiencia de usuario limpia (SEO 2026: Estabilidad de URL).

   A. { "source": "/api/(.*)", "destination": "https://.../api/$1" }
      - PROXY CRÍTICO: Cuando React pide algo a "/api/usuarios", Vercel lo 
        envía por detrás al backend de Go en Render.
      - BENEFICIO: Elimina problemas de CORS (Seguridad) y permite que 
        ambas partes hablen como si estuvieran en el mismo lugar.

   B. { "source": "/sitemap.xml", "destination": "/sitemap.xml" }
      - SEO 2026: Fuerza al servidor a entregar el archivo de mapa del sitio. 
        Esto permite que Google e IAs indexen todas tus páginas de gestión.

   C. { "source": "/robots.txt", "destination": "/robots.txt" }
      - REGLA DE ACCESIBILIDAD: Indica a los bots qué partes de la congregación 
        pueden leer y qué partes (como /perfil) son privadas.

   D. { "source": "/(.*)", "destination": "/index.html" }
      - SPA FALLBACK: Si el usuario pide una ruta que no es API ni archivos 
        de SEO (ej: /configuracion), Vercel entrega el index.html.
      - IMPORTANCIA: Es el "seguro de vida" para que React Router funcione 
        y el usuario no vea nunca una pantalla blanca de error 404.

¿Por qué esta configuración es vital para CEO 2026?

Conectividad Híbrida: Al tener el Frontend en Vercel (optimizado para carga de imágenes y CSS) y el Backend en Render (optimizado para procesos de Go y Base de Datos), obtienes lo mejor de dos mundos en cuanto a velocidad de respuesta.

Transparencia de API: El usuario nunca ve la dirección real de tu backend (onrender.com), lo que aumenta la percepción de seguridad y profesionalismo del sistema.

Indexación Inteligente: Al excluir explícitamente sitemap.xml y robots.txt de la regla general, garantizas que las herramientas de auditoría de Google califiquen positivamente la estructura técnica de tu aplicación.