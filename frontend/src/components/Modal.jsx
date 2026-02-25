import React from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, X, ShieldCheck } from 'lucide-react';

function Modal({ isOpen, type, title, message, onConfirm, onClose }) {
  if (!isOpen) return null;

  const configs = {
    success: { 
      icon: <CheckCircle2 className="w-8 h-8 text-green-500" />, 
      bg: 'bg-green-50', 
      border: 'border-green-100',
      btn: 'bg-green-600 hover:bg-green-700 shadow-green-100' 
    },
    error: { 
      icon: <AlertCircle className="w-8 h-8 text-red-500" />, 
      bg: 'bg-red-50', 
      border: 'border-red-100',
      btn: 'bg-red-600 hover:bg-red-700 shadow-red-100' 
    },
    confirm: { 
      icon: <HelpCircle className="w-8 h-8 text-jw-blue" />, 
      bg: 'bg-blue-50', 
      border: 'border-blue-100',
      btn: 'bg-jw-blue hover:bg-jw-navy shadow-blue-100' 
    },
    security: { 
      icon: <ShieldCheck className="w-8 h-8 text-jw-blue" />, 
      bg: 'bg-slate-50', 
      border: 'border-slate-100',
      btn: 'bg-jw-navy hover:bg-black shadow-slate-200' 
    }
  };

  const config = configs[type] || configs.confirm;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop con desenfoque */}
      <div 
        className="absolute inset-0 bg-jw-navy/30 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Card del Modal */}
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-[340px] w-full overflow-hidden border border-jw-border animate-in zoom-in-95 duration-200">
        
        {/* Sección del Icono */}
        <div className="pt-10 pb-6 flex justify-center">
          <div className={`p-4 rounded-3xl ${config.bg} border ${config.border} shadow-inner`}>
            {config.icon}
          </div>
        </div>

        {/* Contenido de Texto */}
        <div className="px-8 pb-8 text-center">
          {/* TÍTULO: text-xl en móvil, text-lg en PC */}
          <h3 className="text-xl sm:text-lg font-bold text-jw-navy mb-3 tracking-tight italic">
            {title}
          </h3>
          
          {/* MENSAJE: text-[15px] en móvil (muy legible), text-[12px] en PC */}
          <p className="text-gray-500 text-[15px] sm:text-[12px] leading-relaxed font-medium italic mb-8 px-2">
            {message}
          </p>
          
          {/* Botones */}
          <div className="flex flex-col gap-3">
            <button 
              onClick={onConfirm || onClose} 
              className={`w-full py-3.5 text-white rounded-xl font-bold tracking-[0.1em] uppercase text-xs sm:text-[13px] shadow-lg transition-all active:scale-95 ${config.btn}`}
            >
              {type === 'confirm' ? 'CONFIRMAR ACCIÓN' : 'ENTENDIDO'}
            </button>
            
            {onConfirm && (
              <button 
                onClick={onClose} 
                className="w-full py-2 text-gray-400 font-black text-[10px] sm:text-[9px] uppercase tracking-[0.2em] hover:text-jw-navy transition-colors"
              >
                VOLVER ATRÁS
              </button>
            )}
          </div>
        </div>

        {/* Botón de cierre X */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-300 hover:text-jw-blue transition-colors"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

export default Modal;