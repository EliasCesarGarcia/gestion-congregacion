/**
 * ARCHIVO: SecurityTipsPage.jsx
 * UBICACIÓN: frontend/src/pages/SecurityTipsPage.jsx
 * DESCRIPCIÓN: Centro de Seguridad Digital. Diseño Industrial (Bordes Rectos),
 * Glassmorphism calibrado y Tags interactivos.
 * Estándar: Senior God Level (Zero ESLint Errors - High Performance).
 */

import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion"; // Rename to Motion for ESLint fix
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";

// Importación de Iconos
import {
  ShieldCheck,
  Smartphone,
  MousePointer2,
  Users,
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  Zap,
  ShieldAlert,
  Fingerprint,
  HardDrive,
  Info,
  Key,
} from "lucide-react";

/**
 * COMPONENTE: InteractiveTag
 * Despliega información detallada al foco (hover/tap).
 */
const InteractiveTag = ({ label, info, index }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Detectamos si es un botón de la columna derecha en móvil (índices 1, 3, 5...)
  const isRightColumnMobile = index % 2 !== 0;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsHovered(!isHovered)}
    >
      <Motion.div
        whileHover={{ backgroundColor: "var(--color-jw-navy)", color: "#fff" }}
        className="cursor-pointer px-4 py-2 text-[11px] sm:text-[12px] font-medium uppercase tracking-widest bg-jw-card/90 text-jw-navy border border-jw-navy/40 flex items-center justify-between gap-2 rounded-none transition-colors h-full"
      >
        {label} <Info size={12} className="opacity-40" />
      </Motion.div>

      <AnimatePresence>
        {isHovered && (
          <Motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            /* 
               EXPLICACIÓN DE LA LÓGICA NIVEL DIOS:
               1. absolute left-0: SIEMPRE alinea el inicio del texto con el inicio del botón.
               2. sm:w-[450px]: En PC, el ancho es fijo y amplio hacia la derecha.
               3. w-[calc(100vw-120px)]: En la primera columna de móvil, ocupa casi todo el ancho.
               4. isRightColumnMobile ? 'w-[calc(50vw-20px)]' : ... : Si el botón está a la derecha,
                  limitamos su ancho para que no choque con el borde del celular.
            */
            className={`absolute top-full left-0 mt-1 p-4 bg-jw-navy border-t-2 border-t-jw-accent shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-[150] pointer-events-none
              ${isRightColumnMobile ? "w-[calc(46vw)]" : "w-[calc(85vw)]"} 
              sm:w-[450px]`}
          >
            <p className="text-[13px] sm:text-[15px] text-white font-medium leading-relaxed normal-case whitespace-normal">
              {info}
            </p>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * COMPONENTE: GlassContainer
 * Opacidad calibrada al 80% para equilibrio entre transparencia y lectura.
 * Bordes rectos (Industrial Design).
 */
const GlassContainer = ({ children, className = "" }) => (
  <div
    className={`backdrop-blur-xl bg-jw-card/80 border border-white/20 shadow-2xl rounded-none ${className}`}
  >
    {children}
  </div>
);

/**
 * COMPONENTE: SecurityTipCard
 */
const SecurityTipCard = ({ tip, index }) => {
  const isEven = index % 2 === 0;

  return (
    <Motion.article
      /* Definimos el estado inicial: fuera de la pantalla y con un leve desenfoque */
      initial={{
        opacity: 0,
        x: isEven ? -150 : 150, // Más distancia para que el efecto sea más notorio
        filter: "blur(5px)",
      }}
      /* Definimos el estado cuando entra en pantalla */
      whileInView={{
        opacity: 1,
        x: 0,
        filter: "blur(0px)",
      }}
      /* Configuramos el Viewport para que se repita SIEMPRE */
      viewport={{
        once: false, // Permite que la animación se repita al hacer scroll arriba y abajo
        amount: 0.3, // Se dispara cuando el 30% del elemento entra en el visor
      }}
      transition={{
        type: "spring", // Efecto elástico moderno
        stiffness: 50, // Rigidez (controla la velocidad del rebote)
        damping: 20, // Amortiguación
        duration: 0.8,
      }}
      className={`flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} gap-0 items-stretch mb-16 relative group hover:z-[100] focus-within:z-[100] transition-all`}
    >
      {/* 1. La caja se queda quieta (div estándar) */}
      <div className="bg-jw-navy p-8 flex items-center justify-center shrink-0 border border-white/10 shadow-2xl">
        {/* 2. Solo el icono se mueve (Motion.div interno) */}
        <Motion.div
          animate={{
            y: [0, -12, 0], // Oscilación vertical del icono
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="text-jw-accent"
        >
          {React.cloneElement(tip.icon, { size: 54 })}
        </Motion.div>
      </div>

      {/* Contenedor de Texto cristalizado */}
      <GlassContainer
        className={`flex-1 p-8 text-left border-l-0 md:border-l-4 md:border-l-jw-accent`}
      >
        <h3 className="text-xl font-black uppercase tracking-tighter text-jw-navy mb-1">
          {tip.title}
        </h3>
        <p className="text-base text-jw-text-main font-bold leading-snug mb-5">
          {tip.description}
        </p>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-5 justify-start relative">
          {tip.tags?.map((tag, i) => (
            <InteractiveTag
              key={i}
              label={tag.label}
              info={tag.info}
              index={i}
            />
          ))}
        </div>
      </GlassContainer>
    </Motion.article>
  );
};

function SecurityTipsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [dbInfo, setDbInfo] = useState({ contenido: "", updated_at: "" });

  // Función para formatear la fecha dinámicamente según el idioma
  const formatDate = (dateStr) => {
    if (!dateStr) return t("security.recent", "Reciente");
    try {
      // Reemplazamos guiones por barras y quitamos milisegundos para compatibilidad total con móviles
      const validDateStr = dateStr.replace(/-/g, "/").replace(/T.+/, "");
      const dateObj = new Date(validDateStr);

      // Si la fecha sigue siendo inválida tras el intento de limpieza
      if (isNaN(dateObj.getTime())) return t("security.recent", "Reciente");

      return dateObj.toLocaleDateString(i18n.language, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return t("security.recent", "Reciente");
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    axios
      .get("/api/seguridad-info")
      .then((res) => setDbInfo(res.data))
      .catch((err) => console.error(err));
  }, []);

  const handleBack = () => navigate("/perfil#seguridad");

  const tips = useMemo(
    () => [
      {
        id: "estafas",
        icon: <ShieldAlert />,
        title: t("security.tips.estafas.title", "1. Ciberestafas"),
        description: t(
          "security.tips.estafas.desc",
          "El contenido digital falso puede imitar voces y rostros conocidos para robarte información o dinero.",
        ),
        tags: [
          {
            label: t("security.tips.estafas.tags.prevention", "Prevención"),
            info: t("security.tips.estafas.tags.prevention_info"),
          },
          {
            label: t("security.tips.estafas.tags.verification", "Verificación"),
            info: t("security.tips.estafas.tags.verification_info"),
          },
          {
            label: t("security.tips.estafas.tags.deepfake", "Deepfake"),
            info: t("security.tips.estafas.tags.deepfake_info"),
          },
        ],
      },
      {
        id: "perimetro",
        icon: <Smartphone />,
        title: t("security.tips.physical.title", "2. Perímetro Físico"),
        description: t(
          "security.tips.physical.desc",
          "Tu móvil es la llave maestra. Un equipo sin bloqueo es una puerta abierta a toda tu vida privada.",
        ),
        tags: [
          {
            label: t("security.tips.physical.tags.biometry", "Biometría"),
            info: t("security.tips.physical.tags.biometry_info"),
          },
          {
            label: t("security.tips.physical.tags.updates", "Actualizaciones"),
            info: t("security.tips.physical.tags.updates_info"),
          },
          {
            label: t("security.tips.physical.tags.encryption", "Cifrado"),
            info: t("security.tips.physical.tags.encryption_info"),
          },
        ],
      },
      {
        id: "claves",
        icon: <Key />,
        title: t("security.tips.keys.title", "3. Claves de Impacto"),
        description: t(
          "security.tips.keys.desc",
          "Evita usar datos obvios. La mayoría de los ataques ocurren por contraseñas débiles o repetidas.",
        ),
        tags: [
          {
            label: t("security.tips.keys.tags.2fa", "2FA"),
            info: t("security.tips.keys.tags.2fa_info"),
          },
          {
            label: t("security.tips.keys.tags.robustness", "Robustez"),
            info: t("security.tips.keys.tags.robustness_info"),
          },
          {
            label: t("security.tips.keys.tags.passphrases", "Passphrases"),
            info: t("security.tips.keys.tags.passphrases_info"),
          },
        ],
      },
      {
        id: "phishing",
        icon: <MousePointer2 />,
        title: t("security.tips.phishing.title", "4. Detectando el Anzuelo"),
        description: t(
          "security.tips.phishing.desc",
          "Los criminales fingen ser soporte técnico o bancos para robar tus datos mediante el miedo o la urgencia.",
        ),
        tags: [
          {
            label: t("security.tips.phishing.tags.urgency", "Urgencia"),
            info: t("security.tips.phishing.tags.urgency_info"),
          },
          {
            label: t("security.tips.phishing.tags.links", "Enlaces"),
            info: t("security.tips.phishing.tags.links_info"),
          },
          {
            label: t("security.tips.phishing.tags.files", "Archivos"),
            info: t("security.tips.phishing.tags.files_info"),
          },
        ],
      },
      {
        id: "family",
        icon: <Users />,
        title: t("security.tips.family.title", "5. Legado de los Hijos"),
        description: t(
          "security.tips.family.desc",
          "Los niños no tienen malicia para detectar trampas. Enséñales que lo que se sube a internet, se queda ahí.",
        ),
        tags: [
          {
            label: t("security.tips.family.tags.identity", "Identidad"),
            info: t("security.tips.family.tags.identity_info"),
          },
          {
            label: t("security.tips.family.tags.strangers", "Extraños"),
            info: t("security.tips.family.tags.strangers_info"),
          },
          {
            label: t("security.tips.family.tags.privacy", "Privacidad"),
            info: t("security.tips.family.tags.privacy_info"),
          },
        ],
      },
      {
        id: "backup",
        icon: <HardDrive />,
        title: t("security.tips.backup.title", "6. Supervivencia de Datos"),
        description: t(
          "security.tips.backup.desc",
          "Un virus puede bloquear tus archivos. La única copia segura es la que está físicamente desconectada.",
        ),
        tags: [
          {
            label: t("security.tips.backup.tags.frequency", "Frecuencia"),
            info: t("security.tips.backup.tags.frequency_info"),
          },
          {
            label: t("security.tips.backup.tags.disconnection", "Desconexión"),
            info: t("security.tips.backup.tags.disconnection_info"),
          },
          {
            label: t("security.tips.backup.tags.cloud", "Nube"),
            info: t("security.tips.backup.tags.cloud_info"),
          },
        ],
      },
    ],
    [t],
  );

  return (
    <div className="min-h-screen bg-transparent pb-20 overflow-x-hidden relative">
      <Helmet>
        <title>{t("security.seo.title", "Consejos de Seguridad")}</title>
      </Helmet>

      {/* HEADER INDUSTRIAL */}
      <header className="relative z-10 backdrop-blur-xl bg-jw-navy/90 border-b border-white/10 text-white shadow-xl">
        {/* CAMBIO: Se cambia h-14 por min-h-[3.5rem] y se añade py-2 para que no se corte en móvil */}
        <div className="max-w-6xl mx-auto px-4 min-h-[3.5rem] py-2 flex items-center justify-between gap-2">
          <Motion.button
            whileHover="animateChevron" // Disparador para los hijos
            onClick={handleBack}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] px-5 py-2 border border-white/40 hover:bg-white/10 transition-all rounded-none group"
          >
            {/* Envolvemos la flecha en un Motion.span para animarla */}
            <Motion.span
              variants={{
                animateChevron: {
                  x: [0, -6, 0], // Movimiento moderado a la izquierda
                },
              }}
              transition={{
                repeat: Infinity, // Se repite mientras dure el hover
                duration: 0.8, // Velocidad moderada
                ease: "easeInOut",
              }}
            >
              <ChevronLeft size={14} />
            </Motion.span>

            <span>{t("security.back", "Volver")}</span>
          </Motion.button>

          {/* Contenedor de textos: Ajustado para que el texto sea visible y se alinee a la derecha en móvil */}
          <div className="flex flex-col items-end sm:items-start flex-1 text-right sm:text-left">
            <h1 className="text-[10px] sm:text-base font-medium tracking-[0.12em] uppercase text-jw-accent leading-tight">
              {t("security.header_title", "Consejos de Seguridad")}
            </h1>

            <p className="text-[9px] sm:text-xs text-jw-accent font-normal uppercase tracking-widest opacity-90 leading-tight">
              {t("security.revision", "Última revisión")}:{" "}
              <span className="inline-block">
                {formatDate(dbInfo.updated_at)}
              </span>
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        {/* HERO SECTION */}
        <section className="mb-16">
          <GlassContainer className="p-8 sm:p-10 border-l-8 border-l-jw-accent flex flex-col md:flex-row items-center gap-8">
            {/* CONTENEDOR DEL ICONO (A la izquierda) */}
            <div className="relative shrink-0">
              <Motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  filter: [
                    "drop-shadow(0 0 0px rgba(var(--color-jw-accent), 0))",
                    "drop-shadow(0 0 20px rgba(var(--color-jw-accent), 0.8))",
                    "drop-shadow(0 0 0px rgba(var(--color-jw-accent), 0))",
                  ],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: "easeInOut",
                }}
                className="p-6 bg-jw-accent/20 border border-jw-accent/40 rounded-none"
              >
                <ShieldCheck size={65} className="text-jw-accent" />
              </Motion.div>
            </div>

            {/* CONTENEDOR DE TEXTO (A la derecha, alineado a la izquierda) */}
            <div className="text-left space-y-2">
              <h2 className="text-2xl sm:text-4xl font-medium text-jw-navy uppercase tracking-tighter leading-none">
                {t("security.hero_title", "Tu integridad es")} <br />
                <span className="text-jw-accent">
                  {t("security.hero_highlight", "nuestra prioridad")}
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-jw-text-main font-bold uppercase tracking-widest leading-relaxed max-w-xl">
                {/* Frase sugerida: más corta y directa */}
                {t(
                  "security.hero_sub",
                  "Hábitos esenciales para el cuidado de tu privacidad e información personal.",
                )}
              </p>
            </div>
          </GlassContainer>
        </section>

        {/* LISTADO COMPLETO DE TIPS */}
        <div className="space-y-6">
          {tips.map((tip, index) => (
            <SecurityTipCard key={tip.id} tip={tip} index={index} />
          ))}
        </div>

        {/* DB INFO (GLASS) */}
        <AnimatePresence>
          {dbInfo.contenido && (
            <Motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              className="mt-8"
            >
              <GlassContainer className="py-4 px-6 border-l-8 border-l-jw-accent relative overflow-hidden">
                <h4 className="flex items-center gap-2 text-jw-accent font-black uppercase tracking-widest text-[10px] mb-3">
                  <AlertTriangle size={14} />{" "}
                  {t("security.db_alert", "Aviso de Último Minuto")}
                </h4>
                <p className="text-lg font-bold italic text-jw-navy">
                  "{dbInfo.contenido}"
                </p>
              </GlassContainer>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* BOTÓN FINAL CON EFECTO FILL */}
        <section className="mt-24 text-center">
          <Motion.button
            /* Forzamos que los estados se reconozcan siempre */
            initial="rest"
            animate="rest"
            whileHover="hover"
            onClick={handleBack}
            /* EXPLICACIÓN: bg-jw-navy !important asegura que no sea transparente. 
        border-2 border-jw-accent le da el contorno industrial. */
            className="group relative px-12 py-5 bg-jw-navy border-2 border-jw-accent font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl overflow-hidden rounded-none"
            style={{ backgroundColor: "var(--color-jw-navy)" }} // Refuerzo de seguridad Nivel Dios
          >
            {/* 1. Fondo de Relleno (Celeste/Naranja según el tema) */}
            <Motion.div
              variants={{
                rest: { y: "101%" }, // Escondido abajo
                hover: { y: 0 }, // Sube y cubre todo
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="absolute inset-0 bg-jw-accent z-0"
              style={{ backgroundColor: "var(--color-jw-accent)" }}
            />

            {/* 2. El Texto (Siempre encima y legible) */}
            <Motion.span
              variants={{
                rest: { color: "#ffffff" }, // Blanco sobre fondo Navy
                hover: { color: "var(--color-jw-navy)" }, // Navy sobre fondo Accent
              }}
              transition={{ duration: 0.2 }}
              className="relative z-10 flex items-center justify-center gap-3"
            >
              {t("security.accept_btn", "Entendido y volver")}{" "}
              <CheckCircle size={18} />
            </Motion.span>
          </Motion.button>
        </section>
      </main>
    </div>
  );
}

export default SecurityTipsPage;
