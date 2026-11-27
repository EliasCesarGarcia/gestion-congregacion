/**
 * ARCHIVO: personasConfig.js
 * UBICACIÓN: frontend/src/config/personasConfig.js
 * DESCRIPCIÓN: Constantes del módulo de personas que comparten varias
 * pantallas. Las listas de situaciones NO están acá: salen de
 * GET /api/personas/conteos para que coincidan siempre con la base.
 */

// Filtros de la lista (sin el texto de búsqueda, que se maneja aparte).
export const FILTROS_VACIOS = {
  estado: "",
  condicion: "",
  situacion_1: "",
  situacion_2: "",
  situacion_3: "",
  grupo: "",
  rol_app: "",
};

// rol_app -> [clave de traducción, texto por defecto]
export const ROLES = {
  coordinador: ["per_rol_coordinador", "Coordinador"],
  secretario: ["per_rol_secretario", "Secretario"],
  servicio: ["per_rol_servicio", "Servicio"],
  publicador: ["per_rol_publicador", "Publicador"],
};
// Listas válidas del backend para el formulario (un valor fuera de lista es 400).
// La situación 3 no se elige a mano: se pone sola desde el grupo.
export const SITUACIONES_1 = [
  "Publicador",
  "Precursor Auxiliar",
  "Precursor Auxiliar de Continuo",
  "Precursor Regular",
  "Precursor Especial",
  "Misionero",
];
export const SITUACIONES_2 = ["Siervo Ministerial", "Anciano"];

// Valores iniciales del formulario de persona (todo texto, como los inputs).
// `fecha_alta` la completa cada pantalla (en el alta, hoy).
export const FORM_PERSONA_VACIO = {
  apellido: "",
  nombre: "",
  contacto_pais: "AR",
  contacto_numero: "",
  fecha_alta: "",
  condicion: "",
  motivo_alta_id: "",
  situacion_1: "Publicador",
  situacion_2: "",
  grupo_id: "",
  direccion: "",
  ciudad: "",
  partido: "",
  provincia_estado: "",
  pais: "",
  codigo_postal: "",
  detalles: "",
};

// Motivos de ALTA que se pueden elegir al dar de alta un cargo (coordinador,
// secretario y servicio). Las demás opciones del catálogo (uso "cargo_alta")
// se omiten en las ventanas de cargos. Se comparan por el nombre, sin tildes ni
// mayúsculas. Es un filtro de pantalla: el backend todavía acepta cualquier
// motivo activo del uso cargo_alta.
export const MOTIVOS_ALTA_CARGO = [
  "Asignación",
  "Cambio de asignación",
  "Reemplazo",
  "Reestructuración",
];

const sinTildes = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// Deja solo los motivos de alta permitidos para los cargos.
export function motivosAltaCargo(lista) {
  const permitidos = MOTIVOS_ALTA_CARGO.map(sinTildes);
  return (Array.isArray(lista) ? lista : []).filter((m) =>
    permitidos.includes(sinTildes(m.nombre)),
  );
}
