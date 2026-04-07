/**
 * ARCHIVO: ConfiguracionPage.jsx
 * UBICACIÓN: src/pages/ConfiguracionPage.jsx
 * DESCRIPCIÓN: Panel de ajustes globales del sistema.
 * Centraliza las preferencias de usuario relacionadas con la experiencia de
 * interfaz (UX) y la accesibilidad. Actualmente enfocado en el control
 * dinámico del tamaño de fuente.
 *
 * FUNCIONALIDADES CLAVE:
 * - Escalado tipográfico global mediante la raíz HTML.
 * - Feedback visual instantáneo mediante estados activos.
 * - Sincronización estética con el color dinámico del horario.
 * - Estructura preparada para futuros módulos (Idiomas, Temas, Audio).
 */

import React, { useContext, useState, useEffect } from "react";
import { AppContext, themePalettes } from "../context/AppContext";
import { useNavigate } from "react-router-dom";
// --- NUEVA IMPORTACIÓN PARA TRADUCCIONES ---
import { useTranslation } from "react-i18next";

// IMPORTACIÓN DE ICONOS MINIMALISTAS
import {
  Type,
  ChevronLeft,
  ChevronRight,
  Palette,
  Wand2,
  Waves,
  Leaf,
  Moon,
  Sun,
  Terminal,
  Flower2,
  Eye,
  TextSelect,
  Languages,
} from "lucide-react";

// CAMBIO: Se crea una lista de objetos para construir la UI del selector de idiomas.
// Esto mantiene la lógica de la UI separada de la configuración de i18next.
const supportedLanguages = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
  { code: "it", name: "Italiano" },
  { code: "nl", name: "Nederlands" },
  { code: "ru", name: "Русский" },
  { code: "el", name: "Ελληνικά" },
  { code: "ja", name: "日本語" },
  { code: "zh-CN", name: "简体中文" },
  { code: "ko", name: "한국어" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "sw", name: "Kiswahili" },
];

