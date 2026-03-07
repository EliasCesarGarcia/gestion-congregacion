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

// Creación del contexto para su consumo en componentes hijos
export const AppContext = createContext();

export function AppProvider({ children }) {
  // --- 1. ESTADOS DE SESIÓN Y PREFERENCIAS ---

  /**
   * Estado del Usuario: Se inicializa mediante una función para recuperar
   * los datos de la sesión tras un refresco de pantalla (F5).
   */
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("user_session");
    return saved ? JSON.parse(saved) : null;
  });

  /**
   * Estado de Accesibilidad (Tamaño de Fuente):
   * Recupera la preferencia del usuario desde localStorage para mantener
   * la configuración de visibilidad en futuras visitas.
   */
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem("app_font_size") || "normal";
  });

  /**
   * Estado del Tema Visual: Controla colores y saludos.
   * Inicializado con colores nocturnos por defecto para evitar deslumbramientos.
   */
  const [timeTheme, setTimeTheme] = useState({
    bg: "#1a335a",
    greeting: "Hola,",
  });

  // --- 2. LÓGICA DE ACCESIBILIDAD Y RENDIMIENTO (CEO 2026) ---

  /**
   * useLayoutEffect: Sincronización crítica del tamaño de fuente.
   * Se ejecuta de forma síncrona ANTES de que el navegador pinte la pantalla.
   * Vital para eliminar el parpadeo visual (CLS) y cumplir con SEO 2026.
   */
  useEffect(() => {
    // Persiste la elección para el próximo inicio de sesión
    localStorage.setItem("app_font_size", fontSize);
    // Inyecta el atributo en el nodo raíz (html) para que el CSS aplique el escalado
    document.documentElement.setAttribute("data-font-size", fontSize);
  }, [fontSize]);

  // --- 3. LÓGICA DE INTERFAZ ADAPTATIVA (ADAPTIVE UI) ---

  /**
   * updateTimeTheme: Calcula el momento del día basado en la zona horaria.
   * Define los colores institucionales y el saludo dinámico.
   */
  const updateTimeTheme = useCallback(() => {
    // Prioriza la zona horaria del perfil de usuario o usa la del navegador
    const tz =
      user?.zona_horaria || Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const hour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: tz,
        }).format(new Date()),
      );

      // Rangos horarios institucionales
      if (hour >= 6 && hour < 12) {
        setTimeTheme({ bg: "#33558b", greeting: "Buenos días," }); // Mañana
      } else if (hour >= 12 && hour < 19) {
        setTimeTheme({ bg: "#3e4a59", greeting: "Buenas tardes," }); // Tarde
      } else {
        setTimeTheme({ bg: "#1a335a", greeting: "Buenas noches," }); // Noche
      }
    } catch (e) {
      console.error("Error calculando zona horaria:", e);
    }
  }, [user]);

  /**
   * Ciclo de vida del tema: Actualiza el clima visual al cargar
   * y revisa cambios cada minuto (60000ms).
   */
  useEffect(() => {
    updateTimeTheme();
    const interval = setInterval(updateTimeTheme, 60000);
    return () => clearInterval(interval);
  }, [updateTimeTheme]);

  // --- 4. GESTIÓN DE SEGURIDAD Y SESIÓN ---

  /**
   * logout: Finalización de sesión segura.
   * Limpia el estado, borra el almacenamiento y redirige al acceso.
   */
  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("user_session");
    window.location.href = "/login";
  }, []);

  /**
   * Control de Inactividad: Cierra la sesión tras 10 minutos de falta de interacción.
   * Escucha eventos de ratón y teclado para reiniciar el contador.
   */
  useEffect(() => {
    if (!user) return;
    let timer = setTimeout(logout, 10 * 60 * 1000); // Límite: 10 minutos
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, 10 * 60 * 1000);
    };

    // Listeners de actividad del usuario
    window.addEventListener("mousemove", reset);
    window.addEventListener("keypress", reset);

    // Limpieza de listeners al desmontar para evitar fugas de memoria
    return () => {
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keypress", reset);
      clearTimeout(timer);
    };
  }, [user, logout]);

  /**
   * login: Punto de entrada de datos tras autenticación exitosa.
   */
  const login = (userData) => {
    setUser(userData);
    sessionStorage.setItem("user_session", JSON.stringify(userData));
  };

  useLayoutEffect(() => {
    // Aplicamos el atributo inmediatamente antes de que el usuario vea la pantalla
    document.documentElement.setAttribute("data-font-size", fontSize);
    localStorage.setItem("app_font_size", fontSize);
  }, [fontSize]);

  // --- 5. RENDERIZADO DEL PROVEEDOR GLOBAL ---
  return (
    /**
     * Exporta todos los estados y funciones de control para ser
     * consumidos por cualquier componente de la aplicación.
     */
    <AppContext.Provider
      value={{
        user, // Datos del usuario logueado
        login, // Función de inicio de sesión
        logout, // Función de salida
        timeTheme, // Tema visual dinámico (Mañana/Tarde/Noche)
        fontSize, // Configuración de accesibilidad actual
        setFontSize, // Función para modificar tamaño de letra globalmente
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
