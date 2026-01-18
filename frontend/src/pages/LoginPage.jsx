import React, { useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

function LoginPage() {
  // Estados para el formulario
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AppContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Llamamos a nuestro backend de Go
      // Usamos la ruta corta "/api/login" gracias al Proxy de Vite
      const response = await axios.post('/api/login', {
        username: username,
        password: password // Por ahora Go solo valida el username
      });

      console.log("Respuesta de Go:", response.data);

      // Si llegamos aquí, el login fue exitoso
      login(response.data); // Guardamos en el Contexto
      navigate('/');        // Redirigimos al Inicio

    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 401) {
        setError('Usuario no encontrado o datos incorrectos');
      } else {
        setError('No se pudo conectar con el servidor');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100 transform transition-all hover:scale-[1.01]">
        <h2 className="text-3xl font-black text-center text-gray-800 mb-2 tracking-tight">Acceso al Panel</h2>
        <p className="text-gray-500 text-center mb-8">Gestión de Congregación</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 text-sm animate-pulse">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Usuario / Email</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all"
              placeholder="Ej: elias_garcia"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Contraseña</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 focus:ring-4 focus:ring-blue-100 focus:bg-white outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className={`w-full ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all transform active:scale-95`}
          >
            {loading ? 'VERIFICANDO...' : 'ENTRAR AL SISTEMA'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;