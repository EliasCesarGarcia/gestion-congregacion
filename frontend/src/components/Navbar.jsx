/**
 * ARCHIVO: Navbar.jsx
 * UBICACIÓN: frontend/src/components/Navbar.jsx
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

// --- IMPORTACIONES DE LIBRERÍAS ---
import { useLocation, NavLink, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";

// --- IMPORTACIÓN DE ICONOS (LUCIDE-REACT) ---
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
  LayoutGrid,
} from "lucide-react";

function Navbar() {
  // --- 1. CONFIGURACIÓN, ESTADOS Y CONTEXTO ---

  // Consumo del estado global: sesión de usuario y tema dinámico horario
  // CAMBIO: Desestructuramos activeTheme en lugar de timeTheme
  const { user: session, logout, activeTheme } = useContext(AppContext);

  // Lógica de "Nesting Fix": Extrae datos si vienen anidados en .user o usa la raíz
  // Creamos la constante 'user' extrayendo los datos reales (session.user)
  const user = session?.user || session;

  // Estados locales para el control de apertura de menús
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Menú lateral izquierdo
  const [isProfileOpen, setIsProfileOpen] = useState(false); // Dropdown de perfil derecho

  // Hooks de navegación y ubicación de React Router
  const navigate = useNavigate();
  const location = useLocation();

  // --- 2. FUNCIONES DE INTERACCIÓN (LÓGICA) ---

  /**
   * Cierra todos los componentes flotantes (Sidebar y Perfil)
   */
  const closeMenus = () => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
  };

  /**
   * Gestiona el proceso de salida segura y redirección al Login
   */
  const handleLogout = () => {
    logout();
    closeMenus();
    navigate("/login");
  };

  /**
   * Determina el título de la barra superior basado en la ruta actual
   * @returns {string} Texto identificador de la página
   */
  const getTitle = () => {
    if (location.pathname === "/perfil") return "Administración de Cuenta";
    if (location.pathname === "/publicaciones") return "Módulo Publicaciones";
    if (location.pathname === "/seguridad-tips") return "Seguridad Digital";
    if (location.pathname === "/contacto") return "Centro de Ayuda y Contacto";
    if (location.pathname === "/configuracion") return "Configuración";
    return `Congregación ${user?.congregacion_nombre || ""}`;
  };

  /**
   * Define qué icono mostrar al lado del título y su comportamiento
   * @returns {JSX.Element|null} Icono correspondiente o null para Home
   */
  const getPageIcon = () => {
    const size = "w-6 h-6"; // Tamaño base para iconos del Navbar

    // Exclusión de icono en Home para reducir redundancia visual
    if (location.pathname === "/") return null;

    // Mapeo de iconos por ruta
    if (location.pathname === "/perfil") return <User className={size} />;
    if (location.pathname === "/publicaciones")
      return <BookOpen className={size} />;
    if (location.pathname === "/seguridad-tips")
      return <ShieldCheck className={size} />;
    if (location.pathname === "/contacto") return <Globe className={size} />;
    if (location.pathname === "/configuracion")
      return <Settings className={size} />;

    return null; // Por seguridad, si no coincide ninguna, no muestra nada
  };

  /**
   * Procesa la fuente de la imagen de perfil (Local o Supabase)
   * @returns {string|null} URL final de la imagen
   */
  const getProfileImage = () => {
    if (!user?.foto_url) return null;
    // Si es un avatar institucional local o una URL absoluta externa
    if (
      user.foto_url.startsWith("/avatars/") ||
      user.foto_url.startsWith("http")
    ) {
      return user.foto_url;
    }
    // Si es una imagen subida a Supabase (aplica transformación WebP)
    return `https://zigdywbtvyvubgnziwtn.supabase.co/storage/v1/object/public/People_profile/${user.foto_url}?width=120&quality=80&format=webp`;
  };

  useEffect(() => {
    // Si cualquiera de los dos menús está abierto, añadimos la clase 'menu-open' al body
    if (isMenuOpen || isProfileOpen) {
      document.body.classList.add("body-freeze");
    } else {
      document.body.classList.remove("body-freeze");
    }

    // Limpieza al desmontar el componente
    return () => document.body.classList.remove("body-freeze");
  }, [isMenuOpen, isProfileOpen]);

  return (
    <nav className="bg-jw-navy/70 backdrop-blur-md text-jw-text-light fixed top-0 left-0 z-[100] h-16 flex items-center shadow-lg px-2 sm:px-6 w-full transition-colors duration-700">
      {/* NUEVO: Contenedor único que lee la imagen estática desde el CSS */}
      <div className="theme-bg-navbar"></div>

      {/* 
          --- CAPA DE DESENFOQUE (BACKDROP) --- 
          Se activa cuando cualquier menú está abierto. 
          z-[-1] permite que el fondo se desenfoque bajo el Navbar pero sobre el contenido del body.
      */}
      {(isMenuOpen || isProfileOpen) && (
        <div
          className="fixed inset-0 z-[-1] bg-black/10 transition-opacity duration-500 w-screen h-screen"
          style={{
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
          onClick={closeMenus}
        />
      )}

      <div className="w-full flex items-center justify-between gap-2 relative z-10">
        {/* --- SECCIÓN IZQUIERDA: MENÚ, HOME Y TÍTULO DINÁMICO --- */}
        <div
          className={`flex items-center z-50 min-w-0 flex-1 transition-all duration-100 
    ${isMenuOpen || isProfileOpen ? "blur-[2px] opacity-100 pointer-events-none" : "blur-0 opacity-100"}`}
        >
          {/* Disparador del Menú Lateral (Sidebar) */}
          <button
            onClick={() => {
              setIsMenuOpen((prev) => !prev);
              setIsProfileOpen(false);
            }}
            aria-label="Abrir menú de navegación"
            /* CAMBIO: text-jw-text-light para que use el color de texto claro del tema */
            className="p-1.5 sm:p-2 hover:bg-white/20 text-jw-text-light hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 mr-1 shrink-0 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            <Menu className="w-7 h-7" />
          </button>

          {/* Enlace rápido a Inicio */}
          <NavLink
            to="/"
            onClick={closeMenus}
            aria-label="Ir al inicio"
            /* CAMBIO: text-jw-text-light en lugar de text-jw-accent-light */
            className="p-1.5 sm:p-2 hover:bg-white/20 text-jw-text-light hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 mr-2 sm:mr-3 shrink-0 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            <Home className="w-7 h-7" />
          </NavLink>

          <div className="flex flex-row items-baseline gap-2 sm:gap-3 border-l border-white/20 pl-3 sm:pl-4 min-w-0 flex-grow overflow-hidden">
            {/* CAMBIO: text-jw-text-light/80 para que "Sistema de Gestión" sea dinámico pero un poco más sutil */}
            <span className="text-base font-normal tracking-wide text-jw-text-light opacity-80 hidden lg:block italic shrink-0">
              Sistema de Gestión
            </span>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm sm:text-lg font-medium tracking-tight text-jw-text-light truncate block min-w-0 flex-grow">
                {getTitle()}
              </span>
              {/* CAMBIO: text-jw-text-light para el icono de la página */}
              <div className="text-jw-text-light animate-spin-y shrink-0">
                {getPageIcon()}
              </div>
            </div>
          </div>
        </div>

        {/* --- SECCIÓN DERECHA: IDENTIFICACIÓN Y PERFIL --- */}
        <div className="relative z-50 flex items-center justify-end">
          {/* Botón disparador del Dropdown de Perfil */}
          <button
            onClick={() => {
              setIsProfileOpen((prev) => !prev);
              setIsMenuOpen(false); // Cierre de exclusión mutua
            }}
            aria-label="Ver opciones de mi cuenta"
            className="flex items-center gap-3 sm:gap-5 p-0 px-1 hover:bg-white/20 rounded-full transition-all active:scale-95 border border-transparent"
          >
            {/* Saludo y nombre de usuario (Solo visible en tablets y escritorio) */}
            {/* shrink permite que esta sección se achique si el título de la izquierda crece mucho */}
            {/* Saludo y nombre de usuario */}
            <div className="hidden md:flex flex-col items-end text-right leading-none shrink min-w-0 overflow-hidden">
              {/* CAMBIO: text-jw-text-light/80 en lugar de text-jw-accent-light para "Mi Cuenta" */}
              <span className="text-[10px] font-medium text-jw-text-light opacity-80 uppercase tracking-widest mb-1">
                Mi Cuenta
              </span>
              {/* CAMBIO: Aseguramos que el saludo use text-jw-text-light */}
              <span className="text-base font-light italic text-jw-text-light">
                {activeTheme.greeting}{" "}
                <span className="font-medium not-italic truncate">
                  {user?.nombre_completo?.split(" ").reverse().join(" ")}
                </span>
              </span>
            </div>

            {/* Contenedor circular del Avatar con borde de color institucional */}
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
                <User className="text-gray-400 w-7 h-7" /> // Icono por defecto si no hay imagen
              )}
            </div>
          </button>

          {/* 
              --- DROPDOWN DE PERFIL (VENTANA DERECHA) --- 
              Incluye datos de congregación, dirección y botones de acción.
          */}
          {isProfileOpen && (
            <div className="absolute right-0 top-full mt-1 w-62 bg-jw-card z-[160] rounded-2xl shadow-2xl border border-jw-border overflow-hidden text-jw-text-main animate-in fade-in slide-in-from-top-2 duration-200 transition-colors">
              {/* Cabecera del Dropdown adaptada al tema */}
              <div className="p-4 bg-transparent border-b border-jw-border/10 text-left relative z-20">
                <p className="text-base font-bold leading-tight text-jw-text-light">
                  {user?.nombre_completo}
                </p>
                <p className="text-base text-jw-text-light opacity-80 italic mt-0.5 font-light">
                  @{user?.username}
                </p>
              </div>

              {/* Cuerpo de información institucional */}
              <div className="p-4 text-xs text-jw-text-main leading-relaxed italic text-left">
                <div className="px-1 border-l-4 border-jw-accent pl-3">
                  <div className="mb-2">
                    <p className="font-bold not-italic text-jw-text-main text-base leading-tight">
                      {user?.congregacion_nombre}
                    </p>
                  </div>

                  <div className="space-y-1 mb-1">
                    <p className="font-medium">{user?.direccion}</p>
                    <p>
                      {user?.ciudad}, {user?.partido}
                    </p>
                    <p className="opacity-70">
                      {user?.provincia}, {user?.pais}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-gray-50 mt-2">
                    <Globe
                      size={13}
                      className="shrink-0 text-jw-accent-light"
                    />
                    <p className="font-normal uppercase tracking-widest text-[10px] not-italic">
                      Región {user?.region || "No definida"}
                    </p>
                  </div>
                </div>

                <hr className="border-jw-border my-4" />

                {/* Botones de acción rápida - AHORA SE ILUMINAN */}
                <div className="space-y-1 mt-4">
                  <button
                    onClick={() => {
                      navigate("/perfil");
                      closeMenus();
                    }}
                    className="w-full flex items-center gap-3 p-2 hover:bg-jw-accent/20 rounded-xl text-sm transition-all text-jw-text-main group text-left font-medium active:scale-95"
                  >
                    <Settings className="w-4 h-4 text-jw-accent" />
                    <span>Administrar cuenta</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-2 hover:bg-red-500/20 rounded-xl text-sm transition-all text-red-500 group text-left font-medium active:scale-95"
                  >
                    <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-600" />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 
          --- MENÚ LATERAL IZQUIERDO (SIDEBAR) --- 
          Diseño flotante con bordes redondeados y efectos minimalistas.
      */}
      <div
        className={`fixed left-1 top-1.5 h-[calc(100vh-16px)] rounded-2xl w-72 md:w-70 bg-jw-card z-[150] shadow-[20px_0_50px_rgba(0,0,0,0.1)] transition-transform duration-500 ease-[cubic-bezier(0.2,1,0.2,1)] overflow-hidden border border-jw-border will-change-transform ${
          isMenuOpen ? "translate-x-0" : "-translate-x-[calc(100%+20px)]"
        }`}
      >
        <div className="bg-transparent border-b border-jw-border/10 py-4 px-6 text-jw-text-light flex justify-between items-center relative z-20">
          <div className="flex items-center gap-4">
            {/* Icono de menú principal (26px) */}
            <LayoutGrid
              size={28}
              className="shrink-0 text-jw-text-light opacity-80"
            />
            <span className="text-xs tracking-[0.25em] font-medium uppercase leading-none text-jw-text-light">
              Menú Principal
            </span>
          </div>
          <button
            onClick={() => {
              setIsMenuOpen((prev) => !prev);
              setIsProfileOpen(false);
            }}
            aria-label="Cerrar menú"
            className="hover:bg-white/20 p-1.5 rounded-full transition-all active:scale-75 text-jw-text-light"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Listado de navegación dinámica mediante .map para escalabilidad */}
        <div className="p-1 space-y-1 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar text-left mt-2">
          {[
            { to: "/", icon: <Home size={22} />, label: "Inicio" },
            {
              to: "/publicaciones",
              icon: <BookOpen size={22} />,
              label: "Publicaciones",
            },
            {
              to: "/seguridad-tips",
              icon: <ShieldCheck size={22} />,
              label: "Seguridad Digital",
            },
            {
              to: "/contacto",
              icon: <Globe size={22} />,
              label: "Ayuda y Contacto",
            },
            { to: "/perfil", icon: <User size={22} />, label: "Mi Perfil" },
            {
              to: "/configuracion",
              icon: <Settings size={22} />,
              label: "Configuración",
            },
          ].map((item) => {
            // Esta es la variable que debes usar
            const isAct = location.pathname === item.to;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMenus}
                className={({ isActive }) => `
          group relative flex items-center gap-3 py-2 px-5 text-sm font-bold transition-all duration-300 border-l-4
          ${
            isActive
              ? "bg-jw-navy/85 text-jw-text-light border-jw-navy rounded-r-2xl rounded-l-none shadow-lg z-10"
              : "bg-transparent text-jw-text-main  hover:bg-jw-accent/30 rounded-2xl rounded-l-none border-transparent"
          }
        `}
              >
                {/* CORRECCIÓN AQUÍ: Usamos isAct en lugar de isActive */}
                <span
                  className={`shrink-0 transition-transform duration-500 ${isAct ? "scale-110" : "group-hover:scale-110"}`}
                >
                  {item.icon}
                </span>

                <span className="relative z-10 tracking-wide">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>

        {/* Pie de Menú con branding sutil y versión del sistema */}
        <div className="absolute bottom-1 left-0 w-full px-2 opacity-80 border-t border-jw-border pt-2">
          {/* CAMBIO: text-jw-text-main en lugar de text-jw-text-main/70 para asegurar contraste */}
          <p className="text-[0.65rem] font-medium tracking-[0.4em] uppercase text-center text-jw-text-main">
            S.G. v2.6
          </p>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
