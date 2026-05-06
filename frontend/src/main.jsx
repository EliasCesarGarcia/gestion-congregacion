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
import axios from "axios"; 
import { HelmetProvider } from "react-helmet-async"; 
import App from "./App.jsx";
import { AppProvider } from "./context/AppContext";

import "./index.css";
import "./i18n"; 

// ==========================================================
// --- CONFIGURACIÓN ESTRATÉGICA DE RED (AXIOS) ---
// ==========================================================

const isLocal = window.location.hostname === "localhost";

axios.defaults.baseURL = isLocal
  ? "http://localhost:8080"
  : "https://gestion-teocratica-backend.onrender.com";

/**
 * HIDRATACIÓN DE SEGURIDAD (JWT) - REEMPLAZADO:
 * Recuperamos el objeto completo 'user_session', lo convertimos de texto a JSON
 * y extraemos el token para que Axios lo use en todas las peticiones.
 */
const sessionData = sessionStorage.getItem("user_session");
if (sessionData) {
  try {
    const parsed = JSON.parse(sessionData);
    const token = parsed.token; 
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  } catch (error) {
    console.error("Error al hidratar la sesión:", error);
  }
}

// Log institucional
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