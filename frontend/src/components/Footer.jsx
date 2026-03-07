/**
 * ARCHIVO: Footer.jsx
 * UBICACIÓN: frontend/src/components/Footer.jsx
 * DESCRIPCIÓN: Pie de página institucional optimizado para estabilidad visual.
 * Se eliminaron los contenedores de ancho máximo relativo para evitar 
 * desplazamientos al cambiar el tamaño de fuente (SEO 2026).
 * Incluye marcado semántico Schema.org para mejorar el posicionamiento local.
 */

// --- IMPORTACIONES DE LIBRERÍAS Y COMPONENTES ---
import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MapPin, Globe, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

function Footer() {
  // --- 1. CONFIGURACIÓN Y ESTADOS DEL CONTEXTO ---
  
  // Consumimos el estado de sesión y el tema dinámico horario
  const { user: session, timeTheme } = useContext(AppContext); 
  // Lógica de "Nesting Fix": Extrae los datos reales del usuario si vienen anidados en session.user
  const user = session?.user || session;

  // Renderizado condicional: El footer solo es visible si hay un usuario autenticado
  if (!user) return null;

  return (
    /**
     * --- CONTENEDOR PRINCIPAL DEL PIE DE PÁGINA ---
     * style: Sincroniza el color de fondo con el horario (Mañana/Tarde/Noche).
     * border-t-4: Línea superior decorativa institucional.
     * px-2 sm:px-6: Alineación horizontal idéntica a la del Navbar para coherencia visual.
     */
    <footer 
      style={{ backgroundColor: timeTheme.bg }} 
      /* 
         MODIFICACIÓN: Ajustamos px-2 sm:px-6 para que coincida exactamente 
         con los márgenes que definimos en el Navbar.
      */
      className="w-full border-t-4 border-jw-blue text-white py-2 px-2 sm:px-6 mt-auto overflow-hidden transition-colors duration-1000"
    >
      {/* 
          --- ESTRUCTURA DE MICRODATOS (SEO 2026) --- 
          itemScope/itemType: Indica a los motores de búsqueda (Google, IAs) que este bloque
          contiene información estructurada sobre una Organización.
      */}
      <div 
         /* 
           ESTABILIDAD VISUAL: Se usa 'w-full' en lugar de 'max-w-7xl' para evitar que 
           el contenido se desplace al centro cuando el usuario achica la fuente.
        */
        /* 
          CAMBIO: Subimos el cambio de columna a 'lg' (en lugar de 'md'). 
          Esto hace que en tablets el footer siga siendo una lista vertical, 
          evitando que el texto se salga por la derecha.
        */
        className="w-full flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 lg:gap-4 min-w-0"
        itemScope 
        itemType="https://schema.org/Organization"
      >
        
        {/* --- SECCIÓN IZQUIERDA: IDENTIDAD Y LOCALIZACIÓN --- */}
        <div className="flex flex-col items-start min-w-0 w-full lg:w-3/4 text-left">
          {/* Nombre de la Congregación y Número identificador */}
          <h3 className="text-sm font-medium tracking-tight truncate w-full mb-1">
            <span itemProp="name">Congregación {user.congregacion_nombre}</span>
            {/* Usamos text-xs para que sea relativo y no fijo en 13px */}
            <span className="text-gray-300 text-xs ml-2 font-light shrink-0">
              ({user.numero_congregacion})
            </span>
          </h3>
          
          <div className="space-y-2">
            {/* DIRECCIÓN POSTAL SEMÁNTICA (Schema.org) */}
            <address 
              className="flex items-center gap-2 text-xs text-gray-200 font-light italic w-full min-w-0 not-italic"
              itemProp="address" 
              itemScope 
              itemType="https://schema.org/PostalAddress"
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <p className="truncate w-full">
                <span itemProp="streetAddress">{user.direccion}</span>,{" "}
                <span itemProp="addressLocality">{user.ciudad}</span>,{" "}
                <span itemProp="addressRegion">{user.provincia}</span>,{" "}
                <span itemProp="addressCountry">{user.pais}</span>
              </p>
            </address>

            {/* REGIÓN GEOGRÁFICA INTERNA */}
            <div className="flex items-center gap-2 text-xs text-gray-200 font-light italic w-full min-w-0 not-italic">
              <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <p className="truncate w-full uppercase tracking-widest text-[0.65rem] font-normal">
                Región {user.region || "No asignada"}
              </p>
            </div>
          </div>
        </div>

        {/* --- SECCIÓN DERECHA: ENLACES DE SOPORTE Y LEGAL --- */}
        <div className="flex flex-col items-start lg:items-end gap-2 w-full lg:w-auto shrink-0 pt-3 md:pt-0 border-t border-white/5 md:border-none">
          {/* Enlace al Centro de Ayuda (Accesibilidad técnica) */}
          <Link 
            to="/contacto" 
            className="text-xs text-gray-200 hover:text-white transition-colors font-light flex items-center gap-1.5"
          >
            <ShieldCheck size={14} className="text-jw-body" />
            Centro de Ayuda y Contacto
          </Link>
          
          {/* Copyright y Atribución Institucional */}
          <p className="text-[0.6rem] text-gray-300 tracking-[0.2em] uppercase font-light">
            © 2026 GESTIÓN LOCAL TEOCRÁTICA • <span itemProp="areaServed">Uso Institucional</span>
          </p>
        </div>
        
      </div>
    </footer>
  );
}

export default Footer;