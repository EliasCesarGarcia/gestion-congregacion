/**
 * ARCHIVO: Navbar.jsx
 * UBICACIÓN: src/components/Navbar.jsx
 * DESCRIPCIÓN: Barra de navegación principal. 
 * Incluye menú lateral, título dinámico, foto de perfil con actualización 
 * en tiempo real y menú desplegable con datos completos de la congregación.
 */

import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
// Se agregaron ShieldCheck y las importaciones faltantes para evitar errores
import { Menu, Home, User, LogOut, Settings, X, BookOpen, ChevronDown, ShieldCheck } from 'lucide-react';

function Navbar() {
  const { user, logout } = useContext(AppContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeMenus();
    navigate('/login');
  };

  const getTitle = () => {
    if (location.pathname === '/perfil') return "Administración de Cuenta";
    if (location.pathname === '/publicaciones') return "Módulo Publicaciones";
    if (location.pathname === '/seguridad-tips') return "Seguridad Digital";
    return `Congregación ${user?.congregacion_nombre || ''}`;
  };

  const PROJECT_ID = "zigdywbtvyvubgnziwtn";
  const BUCKET_NAME = "People_profile";
  
  // URL de la foto con marca de tiempo para forzar actualización de caché
  const fotoFinal = user?.foto_url 
    ? `https://${PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${user.foto_url}?t=${Date.now()}`
    : null;

  return (
    // 'sticky top-0 z-[100]' mantiene el navbar fijo al hacer scroll
    <nav className="bg-jw-navy text-white fixed top-0 left-0 z-[100] h-16 flex items-center shadow-lg px-2 sm:px-6 w-full">
      {(isMenuOpen || isProfileOpen) && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={closeMenus}></div>
      )}

      <div className="w-full flex items-center justify-between">
        {/* IZQUIERDA: Menú y Home */}
        <div className="flex items-center z-50">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="p-2 hover:bg-white/10 rounded-md transition-all active:scale-90 mr-1"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <NavLink 
            to="/" 
            onClick={closeMenus} 
            className="p-2 hover:bg-white/10 rounded-md transition-all active:scale-90 mr-3 text-jw-accent"
          >
            <Home className="w-6 h-6" />
          </NavLink>

          <div className="flex flex-row items-baseline gap-3 border-l border-white/20 pl-4">
            <span className="text-sm font-light tracking-wide text-gray-300 hidden lg:block italic">
              Sistema de Gestión
            </span>
            <span className="text-base sm:text-lg font-medium tracking-tight text-white truncate max-w-[150px] sm:max-w-none">
              {getTitle()}
            </span>
          </div>
        </div>

        {/* DERECHA: Perfil */}
        <div className="relative z-50">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)} 
            className="flex items-center gap-2 sm:gap-4 p-1 hover:bg-white/10 rounded-full transition-all active:scale-95 border border-transparent"
          >
            <span>Hola, <span className="font-medium not-italic">{user?.nombre_completo?.split(' ').reverse().join(' ')}</span></span>
            
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-jw-blue border-2 border-white/30 flex items-center justify-center overflow-hidden shadow-md">
              {user?.foto_url ? (
                <img 
                  src={fotoFinal} 
                  alt="Perfil" 
                  className="w-full h-full object-cover object-center"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : null}
              <User className="w-6 h-6 text-white/50" />
            </div>
          </button>

          {/* MENÚ DESPLEGABLE (Restaurado con datos completos) */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-jw-border overflow-hidden text-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 bg-jw-body border-b border-jw-border text-left">
                <p className="text-base font-bold leading-tight text-jw-navy">
                  {user?.nombre_completo}
                </p>
                <p className="text-xs text-jw-blue italic mt-0.5 font-light">@{user?.username}</p>
              </div>
              
              <div className="p-4 space-y-3 text-xs text-gray-700 leading-relaxed italic text-left">
                <div className="px-1 border-l-4 border-jw-accent pl-3">
                  <p className="font-bold not-italic text-jw-navy text-sm mb-1">{user?.congregacion_nombre}</p>
                  <p className="font-medium">{user?.direccion}</p>
                  <p>{user?.ciudad}, {user?.partido}</p>
                  <p className="text-gray-400">{user?.provincia}, {user?.pais} ({user?.region})</p>
                  <p className="text-jw-blue mt-2 font-black not-italic tracking-widest uppercase text-[10px]">
                    N° {user?.numero_congregacion}
                  </p>
                </div>
                
                <hr className="border-jw-border my-2" />
                
                <div className="space-y-1">
                  <button 
                    onClick={() => {navigate('/perfil'); closeMenus();}} 
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-jw-body rounded-xl text-sm transition-all text-gray-600 group text-left font-medium active:scale-95"
                  >
                    <Settings className="w-4 h-4 text-gray-400 group-hover:text-jw-blue" /> 
                    <span>Administrar cuenta</span>
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-red-50 rounded-xl text-sm transition-all text-red-600 group text-left font-medium active:scale-95"
                  >
                    <LogOut className="w-4 h-4 text-red-400 group-hover:text-red-600" /> 
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MENÚ LATERAL */}
      <div className={`fixed left-0 top-0 h-full w-72 bg-white text-gray-800 z-[110] shadow-2xl transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 bg-jw-navy text-white flex justify-between items-center shadow-lg border-b-4 border-jw-blue">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-jw-accent" />
            <span className="text-sm tracking-widest font-black uppercase italic">Navegación</span>
          </div>
          <button onClick={() => setIsMenuOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-300" />
          </button>
        </div>
        <div className="p-4 space-y-2 text-left">
          <NavLink 
            to="/publicaciones" 
            onClick={closeMenus} 
            className={({isActive}) => `flex items-center gap-4 p-4 rounded-xl text-base font-medium transition-all border active:scale-95 ${
              isActive 
                ? 'bg-jw-blue text-white border-jw-blue shadow-lg' 
                : 'bg-white border-gray-100 text-gray-600 hover:bg-jw-body hover:border-jw-blue/20'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span>Publicaciones</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;