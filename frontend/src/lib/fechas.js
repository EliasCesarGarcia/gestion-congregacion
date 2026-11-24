/**
 * ARCHIVO: fechas.js
 * UBICACIÓN: frontend/src/lib/fechas.js
 * DESCRIPCIÓN: Formato y cálculo de fechas que llegan del backend como texto
 * ("2026-11-05" o "2026-11-05 12:00"). Se corta el texto a mano, sin pasar
 * por Date local, para que el huso horario nunca cambie el día.
 */

// "2026-11-05..." -> "05/11/2026". Si no hay fecha, devuelve `vacio`.
export function fechaCorta(texto, vacio = "—") {
  if (!texto) return vacio;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto;
}

// Fecha de hoy del dispositivo como "AAAA-MM-DD". Se arma con las partes
// locales (toISOString usaría UTC y cerca de la medianoche daría otro día).
export function hoyISO() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

// "2026-11-05..." -> [2026, 11, 5], o null si no es una fecha.
function partes(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto || "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// Días que tiene un mes (mes de 1 a 12).
const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/**
 * Tiempo transcurrido entre dos fechas "AAAA-MM-DD" (se ignora la hora):
 * { anios, meses, dias }, contando meses completos y los días que sobran.
 * Devuelve null si falta una fecha o si `hasta` es anterior a `desde`.
 */
export function duracionEntre(desde, hasta) {
  const a = partes(desde);
  const b = partes(hasta);
  if (!a || !b) return null;
  const ini = Date.UTC(a[0], a[1] - 1, a[2]);
  const fin = Date.UTC(b[0], b[1] - 1, b[2]);
  if (fin < ini) return null;

  // Meses completos (si el día final es menor que el inicial, falta uno).
  let meses = (b[0] - a[0]) * 12 + (b[1] - a[1]);
  if (b[2] < a[2]) meses -= 1;

  // Fecha que resulta de sumar esos meses al inicio (sin pasarse del mes).
  const indice = a[1] - 1 + meses;
  const anioMedio = a[0] + Math.floor(indice / 12);
  const mesMedio = (indice % 12) + 1;
  const diaMedio = Math.min(a[2], diasDelMes(anioMedio, mesMedio));
  const medio = Date.UTC(anioMedio, mesMedio - 1, diaMedio);

  return {
    anios: Math.floor(meses / 12),
    meses: meses % 12,
    dias: Math.round((fin - medio) / 86400000),
  };
}

/**
 * Lo mismo, como texto en el idioma de la pantalla: "1 año, 9 meses, 14 días".
 * Se omiten las partes en cero. Devuelve "" si no se puede calcular.
 * `t` es la función de useTranslation.
 */
export function textoDuracion(desde, hasta, t) {
  const d = duracionEntre(desde, hasta);
  if (!d) return "";
  const piezas = [];
  if (d.anios > 0) {
    piezas.push(
      `${d.anios} ${d.anios === 1 ? t("per_dur_anio", "año") : t("per_dur_anios", "años")}`,
    );
  }
  if (d.meses > 0) {
    piezas.push(
      `${d.meses} ${d.meses === 1 ? t("per_dur_mes", "mes") : t("per_dur_meses", "meses")}`,
    );
  }
  if (d.dias > 0) {
    piezas.push(
      `${d.dias} ${d.dias === 1 ? t("per_dur_dia", "día") : t("per_dur_dias", "días")}`,
    );
  }
  return piezas.length > 0 ? piezas.join(", ") : t("per_dur_mismo_dia", "Mismo día");
}
