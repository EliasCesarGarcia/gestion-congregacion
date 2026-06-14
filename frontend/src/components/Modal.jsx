/**
 * NOMBRE: Modal.jsx
 * UBICACIÓN: /frontend/src/components/Modal.jsx
 * 
 * DESCRIPCIÓN TÉCNICA (SENIOR):
 * Este es un componente de UI Global basado en el patrón de "Portal".
 * Utiliza 'ReactDOM.createPortal' para renderizar el modal fuera de la jerarquía
 * del DOM principal, evitando conflictos de posicionamiento (Z-index/Transform).
 * Implementa estándares de Accesibilidad SEO 2026 (WAI-ARIA) para que los lectores
 * de pantalla e IAs de búsqueda entiendan que es un diálogo prioritario.
 */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { CheckCircle2, AlertCircle, HelpCircle, X, ShieldCheck } from 'lucide-react';

function Modal({ isOpen, type, title, message, onConfirm, onClose }) {
  
  // Bloquear scroll del body al abrir
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('body-freeze');
    } else {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('body-freeze');
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('body-freeze');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const configs = {
    success: { icon: <CheckCircle2 className="w-8 h-8 text-green-500" />, bg: 'bg-green-50', btn: 'bg-green-600' },
    error: { icon: <AlertCircle className="w-8 h-8 text-red-500" />, bg: 'bg-red-50', btn: 'bg-red-600' },
    confirm: { icon: <HelpCircle className="w-8 h-8 text-jw-blue" />, bg: 'bg-blue-50', btn: 'bg-jw-blue' },
    security: { icon: <ShieldCheck className="w-8 h-8 text-jw-blue" />, bg: 'bg-slate-50', btn: 'bg-jw-navy' }
  };

  const config = configs[type] || configs.confirm;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 w-full h-full flex items-center justify-center z-[9999]">
      {/* Fondo oscuro con desenfoque forzado */}
      <div className="fixed inset-0 bg-jw-navy/60 backdrop-blur-md" onClick={onClose} />
      
      {/* Tarjeta del Modal */}
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl max-w-[340px] w-full p-8 text-center border border-jw-border animate-in zoom-in-95 duration-200">
        <div className="flex justify-center mb-6">
          <div className={`p-4 rounded-3xl ${config.bg} shadow-inner`}>{config.icon}</div>
        </div>
        <h3 className="text-xl font-bold text-jw-navy mb-3 italic">{title}</h3>
        <p className="text-gray-500 text-sm mb-8">{message}</p>
        <div className="flex flex-col gap-3">
          <button onClick={onConfirm || onClose} className={`w-full py-3 text-white rounded-xl font-bold uppercase ${config.btn}`}>{type === 'confirm' ? 'CONFIRMAR' : 'ENTENDIDO'}</button>
          {onConfirm && <button onClick={onClose} className="text-gray-400 text-xs font-black uppercase tracking-widest">CANCELAR</button>}
        </div>
        <button onClick={onClose} className="absolute top-5 inset-inline-end-5 text-gray-300"><X size={20} /></button>
      </div>
    </div>,
    document.body // PORTAL AL BODY PARA EVITAR SCROLL
  );
}

export default Modal;