/**
 * ARCHIVO: fechas.js
 * UBICACIÓN: frontend/src/lib/fechas.js
 * DESCRIPCIÓN: Formato de fechas que llegan del backend como texto
 * ("2026-11-05" o "2026-11-05 12:00"). Se corta el texto a mano, sin pasar
 * por Date, para que el huso horario nunca cambie el día.
 */

// "2026-11-05..." -> "05/11/2026". Si no hay fecha, devuelve `vacio`.
export function fechaCorta(texto, vacio = "—") {
  if (!texto) return vacio;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto;
}