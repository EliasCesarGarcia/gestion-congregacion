/**
 * ARCHIVO: LineaRotulada.jsx
 * UBICACIÓN: frontend/src/components/ui/LineaRotulada.jsx
 * DESCRIPCIÓN: Un dato con su rótulo, para que el rótulo se distinga del dato
 * a simple vista: el rótulo va en NEGRITA y el dato en peso normal.
 *
 * REGLA DE TODO EL PROYECTO: cada texto con rótulo ("Motivo de alta: ...",
 * "Detalles del alta: ...", "Sale: ...", "Asignado por ...") se arma con este
 * componente. No se escribe a mano "rótulo: dato" en un solo texto.
 *
 * Uso (dentro de un <p> o <li>; no dibuja el contenedor):
 *   <p className="text-xs text-jw-text-main">
 *     <LineaRotulada rotulo={t("per_motivo_alta", "Motivo de alta")}>
 *       {motivo}
 *     </LineaRotulada>
 *   </p>
 *   <LineaRotulada rotulo="Asignado por" dosPuntos={false}>{nombre}</LineaRotulada>
 *
 * `dosPuntos` (por defecto true) agrega ":" después del rótulo; se pone en
 * false para rótulos como "Asignado por", "Quitado por", "Alta por".
 * El rótulo toma el color pleno del texto y el dato queda un poco más suave,
 * así que el contenedor NO debe llevar opacidad propia.
 */

function LineaRotulada({ rotulo, dosPuntos = true, children }) {
  return (
    <>
      <strong className="font-semibold text-jw-text-main">
        {rotulo}
        {dosPuntos ? ":" : ""}
      </strong>{" "}
      <span className="opacity-80">{children}</span>
    </>
  );
}

export default LineaRotulada;
