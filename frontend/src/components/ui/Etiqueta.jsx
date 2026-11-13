/**
 * ARCHIVO: Etiqueta.jsx
 * UBICACIÓN: frontend/src/components/ui/Etiqueta.jsx
 * DESCRIPCIÓN: Etiqueta pequeña de estado. Tonos: neutro, ok, aviso y error.
 */

const TONOS = {
  neutro: "border-jw-border text-jw-text-main",
  ok: "border-green-600/40 bg-green-600/10 text-jw-text-main",
  aviso: "border-amber-500/40 bg-amber-500/10 text-jw-text-main",
  error: "border-red-500/40 bg-red-500/10 text-jw-text-main",
};

function Etiqueta({ tono = "neutro", children }) {
  return (
    <span
      className={`inline-block text-xs border rounded-full px-2 py-0.5 ${TONOS[tono] || TONOS.neutro}`}
    >
      {children}
    </span>
  );
}

export default Etiqueta;