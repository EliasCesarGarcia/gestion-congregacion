/**
 * ARCHIVO: Navbar.jsx
 * UBICACIÓN: src/components/Navbar.jsx
 * DESCRIPCIÓN: Barra de navegación principal con posicionamiento fijo. 
 * Maneja el menú lateral (Sidebar), el título dinámico basado en la ruta, 
 * el acceso al perfil de usuario con refresco de caché de imagen.
 * Ahora incluye lógica adaptable de colores y saludos según el horario local.
 * 
 * FUNCIONES IMPLICADAS:
 * - closeMenus: Cierra sidebar y dropdown de perfil.
 * - handleLogout: Gestiona el cierre de sesión y redirección.
 * - getTitle: Determina el texto central según la ruta de React Router.
 * - getProfileImage: Procesa la URL de imagen (Avatar local o Supabase con WebP).
 */

import { useLocation, NavLink, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import {
  Menu,
  Home,
  User,
  LogOut,
  Settings,
  X,
  BookOpen,
  ChevronDown,
  ShieldCheck,
  Globe,
} from "lucide-react";

function Navbar() {
  // --- 1. CONFIGURACIÓN Y ESTADOS ---
  const { user, logout, timeTheme } = useContext(AppContext); // Consumimos el tema dinámico
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // --- 2. FUNCIONES DE NAVEGACIÓN ---
  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeMenus();
    navigate("/login");
  };

  const getTitle = () => {
    if (location.pathname === "/perfil") return "Administración de Cuenta";
    if (location.pathname === "/publicaciones") return "Módulo Publicaciones";
    if (location.pathname === "/seguridad-tips") return "Seguridad Digital";
    if (location.pathname === "/contacto") return "Centro de Ayuda y Contacto";
    return `Congregación ${user?.congregacion_nombre || ""}`;
  };

  // --- 3. GESTIÓN DE IMAGEN ---
  const getProfileImage = () => {
    if (!user?.foto_url) return null;
    if (user.foto_url.startsWith("/avatars/") || user.foto_url.startsWith("http")) {
      return user.foto_url;
    }
    return `https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/${user.foto_url}?width=120&quality=80&format=webp`;
  };

  return (
    <nav
      style={{ backgroundColor: timeTheme.bg }} // Aplicación de color dinámico (Mañana/Tarde/Noche)
      className="text-white fixed top-0 left-0 z-[100] h-16 flex items-center shadow-lg px-2 sm:px-6 w-full transition-colors duration-1000"
    >
      {/* Fondo invisible para cerrar menús al hacer clic fuera */}
      {(isMenuOpen || isProfileOpen) && (
        <div
          className="fixed inset-0 z-[45] w-screen h-screen bg-transparent cursor-default"
          onClick={closeMenus}
        ></div>
      )}

      <div className="w-full flex items-center justify-between">
        {/* SECCIÓN IZQUIERDA: MENÚ, HOME Y TÍTULO */}
        <div className="flex items-center z-50 min-w-0">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Abrir menú de navegación"
            className="p-1.5 sm:p-2 hover:bg-white/20 hover:text-white hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 mr-1 shrink-0 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            <Menu className="w-7 h-7" />
          </button>

          <NavLink
            to="/"
            onClick={closeMenus}
            aria-label="Ir al inicio"
            className="p-1.5 sm:p-2 hover:bg-white/20 hover:text-white hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 mr-2 sm:mr-3 text-jw-accent-light shrink-0 hover:shadow-[0_0_15px_rgba(74,109,167,0.3)]"
          >
            <Home className="w-7 h-7" />
          </NavLink>

          <div className="flex flex-row items-baseline gap-2 sm:gap-3 border-l border-white/20 pl-3 sm:pl-4 min-w-0">
            <span className="text-sm font-light tracking-wide text-gray-300 hidden lg:block italic shrink-0">
              Sistema de Gestión
            </span>
            <span className="text-sm sm:text-lg font-medium tracking-tight text-white truncate">
              {getTitle()}
            </span>
          </div>
        </div>

        {/* SECCIÓN DERECHA: PERFIL Y AVATAR */}
        <div className="relative z-50 flex items-center justify-end">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-label="Ver opciones de mi cuenta"
            className="flex items-center gap-3 sm:gap-5 p-1 hover:bg-white/10 rounded-full transition-all active:scale-95 border border-transparent"
          >
            <div className="hidden md:flex flex-col items-end text-right leading-none">
              <span className="text-[10px] font-medium text-jw-accent-light uppercase tracking-widest mb-1">
                Mi Cuenta
              </span>
              <span className="text-base font-light italic">
                {timeTheme.greeting}{" "} {/* Saludo dinámico: Buenos días / Buenas tardes / Buenas noches */}
                <span className="font-medium not-italic">
                  {user?.nombre_completo?.split(" ").reverse().join(" ")}
                </span>
              </span>
            </div>

            <div className="w-14 h-14 rounded-full border-2 border-jw-accent overflow-hidden bg-jw-body flex items-center justify-center shrink-0 shadow-md">
              {user?.foto_url ? (
                <img
                  src={getProfileImage()}
                  alt="Mi perfil"
                  className="w-full h-full object-cover"
                  key={user.foto_url}
                  fetchPriority="high"
                />
              ) : (
                <User className="text-gray-400 w-7 h-7" />
              )}
            </div>
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-jw-border overflow-hidden text-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4 bg-jw-body border-b border-jw-border text-left">
                <p className="text-base font-bold leading-tight text-jw-navy">
                  {user?.nombre_completo}
                </p>
                <p className="text-xs text-jw-blue italic mt-0.5 font-light">
                  @{user?.username}
                </p>
              </div>

              <div className="p-4 text-xs text-gray-700 leading-relaxed italic text-left">
                <div className="px-1 border-l-4 border-jw-accent pl-3">
                  <div className="mb-3">
                    <p className="font-bold not-italic text-jw-navy text-base leading-tight">
                      {user?.congregacion_nombre}
                    </p>
                    <p className="text-jw-blue font-normal not-italic tracking-widest uppercase text-[11px]">
                      N° {user?.numero_congregacion}
                    </p>
                  </div>

                  <div className="space-y-1 mb-3">
                    <p className="font-medium">{user?.direccion}</p>
                    <p>{user?.ciudad}, {user?.partido}</p>
                    <p className="text-gray-500">{user?.provincia}, {user?.pais}</p>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400 pt-1 border-t border-gray-50 mt-2">
                    <Globe size={13} className="shrink-0 text-jw-accent-light" />
                    <p className="font-bold uppercase tracking-widest text-[10px] not-italic">
                      Región {user?.region || "No definida"}
                    </p>
                  </div>
                </div>

                <hr className="border-jw-border my-4" />

                <div className="space-y-1">
                  <button
                    onClick={() => { navigate("/perfil"); closeMenus(); }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-blue-100 rounded-xl text-sm transition-all text-gray-600 group text-left font-medium active:scale-95"
                  >
                    <Settings className="w-4 h-4 text-gray-400 group-hover:text-jw-blue" />
                    <span>Administrar cuenta</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-red-100 rounded-xl text-sm transition-all text-red-600 group text-left font-medium active:scale-95"
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

      {/* MENÚ LATERAL (SIDEBAR) */}
      <div
        className={`fixed left-0 top-0 h-full w-72 bg-white text-gray-800 z-[110] shadow-2xl transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div 
          style={{ backgroundColor: timeTheme.bg }}
          className="p-5 text-white flex justify-between items-center shadow-lg border-b-4 border-jw-blue transition-colors duration-1000"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-jw-accent" />
            <span className="text-sm tracking-widest font-black uppercase italic">
              Navegación
            </span>
          </div>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="hover:bg-white/10 p-1 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-300" />
          </button>
        </div>

        <div className="p-4 space-y-2 text-left">
          <NavLink
            to="/"
            onClick={closeMenus}
            className={({ isActive }) =>
              `flex items-center gap-4 p-4 rounded-xl text-base font-medium transition-all border active:scale-95 ${
                isActive
                  ? "bg-jw-blue text-white border-jw-blue shadow-lg"
                  : "bg-white border-gray-100 text-gray-600 hover:bg-jw-body hover:border-jw-blue/20"
              }`
            }
          >
            <Home className="w-5 h-5" />
            <span>Inicio</span>
          </NavLink>
          <NavLink
            to="/publicaciones"
            onClick={closeMenus}
            className={({ isActive }) =>
              `flex items-center gap-4 p-4 rounded-xl text-base font-medium transition-all border active:scale-95 ${
                isActive
                  ? "bg-jw-blue text-white border-jw-blue shadow-lg"
                  : "bg-white border-gray-100 text-gray-600 hover:bg-jw-body hover:border-jw-blue/20"
              }`
            }
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