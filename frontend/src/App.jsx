import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer"; // Importamos el nuevo Footer
import RutaProtegida from "./components/RutaProtegida";
import LoginPage from "./pages/LoginPage";
import PublicacionesPage from "./pages/PublicacionesPage";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* La Barra de Navegación se mantiene fija arriba */}
      <Navbar />

      {/* El contenido principal crece para empujar al footer hacia abajo */}
      <main className="flex-grow">
        <Routes>
          {/* Ruta Pública */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Rutas Protegidas (Solo para usuarios logueados) */}
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

          {/* Aquí podrás agregar más rutas como /informes, /reuniones, etc. */}
        </Routes>
      </main>
      
      {/* El Pie de Página con los datos de la congregación */}
      <Footer />
    </div>
  );
}

export default App;