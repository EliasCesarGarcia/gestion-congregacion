import { NavLink } from 'react-router-dom';
import { useContext } from 'react';
import { AppContext } from '../context/AppContext';

function Navbar() {
  const { user } = useContext(AppContext);
  
  const linkClass = ({ isActive }) => 
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <span className="text-blue-500 font-bold text-xl tracking-tight">Gestión Local</span>
            <div className="hidden md:flex space-x-4">
              <NavLink to="/" className={linkClass}>Inicio</NavLink>
              <NavLink to="/publicaciones" className={linkClass}>Publicaciones</NavLink>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <span className="text-gray-300 text-sm italic">Hola, {user.username}</span>
            ) : (
              <NavLink to="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
                Acceder
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;