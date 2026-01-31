import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldCheck, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function SecurityTipsPage() {
  const [info, setInfo] = useState({ contenido: '', updated_at: '' });
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/seguridad-info').then(res => setInfo(res.data));
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="bg-jw-body min-h-screen py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-jw-border overflow-hidden">
        <div className="p-8 bg-jw-navy text-white flex justify-between items-center">
          <div className="flex items-center gap-4">
            <ShieldCheck className="w-10 h-10 text-jw-accent" />
            <div>
              <h1 className="text-2xl font-light italic">Sugerencias de Seguridad</h1>
              <p className="text-xs text-jw-accent font-bold uppercase tracking-widest mt-1">
                Actualizado el {formatDate(info.updated_at)}
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/perfil')} className="p-2 hover:bg-white/10 rounded-full transition-all">
            <ChevronLeft className="w-8 h-8" />
          </button>
        </div>
        
        <div className="p-10 prose prose-blue max-w-none">
          {/* Aquí el contenido vendrá formateado desde la base de datos */}
          <div className="text-gray-700 leading-relaxed space-y-6 text-lg italic font-light">
             {info.contenido || 'Cargando recordatorios...'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SecurityTipsPage;