function ConfiguracionPage() {
  const { activeTheme, userTheme, setUserTheme, fontSize, setFontSize } =
    useContext(AppContext);
  const navigate = useNavigate();

  // --- HOOK DE TRADUCCIÓN ---
  const { t, i18n } = useTranslation(); // <-- El hook que nos da la función 't'

  // --- ESTADOS PARA EL VISUALIZADOR 3D ---
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  
  // CAMBIO: Los arrays ahora se definen DENTRO del componente para que puedan usar `t()`.
  // La función `t()` necesita el contexto de la traducción, que solo está disponible aquí.
  const timesOfDay = ["manana", "tarde", "noche"];
  const labels = [t('time_morning'), t('time_afternoon'), t('time_night')];

  const themes = [
    { id: "default", name: t('theme_default'), icon: Wand2 },
    { id: "oceano", name: t('theme_ocean'), icon: Waves },
    { id: "otono", name: t('theme_autumn'), icon: Leaf },
    { id: "oscuro", name: t('theme_dark'), icon: Moon },
    { id: "solar", name: t('theme_solar'), icon: Sun },
    { id: "retro", name: t('theme_retro'), icon: Terminal },
    { id: "primavera", name: t('theme_spring'), icon: Flower2 },
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const nextPreview = () => setPreviewIndex((prev) => (prev + 1) % 3);
  const prevPreview = () => setPreviewIndex((prev) => (prev - 1 + 3) % 3);

  const fontSizes = ["small", "normal", "large", "extra"];
  const sliderValue = fontSizes.indexOf(fontSize);
  const handleSliderChange = (e) =>
    setFontSize(fontSizes[parseInt(e.target.value)]);

  const getThemeColors = (themeId, time) => {
    if (themeId === "default") {
      if (time === "manana")
        return {
          navy: "#33558b",
          accent: "#8eb4f5",
          body: "#f0f4f8",
          card: "#ffffff",
          text_main: "#1a1a1a",
        };
      if (time === "tarde")
        return {
          navy: "#3e4a59",
          accent: "#a1b4c7",
          body: "#f5f7fa",
          card: "#ffffff",
          text_main: "#1a1a1a",
        };
      return {
        navy: "#1a335a",
        accent: "#4a6da7",
        body: "#f5f5f5",
        card: "#ffffff",
        text_main: "#1a1a1a",
      };
    }
    return themePalettes[themeId][time];
  };

  const getPreviewImage = (themeId, time) => {
    const map = {
      oceano: {
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
      otono: {
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
      oscuro: {
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
    if (!map[themeId]) return null;
    return `/images/themes/${map[themeId][time][isMobile ? "movil" : "pc"]}`;
  };

  return (
    <div className="min-h-screen bg-transparent pb-10 font-sans transition-colors duration-700 relative overflow-hidden">
      {/* FONDO CREATIVO DE LA PÁGINA */}
      <div
        className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at top, ${activeTheme.accent} 0%, transparent 70%)`,
        }}
      />

      {/* ENCABEZADO */}
      <div className="pt-6 px-4 max-w-6xl mx-auto relative z-10 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-jw-text-main font-semibold px-4 py-2 bg-jw-card rounded-xl shadow-sm hover:shadow-md hover:text-jw-accent transition-all border border-jw-border active:scale-95 group"
        >
          <ChevronLeft
            size={18}
            strokeWidth={2.5}
            className="group-hover:-translate-x-1 transition-transform"
          />
          {/* TEXTO AHORA TRADUCIDO */}
          <span className="text-sm tracking-wide uppercase">
            {t("config_back")}
          </span>
        </button>
      </div>

      {/* CONTENEDOR MAESTRO */}
      <main className="max-w-6xl mx-auto p-4 mt-2 flex flex-col gap-6 relative z-10">
        {/* ========================================================= */}
        {/* FILA 1: TEMAS VISUALES + PREVISUALIZACIÓN 3D              */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* 1A. CONTROLES DE TEMA (Izquierda - Altura Reducida) */}
          <section className="lg:col-span-6 bg-jw-card rounded-[1.5rem] shadow-xl border border-jw-border p-5 flex flex-col justify-center relative overflow-hidden">
            {/* ILUSTRACIÓN MINIMALISTA (Marca de Agua) */}
            <div className="absolute top-[-10px] right-[-10px] text-jw-text-main opacity-[0.15] pointer-events-none z-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-28 h-28 md:w-32 md:h-32 transform rotate-[-5deg]"
              >
                {/* Tablet / Pantalla de diseño */}
                <rect x="11" y="3" width="11" height="18" rx="2" />

                {/* Paleta de colores en la pantalla */}
                <circle cx="16.5" cy="9.5" r="2.5" />
                <circle cx="15.5" cy="8.5" r="0.5" fill="currentColor" />
                <circle cx="17.5" cy="9.5" r="0.5" fill="currentColor" />
                <circle cx="15.5" cy="10.5" r="0.5" fill="currentColor" />

                {/* Silueta de mujer mediana edad (Perfil) */}
                <circle cx="4.5" cy="9.5" r="2.5" />
                {/* Detalle de cabello (Corte tipo Bob) */}
                <path d="M 3 7.5 C 1 9.5 2 12.5 3 13" />
                {/* Hombros / Torso */}
                <path d="M 0 21 C 0 16 3.5 14.5 5.5 14.5 C 7 14.5 8.5 15 9.5 16" />

                {/* Brazo tocando la pantalla */}
                <path d="M 6.5 15.5 L 11.5 10.5" />

                {/* Efecto visual de "Tocar" la pantalla (Ondas) */}
                <path d="M 9.5 9.5 A 1.5 1.5 0 0 1 12.5 8" opacity="0.5" />
              </svg>
            </div>
            <div className="flex items-center gap-4 mb-3 relative z-10">
              <div className="p-2.5 bg-jw-accent/10 text-jw-accent rounded-xl">
                <Palette size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-jw-text-main leading-tight">
                  {t("themes_title")}
                </h2>
                {/* AHORA USA text-xs PARA CRECER CON EL SLIDER */}
                <p className="text-xs text-jw-accent font-medium uppercase tracking-wider">
                  {t("themes_subtitle")}
                </p>
              </div>
            </div>

            <div className="flex overflow-x-auto gap-2 pb-2 pt-2 px-1 custom-scrollbar snap-x w-full">
              {themes.map((t) => {
                const Icon = t.icon;
                const isActive = userTheme === t.id;

                return (
                  <button
                    key={t.id}
                    onClick={() => setUserTheme(t.id)}
                    className="flex flex-col items-center gap-1.5 min-w-[4.5rem] snap-center transition-all active:scale-95 group"
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border ${
                        isActive
                          ? "bg-jw-accent text-jw-text-light border-transparent scale-110 shadow-md"
                          : "bg-jw-body text-jw-text-main/50 border-jw-border group-hover:text-jw-accent group-hover:border-jw-accent/50"
                      }`}
                    >
                      <Icon strokeWidth={isActive ? 2.5 : 1.5} size={22} />
                    </div>
                    {/* AHORA USA text-xs PARA CRECER */}
                    <span
                      className={`text-xs text-center leading-tight transition-colors ${
                        isActive
                          ? "text-jw-text-main font-bold"
                          : "text-jw-text-main/60 font-medium group-hover:text-jw-text-main"
                      }`}
                    >
                      {t.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 1B. PREVISUALIZACIÓN 3D ESCALABLE (Derecha) */}
          <section className="lg:col-span-6 bg-jw-card rounded-[1.5rem] shadow-xl border border-jw-border p-5 flex flex-col justify-center overflow-hidden">
            <div className="flex items-center justify-between mb-2 z-20 relative">
              <div className="flex items-center gap-2.5">
                <Eye className="text-jw-accent" size={18} strokeWidth={2.5} />
                {/* AHORA USA text-sm PARA CRECER */}
                <h2 className="text-sm uppercase tracking-widest text-jw-text-main font-bold">
                  {t('demo_visual_title')}
                </h2>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-jw-accent/10 text-jw-accent rounded-md uppercase">
                {isMobile ? "Celular" : "PC"}
              </span>
            </div>

            {/* VISUALIZADOR 3D: AHORA USA REM EN LUGAR DE PX PARA ESCALAR CON LA FUENTE */}
            <div
              className="relative w-full h-[14rem] sm:h-[15rem] flex items-center justify-center"
              style={{ perspective: "1000px" }}
            >
              {timesOfDay.map((time, idx) => {
                let offset = idx - previewIndex;
                if (offset === 2) offset = -1;
                if (offset === -2) offset = 1;

                const isActive = offset === 0;
                const translateX = offset * 55;
                const translateZ = isActive ? 0 : -6; // -6rem (Se adapta al zoom)
                const rotateY = offset * -15;
                const scale = isActive ? 1 : 0.85;
                const opacity = isActive ? 1 : 0.3;
                const zIndex = isActive ? 30 : 10;

                const colors = getThemeColors(userTheme, time);
                const bgImage = getPreviewImage(userTheme, time);

                // Dimensiones dinámicas en REM: Crecen si el usuario agranda la letra
                const cardWidth = isMobile ? "8rem" : "13rem";
                const cardHeight = isMobile ? "14rem" : "9rem";

                return (
                  <div
                    key={time}
                    className="absolute rounded-[1rem] overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] shadow-2xl border border-white/20"
                    style={{
                      width: cardWidth,
                      height: cardHeight,
                      transform: `translateX(${translateX}%) translateZ(${translateZ}rem) rotateY(${rotateY}deg) scale(${scale})`,
                      opacity,
                      zIndex,
                      backgroundColor: colors.body,
                      backgroundImage: bgImage ? `url(${bgImage})` : "none",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {bgImage && (
                      <div className="absolute inset-0 bg-black/20 mix-blend-overlay" />
                    )}

                    {/* MOCKUP INTERNO (Usa clases de Tailwind que están en rem por defecto) */}
                    <div className="relative z-10 w-full h-full flex flex-col">
                      <div
                        className="h-5 flex items-center px-2 justify-between shadow-sm"
                        style={{ backgroundColor: colors.navy }}
                      >
                        <div className="w-2 h-2 rounded-full bg-white/50" />
                        <div className="w-10 h-1.5 rounded bg-white/50" />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: colors.accent }}
                        />
                      </div>

                      <div className="p-2.5 flex flex-col gap-2 flex-1">
                        <div
                          className="w-2/3 h-2 rounded"
                          style={{ backgroundColor: colors.navy, opacity: 0.3 }}
                        />
                        <div
                          className="w-full h-10 rounded flex items-center px-2 border border-black/5"
                          style={{ backgroundColor: colors.card }}
                        >
                          <div
                            className="w-5 h-5 rounded-full mr-1.5"
                            style={{
                              backgroundColor: colors.accent,
                              opacity: 0.8,
                            }}
                          />
                          <div
                            className="w-3/4 h-1.5 rounded"
                            style={{
                              backgroundColor: colors.text_main,
                              opacity: 0.2,
                            }}
                          />
                        </div>
                      </div>

                      {isActive && (
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center animate-in fade-in zoom-in duration-500">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-lg bg-black/60 backdrop-blur-sm uppercase tracking-wider border border-white/10">
                            {labels[idx]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                aria-label="Tema anterior"
                onClick={prevPreview}
                className="absolute left-0 z-40 p-2 rounded-full bg-jw-card/90 backdrop-blur border border-jw-border shadow-md text-jw-text-main hover:text-jw-accent hover:scale-110 active:scale-90 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                aria-label="Siguiente tema"
                onClick={nextPreview}
                className="absolute right-0 z-40 p-2 rounded-full bg-jw-card/90 backdrop-blur border border-jw-border shadow-md text-jw-text-main hover:text-jw-accent hover:scale-110 active:scale-90 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        </div>

        {/* ========================================================= */}
        {/* FILA 2: TAMAÑO DE TEXTO + PREVISUALIZACIÓN DE LECTURA     */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* 2A. CONTROLES DE TEXTO (Izquierda) */}
          <section className="lg:col-span-6 bg-jw-card rounded-[1.5rem] shadow-xl border border-jw-border p-5 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-2.5 bg-jw-accent/10 text-jw-accent rounded-xl">
                <Type size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-jw-text-main leading-tight">
                  {t("fontSize_title")}
                </h2>
                {/* AHORA USA text-xs PARA CRECER */}
                <p className="text-xs text-jw-accent font-medium uppercase tracking-wider">
                  {t("fontSize_subtitle")}
                </p>
              </div>
            </div>

            <div className="px-3 mb-2 relative">
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={sliderValue}
                onChange={handleSliderChange}
                className="custom-slider"
                aria-label="Ajustar tamaño de texto"
              />
              <div className="flex justify-between text-xs font-bold mt-4 uppercase tracking-widest text-jw-text-main/60">
                <span
                  className={
                    sliderValue === 0
                      ? "text-jw-accent scale-110 transition-transform"
                      : ""
                  }
                >
                  Peq
                </span>
                <span
                  className={
                    sliderValue === 1
                      ? "text-jw-accent scale-110 transition-transform"
                      : ""
                  }
                >
                  Nor
                </span>
                <span
                  className={
                    sliderValue === 2
                      ? "text-jw-accent scale-110 transition-transform"
                      : ""
                  }
                >
                  Gde
                </span>
                <span
                  className={
                    sliderValue === 3
                      ? "text-jw-accent scale-110 transition-transform"
                      : ""
                  }
                >
                  Max
                </span>
              </div>
            </div>
          </section>

          {/* 2B. PREVISUALIZACIÓN DE LECTURA (Derecha) */}
          <section className="lg:col-span-6 bg-jw-card rounded-[1.5rem] shadow-xl border border-jw-border p-5 flex flex-col justify-center relative overflow-hidden">
            <div className="flex items-center justify-between mb-4 z-20 relative">
              <div className="flex items-center gap-2.5">
                <TextSelect
                  className="text-jw-accent"
                  size={18}
                  strokeWidth={2.5}
                />
                {/* AHORA USA text-sm PARA CRECER */}
                <h2 className="text-sm uppercase tracking-widest text-jw-text-main font-bold">
                  {t('demo_reading_title')}
                </h2>
              </div>
            </div>

            <div className="p-4 bg-jw-body rounded-xl border border-jw-border transition-all duration-300 h-full flex flex-col justify-center">
              {/* CAMBIO: Contenido de la demo envuelto en t() */}
              <h3 className="text-jw-navy font-bold text-lg mb-2 leading-tight transition-all">
                {t('demo_reading_header')}
              </h3>
              <p className="text-jw-text-main/80 font-medium mb-4 leading-relaxed transition-all text-base">
                {t('demo_reading_p')}
              </p>
              <button className="bg-jw-accent text-jw-text-light px-4 py-2 rounded-lg font-bold shadow-md hover:brightness-110 transition-all active:scale-95 text-sm w-fit">
                {t('demo_reading_button')}
              </button>
            </div>
          </section>
        </div>

        {/* ========================================================= */}
        {/* --- NUEVA FILA 3: SELECCIÓN DE IDIOMA ---                */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <section className="lg:col-span-6 bg-jw-card rounded-[1.5rem] shadow-xl border border-jw-border p-5 flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-3">
              <div className="p-2.5 bg-jw-accent/10 text-jw-accent rounded-xl">
                <Languages size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-jw-text-main leading-tight">
                  {t("lang_title")}
                </h2>
                <p className="text-xs text-jw-accent font-medium uppercase tracking-wider">
                  {t("lang_subtitle")}
                </p>
              </div>
            </div>

            {/* CAMBIO: El selector de idiomas ahora es dinámico, generando botones a partir de la lista `supportedLanguages`. */}
            <div className="flex flex-wrap justify-center items-center gap-3 pt-2">
              {supportedLanguages.map((lang) => {
                // `i18n.language` puede ser 'zh-CN', `lang.code` es 'zh-CN'.
                // `i18n.language` también puede ser 'es-ES', `lang.code` es 'es'. `startsWith` maneja ambos casos.
                const isActive = i18n.language.startsWith(lang.code);
                return (<button key={lang.code} onClick={() => i18n.changeLanguage(lang.code)} className={`px-4 py-2 rounded-lg border-2 transition-all font-bold text-sm tracking-wider ${isActive ? "bg-jw-accent text-jw-text-light border-transparent shadow-lg" : "bg-transparent text-jw-text-main/70 border-jw-border hover:border-jw-accent hover:text-jw-accent"}`}>
                  {lang.name}
                </button>);
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default ConfiguracionPage;
