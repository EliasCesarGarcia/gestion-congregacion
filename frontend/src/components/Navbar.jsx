/**
 * ARCHIVO: Navbar.jsx
 * UBICACIÓN: src/components/Navbar.jsx
 * DESCRIPCIÓN: Barra de navegación principal con posicionamiento fijo.
 * Maneja el menú lateral (Sidebar), el título dinámico basado en la ruta,
 * el acceso al perfil de usuario con refresco de caché de imagen
 * y un menú desplegable con información detallada de la congregación.
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
} from "lucide-react";

function Navbar() {
  // --- 1. CONFIGURACIÓN Y ESTADOS ---
  const { user, logout } = useContext(AppContext);
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

  // Define el título mostrado en la barra según la página actual
  const getTitle = () => {
    if (location.pathname === "/perfil") return "Administración de Cuenta";
    if (location.pathname === "/publicaciones") return "Módulo Publicaciones";
    if (location.pathname === "/seguridad-tips") return "Seguridad Digital";
    if (location.pathname === "/contacto") return "Centro de Ayuda y Contacto";
    return `Congregación ${user?.congregacion_nombre || ""}`;
  };

  // --- 3. GESTIÓN DE IMAGEN (LÓGICA HÍBRIDA) ---
  // Esta función centraliza la lógica para que el Navbar siempre muestre la foto correcta
  const getProfileImage = () => {
    if (!user?.foto_url) return null;

    // Si la foto es una ilustración local o un link externo
    if (
      user.foto_url.startsWith("/avatars/") ||
      user.foto_url.startsWith("http")
    ) {
      return user.foto_url;
    }

    // Si es una foto subida a Supabase
    return `https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/${user.foto_url}?width=120&quality=80&format=webp`;
  };

  return (
    /**
     * CONTENEDOR PRINCIPAL (FIXED)
     */
    <nav
      className="bg-jw-navy text-white fixed top-0 left-0 z-[100] h-16 flex items-center shadow-lg px-2 sm:px-6 w-full"
      style={{ transform: "translateZ(0)", WebkitTransform: "translateZ(0)" }}
    >
      {/* Fondo invisible para cerrar menús al hacer clic fuera */}
      {(isMenuOpen || isProfileOpen) && (
        <div
          className="fixed inset-0 z-[45] w-screen h-screen bg-transparent cursor-default"
          onClick={closeMenus}
        ></div>
      )}

      <div className="w-full flex items-center justify-between">
        {/* ==========================================
            SECCIÓN IZQUIERDA: MENÚ, HOME Y TÍTULO
            ========================================== */}
        <div className="flex items-center z-50 min-w-0">
          {/* Botón Hamburguesa Menú Lateral */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Abrir menú de navegación"
            className="p-1.5 sm:p-2 hover:bg-white/20 hover:text-white hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 mr-1 shrink-0 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            <Menu className="w-7 h-7" />
          </button>

          {/* Botón Inicio */}
          <NavLink
            to="/"
            onClick={closeMenus}
            aria-label="Ir al inicio"
            className="p-1.5 sm:p-2 hover:bg-white/20 hover:text-white hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 mr-2 sm:mr-3 text-jw-accent-light shrink-0 hover:shadow-[0_0_15px_rgba(74,109,167,0.3)]"
          >
            <Home className="w-7 h-7" />
          </NavLink>

          {/* Contenedor de Título */}
          <div className="flex flex-row items-baseline gap-2 sm:gap-3 border-l border-white/20 pl-3 sm:pl-4 min-w-0">
            <span className="text-sm font-light tracking-wide text-gray-300 hidden lg:block italic shrink-0">
              Sistema de Gestión
            </span>
            <span className="text-sm sm:text-lg font-medium tracking-tight text-white truncate">
              {getTitle()}
            </span>
          </div>
        </div>

        {/* ==========================================
            SECCIÓN DERECHA: PERFIL Y AVATAR (ALINEADO TOTAL A LA DERECHA)
            ========================================== */}
        <div className="relative z-50 flex items-center justify-end">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-label="Ver opciones de mi cuenta" // <--- AGREGAR ESTO
            className="flex items-center gap-3 sm:gap-5 p-1 hover:bg-white/10 rounded-full transition-all active:scale-95 border border-transparent"
          >
            {/* Saludo y Nombre: Empujado a la derecha */}
            <div className="hidden md:flex flex-col items-end text-right leading-none">
              <span className="text-[10px] font-medium text-jw-accent-light uppercase tracking-widest mb-1">
                Mi Cuenta
              </span>
              <span className="text-base font-light italic">
                Hola,{" "}
                <span className="font-medium not-italic">
                  {user?.nombre_completo?.split(" ").reverse().join(" ")}
                </span>
              </span>
            </div>

            {/* IMAGEN DE PERFIL: Agrandada levemente y con borde institucional */}
            <div className="w-14 h-14 rounded-full border-2 border-jw-accent overflow-hidden bg-jw-body flex items-center justify-center shrink-0 shadow-md">
              {user?.foto_url ? (
                <img
                  src={getProfileImage()}
                  alt="Mi perfil"
                  className="w-full h-full object-cover"
                  key={user.foto_url}
                  fetchPriority="high" // SEO 2026: Le dice al navegador que esta es prioridad 1
                />
              ) : (
                <User className="text-gray-400 w-7 h-7" />
              )}
            </div>
          </button>

          {/* ==========================================
              VENTANA EMERGENTE (DROPDOWN) DEL PERFIL
              ========================================== */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-jw-border overflow-hidden text-gray-800 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Encabezado del Dropdown */}
              <div className="p-4 bg-jw-body border-b border-jw-border text-left">
                <p className="text-base font-bold leading-tight text-jw-navy">
                  {user?.nombre_completo}
                </p>
                <p className="text-xs text-jw-blue italic mt-0.5 font-light">
                  @{user?.username}
                </p>
              </div>

              {/* Datos de Ubicación de la Congregación */}
              <div className="p-4 space-y-3 text-xs text-gray-700 leading-relaxed italic text-left">
                <div className="px-1 border-l-4 border-jw-accent pl-3">
                  <p className="font-bold not-italic text-jw-navy text-sm mb-1">
                    {user?.congregacion_nombre}
                  </p>
                  <p className="font-medium">{user?.direccion}</p>
                  <p>
                    {user?.ciudad}, {user?.partido}
                  </p>
                  <p className="text-gray-400">
                    {user?.provincia}, {user?.pais} ({user?.region})
                  </p>
                  <p className="text-jw-blue mt-1 font-normal not-italic tracking-widest uppercase text-[13px]">
                    N° {user?.numero_congregacion}
                  </p>
                </div>

                <hr className="border-jw-border my-2" />

                {/* Botones de Acción */}
                <div className="space-y-0">
                  <button
                    onClick={() => {
                      navigate("/perfil");
                      closeMenus();
                    }}
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

      {/* ==========================================
          MENÚ LATERAL DESLIZABLE (SIDEBAR)
          ========================================== */}
      <div
        className={`fixed left-0 top-0 h-full w-72 bg-white text-gray-800 z-[110] shadow-2xl transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-5 bg-jw-navy text-white flex justify-between items-center shadow-lg border-b-4 border-jw-blue">
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

        {/* Lista de Módulos */}
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
