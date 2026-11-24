/**
 * ARCHIVO: Tarjeta.jsx
 * UBICACIÓN: frontend/src/components/ui/Tarjeta.jsx
 * DESCRIPCIÓN: Contenedor base: fondo de tarjeta, borde fino y esquinas amplias.
 * El texto de adentro va siempre alineado a la izquierda (text-start), también
 * en idiomas de derecha a izquierda; solo los títulos de sección se centran.
 */

function Tarjeta({ className = "", children, ...resto }) {
  return (
    <section
      className={`bg-jw-card border border-jw-border rounded-2xl p-5 text-start ${className}`}
      {...resto}
    >
      {children}
    </section>
  );
}

export default Tarjeta;
