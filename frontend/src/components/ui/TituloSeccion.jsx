/**
 * ARCHIVO: TituloSeccion.jsx
 * UBICACIÓN: frontend/src/components/ui/TituloSeccion.jsx
 * DESCRIPCIÓN: Título de una sección o tarjeta (Contacto, Situación, Registro,
 * Altas y bajas...). Centrado, en mayúsculas, con letra espaciada y una línea
 * de color debajo, para que se distinga bien del contenido. Usa solo variables
 * de tema (jw-*), así que sigue los temas y horarios.
 * No lleva margen propio: el margen lo pone quien lo usa.
 */

function TituloSeccion({ children, className = "", ...resto }) {
  return (
    <h2
      className={`text-center text-sm font-semibold uppercase tracking-widest text-jw-text-main pb-2 border-b-2 border-jw-accent/60 ${className}`}
      {...resto}
    >
      {children}
    </h2>
  );
}

export default TituloSeccion;
