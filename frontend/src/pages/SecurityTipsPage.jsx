/**
 * ARCHIVO: SecurityTipsPage.jsx
 * UBICACIÓN: src/pages/SecurityTipsPage.jsx
 * DESCRIPCIÓN: Página informativa dedicada a los recordatorios y consejos de seguridad digital.
 * Presenta una guía visual e interactiva sobre la protección de dispositivos, gestión 
 * de contraseñas, prevención de phishing, seguridad familiar y respaldos.
 * Permite la visualización de actualizaciones dinámicas enviadas por el administrador 
 * desde la base de datos (tabla core_seguridad_info).
 */

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

// Importación de Iconos
import {
  ShieldCheck,
  Smartphone,
  Lock,
  Globe,
  Users,
  MousePointer2,
  ChevronLeft,
  Zap,
  ShieldAlert,
  CheckCircle,
  Database,
  AlertTriangle,
  Key,
  HardDrive,
  Shield,
} from "lucide-react";

function SecurityTipsPage() {
  // --- INICIALIZACIÓN Y ESTADOS ---
  const navigate = useNavigate();
  // Estado para almacenar la información dinámica desde la base de datos
  const [info, setInfo] = useState({ contenido: "", updated_at: "" });

  // --- LÓGICA DE CARGA (SIDE EFFECTS) ---
  useEffect(() => {
    // Asegura que la página siempre inicie desde arriba
    window.scrollTo(0, 0);
    // Petición al backend para obtener la última actualización de seguridad
    axios
      .get("/api/seguridad-info")
      .then((res) => {
        if (res.data) setInfo(res.data);
      })
      .catch((err) => console.error("Error cargando info de seguridad", err));
  }, []);

  // --- FUNCIONES AUXILIARES ---
  // Formatea la fecha recibida del servidor a un formato legible
  const formatDate = (dateStr) => {
    if (!dateStr) return "Reciente";
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Maneja el retorno a la página de perfil con el ancla de seguridad
  const handleBack = () => {
    navigate("/perfil#seguridad");
  };

  // --- CONFIGURACIÓN DE ANIMACIONES (FRAMER MOTION) ---
  // Animación de levitación para los iconos de las tarjetas
  const floatingIcon = {
    animate: {
      y: [0, -6, 0],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    },
  };

  // Animación de pulso suave para el escudo de la introducción
  const pulseScale = {
    animate: {
      scale: [1, 1.02, 1],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    },
  };

  // Animación de entrada para las tarjetas al hacer scroll
  const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-800 pb-12 overflow-x-hidden">
      
      {/* ==========================================
          SECCIÓN: ENCABEZADO (HEADER)
          ========================================== */}
      <header className="bg-sky-700 text-white p-2.5 sm:p-4 sticky top-0 z-50 shadow-md border-b-2 border-sky-400">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          
          {/* Botón Volver con efectos de Hover */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm sm:text-base font-light uppercase tracking-widest bg-sky-800/50 px-3 py-1 rounded-xl shrink-0 transition-all duration-300 hover:scale-105 hover:bg-sky-600 hover:shadow-lg active:scale-95"
          >
            <ChevronLeft size={20} /> Volver
          </button>

          {/* Título y Fecha de Revisión */}
          <div className="text-right min-w-0">
            <h1 className="text-xl sm:text-3xl font-normal  uppercase tracking-tighter leading-none truncate">
              Blindaje Digital
            </h1>
            <p className="text-[12px] sm:text-[12px] text-sky-140 font-normal mt-0.5 uppercase truncate opacity-90">
              Revisión: {formatDate(info.updated_at)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-3 sm:p-6 mt-1 sm:mt-1 space-y-5 sm:space-y-8">
        
        {/* ==========================================
            SECCIÓN: INTRODUCCIÓN PRINCIPAL
            ========================================== */}
        <section className="text-center space-y-2 sm:space-y-4 bg-slate-200 p-4 sm:p-8 rounded-xl border border-sky-100 shadow-sm">
          <motion.div
            variants={pulseScale}
            animate="animate"
            className="inline-block p-2.5 sm:p-4 bg-sky-50 rounded-full text-sky-600"
          >
            <ShieldCheck size={30} className="sm:w-[40px] sm:h-[40px]" />
          </motion.div>
          <div className="space-y-1">
            <h2 className="text-lg sm:text-2xl font-light italic text-sky-900 leading-tight">
              Protegemos lo que{" "}
              <span className="font-black text-sky-700">más importa.</span>
            </h2>
            <p className="text-slate-550 max-w-lg mx-auto leading-tight text-[12px] sm:text-base font-light italic">
              "La seguridad no es un producto, es un hábito". Guía actualizada
              para tu protección digital.
            </p>
          </div>
        </section>

         {/* CONTENEDOR DE TARJETAS DE CONSEJOS */}
        <div className="grid gap-5 sm:gap-8">
          
          {/* --- TARJETA 1: DISPOSITIVOS (PERÍMETRO FÍSICO) --- */}
          <motion.section
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border-l-4 border-l-purple-500 border border-slate-200"
          >
            <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
              <motion.div
                variants={floatingIcon}
                animate="animate"
                className="p-3 bg-purple-50 rounded-xl text-purple-600 w-fit h-fit shadow-inner"
              >
                <Smartphone size={24} className="sm:w-[32px] sm:h-[32px]" />
              </motion.div>
              <div className="space-y-2 flex-1 text-left">
                <h3 className="text-sm sm:text-lg font-black uppercase italic text-purple-900 tracking-tight">
                  1. El Perímetro Físico
                </h3>
                <p className="text-[11px] sm:text-sm text-slate-600 leading-snug">
                  Tu móvil es la llave maestra de tu identidad. Un equipo sin
                  bloqueo es una puerta abierta a tu vida privada.
                </p>
                <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-100 space-y-2">
                  <p className="text-[8px] sm:text-[12px] font-bold text-purple-700 uppercase tracking-widest">
                    Ejemplos de blindaje:
                  </p>
                  <ul className="space-y-3 text-left mt-3">
                    {[
                      {
                        t: "Biometría:",
                        d: "Configura FaceID o Huella. Es mucho más seguro que un patrón.",
                      },
                      {
                        t: "Actualizaciones:",
                        d: "No ignores el mensaje de 'Nueva versión'; cierran agujeros de seguridad.",
                      },
                      {
                        t: "Cifrado:",
                        d: "Asegúrate de que el cifrado esté activo para proteger tus fotos ante robos.",
                      },
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">                        
                        <span className="shrink-0 text-xl sm:text-2xl leading-none text-purple-500 mt-[-8px] font-black select-none">
                          •
                        </span>
                        <p className="text-[12px] sm:text-[14px] leading-snug text-left">
                          <span className="font-bold text-slate-800">
                            {item.t}
                          </span>{" "}
                          <span className="font-normal text-slate-500">
                            {item.d}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>

          {/* --- TARJETA 2: CONTRASEÑAS (CLAVES DE ALTO IMPACTO) --- */}
          <motion.section
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border-l-4 border-l-sky-500 border border-slate-200"
          >
            <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
              <motion.div
                variants={floatingIcon}
                animate="animate"
                className="p-3 bg-sky-50 rounded-xl text-sky-600 w-fit h-fit shadow-inner"
              >
                <Key size={24} className="sm:w-[32px] sm:h-[32px]" />
              </motion.div>
              <div className="space-y-2 flex-1 min-w-0 text-left">
                <h3 className="text-sm sm:text-lg font-black uppercase italic text-sky-900 tracking-tight">
                  2. Claves de Alto Impacto
                </h3>
                <p className="text-[11px] sm:text-sm text-slate-600 leading-snug">
                  Evita usar datos obvios. La mayoría de los ataques ocurren por
                  contraseñas débiles o repetidas.
                </p>
                <div className="bg-sky-50 p-2.5 sm:p-4 rounded-lg border border-sky-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                    <div className="p-2 bg-red-100 rounded-md border border-red-100 overflow-hidden">
                      <p className="text-[14px] text-red-600 font-black uppercase mb-0.5">
                        Inseguro
                      </p>
                      <p className="text-[14px] font-mono text-red-800 break-all leading-none">
                        pedro2024
                      </p>
                    </div>
                    <div className="p-2 bg-green-100 rounded-md border border-green-100 overflow-hidden">
                      <p className="text-[14px] text-green-600 font-black uppercase mb-0.5">
                        Blindado
                      </p>
                      <p className="text-[14px] font-mono text-green-800 break-all leading-none">
                        P3dr0.2024#Talar
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* --- TARJETA 3: PHISHING (DETECTANDO EL ANZUELO) --- */}
          <motion.section
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border-l-4 border-l-orange-500 border border-slate-200"
          >
            <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
              <motion.div
                variants={floatingIcon}
                animate="animate"
                className="p-3 bg-orange-50 rounded-xl text-orange-600 w-fit h-fit shadow-inner"
              >
                <MousePointer2 size={24} className="sm:w-[32px] sm:h-[32px]" />
              </motion.div>
              <div className="space-y-2 flex-1 text-left">
                <h3 className="text-sm sm:text-lg font-black uppercase italic text-orange-900 tracking-tight">
                  3. Detectando el Anzuelo
                </h3>
                <p className="text-[11px] sm:text-sm text-slate-600 leading-snug">
                  Los criminales fingen ser soporte técnico o bancos para robar
                  tus datos mediante el miedo.
                </p>
                <div className="border border-orange-200 p-3 sm:p-4 rounded-lg bg-orange-50/30 text-left">
                  <p className="text-[10px] sm:text-xs font-bold text-orange-800 italic mb-2">
                    Identifica la estafa:
                  </p>
                  <div className="border border-orange-200 p-4 rounded-lg bg-orange-50/30 text-left mt-3">
                    <p className="text-[11px] sm:text-sm font-bold text-orange-800 italic mb-3">
                      Identifica la estafa:
                    </p>
                    <ul className="space-y-3">
                      {[
                        {
                          t: "Urgencia:",
                          d: '"Tu cuenta se cerrará en 1 hora si no actúas".',
                        },
                        {
                          t: "Enlaces:",
                          d: "En vez de google.com, dice g00gle-login.net.",
                        },
                        {
                          t: "Archivos:",
                          d: "Nunca abras un .ZIP o .EXE inesperado.",
                        },
                      ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="shrink-0 text-xl sm:text-2xl leading-none text-orange-500 mt-[-7px] font-black select-none">
                            •
                          </span>
                          <p className="text-[12px] sm:text-[14px] leading-snug text-left">
                            <span className="font-bold text-slate-800">
                              {item.t}
                            </span>{" "}
                            <span className="font-normal text-slate-600">
                              {item.d}
                            </span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* --- TARJETA 4: NIÑOS Y FAMILIA --- */}
          <motion.section
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-slate-800 p-4 sm:p-6 rounded-xl shadow-xl text-white flex flex-col md:flex-row gap-4 sm:gap-6 border border-slate-700"
          >
            <motion.div
              variants={floatingIcon}
              animate="animate"
              className="p-3 bg-sky-500 rounded-xl text-white w-fit h-fit shadow-lg"
            >
              <Users size={24} className="sm:w-[32px] sm:h-[32px]" />
            </motion.div>
            <div className="space-y-2 flex-1 text-left">
              <h3 className="text-sm sm:text-lg font-black uppercase italic text-sky-300 tracking-tight">
                4. El Legado de los Hijos
              </h3>
              <p className="text-[11px] sm:text-sm text-slate-300 leading-snug font-light">
                Los niños no tienen malicia para detectar trampas. Enséñales que
                lo que se sube, se queda.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 text-left">
                  <h4 className="text-sky-300 text-[14px] font-black uppercase mb-1">
                    Identidad
                  </h4>
                  <p className="text-[14px] text-slate-200 italic">
                    Evita revelar datos sensibles en fotos, como uniformes con
                    logos, ubicaciones en tiempo real o detalles del entorno que
                    identifiquen tu hogar.
                  </p>
                </div>
                <div className="p-2.5 bg-white/5 rounded-lg border border-white/10 text-left">
                  <h4 className="text-sky-300 text-[14px] font-black uppercase mb-1">
                    Extraños
                  </h4>
                  <p className="text-[14px] text-slate-200 italic">
                    "Si no lo conoces en persona, no es tu amigo".
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* --- TARJETA 5: RESPALDO (BACKUP) --- */}
          <motion.section
            variants={cardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border-l-4 border-l-emerald-500 border border-slate-200"
          >
            <div className="flex flex-col md:flex-row gap-4 sm:gap-6 text-left">
              <motion.div
                variants={floatingIcon}
                animate="animate"
                className="p-3 bg-emerald-50 rounded-xl text-emerald-600 w-fit h-fit shadow-inner"
              >
                <HardDrive size={24} className="sm:w-[32px] sm:h-[32px]" />
              </motion.div>
              <div className="space-y-2 flex-1 text-left">
                <h3 className="text-sm sm:text-lg font-black uppercase italic text-emerald-900 tracking-tight">
                  5. Supervivencia de Datos
                </h3>
                <p className="text-[11px] sm:text-sm text-slate-600 leading-snug">
                  Un virus puede bloquear tus archivos. La única copia segura es
                  la que está físicamente desconectada.
                </p>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 italic text-left">
                  <p className="text-[12px] sm:text-[14px] text-slate-500 leading-relaxed">
                    Una vez al mes, copia tus archivos a un disco externo y{" "}
                    <b>desconéctalo</b>.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

         {/* ==========================================
              SECCIÓN: CONTENIDO EXTRA (DESDE BASE DE DATOS)
              ========================================== */}
          {info.contenido && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="bg-slate-200 p-4 rounded-xl border border-sky-100 text-left overflow-hidden"
            >
              <h4 className="text-sky-900 font-black uppercase text-[8px] sm:text-[9px] mb-1.5 flex items-center gap-2 italic">
                <AlertTriangle size={12} /> Actualización Especial:
              </h4>
              <p className="text-[10px] sm:text-xs text-sky-800 leading-snug italic font-light">
                {info.contenido}
              </p>
            </motion.div>
          )}
        </div>

        {/* ==========================================
            SECCIÓN: CIERRE Y BOTÓN DE ACEPTACIÓN
            ========================================== */}
        <section className="text-center pt-6 border-t border-slate-200 space-y-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBack}
            className="bg-sky-600 text-white w-full sm:w-auto px-8 sm:px-10 py-3 sm:py-3.5 rounded-full font-black uppercase tracking-widest text-[9px] sm:text-xs shadow-lg flex items-center justify-center gap-2 mx-auto transition-all"
          >
            ACEPTO Y VUELVO <CheckCircle size={16} />
          </motion.button>

          <p className="text-[8px] sm:text-[10px] text-slate-400 uppercase font-normal tracking-[0.1em] px-4 leading-tight">
            Gestión Local Teocrática • Seguridad 2.0
          </p>
        </section>
      </main>
    </div>
  );
}

export default SecurityTipsPage;
