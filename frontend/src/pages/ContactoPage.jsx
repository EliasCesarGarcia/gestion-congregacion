import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Mail, ShieldCheck } from 'lucide-react';

function ContactoPage() {
  return (
    <div className="max-w-4xl mx-auto p-10 text-center">
      <Helmet>
        <title>Soporte y Contacto | Gestión Local</title>
      </Helmet>
      
      <h1 className="text-3xl font-bold text-jw-navy mb-6">Soporte Técnico</h1>
      <p className="text-gray-600 mb-10">
        Si tiene problemas con su acceso o necesita actualizar datos, 
        comuníquese con el Comité de Servicio de su congregación.
      </p>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-jw-border">
        <ShieldCheck className="mx-auto w-12 h-12 text-jw-blue mb-4" />
        <h2 className="text-xl font-bold mb-2">Administración Local</h2>
        <p className="text-sm text-gray-500">
            Esta plataforma es gestionada localmente por los administradores asignados 
            en cada cuerpo de ancianos.
        </p>
      </div>
    </div>
  );
}
export default ContactoPage;