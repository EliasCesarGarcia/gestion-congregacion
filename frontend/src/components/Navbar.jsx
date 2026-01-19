import { NavLink, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { Menu, Home, User, LogOut, Settings, X, BookOpen } from 'lucide-react';

function Navbar() {
  const { user, logout } = useContext(AppContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  };

  return (
    <nav className="bg-jw-navy text-white sticky top-0 z-50 h-16 flex items-center shadow-md">
      {/* Overlay para cerrar al hacer clic fuera */}
      {(isMenuOpen || isProfileOpen) && (
        <div className="fixed inset-0 z-40 bg-black/10" onClick={closeMenus}></div>
      )}

      <div className="w-full flex items-center justify-between px-2 sm:px-4">
        
        {/* Lado Izquierdo: Pegado a la izquierda */}
        <div className="flex items-center gap-1 z-50">
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)} 
            className="p-2 hover:bg-white/10 rounded-md transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <NavLink 
            to="/" 
            onClick={closeMenus}
            className="p-2 hover:bg-white/10 rounded-md transition-colors"
          >
            <Home className="w-6 h-6 text-jw-accent" />
          </NavLink>

          <div className="flex flex-col ml-1 border-l border-white/20 pl-3 leading-tight">
            <span className="text-[11px] text-jw-accent tracking-widest uppercase font-light">Sistema de Gestión</span>
            <span className="text-white text-lg font-medium">Congregación {user?.congregacion_nombre}</span>
          </div>
        </div>

        {/* Lado Derecho: Perfil */}
        <div className="relative z-50">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-md transition-all"
          >
            <span className="hidden md:block text-base font-light">Hola, {user?.username}</span>
            <div className="w-9 h-9 rounded-full bg-jw-blue border border-white/30 flex items-center justify-center overflow-hidden">
              {user?.foto ? <img src={user.foto} alt="U" /> : <User className="w-5 h-5 text-white/70" />}
            </div>
          </button>

          {/* Menú de Perfil Estilo JW */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-white rounded-lg shadow-2xl border border-jw-border overflow-hidden text-jw-text_main">
              <div className="p-6 bg-jw-body border-b border-jw-border">
                <p className="text-xl font-medium text-jw-navy">{user?.nombre_completo}</p>
                <p className="text-sm text-jw-blue italic">@{user?.username}</p>
              </div>
              
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Información</p>
                  <p className="text-base font-medium">{user?.congregacion_nombre}</p>
                  <p className="text-sm text-gray-500">{user?.ciudad}, {user?.provincia}</p>
                  <p className="text-xs text-jw-blue mt-1">ID: {user?.numero_congregacion}</p>
                </div>
                
                <hr className="border-jw-border" />
                
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => { navigate('/perfil'); closeMenus(); }}
                    className="w-full flex items-center gap-4 p-3 hover:bg-jw-body rounded-md text-base transition-colors"
                  >
                    <Settings className="w-5 h-5 text-gray-400" /> Administrar cuenta
                  </button>
                  <button 
                    onClick={() => { logout(); navigate('/login'); closeMenus(); }}
                    className="w-full flex items-center gap-4 p-3 hover:bg-red-50 text-red-600 rounded-md text-base transition-colors"
                  >
                    <LogOut className="w-5 h-5" /> Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menú Lateral Moderno */}
      <div className={`fixed left-0 top-0 h-full w-80 bg-jw-body text-jw-text_main z-[60] shadow-2xl transition-transform duration-300 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 bg-jw-navy text-white flex justify-between items-center">
          <span className="text-lg tracking-widest font-light uppercase">Navegación</span>
          <button onClick={() => setIsMenuOpen(false)} className="hover:rotate-90 transition-transform"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-4 space-y-2">
          <NavLink 
            to="/publicaciones" 
            onClick={closeMenus}
            className={({isActive}) => `flex items-center gap-4 p-4 rounded-lg text-lg transition-all ${isActive ? 'bg-jw-navy text-white shadow-lg' : 'hover:bg-jw-border/30 text-gray-700'}`}
          >
            <BookOpen className="w-6 h-6" />
            <span>Publicaciones</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;