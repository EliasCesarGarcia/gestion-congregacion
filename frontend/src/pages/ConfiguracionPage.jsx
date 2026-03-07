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
import { Settings, Type, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

function ConfiguracionPage() {
  /**
   * Consumimos fontSize y setFontSize para aplicar cambios que afectan a toda la aplicación
   * a través del atributo 'data-font-size' inyectado en el AppContext.
   */
  const { timeTheme, fontSize, setFontSize } = useContext(AppContext);
  const navigate = useNavigate();

  // --- 2. CONFIGURACIÓN DE OPCIONES (DATA) ---

  /**
   * Arreglo de opciones de accesibilidad.
   * El 'id' coincide con los selectores CSS definidos en index.css para escalar el HTML.
   */
  const options = [
    { id: "small", name: "Pequeño", desc: "Vista compacta" },
    { id: "normal", name: "Normal (Recomendado)", desc: "Equilibrio visual" },
    { id: "large", name: "Grande", desc: "Mejor legibilidad" },
    { id: "extra", name: "Extra Grande", desc: "Máxima visibilidad" },
  ];

  return (
    /**
     * CONTENEDOR RAÍZ:
     * font-sans transition-all: Asegura que el cambio de fuente sea fluido y use la tipografía base.
     */
    <div className="min-h-screen bg-jw-body pb-10 font-sans transition-all">
      {/* 
          --- ENCABEZADO DINÁMICO --- 
          style: Sincronizado con el color de fondo horario (Mañana/Tarde/Noche).
          sticky: Se mantiene visible al hacer scroll para facilitar la salida.
      */}
      <header
        style={{ backgroundColor: timeTheme.bg }}
        className="h-16 flex items-center px-4 text-white shadow-lg sticky top-0 z-40 transition-colors duration-1000"
      >
        {/* Botón de retorno con área táctil optimizada */}
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/20 rounded-full mr-2 active:scale-90 transition-all"
        >
          <ChevronLeft size={28} />
        </button>
        <h1 className="text-lg font-light italic flex items-center gap-3">
          <Settings className="w-6 h-6 animate-spin-slow" />
          Configuración
        </h1>
      </header>

      {/* --- CUERPO DE AJUSTES --- */}
      <main className="max-w-2xl mx-auto p-4 mt-6 space-y-6">
        {/* SECCIÓN: ACCESIBILIDAD VISUAL */}
        <section className="bg-white rounded-3xl shadow-sm border border-jw-border overflow-hidden">
          {/* Cabecera de Sección */}
          <div className="p-6 border-b border-gray-50 flex items-center gap-4 bg-gray-50/50">
            <div className="p-3 bg-jw-blue/10 rounded-2xl text-jw-blue">
              <Type size={24} />
            </div>
            <div className="text-left">
              <h2 className="text-base font-black uppercase tracking-widest text-jw-navy">
                Tamaño de Fuente
              </h2>
              <p className="text-xs text-gray-400 italic">
                Accesibilidad Visual
              </p>
            </div>
          </div>

          {/* Listado de Botones de Selección */}
          <div className="p-6 grid gap-4">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFontSize(opt.id)}
                /**
                 * DISEÑO TÁCTIL (SEO 2026):
                 * active:scale-95: feedback de pulsación para móviles.
                 * border-2: Claridad visual sobre el estado seleccionado.
                 */
                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all active:scale-95 ${
                  fontSize === opt.id
                    ? "border-jw-blue bg-blue-50"
                    : "border-gray-100 hover:border-jw-blue/20 bg-white"
                }`}
              >
                <div className="text-left">
                  {/* El nombre de la opción escala según su propio ID para previsualización */}
                  <span
                    className={`block font-bold text-jw-navy ${opt.id === "extra" ? "text-xl" : opt.id === "large" ? "text-lg" : "text-base"}`}
                  >
                    {opt.name}
                  </span>
                  <span className="text-xs text-gray-400 font-light italic">
                    {opt.desc}
                  </span>
                </div>

                {/* Indicador visual de selección activa */}
                {fontSize === opt.id && (
                  <CheckCircle2 className="text-jw-blue" size={24} />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* 
            --- ÁREA DE FUTURAS IMPLEMENTACIONES --- 
            Mantiene el equilibrio visual y anticipa las opciones de Audio e Idiomas.
        */}
        <section className="p-8 border-2 border-dashed border-gray-200 rounded-3xl opacity-50">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.3em] text-center">
            Nuevas opciones de accesibilidad en desarrollo
          </p>
        </section>
      </main>
    </div>
  );
}

export default ConfiguracionPage;
