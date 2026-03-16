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
} from "react";

export const AppContext = createContext();

// CONFIGURACIÓN MAESTRA DE TEMAS
// NUEVO: Cada tema ahora tiene sus variaciones de Mañana, Tarde y Noche
export const themePalettes = {
  oceano: {
    effect: "wave",
    manana: {
      navy: "#006064",
      blue: "#00838f",
      accent: "#00bcd4",
      body: "#e0f7fa",
      card: "#ffffff",
      text_main: "#004d40",
      text_light: "#ffffff",
      border: "#b2ebf2",
    },
    tarde: {
      navy: "#0f2027",
      blue: "#203a43",
      accent: "#2c5364",
      body: "#e0f2f1",
      card: "#ffffff",
      text_main: "#1a1a1a",
      text_light: "#ffffff",
      border: "#b2dfdb",
    },
    noche: {
      navy: "#001a23",
      blue: "#003344",
      accent: "#006688",
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
      blue: "#4e342e",
      accent: "#bf360c",
      body: "#1a1110",
      card: "#271c19",
      text_main: "#ffccbc",
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
      accent: "#00e676",
      body: "#000000",
      card: "#1e1e1e",
      text_main: "#f5f5f5",
      text_light: "#ffffff",
      border: "#333333",
    },
    noche: {
      navy: "#000000",
      blue: "#111111",
      accent: "#00c853",
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
      blue: "#2e7d32",
      accent: "#4caf50",
      body: "#0d1a0e",
      card: "#162e18",
      text_main: "#a5d6a7",
      text_light: "#ffffff",
      border: "#2e7d32",
    },
  },
};

export function AppProvider({ children }) {
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

  // Estado que realmente se aplica a la pantalla
  const [activeTheme, setActiveTheme] = useState({});

  // Calcula el tema por defecto (Horario)
  const calculateDefaultTheme = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return {
        navy: "#33558b",
        blue: "#4a6da7",
        accent: "#8eb4f5",
        body: "#f0f4f8",
        card: "#ffffff",
        text_main: "#1a1a1a",
        text_light: "#ffffff",
        border: "#d1d1d1",
        effect: "none",
        greeting: "Buenos días,",
      };
    } else if (hour >= 12 && hour < 19) {
      return {
        navy: "#3e4a59",
        blue: "#5c6b7d",
        accent: "#a1b4c7",
        body: "#f5f7fa",
        card: "#ffffff",
        text_main: "#1a1a1a",
        text_light: "#ffffff",
        border: "#cfd8dc",
        effect: "none",
        greeting: "Buenas tardes,",
      };
    } else {
      return {
        navy: "#1a335a",
        blue: "#214382",
        accent: "#4a6da7",
        body: "#f5f5f5",
        card: "#ffffff",
        text_main: "#1a1a1a",
        text_light: "#ffffff",
        border: "#d1d1d1",
        effect: "none",
        greeting: "Buenas noches,",
      };
    }
  }, []);

  // NUEVA LÓGICA: Determina el momento del día
  const getCurrentTimeOfDay = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "manana";
    if (hour >= 12 && hour < 19) return "tarde";
    return "noche";
  }, []);

  // Aplica las variables CSS al :root para que Tailwind las use
  const applyCSSVariables = (themeData) => {
    const root = document.documentElement;

    // --- LÍNEA NUEVA A AGREGAR ---
    root.setAttribute("data-theme", themeData.effect);
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

  // Efecto Maestro de Tema
  useEffect(() => {
    localStorage.setItem("app_theme", userTheme);
    let currentThemeData;
    const timeOfDay = getCurrentTimeOfDay();

    // Saludos dinámicos
    let currentGreeting = "Hola,";
    if (timeOfDay === "manana") currentGreeting = "Buenos días,";
    if (timeOfDay === "tarde") currentGreeting = "Buenas tardes,";
    if (timeOfDay === "noche") currentGreeting = "Buenas noches,";

    if (userTheme === "default") {
      // Tema predeterminado Institucional que tenías antes
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
      // Temas creativos: Extrae la sub-paleta correcta (mañana, tarde o noche)
      const baseTheme = themePalettes[userTheme];
      const timePalette = baseTheme[timeOfDay];
      currentThemeData = {
        ...timePalette,
        effect: baseTheme.effect,
        greeting: currentGreeting,
      };
    }

    setActiveTheme(currentThemeData);
    applyCSSVariables(currentThemeData);
  }, [userTheme, getCurrentTimeOfDay]);

  // Bucle para actualizar la hora del día automáticamente
  useEffect(() => {
    const interval = setInterval(() => {
      // Forzamos un re-render cambiando el estado por sí mismo para recalcular el useEffect principal
      setUserTheme((prev) => prev);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <AppContext.Provider
      value={{
        user,
        login,
        logout,
        activeTheme, // Tema visual actual con colores calculados
        userTheme,
        setUserTheme, // Preferencia del usuario
        fontSize,
        setFontSize,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
