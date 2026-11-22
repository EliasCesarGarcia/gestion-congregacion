/**
 * ARCHIVO: gruposApi.js
 * UBICACIÓN: frontend/src/lib/gruposApi.js
 * DESCRIPCIÓN: Utilidades de la pantalla de grupos que comparten varios
 * componentes: cargar los integrantes de un grupo (o de "sin grupo") y leer
 * el texto de un error del backend.
 */

import axios from "axios";

const LIMITE_PAGINA = 50; // máximo que acepta el backend
const MAX_PAGINAS = 10; // tope de seguridad

// Prefijo que el backend le pone a todos los errores de "datos no válidos".
const PREFIJO_DATOS = "datos de la persona no válidos: ";

/**
 * Personas en ALTA de un grupo, por orden alfabético.
 * `grupo`: número del grupo (como número o texto) o "sin" para las que no
 * tienen grupo. El superadmin debe mandar `congregacionId`.
 * Pide todas las páginas que hagan falta.
 */
export async function cargarIntegrantes({
  grupo,
  esSuper,
  congregacionId,
  signal,
}) {
  const base = { grupo: String(grupo), estado: "ALTA" };
  if (esSuper) base.congregacion_id = congregacionId;
  let todas = [];
  let total = 0;
  let pagina = 1;
  do {
    const { data } = await axios.get("/api/personas/buscar", {
      params: { ...base, page: pagina, limit: LIMITE_PAGINA },
      signal,
    });
    todas = todas.concat(Array.isArray(data.personas) ? data.personas : []);
    total = data.total || 0;
    pagina += 1;
  } while (todas.length < total && pagina <= MAX_PAGINAS);
  return todas.sort((a, b) =>
    `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`),
  );
}

// Texto de un error de axios: el mensaje del backend (sin el prefijo de
// "datos no válidos") o `porDefecto` si no hay.
export function textoError(err, porDefecto = "") {
  const texto =
    typeof err.response?.data === "string" ? err.response.data.trim() : "";
  if (!texto) return porDefecto;
  return texto.startsWith(PREFIJO_DATOS)
    ? texto.slice(PREFIJO_DATOS.length)
    : texto;
}
