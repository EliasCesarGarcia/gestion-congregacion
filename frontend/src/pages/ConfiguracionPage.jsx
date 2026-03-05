import React, { useContext } from "react";
import { AppContext } from "../context/AppContext";
import { Settings, Type, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

function ConfiguracionPage() {
  const { timeTheme, fontSize, setFontSize } = useContext(AppContext);
  const navigate = useNavigate();

  const options = [
    { id: 'small', name: 'Pequeño', desc: 'Vista compacta' },
    { id: 'normal', name: 'Normal (Recomendado)', desc: 'Equilibrio visual' },
    { id: 'large', name: 'Grande', desc: 'Mejor legibilidad' },
    { id: 'extra', name: 'Extra Grande', desc: 'Máxima visibilidad' },
  ];

  return (
    <div className="min-h-screen bg-jw-body pb-10 font-sans transition-all">
      {/* Encabezado dinámico que respeta el horario */}
      <header 
        style={{ backgroundColor: timeTheme.bg }}
        className="h-16 flex items-center px-4 text-white shadow-lg sticky top-0 z-40 transition-colors duration-1000"
      >
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/20 rounded-full mr-2 active:scale-90 transition-all">
          <ChevronLeft size={28} />
        </button>
        <h1 className="text-lg font-light italic flex items-center gap-3">
          <Settings className="w-6 h-6 animate-spin-slow" /> 
          Configuración
        </h1>
      </header>

      <main className="max-w-2xl mx-auto p-4 mt-6 space-y-6">
        <section className="bg-white rounded-3xl shadow-sm border border-jw-border overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center gap-4 bg-gray-50/50">
            <div className="p-3 bg-jw-blue/10 rounded-2xl text-jw-blue">
              <Type size={24} />
            </div>
            <div className="text-left">
              <h2 className="text-base font-black uppercase tracking-widest text-jw-navy">Tamaño de Fuente</h2>
              <p className="text-xs text-gray-400 italic">Accesibilidad Visual</p>
            </div>
          </div>

          <div className="p-6 grid gap-4">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFontSize(opt.id)}
                className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all active:scale-95 ${
                  fontSize === opt.id 
                  ? "border-jw-blue bg-blue-50" 
                  : "border-gray-100 hover:border-jw-blue/20 bg-white"
                }`}
              >
                <div className="text-left">
                  <span className={`block font-bold text-jw-navy ${opt.id === 'extra' ? 'text-xl' : opt.id === 'large' ? 'text-lg' : 'text-base'}`}>
                    {opt.name}
                  </span>
                  <span className="text-xs text-gray-400 font-light italic">{opt.desc}</span>
                </div>
                {fontSize === opt.id && <CheckCircle2 className="text-jw-blue" size={24} />}
              </button>
            ))}
          </div>
        </section>

        {/* PRÓXIMAMENTE: AUDIO E IDIOMAS */}
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