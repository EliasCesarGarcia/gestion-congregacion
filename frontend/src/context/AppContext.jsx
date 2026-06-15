/* eslint-disable react-refresh/only-export-components */
/**
 * ARCHIVO: AppContext.jsx
 * UBICACIÓN: frontend/src/context/AppContext.jsx
 * DESCRIPCIÓN: Proveedor de estado global optimizado.
 * Gestiona la identidad del usuario y las preferencias del sistema.
 */

import axios from "axios";
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
} from "react";
import { Helmet } from "react-helmet-async";
import { themePalettes, backgroundImagesMap } from "../config/themeConfig";
import { useParallax } from "../hooks/useParallax";

export const AppContext = createContext();

export function AppProvider({ children }) {
  // MOTOR DE ANIMACIÓN: Recuperamos la referencia del motor Parallax
  const bgRef = useParallax();

  // --- ESTADO DEL USUARIO Y SESIÓN ---
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("user_session");
    return saved ? JSON.parse(saved) : null;
  });

  // --- ACCESIBILIDAD Y TEMAS ---
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("app_font_size") || "normal");
  const [userTheme, setUserTheme] = useState(() => localStorage.getItem("app_theme") || "default");
  const [, setTick] = useState(0); // Disparador para actualizar la hora del día

  // LÓGICA DE TIEMPO: Determina si es Mañana, Tarde o Noche
  const getCurrentTimeOfDay = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "manana";
    if (hour >= 12 && hour < 19) return "tarde";
    return "noche";
  }, []);

  const timeOfDay = getCurrentTimeOfDay();

  // CÁLCULO DEL TEMA ACTIVO (Optimizado con useMemo)
  const activeTheme = useMemo(() => {
    let currentThemeData;
    const currentGreeting = {
      manana: "Buenos días,",
      tarde: "Buenas tardes,",
      noche: "Buenas noches,",
    }[timeOfDay];

    if (userTheme === "default") {
        // Colores por defecto si el usuario no eligió un tema manual
        const defaults = {
            manana: { navy: "#33558b", blue: "#4a6da7", accent: "#8eb4f5", body: "#f0f4f8", card: "#ffffff", text_main: "#1a1a1a", text_light: "#ffffff", border: "#d1d1d1", effect: "none" },
            tarde: { navy: "#3e4a59", blue: "#5c6b7d", accent: "#a1b4c7", body: "#f5f7fa", card: "#ffffff", text_main: "#1a1a1a", text_light: "#ffffff", border: "#cfd8dc", effect: "none" },
            noche: { navy: "#1a335a", blue: "#214382", accent: "#4a6da7", body: "#f5f5f5", card: "#ffffff", text_main: "#1a1a1a", text_light: "#ffffff", border: "#d1d1d1", effect: "none" }
        };
        currentThemeData = defaults[timeOfDay];
    } else {
      const baseTheme = themePalettes[userTheme];
      currentThemeData = { ...baseTheme[timeOfDay], effect: baseTheme.effect };
    }
    return { ...currentThemeData, greeting: currentGreeting };
  }, [userTheme, timeOfDay]);

  // EFECTO: Sincronización de Variables CSS con el DOM
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", activeTheme.effect);
    root.setAttribute("data-time", timeOfDay);
    
    const props = ["navy", "blue", "accent", "body", "card", "text-main", "text-light", "border"];
    props.forEach(p => {
        const key = p.replace("-", "_");
        root.style.setProperty(`--color-jw-${p}`, activeTheme[key]);
    });

    localStorage.setItem("app_theme", userTheme);
  }, [userTheme, activeTheme, timeOfDay]);

  // EFECTO: Gestión de tamaño de fuente
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-font-size", fontSize);
    localStorage.setItem("app_font_size", fontSize);
  }, [fontSize]);

  // Bucle de actualización de reloj cada minuto
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // --- LÓGICA DE AUTENTICACIÓN ---
  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem("user_session");
    window.location.href = "/login";
  }, []);

  const login = (userData) => {
    const savedSession = sessionStorage.getItem("user_session");
    const existingData = savedSession ? JSON.parse(savedSession) : {};
    let finalUserData = userData?.token ? userData : { ...existingData, user: { ...existingData.user, ...userData } };

    setUser(finalUserData);
    sessionStorage.setItem("user_session", JSON.stringify(finalUserData));
    if (finalUserData?.token) axios.defaults.headers.common["Authorization"] = `Bearer ${finalUserData.token}`;
  };

  // SEO 2026: Imágenes activas para pre-carga
  const currentImages = backgroundImagesMap[activeTheme.effect]?.[timeOfDay] || null;

  return (
    <AppContext.Provider value={{ user, login, logout, activeTheme, userTheme, setUserTheme, fontSize, setFontSize }}>
      {currentImages && (
        <Helmet>
          <link rel="preload" as="image" href={`/images/themes/${currentImages.movil}`} media="(max-width: 768px)" fetchpriority="high" />
          <link rel="preload" as="image" href={`/images/themes/${currentImages.pc}`} media="(min-width: 769px)" fetchpriority="high" />
        </Helmet>
      )}
      <div id="parallax-bg" ref={bgRef} />
      {children}
    </AppContext.Provider>
  );
}