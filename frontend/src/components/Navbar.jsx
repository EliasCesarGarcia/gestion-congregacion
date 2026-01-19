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
    <nav className="bg-jw-navy text-white sticky top-0 z-50 h-16 flex items-center shadow-lg px-4">
      {/* Overlay transparente para cerrar menús al tocar fuera */}
      {(isMenuOpen || isProfileOpen) && (
        <div className="fixed inset-0 z-40" onClick={closeMenus}></div>
      )}

      <div className="w-full flex items-center justify-between">
        {/* Izquierda */}
        <div className="flex items-center gap-2 z-50">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-white/10 rounded-md">
            <Menu className="w-7 h-7" />
          </button>
          
          <NavLink to="/" onClick={closeMenus} className="p-2 hover:bg-white/10 rounded-md">
            <Home className="w-7 h-7 text-jw-accent" />
          </NavLink>

          <div className="hidden sm:flex flex-col ml-2 border-l border-white/20 pl-4 leading-tight">
            <span className="text-[10px] text-jw-accent tracking-widest uppercase">Sistema de Gestión</span>
            <span className="text-lg font-medium">Congregación {user?.congregacion_nombre}</span>
          </div>
        </div>

        {/* Derecha */}
        <div className="relative z-50">
          <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-md transition-all">
            <span className="hidden md:block text-base">Hola, {user?.username}</span>
            <div className="w-10 h-10 rounded-full bg-jw-blue border-2 border-white/20 flex items-center justify-center overflow-hidden">
              {user?.foto ? <img src={user.foto} alt="U" /> : <User className="w-6 h-6 text-white/50" />}
            </div>
          </button>

          {/* Menú Perfil Estilo JW (Fondo Gris Azulado) */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-3 w-80 bg-jw-body rounded-lg shadow-2xl border border-jw-border overflow-hidden text-gray-800 animate-in fade-in zoom-in duration-150">
              <div className="p-6 bg-jw-navy text-white border-b border-white/10">
                <p className="text-xl font-medium">{user?.nombre_completo}</p>
                <p className="text-sm text-jw-accent italic">@{user?.username}</p>
              </div>
              <div className="p-4 space-y-4">
                <div className="px-2">
                  <p className="text-base font-medium">{user?.congregacion_nombre}</p>
                  <p className="text-sm text-gray-500">{user?.ciudad}, {user?.provincia}</p>
                  <p className="text-xs text-jw-blue font-bold mt-1">ID: {user?.numero_congregacion}</p>
                </div>
                <hr className="border-jw-border" />
                <button onClick={() => {navigate('/perfil'); closeMenus();}} className="w-full flex items-center gap-4 p-3 hover:bg-white rounded-md text-base transition-colors">
                  <Settings className="w-5 h-5 text-gray-400" /> Administrar cuenta
                </button>
                <button onClick={() => {logout(); navigate('/login'); closeMenus();}} className="w-full flex items-center gap-4 p-3 hover:bg-red-50 text-red-600 rounded-md text-base transition-colors">
                  <LogOut className="w-5 h-5" /> Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menú Lateral (Drawer) */}
      <div className={`fixed left-0 top-0 h-full w-80 bg-jw-body text-gray-800 z-[60] shadow-2xl transition-transform duration-300 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 bg-jw-navy text-white flex justify-between items-center">
          <span className="text-lg tracking-widest font-light uppercase">Navegación</span>
          <button onClick={() => setIsMenuOpen(false)}><X className="w-6 h-6" /></button>
        </div>
        <div className="p-4 space-y-2">
          <NavLink to="/publicaciones" onClick={closeMenus} className={({isActive}) => `flex items-center gap-4 p-4 rounded-lg text-lg transition-all ${isActive ? 'bg-jw-blue text-white shadow-lg' : 'hover:bg-jw-border text-gray-700'}`}>
            <BookOpen className="w-6 h-6" />
            <span>Publicaciones</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
}
export default Navbar;