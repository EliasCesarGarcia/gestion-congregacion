import { useLocation, NavLink, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Menu, Home, User, LogOut, Settings, X, BookOpen } from 'lucide-react';

//if (!user) return null; // El Navbar no existe hasta que haya login

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
    return `Congregación ${user?.congregacion_nombre || ''}`;
  };

  const PROJECT_ID = "zigdywbtvyvubgnziwtn";
  const BUCKET_NAME = "People_profile";
  
  const fotoFinal = user?.foto_url 
    ? `https://${PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${user.foto_url}`
    : null;

  return (
    <nav className="bg-jw-navy text-white sticky top-0 z-50 h-16 flex items-center shadow-lg px-2 sm:px-6">
      {(isMenuOpen || isProfileOpen) && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={closeMenus}></div>
      )}

      <div className="w-full flex items-center justify-between">
        {/* IZQUIERDA */}
        <div className="flex items-center z-50">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-white/10 rounded-md transition-colors mr-1">
            <Menu className="w-6 h-6" />
          </button>
          
          <NavLink to="/" onClick={closeMenus} className="p-2 hover:bg-white/10 rounded-md transition-colors mr-3 text-jw-accent">
            <Home className="w-6 h-6" />
          </NavLink>

          <div className="flex flex-row items-baseline gap-3 border-l border-white/20 pl-4">
            <span className="text-sm font-light tracking-wide text-gray-300 hidden lg:block italic">
              Sistema de Gestión
            </span>
            <span className="text-lg font-medium tracking-tight text-white">
              {getTitle()}
            </span>
          </div>
        </div>

        {/* DERECHA */}
        <div className="relative z-50">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)} 
            className="flex items-center gap-4 p-1 hover:bg-white/10 rounded-full transition-all border border-transparent"
          >
            <span className="hidden md:block text-base font-light italic">
              Hola, <span className="font-medium not-italic">{user?.nombre_completo}</span>
            </span>
            
            {/* AVATAR PEQUEÑO CON OBJECT-COVER */}
            <div className="w-11 h-11 rounded-full bg-jw-blue border-2 border-white/30 flex items-center justify-center overflow-hidden shadow-md">
              {user?.foto_url ? (
                <img 
                  src={fotoFinal} 
                  alt="P" 
                  className="w-full h-full object-cover object-center"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : null}
              <User className="w-6 h-6 text-white/50" />
            </div>
          </button>

          {/* VENTANA EMERGENTE PERFIL */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-jw-border overflow-hidden text-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 bg-jw-body border-b border-jw-border">
                <p className="text-lg font-medium leading-tight text-jw-navy">
                  {user?.nombre_completo}
                </p>
                <p className="text-xs text-jw-blue italic mt-0.5 font-light">@{user?.username}</p>
              </div>
              
              <div className="p-3 space-y-3 text-xs text-gray-700 leading-relaxed italic">
                <div className="px-1 border-l-2 border-jw-accent pl-2">
                  <p className="font-medium not-italic text-jw-navy text-sm">{user?.congregacion_nombre}</p>
                  <p>{user?.direccion}</p>
                  <p>{user?.ciudad}, {user?.partido}</p>
                  <p className="text-jw-blue mt-1 font-bold not-italic tracking-wider uppercase">
                    ({user?.numero_congregacion})
                  </p>
                </div>
                
                <hr className="border-jw-border" />
                
                <div className="space-y-0.5">
                  <button 
                    onClick={() => {navigate('/perfil'); closeMenus();}} 
                    className="w-full flex items-center gap-3 p-2 hover:bg-jw-body rounded-lg text-sm transition-all text-gray-600 group text-left font-light"
                  >
                    <Settings className="w-4 h-4 text-gray-400 group-hover:text-jw-blue" /> 
                    <span>Administrar cuenta</span>
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="w-full flex items-center gap-3 p-2 hover:bg-red-50 rounded-lg text-sm transition-all text-red-600 group text-left font-light"
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
      <div className={`fixed left-0 top-0 h-full w-72 bg-jw-body text-gray-800 z-[60] shadow-2xl transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 bg-jw-navy text-white flex justify-between items-center shadow-lg">
          <span className="text-base tracking-widest font-light uppercase italic">Navegación</span>
          <button onClick={() => setIsMenuOpen(false)}>
            <X className="w-6 h-6 text-gray-300" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <NavLink 
            to="/publicaciones" 
            onClick={closeMenus} 
            className={({isActive}) => `flex items-center gap-4 p-3 rounded-lg text-base transition-all border ${
              isActive 
                ? 'bg-jw-blue text-white border-jw-blue shadow-lg' 
                : 'bg-white border-gray-100 text-gray-600 hover:bg-jw-gray_hover'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-light">Publicaciones</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;