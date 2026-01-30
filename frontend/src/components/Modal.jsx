import React from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, X } from 'lucide-react';

function Modal({ isOpen, type, title, message, onConfirm, onClose }) {
  if (!isOpen) return null;

  // Configuración de colores e iconos según el tipo
  const configs = {
    success: { icon: <CheckCircle2 className="w-16 h-16 text-green-500" />, color: 'text-green-600', btn: 'bg-green-600' },
    error: { icon: <AlertCircle className="w-16 h-16 text-red-500" />, color: 'text-red-600', btn: 'bg-red-600' },
    confirm: { icon: <HelpCircle className="w-16 h-16 text-jw-blue" />, color: 'text-jw-navy', btn: 'bg-jw-blue' }
  };

  const config = configs[type] || configs.confirm;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-jw-navy/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center border border-jw-border animate-in zoom-in duration-300">
        <div className="flex justify-center mb-4">{config.icon}</div>
        <h3 className={`text-xl font-medium mb-2 ${config.color} italic`}>{title}</h3>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">{message}</p>
        
        <div className="flex gap-3">
          {type === 'confirm' && (
            <button onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 text-gray-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50">
              Cancelar
            </button>
          )}
          <button 
            onClick={onConfirm || onClose} 
            className={`flex-1 px-4 py-3 text-white rounded-xl font-bold tracking-widest uppercase text-xs shadow-lg transition-transform active:scale-95 ${config.btn}`}
          >
            {type === 'confirm' ? 'Confirmar' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;