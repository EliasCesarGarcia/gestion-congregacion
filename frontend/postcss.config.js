/**
 * ARCHIVO: postcss.config.js
 * UBICACIÓN: /frontend/postcss.config.js
 * DESCRIPCIÓN: Configuración del motor PostCSS.
 * Actúa como un pipeline de transformación para el CSS de la aplicación,
 * permitiendo procesar utilidades de Tailwind y automatizar la compatibilidad
 * con diferentes motores de renderizado (Browsers).
 * 
 * FUNCIONALIDADES CLAVE:
 * - Compilación de directivas de Tailwind CSS.
 * - Inyección automática de prefijos de proveedores (Vendor Prefixes).
 * - Optimización del árbol de estilos para el despliegue final.
 */

export default {
  /**
   * --- SISTEMA DE PLUGINS DE POSTCSS ---
   */
  plugins: {
    /**
     * @tailwindcss/postcss:
     * Integra el motor de Tailwind CSS en el flujo de procesamiento de estilos.
     * Permite el uso de @theme, @apply y otras funciones avanzadas de Tailwind v4,
     * transformando clases de utilidad en CSS puro eficiente.
     */
    '@tailwindcss/postcss': {},
    
    /**
     * autoprefixer:
     * Plugin fundamental para la compatibilidad entre navegadores.
     * Analiza el CSS generado y añade automáticamente prefijos como -webkit-, 
     * -moz- o -ms- basándose en la base de datos de "Can I Use".
     * 
     * POR QUÉ ES CRÍTICO (CEO 2026):
     * 1. Estabilidad Visual: Garantiza que animaciones, flexbox y grid se vean 
     *    exactamente igual en Safari, Chrome, Edge y navegadores móviles.
     * 2. Accesibilidad: Evita que funciones de diseño críticas fallen en 
     *    dispositivos antiguos, asegurando que el contenido sea siempre legible.
     * 3. Mantenibilidad: Permite escribir CSS moderno sin preocuparse por 
     *    las peculiaridades técnicas de cada navegador.
     */
    'autoprefixer': {},
  },
}