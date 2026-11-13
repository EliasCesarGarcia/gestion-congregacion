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