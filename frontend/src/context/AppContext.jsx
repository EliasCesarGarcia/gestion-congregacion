/**
 * ARCHIVO: AppContext.jsx
 * UBICACIÓN: src/context/AppContext.jsx
 * DESCRIPCIÓN: Proveedor de estado global de la aplicación.
 * Maneja la sesión del usuario, el cierre automático por inactividad
 * y la lógica de "Adaptive UI" (clima visual y saludos) según la zona horaria.
 */

import React, { createContext, useState, useEffect, useCallback } from 'react';

export const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user_session');
    return saved ? JSON.parse(saved) : null;
  });

  // --- LÓGICA DE TIEMPO DINÁMICO (TEMA ADAPTATIVO) ---
  // Iniciamos con un valor por defecto para evitar que la app falle si no hay usuario
  const [timeTheme, setTimeTheme] = useState({
    bg: '#1a335a', // Azul Navy original (Noche)
    greeting: 'Hola,'
  });

  const updateTimeTheme = useCallback(() => {
    // Si no hay usuario, usamos la hora local del navegador como respaldo
    const tz = user?.zona_horaria || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    try {
      const hour = parseInt(new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: tz
      }).format(new Date()));

      if (hour >= 6 && hour < 12) {
        setTimeTheme({ bg: '#33558b', greeting: 'Buenos días,' }); // Mañana
      } else if (hour >= 12 && hour < 19) {
        setTimeTheme({ bg: '#3e4a59', greeting: 'Buenas tardes,' }); // Tarde
      } else {
        setTimeTheme({ bg: '#1a335a', greeting: 'Buenas noches,' }); // Noche
      }
    } catch (e) {
      console.error("Error calculando zona horaria:", e);
    }
  }, [user]);

  // Actualizar el tema cuando el usuario loguea o cada minuto
  useEffect(() => {
    updateTimeTheme();
    const interval = setInterval(updateTimeTheme, 60000);
    return () => clearInterval(interval);
  }, [updateTimeTheme]);

  // --- GESTIÓN DE SESIÓN ---
  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('user_session');
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    if (!user) return;
    let timer = setTimeout(logout, 10 * 60 * 1000); // 10 min inactividad
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

  return (
    <AppContext.Provider value={{ user, login, logout, timeTheme }}>
      {children}
    </AppContext.Provider>
  );
}