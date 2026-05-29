/**
 * ARCHIVO: Footer.jsx
 * UBICACIÓN: frontend/src/components/Footer.jsx
 * DESCRIPCIÓN: Pie de página institucional optimizado para estabilidad visual.
 * Se eliminaron los contenedores de ancho máximo relativo para evitar
 * desplazamientos al cambiar el tamaño de fuente (SEO 2026).
 * Incluye marcado semántico Schema.org para mejorar el posicionamiento local.
 */

// --- IMPORTACIONES DE LIBRERÍAS Y COMPONENTES ---
import React, { useContext } from "react";
import { AppContext } from "../context/AppContext";
import { MapPin, Globe, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
// NUEVO: Importación para el soporte de traducción de react-i18next
import { useTranslation } from "react-i18next";

function Footer() {
  // --- 1. CONFIGURACIÓN Y ESTADOS DEL CONTEXTO ---
  const { t, i18n } = useTranslation();

  // Consumimos el estado de sesión
  const { user: session } = useContext(AppContext);
  // Lógica de "Nesting Fix": Extrae los datos reales del usuario si vienen anidados en session.user
  const user = session?.user || session;

  // NUEVO: Detección dinámica de dirección (LTR / RTL)
  const isRtl = i18n.dir ? i18n.dir() === "rtl" : ["ar", "he"].includes(i18n.language);

  // Renderizado condicional: El footer solo es visible si hay un usuario autenticado
  if (!user) return null;

  /**
   * Mapea la región de la base de datos a una clave de traducción
   * Reutilizamos la misma lógica simplificada que se diseñó para el Navbar
   * @param {string} regionName Nombre de la región en la base de datos
   * @returns {string} Clave de traducción
   */
  const getRegionKey = (regionName) => {
    const map = {
      "Asia": "region_asia",
      "África": "region_africa",
      "Europa": "region_europa",
      "América del Norte": "region_north_america",
      "América Central": "region_central_america",
      "América del Sur": "region_south_america",
      "Oceanía": "region_oceania"
    };
    return map[regionName] || "nav_undefined";
  };

  return (
    /**
     * --- CONTENEDOR PRINCIPAL DEL PIE DE PÁGINA ---
     * style: Sincroniza el color de fondo con el horario (Mañana/Tarde/Noche).
     * border-t-4: Línea superior decorativa institucional.
     * px-2 sm:px-6: Alineación horizontal idéntica a la del Navbar para coherencia visual.
     */
    <footer
      dir={isRtl ? "rtl" : "ltr"}
      className="bg-jw-navy/65 backdrop-blur-sm w-full border-t border-jw-blue/30 text-jw-text-light py-2 px-2 sm:px-6 mt-auto overflow-hidden transition-colors duration-1000 relative"
    >

      {/* Capa de imagen estática para el Footer */}
      <div className="theme-bg-footer"></div>

      {/* 
          --- ESTRUCTURA DE MICRODATOS (SEO 2026) --- 
          itemScope/itemType: Indica a los motores de búsqueda (Google, IAs) que este bloque
          contiene información estructurada sobre una Organización.
      */}
      <div
        className="w-full flex flex-col sm:flex-row flex-wrap justify-start items-start gap-4 sm:gap-6 min-w-0 relative z-10"
        itemScope
        itemType="https://schema.org/Organization"
      >
        {/* --- SECCIÓN IZQUIERDA: IDENTIDAD Y LOCALIZACIÓN --- */}
        {/* En RTL, alineamos el bloque completo a la derecha (items-end text-right) */}
        <div className={`flex flex-col ${isRtl ? 'items-end text-right' : 'items-start text-left'} min-w-0 max-w-full md:flex-1`}>
          
          {/* h3 convertido en flexbox con un gap constante para evitar colapsos de texto con el paréntesis */}
          <h3 className={`text-sm font-medium tracking-tight truncate w-full mb-1 flex items-center gap-1.5 ${isRtl ? 'justify-start' : ''}`}>
            <span itemProp="name">
              {t("nav_congregation", "Congregación")} {user.congregacion_nombre}
            </span>
            {/* El uso de <bdi> garantiza que los paréntesis se rendericen de forma correcta en hebreo/árabe */}
            <span className="opacity-70 text-xs font-light shrink-0">
              <bdi>({user.numero_congregacion})</bdi>
            </span>
          </h3>

          <div className="space-y-2 w-full">
            {/* DIRECCIÓN POSTAL SEMÁNTICA (Schema.org) */}
            {/* El navegador coloca el icono a la derecha de manera nativa en RTL */}
            <address
              className={`flex items-center gap-2 text-xs opacity-80 font-light italic w-full min-w-0 not-italic ${isRtl ? 'text-right' : 'text-left'}`}
              itemProp="address"
              itemScope
              itemType="https://schema.org/PostalAddress"
            >
              <MapPin className="w-3.5 h-3.5 opacity-60 shrink-0" />
              {/* flex-1 permite que ocupe el espacio disponible y justify-start alinea a la derecha en RTL */}
              <p className={`flex flex-wrap items-baseline min-w-0 flex-1 justify-start ${isRtl ? 'text-right' : 'text-left'}`}>
                {/* Calle: Texto + Coma (condicional) */}
                {user.direccion && (
                  <span
                    itemProp="streetAddress"
                    className="truncate flex-shrink-0"
                  >
                    {user.direccion}
                    {user.ciudad || user.provincia || user.pais
                      ? ",\u00A0"
                      : ""}{" "}
                  </span>
                )}

                {/* Ciudad: Texto + Coma (condicional) */}
                {user.ciudad && (
                  <span
                    itemProp="addressLocality"
                    className="truncate flex-shrink-0"
                  >
                    {user.ciudad}
                    {user.provincia || user.pais ? ",\u00A0" : ""}{" "}
                  </span>
                )}

                {/* Provincia: Texto + Coma (condicional) */}
                {user.provincia && (
                  <span
                    itemProp="addressRegion"
                    className="truncate flex-shrink-0"
                  >
                    {user.provincia}
                    {user.pais ? ",\u00A0" : ""}{" "}
                  </span>
                )}

                {/* País */}
                {user.pais && (
                  <span
                    itemProp="addressCountry"
                    className="truncate flex-shrink-0"
                  >
                    {user.pais}
                  </span>
                )}
              </p>
            </address>

            {/* REGIÓN GEOGRÁFICA INTERNA */}
            {/* El navegador ubica el icono de la región a la derecha automáticamente en RTL */}
            <div className={`flex items-center gap-2 text-xs text-gray-200 font-light italic w-full min-w-0 not-italic ${isRtl ? 'text-right' : 'text-left'}`}>
              <Globe className="w-3.5 h-3.5 opacity-60 shrink-0" />
              <p className={`truncate flex-1 uppercase tracking-widest text-[0.65rem] font-normal ${isRtl ? 'text-right' : 'text-left'}`}>
                {t("nav_region", "Región")} {user.region ? t(getRegionKey(user.region), user.region) : t("nav_undefined", "No asignada")}
              </p>
            </div>
          </div>
        </div>

        {/* --- SECCIÓN DERECHA: ENLACES DE SOPORTE Y LEGAL --- */}
        {/* En RTL, alineamos este bloque a la izquierda de la pantalla para mantener la simetría */}
        <div className={`flex flex-col ${isRtl ? 'items-start md:items-start text-left' : 'items-start md:items-end text-left md:text-right'} gap-2 max-w-full shrink-0 pt-3 sm:pt-0 border-t border-white/5 sm:border-none w-full sm:w-auto`}>
          {/* Enlace al Centro de Ayuda */}
          <Link
            to="/contacto"
            className="text-xs opacity-80 hover:opacity-100 transition-opacity font-light flex items-center gap-1.5"
          >
            <ShieldCheck size={14} className="text-jw-text-light" />
            {t("nav_help_contact", "Centro de Ayuda y Contacto")}
          </Link>

          {/* Copyright y Atribución Institucional */}
          <p className="text-[0.6rem] opacity-60 tracking-[0.2em] uppercase font-light">
            © 2026 {t("footer_title", "GESTIÓN LOCAL TEOCRÁTICA")} •{" "}
            <span itemProp="areaServed">{t("footer_use", "Uso Institucional")}</span>
          </p>

          {/* Versión */}
          <p className="text-[0.6rem] text-gray-300 tracking-[0.2em] uppercase font-light">
            S.G. v2.6 • <span itemProp="areaServed">{t("footer_terms", "Condiciones de Uso")}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;