/**
 * ARCHIVO: Tarjeta.jsx
 * UBICACIÓN: frontend/src/components/ui/Tarjeta.jsx
 * DESCRIPCIÓN: Contenedor base: fondo de tarjeta, borde fino y esquinas amplias.
 */

function Tarjeta({ className = "", children, ...resto }) {
  return (
    <section
      className={`bg-jw-card border border-jw-border rounded-2xl p-5 ${className}`}
      {...resto}
    >
      {children}
    </section>
  );
}

export default Tarjeta;