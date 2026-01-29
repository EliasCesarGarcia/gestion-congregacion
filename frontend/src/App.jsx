import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RutaProtegida from "./components/RutaProtegida";

// Páginas
import LoginPage from "./pages/LoginPage";
import PublicacionesPage from "./pages/PublicacionesPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage"; // <--- Esta faltaba y es clave

function App() {
  return (
    /**
     * ESTRUCTURA GLOBAL PROFESIONAL:
     * bg-jw-body: Color gris suave de jw.org definido en index.css
     * overflow-x-hidden: Evita el scroll horizontal en móviles
     */
    <div className="min-h-screen bg-jw-body text-gray-900 flex flex-col overflow-x-hidden">
      
      {/* Barra de Navegación Institucional (Título dinámico) */}
      <Navbar />

      {/* Contenedor Principal que empuja el Footer al fondo */}
      <main className="flex-grow w-full overflow-x-hidden">
        <Routes>
          {/* RUTA PÚBLICA */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* RUTAS PROTEGIDAS (Requieren Login) */}
          <Route 
            path="/" 
            element={
              <RutaProtegida>
                <HomePage />
              </RutaProtegida>
            } 
          />
          
          <Route 
            path="/publicaciones" 
            element={
              <RutaProtegida>
                <PublicacionesPage />
              </RutaProtegida>
            } 
          />

          {/* RUTA DE PERFIL / ADMINISTRACIÓN DE CUENTA */}
          <Route 
            path="/perfil" 
            element={
              <RutaProtegida>
                <ProfilePage />
              </RutaProtegida>
            } 
          />

        </Routes>
      </main>
      
      {/* Footer con datos de la congregación */}
      <Footer />
    </div>
  );
}

export default App;