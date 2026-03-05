/**
 * ARCHIVO: AppContext.jsx
 * UBICACIÓN: src/context/AppContext.jsx
 * DESCRIPCIÓN: Proveedor de estado global de la aplicación.
 * Maneja la sesión del usuario, el cierre automático por inactividad
 * y la lógica de "Adaptive UI" (clima visual y saludos) según la zona horaria.
 */
/**
 * ARCHIVO: AppContext.jsx
 * UBICACIÓN: src/context/AppContext.jsx
 */

import React, { createContext, useState, useEffect, useCallback, useLayoutEffect } from 'react';

export const AppContext = createContext();

export function AppProvider({ children }) {
  // --- 1. ESTADOS (Aquí inyectamos el estado de la fuente junto al del usuario) ---
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user_session');
    return saved ? JSON.parse(saved) : null;
  });

  // NUEVO: Estado para el tamaño de la fuente
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('app_font_size') || 'normal';
  });

  const [timeTheme, setTimeTheme] = useState({
    bg: '#1a335a', 
    greeting: 'Hola,'
  });

  // --- 2. LÓGICA Y EFECTOS ---

  // NUEVO: Efecto para aplicar el tamaño de fuente al sistema
  useEffect(() => {
    localStorage.setItem('app_font_size', fontSize);
    // Aplicamos el atributo al HTML para que el CSS (index.css) lo detecte
    document.documentElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  const updateTimeTheme = useCallback(() => {
    const tz = user?.zona_horaria || Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const hour = parseInt(new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: tz
      }).format(new Date()));

      if (hour >= 6 && hour < 12) {
        setTimeTheme({ bg: '#33558b', greeting: 'Buenos días,' });
      } else if (hour >= 12 && hour < 19) {
        setTimeTheme({ bg: '#3e4a59', greeting: 'Buenas tardes,' });
      } else {
        setTimeTheme({ bg: '#1a335a', greeting: 'Buenas noches,' });
      }
    } catch (e) {
      console.error("Error calculando zona horaria:", e);
    }
  }, [user]);

  useEffect(() => {
    updateTimeTheme();
    const interval = setInterval(updateTimeTheme, 60000);
    return () => clearInterval(interval);
  }, [updateTimeTheme]);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('user_session');
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    if (!user) return;
    let timer = setTimeout(logout, 10 * 60 * 1000); 
    const reset = () => { 
      clearTimeout(timer); 
      timer = setTimeout(logout, 10 * 60 * 1000); 
    };
    window.addEventListener('mousemove', reset);
    window.addEventListener('keypress', reset);
    return () => {
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keypress', reset);
      clearTimeout(timer);
    };
  }, [user, logout]);

  const login = (userData) => {
    setUser(userData);
    sessionStorage.setItem('user_session', JSON.stringify(userData));
  };

  useLayoutEffect(() => {
  // Aplicamos el atributo inmediatamente antes de que el usuario vea la pantalla
  document.documentElement.setAttribute('data-font-size', fontSize);
  localStorage.setItem('app_font_size', fontSize);
}, [fontSize]);

  // --- 3. RENDERIZADO DEL PROVIDER (Aquí agregamos los nuevos valores al value) ---
  return (
    <AppContext.Provider value={{ 
      user, 
      login, 
      logout, 
      timeTheme, 
      fontSize,    // <--- Agregado
      setFontSize  // <--- Agregado
    }}>
      {children}
    </AppContext.Provider>
  );
}