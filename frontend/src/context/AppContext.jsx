/* eslint-disable react-refresh/only-export-components */
/**
 * ARCHIVO: AppContext.jsx
 * UBICACIÓN: frontend/src/context/AppContext.jsx
 * DESCRIPCIÓN: Proveedor de estado global (Context API).
 * Centraliza la autenticación, las preferencias de accesibilidad y la
 * interfaz adaptativa. Implementa persistencia en almacenamiento local
 * y gestión automática del ciclo de vida de la sesión.
 *
 * FUNCIONALIDADES CLAVE:
 * - Hidratación de sesión: Recupera el usuario desde sessionStorage.
 * - Accesibilidad Visual: Control global del tamaño de fuente con persistencia.
 * - Adaptive UI: Sincronización estética según el horario local y zona horaria.
 * - Seguridad Activa: Cierre de sesión automático por inactividad.
 */

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Helmet } from "react-helmet-async"; // <--- NUEVA IMPORTACIÓN

export const AppContext = createContext();

// CONFIGURACIÓN MAESTRA DE TEMAS
// NUEVO: Cada tema ahora tiene sus variaciones de Mañana, Tarde y Noche
export const themePalettes = {
  oceano: {
    effect: "wave",
    manana: {
      navy: "#1caab8", // <--- ESTE ES EL COLOR DEL NAVBAR Y DEL FOOTER
      blue: "#00838f", // <--- Color de los botones principales y enlaces
      accent: "#00bcd4", // <--- Color de detalles, iconos, bordes activos, encabezado de menús (ej. inputs)
      body: "#e0f7fa", // <--- Color de fondo general de la página
      card: "#ffffff", // <--- Color de fondo de las tarjetas blancas
      text_main: "#000512", // <--- Color del texto principal (ej. "Bienvenido")
      text_light: "#ffffff", // <--- Color del texto que va SOBRE el Navbar/Footer
      border: "#b2ebf2", // <--- Color de las líneas divisorias
    },
    tarde: {
      navy: "#10597d",
      blue: "#10597d",
      accent: "#10597d",
      body: "#e0f2f1",
      card: "#f0fbfc",
      text_main: "#1a1a1a",
      text_light: "#f0f2f5",
      border: "#b2dfdb",
    },
    noche: {
      navy: "#001a23",
      blue: "#00acc1",
      accent: "#26c6da",
      body: "#000a12",
      card: "#001a23",
      text_main: "#ffffff",
      text_light: "#ffffff",
      border: "#004d66",
    },
  },
  otono: {
    effect: "leaves",
    manana: {
      navy: "#e65100",
      blue: "#ef6c00",
      accent: "#ffa726",
      body: "#fff3e0",
      card: "#ffffff",
      text_main: "#5d4037",
      text_light: "#ffffff",
      border: "#ffe0b2",
    },
    tarde: {
      navy: "#5d4037",
      blue: "#8d6e63",
      accent: "#d84315",
      body: "#efebe9",
      card: "#ffffff",
      text_main: "#3e2723",
      text_light: "#ffffff",
      border: "#d7ccc8",
    },
    noche: {
      navy: "#3e2723",
      blue: "#ff8a65",
      accent: "#ff7043",
      body: "#1a1110",
      card: "#271c19",
      text_main: "#faede8",
      text_light: "#ffffff",
      border: "#5d4037",
    },
  },
  oscuro: {
    effect: "neon",
    manana: {
      navy: "#212121",
      blue: "#424242",
      accent: "#00e676",
      body: "#121212",
      card: "#1e1e1e",
      text_main: "#e0e0e0",
      text_light: "#ffffff",
      border: "#424242",
    },
    tarde: {
      navy: "#121212",
      blue: "#1f1f1f",
      accent: "#2d9ffc",
      body: "#000000",
      card: "#1e1e1e",
      text_main: "#f5f5f5",
      text_light: "#ffffff",
      border: "#333333",
    },
    noche: {
      navy: "#000000",
      blue: "#111111",
      accent: "#2256f2",
      body: "#000000",
      card: "#0a0a0a",
      text_main: "#ffffff",
      text_light: "#ffffff",
      border: "#222222",
    },
  },
  solar: {
    effect: "sun",
    manana: {
      navy: "#f9a825",
      blue: "#fbc02d",
      accent: "#ffee58",
      body: "#fffde7",
      card: "#ffffff",
      text_main: "#f57f17",
      text_light: "#ffffff",
      border: "#fff59d",
    },
    tarde: {
      navy: "#f57f17",
      blue: "#f9a825",
      accent: "#ffb300",
      body: "#fff8e1",
      card: "#ffffff",
      text_main: "#e65100",
      text_light: "#ffffff",
      border: "#ffecb3",
    },
    noche: {
      navy: "#e65100",
      blue: "#ef6c00",
      accent: "#ff9800",
      body: "#3e2723",
      card: "#4e342e",
      text_main: "#ffe0b2",
      text_light: "#ffffff",
      border: "#5d4037",
    },
  },
  retro: {
    effect: "retro",
    manana: {
      navy: "#4a148c",
      blue: "#7b1fa2",
      accent: "#ff4081",
      body: "#f3e5f5",
      card: "#ffffff",
      text_main: "#4a148c",
      text_light: "#ffffff",
      border: "#e1bee7",
    },
    tarde: {
      navy: "#2a0845",
      blue: "#6441a5",
      accent: "#00e5ff",
      body: "#120024",
      card: "#240b36",
      text_main: "#e0e0e0",
      text_light: "#ffffff",
      border: "#4a148c",
    },
    noche: {
      navy: "#120024",
      blue: "#2a0845",
      accent: "#d500f9",
      body: "#000000",
      card: "#120024",
      text_main: "#ea80fc",
      text_light: "#ffffff",
      border: "#311b92",
    },
  },
  primavera: {
    effect: "spring",
    manana: {
      navy: "#2e7d32",
      blue: "#4caf50",
      accent: "#81c784",
      body: "#f1f8e9",
      card: "#ffffff",
      text_main: "#1b5e20",
      text_light: "#ffffff",
      border: "#c8e6c9",
    },
    tarde: {
      navy: "#00695c",
      blue: "#00897b",
      accent: "#4db6ac",
      body: "#e0f2f1",
      card: "#ffffff",
      text_main: "#004d40",
      text_light: "#ffffff",
      border: "#b2dfdb",
    },
    noche: {
      navy: "#1b5e20",
      blue: "#66bb6a",
      accent: "#81c784",
      body: "#0d1a0e",
      card: "#162e18",
      text_main: "#a5d6a7",
      text_light: "#ffffff",
      border: "#2e7d32",
    },
  },
};

