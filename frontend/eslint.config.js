/**
 * ARCHIVO: eslint.config.js
 * UBICACIÓN: /frontend/eslint.config.js
 * DESCRIPCIÓN: Configuración centralizada de ESLint (Flat Config).
 * Define las reglas de calidad de código, estándares de sintaxis y 
 * mejores prácticas para el desarrollo con React y Vite.
 * 
 * FUNCIONALIDADES CLAVE:
 * - Aplicación de reglas recomendadas de JavaScript moderno (ES2020+).
 * - Integración de plugins para la validación de React Hooks.
 * - Soporte para Hot Module Replacement (HMR) mediante React Refresh.
 * - Gestión de limpieza de código mediante reglas de variables no utilizadas.
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  /**
   * --- EXCLUSIONES GLOBALES ---
   * Ignora la carpeta 'dist' (compilación final) para evitar errores 
   * de linting en archivos optimizados y minificados.
   */
  globalIgnores(['dist']),
  {
    /* Aplicación de reglas a todos los archivos de lógica y componentes */
    files: ['**/*.{js,jsx}'],
    
    /**
     * --- EXTENSIONES DE REGLAS (PRESETS) ---
     */
    extends: [
      js.configs.recommended, // Reglas base de JavaScript
      reactHooks.configs.flat.recommended, // Validación de reglas de Hooks (useEffect, useCallback)
      reactRefresh.configs.vite, // Optimización para recarga rápida en desarrollo
    ],
    
    /**
     * --- CONFIGURACIÓN DEL ENTORNO DE LENGUAJE ---
     */
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])
