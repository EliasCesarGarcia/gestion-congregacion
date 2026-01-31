import React from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, X, ShieldCheck } from 'lucide-react';

function Modal({ isOpen, type, title, message, onConfirm, onClose }) {
  if (!isOpen) return null;

  const configs = {
    success: { icon: <CheckCircle2 className="w-16 h-16 text-green-500" />, color: 'text-green-600', btn: 'bg-green-600' },
    error: { icon: <AlertCircle className="w-16 h-16 text-red-500" />, color: 'text-red-600', btn: 'bg-red-600' },
    confirm: { icon: <HelpCircle className="w-16 h-16 text-jw-blue" />, color: 'text-jw-navy', btn: 'bg-jw-blue' },
    security: { icon: <ShieldCheck className="w-16 h-16 text-jw-blue" />, color: 'text-jw-navy', btn: 'bg-jw-blue' }
  };

  const config = configs[type] || configs.confirm;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-jw-navy/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center border border-jw-border animate-in zoom-in duration-300">
        <div className="flex justify-center mb-4">{config.icon}</div>
        <h3 className={`text-xl font-bold mb-2 ${config.color} italic tracking-tight`}>{title}</h3>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed font-light">{message}</p>
        
        <div className="flex flex-col gap-2">
          <button 
            onClick={onConfirm || onClose} 
            className={`w-full py-4 text-white rounded-2xl font-black tracking-widest uppercase text-xs shadow-lg transition-all active:scale-95 ${config.btn}`}
          >
            {type === 'confirm' || type === 'error' && onConfirm ? 'SÍ, CONTINUAR' : 'ACEPTAR'}
          </button>
          
          {(type === 'confirm' || type === 'error') && (
            <button onClick={onClose} className="w-full py-3 text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-jw-navy transition-colors">
              CANCELAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export default Modal;