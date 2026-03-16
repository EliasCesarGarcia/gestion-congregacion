/**
 * ARCHIVO: tailwind.config.js
 * UBICACIÓN: /frontend/tailwind.config.js
 * DESCRIPCIÓN: Configuración del motor Tailwind CSS.
 * Define la identidad visual del sistema mediante la personalización de la 
 * paleta de colores, la escala tipográfica y el rastreo de archivos para 
 * la generación de estilos bajo demanda (Just-in-Time).
 * 
 * FUNCIONALIDADES CLAVE:
 * - Definición de colores institucionales "JW".
 * - Escalado tipográfico de accesibilidad (+2pt base).
 * - Optimización de purga de CSS para rendimiento (LCP).
 */

/** @type {import('tailwindcss').Config} */
export default {
  /**
   * --- RASTREO DE CONTENIDO ---
   * Define las rutas de todos los archivos que contienen clases de Tailwind.
   * Esto permite que el motor elimine el CSS no utilizado, reduciendo el 
   * peso del bundle final (Vital para SEO 2026).
   */
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      /**
       * --- PALETA DE COLORES INSTITUCIONAL (JW) ---
       * Se define un objeto "jw" para centralizar los colores de marca.
       * Esto asegura la coherencia visual en todos los módulos del sistema.
       */
      colors: {
        jw: {
          /* AHORA LEEN VARIABLES CSS DINÁMICAS INYECTADAS POR EL TEMA */
          navy: 'var(--color-jw-navy)',      
          blue: 'var(--color-jw-blue)',      
          accent: 'var(--color-jw-accent)',    
          body: 'var(--color-jw-body)',      
          card: 'var(--color-jw-card)',      
          'text-main': 'var(--color-jw-text-main)', 
          'text-light': 'var(--color-jw-text-light)',
          border: 'var(--color-jw-border)',    
        }
      },
      
      /**
       * --- SISTEMA DE ACCESIBILIDAD TIPOGRÁFICA ---
       * SEO 2026: Se ha aumentado la escala base en 2 puntos (aprox. 0.125rem).
       * El uso de unidades 'rem' es crítico aquí, ya que permite que el sistema 
       * escale proporcionalmente cuando el usuario cambia el tamaño de letra 
       * desde el panel de Configuración.
       */
      fontSize: {
        'xs': '0.875rem',    // 14px (Antes 12px) - Notas legales y Copyright
        'sm': '1rem',        // 16px (Antes 14px) - Datos de dirección y contacto
        'base': '1.125rem',  // 18px (Antes 16px) - El estándar de lectura del cuerpo
        'lg': '1.25rem',     // 20px (Antes 18px) - Títulos secundarios
        'xl': '1.5rem',      // 24px (Antes 20px) - Títulos de sección
        '2xl': '1.875rem',   // 30px (Antes 24px) - Encabezados de página
        '3xl': '2.25rem',    // 36px
        '4xl': '3rem',       // 48px
        '5xl': '3.75rem',    // 60px
      }
    },
  },
  
  /**
   * --- PLUGINS ADICIONALES ---
   * Área para extender funcionalidades (Forms, Typography, Aspect Ratio).
   */
  plugins: [],
}