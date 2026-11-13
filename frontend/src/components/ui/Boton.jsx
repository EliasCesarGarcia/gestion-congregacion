/**
 * ARCHIVO: Boton.jsx
 * UBICACIÓN: frontend/src/components/ui/Boton.jsx
 * DESCRIPCIÓN: Botón compartido. Variantes: primario, suave y peligro.
 * Solo usa variables de tema (jw-*), así que sigue los temas y horarios.
 */

const VARIANTES = {
  primario: "bg-jw-navy text-jw-text-light hover:opacity-90",
  suave: "border border-jw-border text-jw-text-main hover:bg-jw-accent/20",
  peligro: "border border-red-500/40 text-red-600 hover:bg-red-500/10",
};

function Boton({
  variante = "primario",
  icono: Icono,
  type = "button",
  className = "",
  children,
  ...resto
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ${VARIANTES[variante] || VARIANTES.primario} ${className}`}
      {...resto}
    >
      {Icono && <Icono size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

export default Boton;