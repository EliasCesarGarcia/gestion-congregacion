/**
 * ARCHIVO: Footer.jsx
 * UBICACIÓN: src/components/Footer.jsx
 * DESCRIPCIÓN: Pie de página institucional optimizado para estabilidad visual.
 * Se eliminaron los contenedores de ancho máximo relativo para evitar 
 * desplazamientos al cambiar el tamaño de fuente (SEO 2026).
 */

import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MapPin, Globe, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

function Footer() {
  const { user: session, timeTheme } = useContext(AppContext); 
  const user = session?.user || session;

  if (!user) return null;

  return (
    <footer 
      style={{ backgroundColor: timeTheme.bg }} 
      /* 
         MODIFICACIÓN: Ajustamos px-2 sm:px-6 para que coincida exactamente 
         con los márgenes que definimos en el Navbar.
      */
      className="w-full border-t-4 border-jw-blue text-white py-2 px-2 sm:px-6 mt-auto overflow-hidden transition-colors duration-1000"
    >
      {/* Marcado de Microdatos para SEO Local */}
      <div 
        /* 
           CAMBIO CLAVE: Eliminamos 'max-w-7xl mx-auto'. 
           Ahora usamos 'w-full' para que el contenido siempre ocupe todo el ancho disponible
           y los márgenes laterales dependan solo del padding del footer, no del tamaño de letra.
        */
        className="w-full flex flex-col md:flex-row justify-between items-start md:items-end gap-6 md:gap-2"
        itemScope 
        itemType="https://schema.org/Organization"
      >
        
        {/* LADO IZQUIERDA: Información de la Congregación */}
        <div className="flex flex-col items-start min-w-0 w-full md:w-auto text-left">
          <h3 className="text-sm font-medium tracking-tight truncate w-full mb-1">
            <span itemProp="name">Congregación {user.congregacion_nombre}</span>
            {/* Usamos text-xs para que sea relativo y no fijo en 13px */}
            <span className="text-gray-300 text-xs ml-2 font-light shrink-0">
              ({user.numero_congregacion})
            </span>
          </h3>
          
          <div className="space-y-2">
            {/* DIRECCIÓN POSTAL */}
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

            {/* REGIÓN GEOGRÁFICA */}
            <div className="flex items-center gap-2 text-xs text-gray-200 font-light italic w-full min-w-0 not-italic">
              <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <p className="truncate w-full uppercase tracking-widest text-[0.65rem] font-normal">
                Región {user.region || "No asignada"}
              </p>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: Contacto y Legal */}
        <div className="flex flex-col items-start md:items-end gap-2 w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t border-white/5 md:border-none">
          <Link 
            to="/contacto" 
            className="text-xs text-gray-200 hover:text-white transition-colors font-light flex items-center gap-1.5"
          >
            <ShieldCheck size={14} className="text-jw-body" />
            Centro de Ayuda y Contacto
          </Link>
          
          <p className="text-[0.6rem] text-gray-300 tracking-[0.2em] uppercase font-light">
            © 2026 GESTIÓN LOCAL TEOCRÁTICA • <span itemProp="areaServed">Uso Institucional</span>
          </p>
        </div>
        
      </div>
    </footer>
  );
}

export default Footer;