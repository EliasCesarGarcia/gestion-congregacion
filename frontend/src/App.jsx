import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import RutaProtegida from "./components/RutaProtegida";

// Páginas
import LoginPage from "./pages/LoginPage";
import PublicacionesPage from "./pages/PublicacionesPage";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage"; 
import SecurityTipsPage from "./pages/SecurityTipsPage"; // <--- ESTA LÍNEA FALTABA

function App() {
  return (
    <div className="min-h-screen bg-jw-body text-gray-900 flex flex-col overflow-x-hidden">
      
      <Navbar />

      <main className="flex-grow w-full overflow-x-hidden">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
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

          <Route 
            path="/perfil" 
            element={
              <RutaProtegida>
                <ProfilePage />
              </RutaProtegida>
            } 
          />

          <Route 
            path="/seguridad-tips" 
            element={
              <RutaProtegida>
                <SecurityTipsPage />
              </RutaProtegida>
            } 
          />

        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;