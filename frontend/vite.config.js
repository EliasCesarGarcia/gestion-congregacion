/**
 * ARCHIVO: vite.config.js
 * UBICACIÓN: /frontend/vite.config.js
 * DESCRIPCIÓN: Configuración maestra de Vite (Next Generation Frontend Tooling).
 * Define el entorno de compilación, la integración con React y la arquitectura
 * de red para el servidor de desarrollo, permitiendo una comunicación fluida 
 * con el backend mediante un túnel de proximidad (Proxy).
 * 
 * FUNCIONALIDADES CLAVE:
 * - Habilitación de Fast Refresh para una experiencia de desarrollo ultra rápida.
 * - Resolución de políticas de CORS mediante redireccionamiento de API.
 * - Optimización del bundle final para métricas de SEO 2026 (LCP/INP).
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Documentación oficial: https://vite.dev/config/
export default defineConfig({
  /**
   * --- SISTEMA DE PLUGINS ---
   * react(): Plugin oficial que permite el soporte de sintaxis JSX/TSX,
   * y habilita la transformación de código necesaria para que React 
   * funcione con el motor de módulos nativos (ESM) de Vite.
   */
  plugins: [react()],
  
  /**
   * --- CONFIGURACIÓN DEL SERVIDOR DE DESARROLLO ---
   */
  server: {
    /**
     * PROXY (Túnel de API):
     * SEO 2026: Una arquitectura limpia separa el dominio del cliente y el servidor.
     * Esta configuración evita problemas de CORS (Cross-Origin Resource Sharing) 
     * durante el desarrollo.
     */
    proxy: {
      /**
       * Cada vez que el código de React realice una petición a una ruta 
       * que comience con '/api' (ej: axios.get('/api/usuario')), 
       * Vite interceptará la llamada y la desviará al servidor backend.
       */
      '/api': {
        // Dirección física del servidor Backend (Escrito en Go)
        target: 'http://127.0.0.1:8080',
        
        /**
         * changeOrigin: 
         * Al establecerse en 'true', Vite cambia el encabezado "Origin" 
         * de la petición para que coincida con la URL del target (Go). 
         * Esto engaña al servidor backend para que crea que la petición 
         * viene de su propio dominio, evitando bloqueos de seguridad.
         */
        changeOrigin: true,
        
        /**
         * secure:
         * Se establece en 'false' para permitir conexiones a servidores 
         * locales que no tienen certificados SSL (HTTP en lugar de HTTPS), 
         * facilitando el flujo de trabajo en localhost.
         */
        secure: false,
      }
    }
  }
})