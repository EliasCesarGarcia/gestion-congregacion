import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, Smartphone, Lock, Globe, Users, 
  MousePointer2, ChevronLeft, Zap, ShieldAlert, 
  CheckCircle, Database, AlertTriangle, Key, HardDrive, Shield
} from 'lucide-react';

function SecurityTipsPage() {
  const navigate = useNavigate();
  const [info, setInfo] = useState({ contenido: '', updated_at: '' });

  useEffect(() => {
    window.scrollTo(0, 0);
    axios.get('/api/seguridad-info')
      .then(res => { if (res.data) setInfo(res.data); })
      .catch(err => console.error("Error cargando info de seguridad", err));
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Reciente';
    return new Date(dateStr).toLocaleDateString('es-ES', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    });
  };

  const handleBack = () => {
    navigate('/perfil#seguridad');
  };

  // ANIMACIONES PERMANENTES
  const floatingIcon = {
    animate: {
      y: [0, -10, 0],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    }
  };

  const pulseScale = {
    animate: {
      scale: [1, 1.05, 1],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-800 pb-20 overflow-x-hidden">
      {/* HEADER RESPONSIVO */}
      <header className="bg-sky-700 text-white p-4 sm:p-6 sticky top-0 z-50 shadow-lg border-b-4 border-sky-400">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button 
            onClick={handleBack}
            className="flex items-center gap-1 sm:gap-2 text-[10px] font-black uppercase tracking-widest hover:text-sky-200 transition-all bg-sky-800/50 px-3 py-2 rounded-lg shrink-0"
          >
            <ChevronLeft size={18} /> Volver
          </button>
          <div className="text-right min-w-0">
            <h1 className="text-sm sm:text-xl font-black italic uppercase tracking-tighter leading-none truncate">Blindaje Digital</h1>
            <p className="text-[8px] sm:text-[9px] text-sky-100 font-bold mt-1 uppercase truncate">
              Revisión: {formatDate(info.updated_at)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 mt-4 sm:mt-8 space-y-10 sm:space-y-16">
        
        {/* INTRODUCCIÓN */}
        <section className="text-center space-y-4 sm:space-y-6 bg-white p-6 sm:p-10 rounded-3xl border border-sky-100 shadow-sm relative overflow-hidden">
          <motion.div variants={pulseScale} animate="animate" className="inline-block p-4 sm:p-5 bg-sky-50 rounded-full text-sky-600 relative z-10">
            <ShieldCheck size={45} className="sm:w-[60px] sm:h-[60px]" />
          </motion.div>
          <div className="relative z-10 space-y-3">
            <h2 className="text-2xl sm:text-4xl font-light italic text-sky-900 leading-tight">
              Protegemos lo que <span className="font-black text-sky-700">más importa.</span>
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto leading-relaxed text-sm sm:text-lg font-light italic">
              "La seguridad no es un producto, es un hábito". Hemos actualizado esta guía con ejemplos reales para que tu experiencia en línea sea una fortaleza inexpugnable.
            </p>
          </div>
        </section>

        {/* LISTADO DE CONSEJOS NUTRIDOS */}
        <div className="grid gap-8 sm:gap-12">
          
          {/* 1. DISPOSITIVOS */}
          <motion.section variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border-l-[6px] sm:border-l-8 border-l-purple-500 border border-slate-200">
            <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
              <motion.div variants={floatingIcon} animate="animate" className="p-4 sm:p-5 bg-purple-50 rounded-3xl text-purple-600 w-fit h-fit shadow-inner">
                <Smartphone size={35} className="sm:w-[45px] sm:h-[45px]" />
              </motion.div>
              <div className="space-y-4 flex-1">
                <h3 className="text-xl sm:text-2xl font-black uppercase italic text-purple-900 tracking-tight">1. El Perímetro Físico</h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Tu dispositivo móvil es la llave maestra de tu identidad. Si alguien lo toma sin bloqueo, tiene acceso a tu correo, tus contactos y tus sesiones activas.
                </p>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 space-y-3">
                  <p className="text-[10px] sm:text-xs font-bold text-purple-700 flex items-center gap-2 uppercase tracking-tighter"><Zap size={14}/> Ejemplo de blindaje:</p>
                  <ul className="text-xs sm:text-sm text-slate-500 space-y-2 font-medium">
                    <li className="flex gap-2"><b>• Biometría:</b> Configura FaceID o Huella. Es mucho más difícil de copiar que un patrón.</li>
                    <li className="flex gap-2"><b>• Actualizaciones:</b> No ignores el mensaje de "Nueva versión". Cierran agujeros de seguridad.</li>
                    <li className="flex gap-2"><b>• Cifrado:</b> Asegúrate de que el cifrado esté activo para que tus fotos sean ilegibles ante robos.</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>

          {/* 2. CONTRASEÑAS */}
          <motion.section variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border-l-[6px] sm:border-l-8 border-l-sky-500 border border-slate-200">
            <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
              <motion.div variants={floatingIcon} animate="animate" className="p-4 sm:p-5 bg-sky-50 rounded-3xl text-sky-600 w-fit h-fit shadow-inner">
                <Key size={35} className="sm:w-[45px] sm:h-[45px]" />
              </motion.div>
              <div className="space-y-4 flex-1 min-w-0">
                <h3 className="text-xl sm:text-2xl font-black uppercase italic text-sky-900 tracking-tight">2. Claves de Alto Impacto</h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Utilizar "123456" o nombres de mascotas es invitar a los hackers. La mayoría de ataques ocurren por contraseñas débiles o repetidas.
                </p>
                <div className="bg-sky-50 p-4 sm:p-5 rounded-2xl border border-sky-100">
                  <p className="text-[10px] sm:text-xs font-bold text-sky-800 uppercase mb-3">Comparativa de Seguridad:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100 overflow-hidden">
                      <p className="text-[9px] text-red-600 font-black uppercase mb-1">Inseguro</p>
                      <p className="text-xs sm:text-sm font-mono text-red-800 break-all">pedro2024</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100 overflow-hidden">
                      <p className="text-[9px] text-green-600 font-black uppercase mb-1">Blindado</p>
                      <p className="text-xs sm:text-sm font-mono text-green-800 break-all">P3dr0.2024#Talar</p>
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-sky-700 mt-4 italic font-medium">
                    <b>Tip:</b> Cambia tu contraseña cada 6 meses y nunca la guardes en notas físicas.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* 3. PHISHING */}
          <motion.section variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border-l-[6px] sm:border-l-8 border-l-orange-500 border border-slate-200">
            <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
              <motion.div variants={floatingIcon} animate="animate" className="p-4 sm:p-5 bg-orange-50 rounded-3xl text-orange-600 w-fit h-fit shadow-inner">
                <MousePointer2 size={35} className="sm:w-[45px] sm:h-[45px]" />
              </motion.div>
              <div className="space-y-4 flex-1">
                <h3 className="text-xl sm:text-2xl font-black uppercase italic text-orange-900 tracking-tight">3. Detectando el Anzuelo</h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  El 90% de robos de cuenta empiezan con un correo falso. Los criminales fingen ser soporte técnico o bancos.
                </p>
                <div className="border-2 border-dashed border-orange-200 p-4 rounded-2xl bg-orange-50/30 space-y-3">
                  <p className="text-xs sm:text-sm font-bold text-orange-800 italic">Identifica la estafa:</p>
                  <ul className="text-xs sm:text-sm text-slate-600 space-y-3">
                    <li className="flex gap-2"><AlertTriangle size={16} className="text-orange-500 shrink-0"/> <b>Urgencia:</b> "Tu cuenta se cerrará en 1 hora".</li>
                    <li className="flex gap-2"><AlertTriangle size={16} className="text-orange-500 shrink-0"/> <b>Enlaces:</b> En vez de <i>google.com</i>, dice <i>g00gle-login.net</i>.</li>
                    <li className="flex gap-2"><AlertTriangle size={16} className="text-orange-500 shrink-0"/> <b>Archivos:</b> Nunca abras un .ZIP o .EXE inesperado.</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>

          {/* 4. NIÑOS (SECCIÓN OSCURA) */}
          <motion.section variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="bg-slate-800 p-5 sm:p-8 rounded-3xl shadow-2xl text-white flex flex-col md:flex-row gap-6 sm:gap-8">
            <motion.div variants={floatingIcon} animate="animate" className="p-4 sm:p-5 bg-sky-500 rounded-3xl text-white w-fit h-fit shadow-lg">
              <Users size={35} className="sm:w-[45px] sm:h-[45px]" />
            </motion.div>
            <div className="space-y-4 flex-1">
              <h3 className="text-xl sm:text-2xl font-black uppercase italic text-sky-300 tracking-tight">4. El Legado de los Hijos</h3>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
                Internet tiene memoria infinita. Enséñales que lo que se sube, se queda. Los niños son nativos digitales pero no tienen malicia para detectar trampas.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <h4 className="text-sky-300 text-[10px] font-black uppercase mb-2 tracking-widest">Identidad</h4>
                  <p className="text-[11px] text-slate-400 italic leading-relaxed">No subir fotos donde se vea la dirección de casa o el nombre del colegio.</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <h4 className="text-sky-300 text-[10px] font-black uppercase mb-2 tracking-widest">Extraños</h4>
                  <p className="text-[11px] text-slate-400 italic leading-relaxed">"Si no lo conoces en persona, no es tu amigo en la red".</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* 5. BACKUP */}
          <motion.section variants={cardVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border-l-[6px] sm:border-l-8 border-l-emerald-500 border border-slate-200">
            <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
              <motion.div variants={floatingIcon} animate="animate" className="p-4 sm:p-5 bg-emerald-50 rounded-3xl text-emerald-600 w-fit h-fit shadow-inner">
                <HardDrive size={35} className="sm:w-[45px] sm:h-[45px]" />
              </motion.div>
              <div className="space-y-4 flex-1">
                <h3 className="text-xl sm:text-2xl font-black uppercase italic text-emerald-900 tracking-tight">5. Supervivencia de Datos</h3>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  ¿Qué harías si hoy entraras a tu PC y todos tus archivos estuvieran bloqueados? Esto se llama <b>Ransomware</b>.
                </p>
                <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-100 italic">
                  <p className="text-xs sm:text-sm text-emerald-800 font-medium">
                    "La única copia de seguridad segura es la que está físicamente desconectada".
                  </p>
                  <p className="text-[11px] sm:text-[12px] text-slate-500 mt-3 leading-relaxed">
                    Una vez al mes, copia tus archivos a un disco externo y <b>desconéctalo</b>. Si un virus ataca, no podrá tocar lo que no está enchufado.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* CONTENIDO EXTRA BD */}
          {info.contenido && (
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="bg-sky-50 p-6 sm:p-8 rounded-3xl border border-sky-100 overflow-hidden">
              <h4 className="text-sky-900 font-black uppercase text-[10px] sm:text-xs mb-3 flex items-center gap-2 italic">
                <AlertTriangle size={16}/> Actualización Especial:
              </h4>
              <p className="text-sm sm:text-base text-sky-800 leading-relaxed italic font-light">{info.contenido}</p>
            </motion.div>
          )}

        </div>

        {/* CIERRE */}
        <section className="text-center pt-8 sm:pt-10 border-t border-slate-200 space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <h4 className="text-lg sm:text-xl font-bold text-slate-700 italic">¿Listo para navegar seguro?</h4>
            <p className="text-xs sm:text-sm text-slate-400">Protege tu cuenta con lo aprendido.</p>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleBack}
            className="bg-sky-600 text-white w-full sm:w-auto px-10 sm:px-16 py-4 sm:py-5 rounded-full font-black uppercase tracking-widest text-xs sm:text-sm shadow-xl flex items-center justify-center gap-3 mx-auto transition-all"
          >
            ACEPTO Y VUELVO <CheckCircle size={20}/>
          </motion.button>
          
          <p className="text-[8px] sm:text-[10px] text-slate-300 uppercase font-black tracking-[0.1em] sm:tracking-[0.2em] px-4">
            Gestión Local Teocrática • Seguridad 2.0
          </p>
        </section>

      </main>
    </div>
  );
}

export default SecurityTipsPage;