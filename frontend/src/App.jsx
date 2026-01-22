import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RutaProtegida from "./components/RutaProtegida";
import LoginPage from "./pages/LoginPage";
import PublicacionesPage from "./pages/PublicacionesPage";
import HomePage from "./pages/HomePage";

function App() {
  return (
    /**
     * ESTRUCTURA GLOBAL PROFESIONAL:
     * 1. min-h-screen: Asegura que el sitio ocupe toda la pantalla.
     * 2. bg-jw-body: Aplica el color de fondo gris suave institucional.
     * 3. flex-col: Permite que el footer sea empujado al fondo.
     * 4. overflow-x-hidden: (CRÍTICO) Bloquea el scroll horizontal en toda la App.
     */
    <div className="min-h-screen bg-jw-body text-gray-900 flex flex-col overflow-x-hidden">
      
      {/* Barra de Navegación Institucional */}
      <Navbar />

      {/* 
          CONTENEDOR PRINCIPAL:
          - flex-grow: Expande el espacio para que el Footer siempre esté abajo.
          - w-full overflow-x-hidden: Segunda capa de seguridad contra desbordamientos de texto.
      */}
      <main className="flex-grow w-full overflow-x-hidden">
        <Routes>
          {/* Ruta Pública: Acceso al Login */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* 
              RUTAS PROTEGIDAS:
              Solo accesibles si el usuario está logueado (gestionado por RutaProtegida.jsx) 
          */}
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

          {/* 
              Próximos módulos a desarrollar:
              <Route path="/informes" element={<RutaProtegida><InformesPage /></RutaProtegida>} />
              <Route path="/reuniones" element={<RutaProtegida><ReunionesPage /></RutaProtegida>} />
          */}
        </Routes>
      </main>
      
      {/* Pie de Página con datos dinámicos de la congregación */}
      <Footer />
    </div>
  );
}

export default App;