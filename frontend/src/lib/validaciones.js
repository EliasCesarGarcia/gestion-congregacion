/**
 * ARCHIVO: validaciones.js
 * UBICACIÓN: frontend/src/lib/validaciones.js
 * DESCRIPCIÓN: Validaciones del formulario de persona, compartidas por el alta
 * y la edición. Las reglas son las mismas que aplica el backend
 * (service/personas_escritura.go); el backend sigue siendo quien decide.
 *
 * Cada validador devuelve el mensaje de error ("" si está bien). Reciben `t`
 * (de useTranslation) para que el mensaje salga en el idioma del usuario.
 *
 * Teléfono: se elige el país (el código +NN se pone solo) y se escribe el
 * número. Se guarda en una sola columna como "+54 11 2345-6789".
 */

import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { hoyISO } from "./fechas";

// Largos máximos (iguales a los del backend).
export const LIMITES = {
  nombre: 100,
  contacto: 100,
  detalles: 300,
  direccion: 200,
  postal: 12,
  ubicacion: 100, // país, provincia/estado, ciudad y partido
};

const REGEX_NOMBRE = /^[\p{L} .'’-]+$/u;
const REGEX_DIRECCION = /^[\p{L}\p{Nd} .,'’°/#()&-]+$/u;
const REGEX_UBICACION = /^[\p{L}\p{Nd} .'’()-]+$/u;
const REGEX_POSTAL = /^[A-Za-z0-9 -]+$/;
const REGEX_NUMERO_TEL = /^[0-9 ()-]+$/;

// --- Nombres ---
export function validarApellido(valor, t) {
  const v = String(valor ?? "").trim();
  if (!v) return t("per_err_apellido", "Falta el apellido.");
  if (!REGEX_NOMBRE.test(v)) {
    return t(
      "per_err_apellido_chars",
      "Solo letras, espacios, guion, apóstrofo y punto.",
    );
  }
  return "";
}

export function validarNombre(valor, t) {
  const v = String(valor ?? "").trim();
  if (!v) return t("per_err_nombre", "Falta el nombre.");
  if (!REGEX_NOMBRE.test(v)) {
    return t(
      "per_err_nombre_chars",
      "Solo letras, espacios, guion, apóstrofo y punto.",
    );
  }
  return "";
}

// --- Fecha de alta ---
// `obligatoria`: false solo para personas antiguas que nunca tuvieron fecha.
// `fechaBaja` ("AAAA-MM-DD" o ""): la alta no puede ser posterior.
export function validarFechaAlta(
  valor,
  t,
  { obligatoria = true, fechaBaja = "" } = {},
) {
  if (!valor) {
    return obligatoria ? t("per_err_fecha_alta", "Falta la fecha de alta.") : "";
  }
  if (valor > hoyISO()) {
    return t("per_err_fecha_futura", "La fecha de alta no puede ser futura.");
  }
  if (fechaBaja && valor > fechaBaja) {
    return t(
      "per_err_alta_despues_baja",
      "La fecha de alta no puede ser posterior a la fecha de baja.",
    );
  }
  return "";
}

// --- Dirección y ubicación (todos opcionales) ---
const TEXTOS = {
  direccion: {
    regex: REGEX_DIRECCION,
    max: LIMITES.direccion,
    clave: "per_err_direccion_chars",
    texto: "Solo letras, números, espacios y . , ' - ° / # ( ) &",
  },
  ubicacion: {
    regex: REGEX_UBICACION,
    max: LIMITES.ubicacion,
    clave: "per_err_ubicacion_chars",
    texto: "Solo letras, números, espacios y . ' - ( )",
  },
  postal: {
    regex: REGEX_POSTAL,
    max: LIMITES.postal,
    clave: "per_err_postal_chars",
    texto: "Solo letras, números, espacios y guiones.",
  },
};

// tipo: "direccion" | "ubicacion" | "postal"
export function validarTextoOpcional(valor, tipo, t) {
  const v = String(valor ?? "").trim();
  if (!v) return "";
  const regla = TEXTOS[tipo];
  if (!regla.regex.test(v)) return t(regla.clave, regla.texto);
  if (v.length > regla.max) {
    return t("per_err_largo", {
      defaultValue: "Máximo {{max}} caracteres.",
      max: regla.max,
    });
  }
  return "";
}

// --- Países y teléfono ---

// Lista de países [{ codigo: "AR", nombre: "Argentina", llamada: "54" }]
// con el nombre en el idioma indicado, ordenada alfabéticamente.
export function listarPaises(idioma = "es") {
  let nombres = null;
  try {
    nombres = new Intl.DisplayNames([idioma], { type: "region" });
  } catch {
    nombres = null;
  }
  const nombreDe = (codigo) => {
    try {
      return nombres?.of(codigo) || codigo;
    } catch {
      return codigo;
    }
  };
  return getCountries()
    .map((codigo) => ({
      codigo,
      llamada: getCountryCallingCode(codigo),
      nombre: nombreDe(codigo),
    }))
    .filter((p) => p.nombre !== p.codigo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, idioma));
}

const paisDeLlamada = (llamada) =>
  getCountries().find((c) => getCountryCallingCode(c) === String(llamada));

// "+54 11 2345-6789" -> { pais: "AR", numero: "11 2345-6789" }.
// Un contacto viejo sin "+" se muestra con el país por defecto.
export function dividirContacto(texto, paisPorDefecto = "AR") {
  const v = String(texto ?? "").trim();
  if (!v) return { pais: paisPorDefecto, numero: "" };
  if (!v.startsWith("+")) return { pais: paisPorDefecto, numero: v };
  const parsed = parsePhoneNumberFromString(v);
  if (!parsed) return { pais: paisPorDefecto, numero: v };
  const llamada = String(parsed.countryCallingCode);
  return {
    pais: parsed.country || paisDeLlamada(llamada) || paisPorDefecto,
    numero: v.slice(1 + llamada.length).trim(),
  };
}

// ("AR", "11 2345-6789") -> "+54 11 2345-6789". Sin número devuelve "".
export function armarContacto(pais, numero) {
  const n = String(numero ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!n) return "";
  return `+${getCountryCallingCode(pais)} ${n}`;
}

// Opcional: sin número no hay error. Comprueba los caracteres y que el
// número sea posible para ese país (no exige que exista de verdad).
export function validarTelefono(pais, numero, t) {
  const n = String(numero ?? "").trim();
  if (!n) return "";
  if (!REGEX_NUMERO_TEL.test(n)) {
    return t(
      "per_err_tel_chars",
      "Solo números, espacios, guiones y paréntesis.",
    );
  }
  const completo = armarContacto(pais, n);
  const digitos = completo.replace(/\D/g, "").length;
  const parsed = parsePhoneNumberFromString(completo);
  if (digitos < 7 || digitos > 15 || !parsed || !parsed.isPossible()) {
    return t(
      "per_err_tel_largo",
      "El número no parece completo. Revise el largo y el código de área.",
    );
  }
  return "";
}

// --- Validación del formulario completo ---

// Campos que se validan, en el orden en que aparecen en pantalla (el foco va
// al primero que falle).
export const CAMPOS_VALIDABLES = [
  "apellido",
  "nombre",
  "contacto_numero",
  "fecha_alta",
  "direccion",
  "ciudad",
  "partido",
  "provincia_estado",
  "pais",
  "codigo_postal",
];

// Mensaje de error de un campo ("" si está bien o si no se valida).
// opciones: { fechaAltaObligatoria, fechaBaja } (solo para la fecha de alta).
export function validarCampoPersona(nombre, valores, t, opciones = {}) {
  const { fechaAltaObligatoria = true, fechaBaja = "" } = opciones;
  switch (nombre) {
    case "apellido":
      return validarApellido(valores.apellido, t);
    case "nombre":
      return validarNombre(valores.nombre, t);
    case "contacto_numero":
      return validarTelefono(valores.contacto_pais, valores.contacto_numero, t);
    case "fecha_alta":
      return validarFechaAlta(valores.fecha_alta, t, {
        obligatoria: fechaAltaObligatoria,
        fechaBaja,
      });
    case "direccion":
      return validarTextoOpcional(valores.direccion, "direccion", t);
    case "ciudad":
    case "partido":
    case "provincia_estado":
    case "pais":
      return validarTextoOpcional(valores[nombre], "ubicacion", t);
    case "codigo_postal":
      return validarTextoOpcional(valores.codigo_postal, "postal", t);
    default:
      return "";
  }
}

// Al salir de un campo: solo se valida si tiene algo escrito (pasar de largo
// por un campo vacío no debe mostrar errores; eso lo hace "Guardar").
export function validarAlSalir(nombre, valores, t, opciones) {
  if (!String(valores[nombre] ?? "").trim()) return "";
  return validarCampoPersona(nombre, valores, t, opciones);
}

// Todos los errores del formulario: { campo: mensaje }.
export function validarFormularioPersona(valores, t, opciones) {
  const errores = {};
  CAMPOS_VALIDABLES.forEach((k) => {
    const mensaje = validarCampoPersona(k, valores, t, opciones);
    if (mensaje) errores[k] = mensaje;
  });
  return errores;
}

// Nombre legible de un campo, para el aviso "Revise estos campos: ...".
export function etiquetaCampoPersona(nombre, t) {
  const e = {
    congregacion: ["per_congregacion", "Congregación"],
    apellido: ["per_f_apellido", "Apellido"],
    nombre: ["per_f_nombre", "Nombre"],
    contacto_numero: ["per_contacto", "Contacto"],
    fecha_alta: ["per_fecha_alta", "Fecha de alta"],
    direccion: ["per_direccion", "Dirección"],
    ciudad: ["per_ciudad", "Ciudad"],
    partido: ["per_partido", "Partido"],
    provincia_estado: ["per_provincia", "Provincia o estado"],
    pais: ["per_pais", "País"],
    codigo_postal: ["per_codigo_postal", "Código postal"],
  }[nombre];
  return e ? t(e[0], e[1]) : nombre;
}
