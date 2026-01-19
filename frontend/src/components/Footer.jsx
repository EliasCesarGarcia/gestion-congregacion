import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MapPin, MessageSquare } from 'lucide-react';

function Footer() {
  const { user } = useContext(AppContext);
  if (!user) return null;

  return (
    <footer className="bg-jw-navy text-white py-8 px-6 border-t-4 border-jw-blue">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left space-y-1">
          <h3 className="text-xl font-medium">
            Congregación {user.congregacion_nombre} 
            <span className="text-jw-accent text-sm ml-3">({user.numero_congregacion})</span>
          </h3>
          <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-gray-400">
            <MapPin className="w-4 h-4 text-jw-accent" />
            <p>{user.direccion}, {user.ciudad}, {user.partido}, {user.provincia}, {user.pais}</p>
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end gap-3">
          <button className="flex items-center gap-2 bg-jw-blue hover:bg-jw-accent text-white px-6 py-2 rounded-sm transition-all text-sm font-bold uppercase tracking-widest border border-white/10 shadow-lg">
            <MessageSquare className="w-4 h-4" /> Contáctenos
          </button>
          <p className="text-[10px] text-gray-500 tracking-[0.3em]">© 2026 GESTIÓN LOCAL TEOCRÁTICA</p>
        </div>
      </div>
    </footer>
  );
}
export default Footer;