/**
 * ARCHIVO: App.jsx
 * UBICACIÓN: frontend/src/App.jsx
 * DESCRIPCIÓN: Componente raíz y orquestador principal de la aplicación.
 * Define la estructura global del layout (Navbar, Main, Footer) y gestiona
 * el sistema de enrutamiento declarativo mediante React Router.
 *
 * FUNCIONALIDADES CLAVE:
 * - Control de navegación y arquitectura Single Page Application (SPA).
 * - Implementación de Middleware de seguridad mediante el componente "RutaProtegida".
 * - Maquetación adaptativa y control de desbordamiento (Overflow).
 */

import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";

// --- IMPORTACIÓN DE COMPONENTES DE ESTRUCTURA (LAYOUT) ---
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RutaProtegida from "./components/RutaProtegida"; // Wrapper de seguridad para sesiones activas

// --- IMPORTACIÓN DE COMPONENTES DE PÁGINA (VISTAS) ---
import LoginPage from "./pages/LoginPage"; // Acceso al sistema
import PublicacionesPage from "./pages/PublicacionesPage"; // Gestión de contenidos
import HomePage from "./pages/HomePage"; // Tablero principal / Inicio
import ProfilePage from "./pages/ProfilePage"; // Administración de perfil de usuario
import SecurityTipsPage from "./pages/SecurityTipsPage"; // Centro de seguridad digital
import ContactoPage from "./pages/ContactoPage"; // Ayuda y soporte institucional
import ConfiguracionPage from "./pages/ConfiguracionPage"; // Preferencias y accesibilidad (CEO 2026)

function App() {
  // --- MOTOR PARALLAX LIMITADO (Suave, Inteligente y a prueba de fallos) ---
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // 1. Calculamos el largo total de la página vs la pantalla
          const docHeight = document.documentElement.scrollHeight;
          const winHeight = window.innerHeight;
          const maxScroll = docHeight - winHeight;

          // 2. Porcentaje exacto (con límites estrictos entre 0 y 1 para no fallar)
          let scrollPercent = 0;
          if (maxScroll > 0) {
            scrollPercent = window.scrollY / maxScroll;
            scrollPercent = Math.max(0, Math.min(1, scrollPercent));
          }

          // 3. Inyectamos los valores al CSS en tiempo real
          document.documentElement.style.setProperty(
            "--parallax-y",
            `-${scrollPercent * 20}vh`,
          );
          document.documentElement.style.setProperty(
            "--depth-op",
            scrollPercent * 0.85,
          );

          ticking = false;
        });
        ticking = true;
      }
    };

    // Escuchamos el scroll y también cuando se cambia el tamaño de la ventana
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    // Forzamos un cálculo inicial tras medio segundo para que React termine de pintar todo
    setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    /**
     * CONTENEDOR PRINCIPAL:
     * min-h-screen: Garantiza que el Footer se empuje al final si hay poco contenido.
     * bg-jw-body: Aplica el color de fondo institucional definido en Tailwind.
     * flex-col: Permite que el 'main' crezca y ocupe el espacio sobrante.
     */

    <div className="min-h-screen bg-transparent text-jw-text-main flex flex-col overflow-x-hidden transition-colors duration-700">
      {/* BARRA DE NAVEGACIÓN: Posicionamiento fijo gestionado internamente */}
      <Navbar />

      {/*
    //ÁREA DE CONTENIDO DINÁMICO:
    //pt-16: Compensación de altura por el Navbar fijo (h-16).
    //flex-grow: Fuerza a este contenedor a ocupar todo el espacio entre Navbar y Footer.
    */}
      <main className="flex-grow w-full pt-16 overflow-x-hidden">
        <Routes>
          {/* RUTA PÚBLICA: Acceso libre para autenticación */}
          <Route path="/login" element={<LoginPage />} />

          {/* 
              BLOQUE DE RUTAS PROTEGIDAS:
              Cada vista está envuelta en <RutaProtegida>. 
              Este componente verifica si el usuario tiene una sesión activa en AppContext 
              antes de permitir el renderizado de la página.
          */}

          {/* Inicio / Dashboard */}
          <Route
            path="/"
            element={
              <RutaProtegida>
                <HomePage />
              </RutaProtegida>
            }
          />

          {/* Módulo de Publicaciones Teocráticas */}
          <Route
            path="/publicaciones"
            element={
              <RutaProtegida>
                <PublicacionesPage />
              </RutaProtegida>
            }
          />

          {/* Administración de Cuenta y Datos Personales */}
          <Route
            path="/perfil"
            element={
              <RutaProtegida>
                <ProfilePage />
              </RutaProtegida>
            }
          />

          {/* Guía de Seguridad y Buenas Prácticas Digitales */}
          <Route
            path="/seguridad-tips"
            element={
              <RutaProtegida>
                <SecurityTipsPage />
              </RutaProtegida>
            }
          />

          {/* Centro de Ayuda y Contacto con Ancianos */}
          <Route
            path="/contacto"
            element={
              <RutaProtegida>
                <ContactoPage />
              </RutaProtegida>
            }
          />

          {/* Panel de Configuración: Accesibilidad, Tamaño de fuente y Temas (SEO 2026) */}
          <Route
            path="/configuracion"
            element={
              <RutaProtegida>
                <ConfiguracionPage />
              </RutaProtegida>
            }
          />
        </Routes>
      </main>

      {/* PIE DE PÁGINA: Sincronizado con el estado global y SEO local */}
      <Footer />
    </div>
  );
}

export default App;
