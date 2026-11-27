/**
 * ARCHIVO: HistorialCargo.jsx
 * UBICACIÓN: frontend/src/components/personas/HistorialCargo.jsx
 * DESCRIPCIÓN: Historial de UN cargo de la congregación (coordinador,
 * secretario o servicio): todos los períodos, el vigente primero y después
 * del más nuevo al más antiguo. Cada fila tiene el botón "Corregir".
 *
 * Pantallas grandes (desde `lg`): tabla de columnas fijas (titular, Desde,
 * Hasta, Duración, Vigencia y Corregir). Celular y tableta: una tarjeta por
 * período, con "Desde" y "Hasta" en bloques separados y siempre en el mismo
 * lugar. Todo el texto va alineado a la izquierda; solo el título de la
 * sección va centrado.
 *
 * Duración: tiempo entre el inicio y el fin ("1 año, 9 meses, 14 días"); en
 * el período vigente se cuenta hasta hoy. Las fechas null son fechas que no
 * se conocen y se muestran como "Sin fecha".
 *
 * Props:
 *  - cargo: { rol, historial: [fila] }. Cada fila: { id, persona_id,
 *    apellido, nombre, fecha_inicio, fecha_fin, vigente, motivo_inicio,
 *    detalles_inicio, motivo_fin, detalles_fin, asignado_por, quitado_por }.
 *  - onCorregir(fila): la pantalla abre la ventana de corrección.
 */

import { useTranslation } from "react-i18next";
import { Pencil } from "lucide-react";
import Boton from "../ui/Boton";
import Etiqueta from "../ui/Etiqueta";
import LineaRotulada from "../ui/LineaRotulada";
import Tarjeta from "../ui/Tarjeta";
import TituloSeccion from "../ui/TituloSeccion";
import { ROLES } from "../../config/personasConfig";
import { fechaCorta, hoyISO, textoDuracion } from "../../lib/fechas";

// Una fecha de izquierda a derecha (también en idiomas RTL). Si no se conoce,
// se ve atenuada y en cursiva.
function Fecha({ valor }) {
  const { t } = useTranslation();
  if (!valor) {
    return (
      <span className="italic opacity-60">{t("per_sin_fecha", "Sin fecha")}</span>
    );
  }
  return (
    <span dir="ltr" className="inline-block tabular-nums whitespace-nowrap">
      {fechaCorta(valor)}
    </span>
  );
}

// Fecha de fin: un período vigente no tiene fin.
function Hasta({ fecha, vigente }) {
  return vigente ? <span aria-hidden="true">—</span> : <Fecha valor={fecha} />;
}

// Duración de un período (hasta hoy si es vigente), o "—" si no se puede calcular.
function Duracion({ desde, hasta, vigente }) {
  const { t } = useTranslation();
  const texto = textoDuracion(desde, vigente ? hoyISO() : hasta, t);
  if (!texto) return <span aria-hidden="true">—</span>;
  return (
    <span>
      {texto}
      {vigente && (
        <span className="block text-xs opacity-60">
          {t("per_hasta_hoy", "hasta hoy")}
        </span>
      )}
    </span>
  );
}

function Vigencia({ vigente }) {
  const { t } = useTranslation();
  return vigente ? (
    <Etiqueta tono="ok">{t("per_vigente", "Vigente")}</Etiqueta>
  ) : (
    <Etiqueta>{t("per_finalizado", "Finalizado")}</Etiqueta>
  );
}

// Líneas de detalle debajo del nombre: { rotulo, valor, dosPuntos? }. El
// rótulo va en negrita (LineaRotulada) y el dato en peso normal.
function Detalles({ lineas }) {
  if (!lineas || lineas.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5 text-xs text-jw-text-main">
      {lineas.map((l, i) => (
        <p key={i} className="break-words">
          <LineaRotulada rotulo={l.rotulo} dosPuntos={l.dosPuntos}>
            {l.valor}
          </LineaRotulada>
        </p>
      ))}
    </div>
  );
}

// Un bloque "rótulo arriba, valor abajo" de la tarjeta del celular.
function Dato({ rotulo, children, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-xs text-jw-text-main opacity-60">{rotulo}</dt>
      <dd className="text-sm text-jw-text-main">{children}</dd>
    </div>
  );
}