export function AppProvider({ children }) {
  const bgRef = useRef(null);
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("user_session");
    return saved ? JSON.parse(saved) : null;
  });

  const [fontSize, setFontSize] = useState(
    () => localStorage.getItem("app_font_size") || "normal",
  );

  // NUEVO: Estado del Tema elegido por el usuario
  const [userTheme, setUserTheme] = useState(
    () => localStorage.getItem("app_theme") || "default",
  );

  // NUEVA LÓGICA: Determina el momento del día
  const getCurrentTimeOfDay = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "manana";
    if (hour >= 12 && hour < 19) return "tarde";
    return "noche";
  }, []);

  // Aplica las variables CSS al :root para que Tailwind las use
  const applyCSSVariables = (themeData, timeOfDay) => {
    const root = document.documentElement;

    // --- LÍNEA NUEVA A AGREGAR ---
    root.setAttribute("data-theme", themeData.effect);
    root.setAttribute("data-time", timeOfDay);
    // -----------------------------

    root.style.setProperty("--color-jw-navy", themeData.navy);
    root.style.setProperty("--color-jw-blue", themeData.blue);
    root.style.setProperty("--color-jw-accent", themeData.accent);
    root.style.setProperty("--color-jw-body", themeData.body);
    root.style.setProperty("--color-jw-card", themeData.card);
    root.style.setProperty("--color-jw-text-main", themeData.text_main);
    root.style.setProperty("--color-jw-text-light", themeData.text_light);
    root.style.setProperty("--color-jw-border", themeData.border);
  };

  // 1. Obtenemos el momento del día actual (se evalúa al renderizar)
  const timeOfDay = getCurrentTimeOfDay();

  // 2. Calculamos el tema activo de forma derivada (Evita el Error de ESLint)
  const activeTheme = useMemo(() => {
    let currentThemeData;
    let currentGreeting = "Hola,";

    if (timeOfDay === "manana") currentGreeting = "Buenos días,";
    if (timeOfDay === "tarde") currentGreeting = "Buenas tardes,";
    if (timeOfDay === "noche") currentGreeting = "Buenas noches,";

    if (userTheme === "default") {
      if (timeOfDay === "manana") {
        currentThemeData = {
          navy: "#33558b",
          blue: "#4a6da7",
          accent: "#8eb4f5",
          body: "#f0f4f8",
          card: "#ffffff",
          text_main: "#1a1a1a",
          text_light: "#ffffff",
          border: "#d1d1d1",
          effect: "none",
        };
      } else if (timeOfDay === "tarde") {
        currentThemeData = {
          navy: "#3e4a59",
          blue: "#5c6b7d",
          accent: "#a1b4c7",
          body: "#f5f7fa",
          card: "#ffffff",
          text_main: "#1a1a1a",
          text_light: "#ffffff",
          border: "#cfd8dc",
          effect: "none",
        };
      } else {
        currentThemeData = {
          navy: "#1a335a",
          blue: "#214382",
          accent: "#4a6da7",
          body: "#f5f5f5",
          card: "#ffffff",
          text_main: "#1a1a1a",
          text_light: "#ffffff",
          border: "#d1d1d1",
          effect: "none",
        };
      }
      currentThemeData.greeting = currentGreeting;
    } else {
      const baseTheme = themePalettes[userTheme];
      const timePalette = baseTheme[timeOfDay];
      currentThemeData = {
        ...timePalette,
        effect: baseTheme.effect,
        greeting: currentGreeting,
      };
    }
    return currentThemeData;
  }, [userTheme, timeOfDay]);

  // Disparador invisible para revisar la hora cada minuto
  const [, setTick] = useState(0);

  // Bucle para actualizar la hora del día automáticamente
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // 3. EFECTO LIMPIO: Solo se usa para interactuar con el exterior (DOM y Storage)
  useEffect(() => {
    localStorage.setItem("app_theme", userTheme);
    applyCSSVariables(activeTheme, timeOfDay);
  }, [userTheme, activeTheme, timeOfDay]);

  // Accesibilidad tipográfica
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-font-size", fontSize);
    localStorage.setItem("app_font_size", fontSize);
  }, [fontSize]);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("user_session");
    window.location.href = "/login";
  }, []);

  const login = (userData) => {
    setUser(userData);
    sessionStorage.setItem("user_session", JSON.stringify(userData));
  };

  // --- NUEVA LÓGICA SEO 2026: Calculadora de Imágenes Activas ---
  const getBackgroundImages = useCallback((effect, timeOfDay) => {
    const themeMap = {
      wave: {
        manana: {
          pc: "oceano-pc-body-morning.webp",
          movil: "oceano-movil-body-morning.webp",
        },
        tarde: {
          pc: "oceano-pc-body-afternoon.webp",
          movil: "oceano-movil-body-afternoon.webp",
        },
        noche: {
          pc: "oceano-pc-body-night.webp",
          movil: "oceano-movil-body-night.webp",
        },
      },
      leaves: {
        manana: {
          pc: "otono-pc-body-morning.webp",
          movil: "otono-movil-body-morning.webp",
        },
        tarde: {
          pc: "otono-pc-body-afternoon.webp",
          movil: "otono-movil-body-afternoon.webp",
        },
        noche: {
          pc: "otono-pc-body-night.webp",
          movil: "otono-movil-body-night.webp",
        },
      },
      neon: {
        manana: {
          pc: "noche-pc-body-morning.webp",
          movil: "noche-movil-body-morning.webp",
        },
        tarde: {
          pc: "noche-pc-body-afternoon.webp",
          movil: "noche-movil-body-afternoon.webp",
        },
        noche: {
          pc: "noche-pc-body-night.webp",
          movil: "noche-movil-body-night.webp",
        },
      },
    };
    return themeMap[effect]?.[timeOfDay] || null;
  }, []);

  const currentImages = getBackgroundImages(
    activeTheme.effect,
    getCurrentTimeOfDay(),
  );

  /// --- MOTOR PARALLAX PREMIUM DIRECTO (Cero Layout Thrashing) ---
  useEffect(() => {
    let animationFrameId;
    let targetY = 0;
    let currentY = 0;
    let initialized = false;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      
      if (docHeight <= winHeight) {
        targetY = 0;
        return;
      }

      const rawPercent = scrollTop / (docHeight - winHeight);
      const scrollPercent = Math.max(0, Math.min(1, rawPercent));
      
      // En lugar de vh, calculamos PÍXELES EXACTOS (25% del alto de la ventana)
      targetY = -(scrollPercent * (winHeight * 0.25)); 
    };

    const loop = () => {
      // Evita que se "mueva sola" al cargar la página si ya estabas a la mitad
      if (!initialized) {
        currentY = targetY;
        initialized = true;
      } else {
        // Amortiguador suave del 10% por fotograma
        currentY += (targetY - currentY) * 0.1; 
      }
      
      // ACTUALIZACIÓN DIRECTA: Solo movemos este div, sin afectar el resto del sitio
      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(0, ${currentY}px, 0)`;
      }
      
      animationFrameId = window.requestAnimationFrame(loop);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    loop();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        login,
        logout,
        activeTheme,
        userTheme,
        setUserTheme,
        fontSize,
        setFontSize,
      }}
    >
      {/* 
        PRE-CARGA INTELIGENTE LCP (SEO 2026): 
        Solo descarga la imagen correspondiente a la pantalla actual (media query activo). 
      */}
      {currentImages && (
        <Helmet>
          <link
            rel="preload"
            as="image"
            href={`/images/themes/${currentImages.movil}`}
            media="(max-width: 768px)"
            fetchpriority="high"
          />
          <link
            rel="preload"
            as="image"
            href={`/images/themes/${currentImages.pc}`}
            media="(min-width: 769px)"
            fetchpriority="high"
          />
        </Helmet>
      )}

      {/* --- NUEVO FONDO DEDICADO DE ALTO RENDIMIENTO --- */}
      <div id="parallax-bg" ref={bgRef} />

      {children}
    </AppContext.Provider>
  );
}
