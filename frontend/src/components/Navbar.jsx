/**
 * ARCHIVO: Navbar.jsx
 * UBICACIÓN: frontend/src/components/Navbar.jsx
 * DESCRIPCIÓN: Barra de navegación principal con posicionamiento fijo.
 * Maneja el menú lateral (Sidebar), el título dinámico basado en la ruta,
 * el acceso al perfil de usuario con refresco de caché de imagen.
 * Ahora incluye lógica adaptable de colores y saludos según el horario local.
 */

// --- IMPORTACIONES DE LIBRERÍAS ---
import { useLocation, NavLink, useNavigate, matchPath } from "react-router-dom";
import { useContext, useState, useEffect, useRef } from "react";
import { AppContext } from "../context/AppContext";
// NUEVO: Importación para el soporte de traducción de react-i18next
import { useTranslation } from "react-i18next";
import { MODULOS_UI } from "../config/modulosConfig";
// Estilos propios del menú lateral (colores solo con variables de tema jw-*)
import "../styles/menuLateral.css";

// --- IMPORTACIÓN DE ICONOS (LUCIDE-REACT) ---
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
  SlidersHorizontal,
  UserCog,
  Tag,
  Building2,
  Users,
  Briefcase,
  ListChecks,
  Cog,
  ChevronDown,
} from "lucide-react";

// Texto de versión que se muestra al pie del menú lateral
const VERSION_SISTEMA = "S.G. v2.6";

