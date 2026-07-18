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

// Esta línea es la más importante. 
// Permite que Axios incluya las cookies en cada petición automáticamente.
axios.defaults.withCredentials = true; 

// --- INTERCEPTOR PARA (REFRESCO AUTOMÁTICO) ---
// Este bloque detecta si el token de 15 min venció y pide uno nuevo sin cerrar sesión.
axios.interceptors.response.use(
  (response) => response, // Si la respuesta es exitosa (200), no hace nada.
  async (error) => {
    const originalRequest = error.config;

    // Si el servidor responde 401 (Venció el token) y no hemos intentado refrescar aún...
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Marcamos que estamos intentando el refresco

      try {
        // Llamamos al endpoint de refresco. 
        // El Backend leerá la cookie HttpOnly 'refresh_token' automáticamente.
        await axios.post("/api/refresh");

        // Si el refresco fue exitoso, re-intentamos la petición original que había fallado.
        return axios(originalRequest);
      } catch (refreshError) {
        // Si el refresco también falla (ej: pasaron los 7 días de la llave larga), 
        // borramos la sesión y mandamos al login.
        console.error("Sesión expirada completamente.");
        sessionStorage.removeItem("user_session");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

// ELIMINADO: Ya no hidratamos el Authorization Header porque usamos Cookies HttpOnly.
console.log("🚀 Conectado al servidor con Cookies Seguras:", axios.defaults.baseURL);


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