function HistorialCargo({ cargo, onCorregir }) {
  const { t } = useTranslation();
  const rol = ROLES[cargo.rol];
  const nombreRol = rol ? t(rol[0], rol[1]) : cargo.rol;
  const filas = Array.isArray(cargo.historial) ? cargo.historial : [];
  const th =
    "py-2 pe-4 text-start text-xs font-medium whitespace-nowrap opacity-60";

  const nombreDe = (f) => `${f.apellido || ""} ${f.nombre || ""}`.trim();

  // Motivos, detalles y quién asignó o quitó (solo lo que hay), cada uno en
  // su línea y con el rótulo en negrita.
  const lineasDe = (f) =>
    [
      f.motivo_inicio && {
        rotulo: t("per_motivo_alta", "Motivo de alta"),
        valor: f.motivo_inicio,
      },
      f.detalles_inicio && {
        rotulo: t("per_detalles_alta", "Detalles del alta"),
        valor: f.detalles_inicio,
      },
      f.motivo_fin && {
        rotulo: t("per_motivo_baja", "Motivo de baja"),
        valor: f.motivo_fin,
      },
      f.detalles_fin && {
        rotulo: t("per_detalles_baja", "Detalles de la baja"),
        valor: f.detalles_fin,
      },
      f.asignado_por && {
        rotulo: t("per_asignado_por", "Asignado por"),
        valor: f.asignado_por,
        dosPuntos: false,
      },
      f.quitado_por && {
        rotulo: t("per_quitado_por", "Quitado por"),
        valor: f.quitado_por,
        dosPuntos: false,
      },
    ].filter(Boolean);

  const botonCorregir = (f, className = "") => (
    <Boton
      variante="suave"
      icono={Pencil}
      className={className}
      aria-label={t("car_corregir_de", {
        defaultValue: "Corregir el período de {{nombre}}",
        nombre: nombreDe(f),
      })}
      onClick={() => onCorregir(f)}
    >
      {t("car_corregir", "Corregir")}
    </Boton>
  );

  const titulo = t("car_hist_de", {
    defaultValue: "Historial: {{cargo}}",
    cargo: nombreRol,
  });

  return (
    <Tarjeta>
      <TituloSeccion>{titulo}</TituloSeccion>

      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-jw-text-main opacity-60">
          {t("car_hist_vacio", "Este cargo todavía no tiene períodos cargados.")}
        </p>
      ) : (
        <>
          {/* Pantallas grandes: tabla de columnas fijas */}
          <table className="hidden lg:table mt-2 w-full table-fixed text-start text-sm text-jw-text-main">
            <caption className="sr-only">{titulo}</caption>
            <colgroup>
              <col />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-44" />
              <col className="w-28" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr className="border-b border-jw-border">
                <th scope="col" className={th}>
                  {t("car_h_titular", "Titular")}
                </th>
                <th scope="col" className={th}>
                  {t("per_h_desde", "Desde")}
                </th>
                <th scope="col" className={th}>
                  {t("per_h_hasta", "Hasta")}
                </th>
                <th scope="col" className={th}>
                  {t("per_h_duracion", "Duración")}
                </th>
                <th scope="col" className={th}>
                  {t("per_h_vigencia", "Vigencia")}
                </th>
                <th
                  scope="col"
                  className="py-2 text-start text-xs font-medium whitespace-nowrap opacity-60"
                >
                  {t("car_h_acciones", "Acciones")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jw-border">
              {filas.map((f) => (
                <tr key={f.id} className="align-top">
                  <td className="py-3 pe-4 text-start break-words">
                    <span className="font-medium">{nombreDe(f)}</span>
                    <Detalles lineas={lineasDe(f)} />
                  </td>
                  <td className="py-3 pe-4 text-start whitespace-nowrap">
                    <Fecha valor={f.fecha_inicio} />
                  </td>
                  <td className="py-3 pe-4 text-start whitespace-nowrap">
                    <Hasta fecha={f.fecha_fin} vigente={f.vigente} />
                  </td>
                  <td className="py-3 pe-4 text-start">
                    <Duracion
                      desde={f.fecha_inicio}
                      hasta={f.fecha_fin}
                      vigente={f.vigente}
                    />
                  </td>
                  <td className="py-3 pe-4 text-start">
                    <Vigencia vigente={f.vigente} />
                  </td>
                  <td className="py-3 text-start">{botonCorregir(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Celular y tableta: una tarjeta por período */}
          <ul className="lg:hidden mt-1 divide-y divide-jw-border text-start">
            {filas.map((f) => (
              <li key={f.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-jw-text-main break-words">
                    {nombreDe(f)}
                  </p>
                  <div className="shrink-0">
                    <Vigencia vigente={f.vigente} />
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  <Dato rotulo={t("per_h_desde", "Desde")}>
                    <Fecha valor={f.fecha_inicio} />
                  </Dato>
                  <Dato rotulo={t("per_h_hasta", "Hasta")}>
                    <Hasta fecha={f.fecha_fin} vigente={f.vigente} />
                  </Dato>
                  <Dato
                    rotulo={t("per_h_duracion", "Duración")}
                    className="col-span-2"
                  >
                    <Duracion
                      desde={f.fecha_inicio}
                      hasta={f.fecha_fin}
                      vigente={f.vigente}
                    />
                  </Dato>
                </dl>
                <Detalles lineas={lineasDe(f)} />
                {botonCorregir(f, "mt-3 w-full sm:w-auto")}
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  );
}

export default HistorialCargo;
