import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import RutaProtegida from "./components/RutaProtegida";
import LoginPage from "./pages/LoginPage";
import PublicacionesPage from "./pages/PublicacionesPage";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Rutas que requieren estar logueado */}
        <Route path="/" element={
          <RutaProtegida>
            <HomePage />
          </RutaProtegida>
        } />
        
        <Route path="/" element={
          <div className="flex flex-col items-center justify-center py-32">
            <h1 className="text-5xl font-black text-gray-900 tracking-tighter">Bienvenido</h1>
            <p className="text-gray-500 mt-4 text-xl">Gestión Unificada para Congregaciones</p>
          </div>
        } />
      </Routes>
    </div>
  );
}
export default App;