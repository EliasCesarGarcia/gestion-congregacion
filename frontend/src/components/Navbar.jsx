/**
 * ARCHIVO: Navbar.jsx
 * UBICACIÓN: frontend/src/components/Navbar.jsx
 * DESCRIPCIÓN: Barra de navegación principal con posicionamiento fijo.
 * Maneja el menú lateral (Sidebar), el título dinámico basado en la ruta,
 * el acceso al perfil de usuario con refresco de caché de imagen.
 * Ahora incluye lógica adaptable de colores y saludos según el horario local.
 */

// --- IMPORTACIONES DE LIBRERÍAS ---
import { useLocation, NavLink, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
// NUEVO: Importación para el soporte de traducción de react-i18next
import { useTranslation } from "react-i18next";

// --- IMPORTACIÓN DE ICONOS (LUCIDE-REACT) ---
// Optimizado: Se elimina ChevronDown que no se utilizaba para evitar advertencias de ESLint
import {
  Menu,
  Home,
  User,
  LogOut,
  Settings,
  X,
  BookOpen,
  ShieldCheck,
  Globe,
  LayoutGrid,
} from "lucide-react";

function Navbar() {
  // --- 1. CONFIGURACIÓN, ESTADOS Y CONTEXTO ---
  const { t, i18n } = useTranslation();

  // Consumo del estado global: sesión de usuario (Se remueve activeTheme para evitar no-unused-vars)
  const { user: session, logout } = useContext(AppContext);

  // Lógica de "Nesting Fix": Extrae datos si vienen anidados en .user o usa la raíz
  const user = session?.user || session;

  // NUEVO: Detección dinámica de dirección (LTR / RTL)
  const isRtl = i18n.dir
    ? i18n.dir() === "rtl"
    : ["ar", "he"].includes(i18n.language);

  // NUEVO: Direcciones dinámicas para las animaciones del menú según el sentido de lectura
  const rtlTranslate = isRtl ? "-translate-x-1" : "translate-x-1";
  const rtlRotate = isRtl ? "group-hover:-rotate-3" : "group-hover:rotate-3";

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
   * @returns {string} Texto identificador de la página traducido
   */
  const getTitle = () => {
    if (location.pathname === "/perfil")
      return t("nav_profile_admin", "Administración de Cuenta");
    if (location.pathname === "/publicaciones")
      return t("nav_publications_mod", "Módulo Publicaciones");
    if (location.pathname === "/seguridad-tips")
      return t("nav_security_dig", "Seguridad Digital");
    if (location.pathname === "/contacto")
      return t("nav_help_contact", "Centro de Ayuda y Contacto");
    if (location.pathname === "/configuracion")
      return t("nav_config", "Configuración");
    return `${t("nav_congregation", "Congregación")} ${user?.congregacion_nombre || ""}`;
  };

  /**
   * Determina el saludo según el horario actual y el idioma seleccionado
   * @returns {string} Saludo traducido
   */
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return t("greeting_morning", "Buenos días,");
    if (hour >= 12 && hour < 19)
      return t("greeting_afternoon", "Buenas tardes,");
    return t("greeting_night", "Buenas noches,");
  };

  /**
   * Mapea la región de la base de datos a una clave de traducción
   * @param {string} regionName Nombre de la región en la base de datos
   * @returns {string} Clave de traducción
   */
  const getRegionKey = (regionName) => {
    const map = {
      Asia: "region_asia",
      África: "region_africa",
      Europa: "region_europa",
      "América del Norte": "region_north_america",
      "América Central": "region_central_america",
      "América del Sur": "region_south_america",
      Oceanía: "region_oceania",
    };
    return map[regionName] || "nav_undefined";
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
      {/* Contenedor único que lee la imagen estática desde el CSS */}
      <div className="theme-bg-navbar"></div>

      {/* 
          --- CAPA DE DESENFOQUE (BACKDROP) --- 
          Se activa cuando cualquier menú está abierto. 
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
            aria-label={t("nav_open_menu", "Abrir menú de navegación")}
            className={`p-1.5 sm:p-2 hover:bg-white/20 text-jw-text-light hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 shrink-0 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] ${isRtl ? "ml-1" : "mr-1"}`}
          >
            <Menu className="w-7 h-7" />
          </button>

          {/* Enlace rápido a Inicio */}
          <NavLink
            to="/"
            onClick={closeMenus}
            aria-label={t("nav_go_home", "Ir al inicio")}
            className={`p-1.5 sm:p-2 hover:bg-white/20 text-jw-text-light hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 shrink-0 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] ${isRtl ? "ml-2 sm:ml-3" : "mr-2 sm:mr-3"}`}
          >
            <Home className="w-7 h-7" />
          </NavLink>

          <div
            className={`flex flex-row items-baseline gap-2 sm:gap-3 ${isRtl ? "border-r pr-3 sm:pr-4" : "border-l pl-3 sm:pl-4"} border-white/20 min-w-0 flex-grow overflow-hidden`}
          >
            <span className="text-base font-normal tracking-wide text-jw-text-light opacity-80 hidden lg:block italic shrink-0">
              {t("nav_system_title", "Sistema de Gestión")}
            </span>
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm sm:text-lg font-medium tracking-tight text-jw-text-light truncate block min-w-0 flex-grow">
                {getTitle()}
              </span>
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
            aria-label={t(
              "nav_my_account_options",
              "Ver opciones de mi cuenta",
            )}
            className="flex items-center gap-3 sm:gap-5 p-0 px-1 hover:bg-white/20 rounded-full transition-all active:scale-95 border border-transparent"
          >
            {/* Saludo y nombre de usuario (Alineación invertida dinámicamente si es RTL) */}
            <div
              className={`hidden md:flex flex-col ${isRtl ? "items-start text-left" : "items-end text-right"} leading-none shrink min-w-0 overflow-hidden`}
            >
              <span className="text-[10px] font-medium text-jw-text-light opacity-80 uppercase tracking-widest mb-1">
                {t("nav_my_account", "Mi Cuenta")}
              </span>
              <span className="text-base font-light italic text-jw-text-light">
                {getGreeting()}{" "}
                <span className="font-medium not-italic truncate">
                  {user?.nombre_completo?.split(" ").reverse().join(" ")}
                </span>
              </span>
            </div>

            {/* Contenedor circular del Avatar */}
            <div className="w-14 h-14 rounded-full border-2 border-jw-accent overflow-hidden bg-jw-body flex items-center justify-center shrink-0 shadow-md">
              {user?.foto_url ? (
                <img
                  src={getProfileImage()}
                  alt={t("nav_my_profile_alt", "Mi perfil")}
                  className="w-full h-full object-cover"
                  key={user.foto_url}
                  fetchPriority="high"
                />
              ) : (
                <User className="text-gray-400 w-7 h-7" />
              )}
            </div>
          </button>

          {/* 
              --- DROPDOWN DE PERFIL (VENTANA IZQUIERDA EN RTL / DERECHA EN LTR) --- 
          */}
          {isProfileOpen && (
            <div
              className={`absolute ${isRtl ? "left-0" : "right-0"} top-full mt-1 w-62 bg-jw-card z-[160] rounded-2xl shadow-2xl border border-jw-border overflow-hidden text-jw-text-main animate-in fade-in slide-in-from-top-2 duration-200 transition-colors`}
            >
              {/* Cabecera del Dropdown */}
              <div
                className={`py-4 px-6 menu-header-dynamic ${isRtl ? "text-start" : "text-start"} relative z-20`}
              >
                <p className="text-lg font-bold leading-tight text-white drop-shadow-sm">
                  {user?.nombre_completo}
                </p>
                <p className="text-sm text-white/70 italic mt-0.5 font-light">
                  @{user?.username}
                </p>
              </div>

              {/* Cuerpo de información institucional */}
              <div
                className={`p-4 text-xs text-jw-text-main leading-relaxed italic ${isRtl ? "text-right" : "text-left"}`}
              >
                <div
                  className={`px-1 ${isRtl ? "border-r-4 pr-3" : "border-l-4 pl-3"} border-jw-accent`}
                >
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
                      {t("nav_region", "Región")}{" "}
                      {user?.region
                        ? t(getRegionKey(user.region), user.region)
                        : t("nav_undefined", "No definida")}
                    </p>
                  </div>
                </div>

                <hr className="border-jw-border my-4" />

                {/* Botones de acción rápida */}
                <div className="space-y-1 mt-4">
                  <button
                    onClick={() => {
                      navigate("/perfil");
                      closeMenus();
                    }}
                    className={`w-full flex items-center gap-3 p-2 hover:bg-jw-accent/20 rounded-xl text-sm transition-all text-jw-text-main group ${isRtl ? "text-right" : "text-left"} font-medium active:scale-95`}
                  >
                    <Settings className="w-4 h-4 text-jw-accent" />
                    <span>{t("nav_admin_account", "Administrar cuenta")}</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 p-2 hover:bg-red-500/20 rounded-xl text-sm transition-all text-red-500 group ${isRtl ? "text-right" : "text-left"} font-medium active:scale-95`}
                  >
                    <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-600" />
                    <span>{t("nav_logout", "Cerrar sesión")}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 
          --- MENÚ LATERAL (DERECHA EN RTL / IZQUIERDA EN LTR) --- 
      */}
      <div
        className={`fixed top-0 h-screen w-60 md:w-70 bg-jw-card z-[150] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden shadow-2xl 
  ${isRtl ? "right-0 border-l border-jw-border" : "left-0 border-r border-jw-border"} 
  ${isMenuOpen ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"}`}
      >
        {/* --- AHORA (Nivel Dios) --- */}
        <div className="menu-header-dynamic py-5 px-5 text-jw-text-light flex justify-between items-start relative z-20">
          <div className="flex items-center gap-4">
            <LayoutGrid
              size={32}
              className="shrink-0 text-white drop-shadow-md"
            />
            <div className="flex flex-col items-start text-start">
              <span className="text-[10px] tracking-[0.3em] font-black uppercase opacity-60">
                {t("nav_menu_title", "Menú Principal")}
              </span>
              <span className="text-sm font-bold italic text-white">
                {user?.congregacion_nombre}
              </span>
            </div>
          </div>
          {/* Botón X de cierre corregido con inset-inline-end */}
          <button
            onClick={() => setIsMenuOpen(false)}
            className="hover:bg-white/20 p-2 rounded-full transition-all"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Listado de navegación dinámica con i18n */}
        <div
          className={`p-1 space-y-1 overflow-y-auto h-[calc(100%-60px)] custom-scrollbar ${isRtl ? "text-right" : "text-left"} mt-2`}
        >
          {[
            {
              to: "/",
              icon: <Home size={22} />,
              label: t("nav_home", "Inicio"),
            },
            {
              to: "/publicaciones",
              icon: <BookOpen size={22} />,
              label: t("nav_publications", "Publicaciones"),
            },
            {
              to: "/seguridad-tips",
              icon: <ShieldCheck size={22} />,
              label: t("nav_security", "Seguridad Digital"),
            },
            {
              to: "/contacto",
              icon: <Globe size={22} />,
              label: t("nav_help", "Ayuda y Contacto"),
            },
            {
              to: "/perfil",
              icon: <User size={22} />,
              label: t("nav_profile", "Mi Perfil"),
            },
            {
              to: "/configuracion",
              icon: <Settings size={22} />,
              label: t("nav_config", "Configuración"),
            },
          ].map((item) => {
            const isAct = location.pathname === item.to;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMenus}
                className={({ isActive }) => `
                  group relative flex items-center gap-3 py-2 px-5 text-sm font-medium transition-all duration-300 ${isRtl ? "border-r-4" : "border-l-4"}
                  ${
                    isActive
                      ? "nav-item-selected text-jw-text-light shadow-lg z-10"
                      : `bg-transparent text-jw-text-main hover:bg-jw-accent/30 rounded-2xl ${isRtl ? "rounded-r-none" : "rounded-l-none"} border-transparent`
                  }
                `}
              >
                <span
                  className={`shrink-0 transition-all duration-300 ${
                    isAct
                      ? `scale-125 ${rtlTranslate}`
                      : `group-hover:scale-125 group-hover:${rtlTranslate} ${rtlRotate}`
                  }`}
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
          <p className="text-[0.65rem] font-medium tracking-[0.4em] uppercase text-center text-jw-text-main">
            S.G. v2.6
          </p>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
