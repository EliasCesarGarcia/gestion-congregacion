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

import React, { useContext } from "react";
import { AppContext } from "../context/AppContext";
import { Type, ChevronLeft, Palette } from "lucide-react";
import { useNavigate } from "react-router-dom";

function ConfiguracionPage() {
  const { activeTheme, userTheme, setUserTheme, fontSize, setFontSize } = useContext(AppContext);
  const navigate = useNavigate();

  // Lista de temas disponibles
  const themes = [
    { id: "default", name: "Automático", img: "⏱️" },
    { id: "oceano", name: "Océano Profundo", img: "🌊" },
    { id: "otono", name: "Cálido Otoño", img: "🍂" },
    { id: "oscuro", name: "Modo Oscuro", img: "🌙" },
    { id: "solar", name: "Claro Solar", img: "☀️" },
    { id: "retro", name: "Retro Digital", img: "👾" },
    { id: "primavera", name: "Primavera", img: "🌸" },
  ];

  // Configuración del Slider
  const fontSizes = ["small", "normal", "large", "extra"];
  const sliderValue = fontSizes.indexOf(fontSize);

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value);
    setFontSize(fontSizes[val]);
  };

  return (
    <div className="min-h-screen bg-transparent pb-10 font-sans transition-colors duration-700 relative">
      
      {/* FONDO CREATIVO DE LA PÁGINA BASADO EN EL TEMA (Diferente al Navbar) */}
      <div 
        className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none transition-all duration-1000"
        style={{ 
          background: `radial-gradient(circle at top, ${activeTheme.accent} 0%, transparent 70%)` 
        }}
      />

      {/* ENCABEZADO: Sólo el botón volver */}
      <div className="pt-6 px-4 max-w-2xl mx-auto relative z-10 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-jw-navy font-bold px-4 py-2 bg-jw-card rounded-full shadow-md hover:bg-jw-border transition-colors border border-jw-border"
        >
          <ChevronLeft size={20} />
          VOLVER
        </button>
      </div>

      <main className="max-w-2xl mx-auto p-4 mt-4 space-y-8 relative z-10">
        
        {/* SECCIÓN 1: PERSONALIZACIÓN VISUAL (TEMAS) */}
        <section className="bg-jw-card rounded-[2.5rem] shadow-xl border border-jw-border p-6 overflow-hidden relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-jw-navy text-jw-text-light rounded-2xl shadow-lg">
              <Palette size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-jw-text-main">Temas Visuales</h2>
              <p className="text-xs text-jw-blue font-semibold italic">Personaliza tu entorno de trabajo</p>
            </div>
          </div>

          {/* Carrusel horizontal de temas */}
          <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar snap-x">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setUserTheme(t.id)}
                className={`flex flex-col items-center gap-2 min-w-[80px] snap-center transition-transform active:scale-90 ${
                  userTheme === t.id ? "opacity-100 scale-105" : "opacity-60 hover:opacity-100"
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-md border-[3px] transition-colors ${
                  userTheme === t.id ? "border-jw-accent bg-jw-body" : "border-transparent bg-gray-100"
                }`}>
                  {t.img}
                </div>
                <span className={`text-[11px] font-bold text-center leading-tight ${
                  userTheme === t.id ? "text-jw-navy" : "text-gray-500"
                }`}>
                  {t.name}
                </span>
              </button>
            ))}
          </div>

          {/* Miniatura en vivo (Preview Home) */}
          <div className="mt-6 border-t border-jw-border pt-6">
            <p className="text-[10px] uppercase tracking-widest text-jw-blue font-bold mb-3">Previsualización en vivo</p>
            <div className="w-full h-40 rounded-2xl border-4 border-jw-navy overflow-hidden bg-jw-body shadow-inner flex flex-col">
              {/* Fake Navbar Mini */}
              <div className="h-8 bg-jw-navy relative flex items-center px-3 justify-between overflow-hidden">
                {activeTheme.effect === 'wave' && <div className="theme-wave" style={{height: '10px'}} />}
                {activeTheme.effect === 'neon' && <div className="theme-neon" />}
                <div className="w-4 h-4 rounded-full bg-jw-text-light/50" />
                <div className="w-16 h-2 rounded bg-jw-text-light/50" />
                <div className="w-4 h-4 rounded-full bg-jw-accent" />
              </div>
              {/* Fake Content */}
              <div className="flex-1 p-3 flex flex-col gap-2">
                <div className="w-1/2 h-4 rounded bg-jw-navy/20" />
                <div className="w-full h-16 rounded-xl bg-jw-card border border-jw-border flex items-center px-3">
                   <div className="w-8 h-8 rounded-full bg-jw-accent/30 mr-2" />
                   <div className="w-3/4 h-3 rounded bg-jw-text-main/20" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: ESCALADO DE TEXTO (ACCESIBILIDAD) */}
        <section className="bg-jw-card rounded-[2.5rem] shadow-xl border border-jw-border p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-jw-navy text-jw-text-light rounded-2xl shadow-lg">
              <Type size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-jw-text-main">Tamaño de Texto</h2>
              <p className="text-xs text-jw-blue font-semibold italic">Ajuste horizontal dinámico</p>
            </div>
          </div>

          {/* Slider Horizontal */}
          <div className="px-2 mb-8 relative">
            <input 
              type="range" 
              min="0" 
              max="3" 
              step="1" 
              value={sliderValue} 
              onChange={handleSliderChange}
              className="custom-slider"
            />
            {/* Etiquetas bajo el slider */}
            <div className="flex justify-between text-[10px] font-bold text-jw-navy mt-4 uppercase tracking-widest px-1">
              <span className={sliderValue === 0 ? "text-jw-accent" : "opacity-50"}>Peq</span>
              <span className={sliderValue === 1 ? "text-jw-accent" : "opacity-50"}>Nor</span>
              <span className={sliderValue === 2 ? "text-jw-accent" : "opacity-50"}>Gde</span>
              <span className={sliderValue === 3 ? "text-jw-accent" : "opacity-50"}>Max</span>
            </div>
          </div>

          {/* Muestra de texto */}
          <div className="p-5 bg-jw-body rounded-2xl border border-jw-border text-center transition-all">
            <p className="text-jw-text-main font-medium italic mb-2">
              "El texto se verá de este tamaño en toda la plataforma."
            </p>
            <button className="bg-jw-blue text-jw-text-light px-6 py-2 rounded-lg font-bold shadow-md hover:opacity-80 transition-opacity">
              Botón de Ejemplo
            </button>
          </div>
        </section>

      </main>
    </div>
  );
}

export default ConfiguracionPage;