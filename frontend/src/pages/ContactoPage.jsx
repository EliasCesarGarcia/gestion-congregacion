/**
 * ARCHIVO: ContactoPage.jsx
 * UBICACIÓN: src/pages/ContactoPage.jsx
 * DESCRIPCIÓN: Vista de soporte técnico y contacto institucional.
 * Centraliza las instrucciones para la resolución de incidencias de acceso,
 * actualización de datos personales y soporte administrativo.
 *
 * FUNCIONALIDADES CLAVE:
 * - Gestión de Metadatos (SEO 2026) mediante React Helmet.
 * - Jerarquía visual clara para asistencia técnica local.
 * - Integración de iconografía descriptiva (Lucide).
 */

import React from "react";
import { Helmet } from "react-helmet-async";
import { Mail, ShieldCheck } from "lucide-react";

function ContactoPage() {
  return (
    /**
     * CONTENEDOR PRINCIPAL:
     * max-w-4xl: Limita el ancho para optimizar la longitud de línea y legibilidad.
     * text-center: Alineación central para transmitir orden y formalidad.
     */
    <div className="max-w-4xl mx-auto p-10 text-center">
      {/* 
          --- GESTIÓN DE METADATOS (SEO 2026) --- 
          Helmet permite inyectar títulos y etiquetas meta dinámicas, 
          vital para que los motores de búsqueda indexen correctamente 
          la sección de soporte.
      */}
      <Helmet>
        <title>Soporte y Contacto | Gestión Local</title>
      </Helmet>

      <h1 className="text-3xl font-bold text-jw-navy mb-6">Soporte Técnico</h1>
      <p className="text-gray-600 mb-10">
        Si tiene problemas con su acceso o necesita actualizar datos,
        comuníquese con el Comité de Servicio de su congregación.
      </p>

      {/* 
          --- PANEL DE INFORMACIÓN INSTITUCIONAL --- 
          Diseño en tarjeta (Card) con bordes suavizados y sombra sutil 
          para resaltar la autoridad administrativa.
      */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-jw-border">
        <ShieldCheck className="mx-auto w-12 h-12 text-jw-blue mb-4" />
        <h2 className="text-xl font-bold mb-2">Administración Local</h2>
        <p className="text-sm text-gray-500">
          Esta plataforma es gestionada localmente por los administradores
          asignados en cada cuerpo de ancianos.
        </p>
      </div>

      {/* 
          PIE DE PÁGINA DE SOPORTE: 
          Indica el nivel de versión para facilitar reportes de errores técnicos.
      */}
      <div className="mt-12 opacity-30">
        <p className="text-[10px] uppercase tracking-[0.4em] font-black text-jw-navy">
          S.G. v2.6.0 Premium
        </p>
      </div>
    </div>
  );
}
export default ContactoPage;
