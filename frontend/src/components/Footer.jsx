import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

function Footer() {
  const { user } = useContext(AppContext);
  if (!user) return null;

  return (
    <footer className="w-full bg-jw-navy border-t-4 border-jw-blue text-white py-3 px-4 mt-auto overflow-hidden">
      {/* Marcado de Microdatos para SEO Local */}
      <div 
        className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-2"
        itemScope 
        itemType="https://schema.org/Organization"
      >
        
        <div className="flex flex-col items-start min-w-0 w-full md:w-auto">
          <h3 className="text-sm font-medium tracking-tight truncate w-full">
            <span itemProp="name">Congregación {user.congregacion_nombre}</span>
            <span className="text-gray-300 text-[13px] ml-2 font-light shrink-0">
              ({user.numero_congregacion})
            </span>
          </h3>
          
          {/* Dirección estructurada para Google Maps e IA */}
          <address 
            className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-200 font-light italic w-full min-w-0 not-italic"
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
        </div>

        <div className="flex flex-col items-start md:items-end gap-1 w-full md:w-auto shrink-0 pt-1 md:pt-0 border-t border-white/5 md:border-none">
          <Link 
            to="/contacto" 
            className="text-[11px] sm:text-xs text-gray-200 hover:text-white transition-colors font-light"
          >
            Centro de Ayuda y Contacto
          </Link>
          <p className="text-[9px] text-gray-300 tracking-[0.2em] uppercase font-light">
            © 2026 GESTIÓN LOCAL TEOCRÁTICA • <span itemProp="areaServed">Uso Institucional</span>
          </p>
        </div>
        
      </div>
    </footer>
  );
}

export default Footer;