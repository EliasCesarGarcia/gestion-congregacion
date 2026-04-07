/**
 * ARCHIVO: main.jsx
 * UBICACIÓN: src/main.jsx
 * DESCRIPCIÓN: Punto de entrada principal de la aplicación React (Frontend).
 * Se encarga de la inicialización del DOM virtual, la configuración global de 
 * peticiones HTTP (Axios), la hidratación de la seguridad (JWT) tras recargas 
 * y el montaje de los proveedores de contexto (Router, SEO y Estado Global).
 * 
 * COMPONENTES Y LIBRERÍAS CLAVE:
 * - Axios: Cliente HTTP configurado para persistencia de sesión.
 * - HelmetProvider: Gestión de metadatos dinámicos para SEO 2026.
 * - AppProvider: Manejo del estado global y Adaptive UI.
 * - BrowserRouter: Motor de navegación SPA (Single Page Application).
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import axios from "axios"; // <--- AGREGADO
import { HelmetProvider } from "react-helmet-async"; // <--- AGREGAR ESTO
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext";

import "./index.css";

import "./i18n"; //Para idiomas / traducciones

// ==========================================================
// --- CONFIGURACIÓN ESTRATÉGICA DE RED (AXIOS) ---
// ==========================================================

// Detección automática del entorno de ejecución
const isLocal = window.location.hostname === "localhost";

/**
 * BaseURL: Define la dirección del servidor Backend.
 * Cambia dinámicamente entre el entorno de desarrollo local y el servidor en Render.
 */
axios.defaults.baseURL = isLocal
  ? "http://localhost:8080"
  : "https://gestion-teocratica-backend.onrender.com";

/**
 * HIDRATACIÓN DE SEGURIDAD (JWT):
 * Si el usuario refresca la página (F5), React se reinicia, pero sessionStorage
 * mantiene el token. Recuperamos el token e inyectamos el Header de Autorización
 * para que las peticiones protegidas no pierdan el acceso.
 */
const savedToken = sessionStorage.getItem("auth_token");
if (savedToken) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
}

// Log institucional para verificación técnica en consola de desarrollador (F12)
console.log("🚀 Conectado al servidor:", axios.defaults.baseURL);

// ==========================================================
// --- MONTAJE Y RENDERIZADO DE LA APLICACIÓN ---
// ==========================================================

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>,
);