function Navbar() {
  // --- 1. CONFIGURACIÓN, ESTADOS Y CONTEXTO ---
  const { t, i18n } = useTranslation();

  // ✅ Solo destructuramos lo que Navbar realmente utiliza
  const { user, logout, modulos, permisos } = useContext(AppContext);

  // Menú lateral. Cada entrada es un enlace ({ to, icon, label }) o un grupo
  // desplegable ({ id, icon, label, items: [{ to, label }] }).
  // Los módulos del usuario que tengan pantalla (MODULOS_UI) se suman como enlaces.
  // Object.hasOwn evita que un id como "constructor" coincida con la tabla.
  const puedeGestionarPersonas =
    permisos.es_superadmin || permisos.es_encargado_general;

  // Parte de trabajo: inicio, módulos y grupos de gestión
  const entradasTrabajo = [
    { to: "/", icon: <Home />, label: t("nav_home", "Inicio") },
    ...modulos
      .filter((m) => Object.hasOwn(MODULOS_UI, m.id))
      .map((m) => {
        const { to, icon: Icono, labelKey } = MODULOS_UI[m.id];
        return { to, icon: <Icono />, label: t(labelKey, m.nombre) };
      }),
    // Coordinador, secretario, servicio y superadmin (el backend igual valida cada ruta)
    ...(puedeGestionarPersonas
      ? [
          {
            id: "personas",
            icon: <Users />,
            label: t("nav_group_personas", "Gestión de personas"),
            items: [
              {
                to: "/personas",
                label: t("nav_personas", "Personas"),
              },
              {
                to: "/admin/encargados",
                label: t("nav_admin_encargados", "Encargados de departamentos"),
              },
            ],
          },
        ]
      : []),
    // Solo se muestra al superadmin (el backend igual valida cada ruta)
    ...(permisos.es_superadmin
      ? [
          {
            id: "admin",
            icon: <Cog />,
            label: t("nav_group_admin", "Administración"),
            items: [
              {
                to: "/admin/cargos",
                label: t("nav_admin_cargos", "Cargos de la congregación"),
              },
              {
                to: "/admin/congregaciones",
                label: t("nav_admin_congregaciones", "Congregaciones"),
              },
              {
                to: "/admin/catalogo-motivos",
                label: t(
                  "nav_admin_catalogo_motivos",
                  "Motivos de personas y cargos",
                ),
              },
              {
                to: "/admin/motivos",
                label: t("nav_admin_motivos", "Motivos de puestos"),
              },
              {
                to: "/admin/modulos",
                label: t("nav_admin_modules", "Módulos del sistema"),
              },
            ],
          },
        ]
      : []),
  ];

  // Parte de la cuenta y la ayuda, separada del resto por una línea
  const entradasCuenta = [
    {
      to: "/seguridad-tips",
      icon: <ShieldCheck />,
      label: t("nav_security", "Seguridad Digital"),
    },
    {
      to: "/contacto",
      icon: <Globe />,
      label: t("nav_help", "Ayuda y Contacto"),
    },
    {
      to: "/perfil",
      icon: <User />,
      label: t("nav_profile", "Mi Perfil"),
    },
    {
      to: "/configuracion",
      icon: <Settings />,
      label: t("nav_config", "Configuración"),
    },
  ];

  // NUEVO: Detección dinámica de dirección (LTR / RTL)
  const isRtl = i18n.dir
    ? i18n.dir() === "rtl"
    : ["ar", "he"].includes(i18n.language);

  // Estados locales para el control de apertura de menús
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Menú lateral izquierdo
  const [isProfileOpen, setIsProfileOpen] = useState(false); // Dropdown de perfil derecho

  // Hooks de navegación y ubicación de React Router
  const navigate = useNavigate();
  const location = useLocation();

  // Referencias para el manejo del foco (teclado y lectores de pantalla)
  const botonMenuRef = useRef(null);
  const botonCerrarRef = useRef(null);

  // Grupos del menú que la persona abrió o cerró a mano. Al cambiar de página
  // se vuelve a la regla automática: se abre solo el grupo de la página actual.
  const [gruposManual, setGruposManual] = useState({});
  const [rutaAnterior, setRutaAnterior] = useState(location.pathname);
  if (rutaAnterior !== location.pathname) {
    setRutaAnterior(location.pathname);
    setGruposManual({});
  }

  // Misma regla que usa NavLink: coincide la ruta exacta o una subruta ("/personas/12")
  const rutaActiva = (to) =>
    !!matchPath({ path: to, end: to === "/" }, location.pathname);
  const grupoTieneRutaActiva = (grupo) =>
    grupo.items.some((item) => rutaActiva(item.to));
  const grupoAbierto = (grupo) =>
    gruposManual[grupo.id] ?? grupoTieneRutaActiva(grupo);
  const alternarGrupo = (grupo) =>
    setGruposManual((prev) => ({ ...prev, [grupo.id]: !grupoAbierto(grupo) }));

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
    if (location.pathname === "/admin/modulos")
      return t("nav_admin_modules", "Módulos del sistema");
    if (location.pathname.startsWith("/personas"))
      return t("nav_personas", "Personas");
    if (location.pathname === "/admin/encargados")
      return t("nav_admin_encargados", "Encargados de departamentos");
    if (location.pathname === "/admin/motivos")
      return t("nav_admin_motivos", "Motivos de puestos");
    if (location.pathname === "/admin/congregaciones")
      return t("nav_admin_congregaciones", "Congregaciones");
    if (location.pathname === "/admin/cargos")
      return t("nav_admin_cargos", "Cargos de la congregación");
    if (location.pathname === "/admin/catalogo-motivos")
      return t("nav_admin_catalogo_motivos", "Motivos de personas y cargos");
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
    if (location.pathname === "/admin/modulos")
      return <SlidersHorizontal className={size} />;
    if (location.pathname === "/admin/encargados")
      return <UserCog className={size} />;
    if (location.pathname === "/admin/motivos") return <Tag className={size} />;
    if (location.pathname === "/admin/congregaciones")
      return <Building2 className={size} />;
    if (location.pathname === "/admin/cargos")
      return <Briefcase className={size} />;
    if (location.pathname === "/admin/catalogo-motivos")
      return <ListChecks className={size} />;
    if (location.pathname.startsWith("/personas"))
      return <Users className={size} />;

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

  // Esc cierra los menús y devuelve el foco al botón que abre el menú lateral
  useEffect(() => {
    if (!isMenuOpen && !isProfileOpen) return;
    const alPulsarTecla = (e) => {
      if (e.key !== "Escape") return;
      const estabaElMenu = isMenuOpen;
      setIsMenuOpen(false);
      setIsProfileOpen(false);
      if (estabaElMenu) botonMenuRef.current?.focus();
    };
    document.addEventListener("keydown", alPulsarTecla);
    return () => document.removeEventListener("keydown", alPulsarTecla);
  }, [isMenuOpen, isProfileOpen]);

  // Al abrir el menú lateral el foco entra en él
  useEffect(() => {
    if (isMenuOpen) botonCerrarRef.current?.focus({ preventScroll: true });
  }, [isMenuOpen]);

  // Dibuja un enlace del menú (de primer nivel o dentro de un grupo)
  const renderEnlace = (item, esSubitem = false) => (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={closeMenus}
      className={({ isActive }) =>
        `menu-item${esSubitem ? " menu-item--sub" : ""}${isActive ? " menu-item--activo" : ""}`
      }
    >
      {!esSubitem && (
        <span className="menu-icono" aria-hidden="true">
          {item.icon}
        </span>
      )}
      <span className="menu-texto">{item.label}</span>
    </NavLink>
  );

  // Dibuja una entrada: enlace suelto o grupo desplegable
  const renderEntrada = (entrada) => {
    if (!entrada.items) {
      return <li key={entrada.to}>{renderEnlace(entrada)}</li>;
    }

    const abierto = grupoAbierto(entrada);
    const idSublista = `menu-sub-${entrada.id}`;

    return (
      <li key={entrada.id}>
        <button
          type="button"
          className={`menu-item menu-item--grupo${grupoTieneRutaActiva(entrada) ? " menu-item--grupo-activo" : ""}`}
          aria-expanded={abierto}
          aria-controls={idSublista}
          onClick={() => alternarGrupo(entrada)}
        >
          <span className="menu-icono" aria-hidden="true">
            {entrada.icon}
          </span>
          <span className="menu-texto">{entrada.label}</span>
          <span className="menu-chevron" aria-hidden="true">
            <ChevronDown />
          </span>
        </button>
        <div className="menu-subgrupo" data-open={abierto}>
          <ul id={idSublista} className="menu-sublista" inert={!abierto}>
            {entrada.items.map((item) => (
              <li key={item.to}>{renderEnlace(item, true)}</li>
            ))}
          </ul>
        </div>
      </li>
    );
  };

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
            ref={botonMenuRef}
            onClick={() => {
              setIsMenuOpen((prev) => !prev);
              setIsProfileOpen(false);
            }}
            aria-label={t("nav_open_menu", "Abrir menú de navegación")}
            aria-expanded={isMenuOpen}
            aria-controls="menu-lateral"
            className="p-1.5 sm:p-2 hover:bg-white/20 text-jw-text-light hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 shrink-0 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] me-1"
          >
            <Menu className="w-7 h-7" />
          </button>

          {/* Enlace rápido a Inicio */}
          <NavLink
            to="/"
            onClick={closeMenus}
            aria-label={t("nav_go_home", "Ir al inicio")}
            className="p-1.5 sm:p-2 hover:bg-white/20 text-jw-text-light hover:-translate-y-1 rounded-md transition-all duration-300 active:scale-90 shrink-0 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] me-2 sm:me-3"
          >
            <Home className="w-7 h-7" />
          </NavLink>

          <div
            className="flex flex-row items-baseline gap-2 sm:gap-3 border-s ps-3 sm:ps-4 border-white/20 min-w-0 flex-grow overflow-hidden"
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
            {/* Saludo y nombre de usuario (alineado al inicio del texto en cualquier idioma) */}
            <div className="hidden md:flex flex-col items-start text-start leading-none shrink min-w-0 overflow-hidden">
              <span className="text-[0.625rem] font-medium text-jw-text-light opacity-80 uppercase tracking-widest mb-1">
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
                <User className="text-jw-text-main/40 w-7 h-7" />
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
                className="py-4 px-6 menu-header-dynamic text-start relative z-20"
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
                className="p-4 text-xs text-jw-text-main leading-relaxed italic text-start"
              >
                <div className="px-1 border-s-4 ps-3 border-jw-accent">
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

                  <div className="flex items-center gap-2 pt-1 border-t border-jw-border mt-2">
                    <Globe className="w-3.5 h-3.5 shrink-0 text-jw-accent" />
                    <p className="font-normal uppercase tracking-widest text-[0.625rem] not-italic">
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
                    className={`w-full flex items-center gap-3 p-2 hover:bg-jw-accent/20 rounded-xl text-sm transition-all text-jw-text-main group text-start font-medium active:scale-95`}
                  >
                    <Settings className="w-4 h-4 text-jw-accent" />
                    <span>{t("nav_admin_account", "Administrar cuenta")}</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className={`w-full flex items-center gap-3 p-2 hover:bg-red-500/20 rounded-xl text-sm transition-all text-red-500 group text-start font-medium active:scale-95`}
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
          --- MENÚ LATERAL (a la derecha en idiomas RTL, a la izquierda en el resto) ---
          Estructura en columna: cabecera fija, lista con scroll propio y pie fijo.
          "inert" mientras está cerrado: no recibe foco ni lo leen los lectores de pantalla.
      */}
      <div
        id="menu-lateral"
        className="menu-lateral"
        data-open={isMenuOpen}
        inert={!isMenuOpen}
      >
        <div className="menu-header-dynamic shrink-0 py-5 px-5 text-jw-text-light flex justify-between items-start relative z-20">
          <div className="flex items-center gap-4">
            <LayoutGrid className="w-8 h-8 shrink-0 text-white drop-shadow-md" />
            <div className="flex flex-col items-start text-start">
              <span className="text-[0.625rem] tracking-[0.3em] font-black uppercase opacity-60">
                {t("nav_menu_title", "Menú Principal")}
              </span>
              <span className="text-sm font-bold italic text-white">
                {user?.congregacion_nombre}
              </span>
            </div>
          </div>
          <button
            ref={botonCerrarRef}
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              botonMenuRef.current?.focus();
            }}
            aria-label={t("nav_close_menu", "Cerrar menú de navegación")}
            className="hover:bg-white/20 p-2 rounded-full transition-all"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Lista de navegación: es lo único que se desplaza */}
        <div className="menu-scroll">
          <ul className="menu-lista">
            {entradasTrabajo.map(renderEntrada)}
            <li className="menu-separador" role="separator" />
            {entradasCuenta.map(renderEntrada)}
          </ul>
        </div>

        {/* Pie con la versión: ocupa su propio espacio, no tapa ninguna opción */}
        <div className="menu-pie">{VERSION_SISTEMA}</div>
      </div>
    </nav>
  );
}

export default Navbar;
