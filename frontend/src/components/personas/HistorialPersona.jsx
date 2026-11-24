/**
 * ARCHIVO: HistorialPersona.jsx
 * UBICACIÓN: frontend/src/components/personas/HistorialPersona.jsx
 * DESCRIPCIÓN: Los historiales de una persona, solo lectura: altas y bajas,
 * situaciones, grupos, cargos de encargado y roles.
 *
 * Cada historial se ve como una tabla de columnas fijas en pantallas anchas
 * (dato principal, Desde, Hasta, Duración y Vigencia) y como una lista de
 * tarjetas en el celular, con "Desde" y "Hasta" siempre en el mismo lugar,
 * cada fecha en su propio bloque. Todo el texto va alineado a la izquierda;
 * solo los títulos de sección van centrados.
 *
 * Duración: tiempo entre el inicio y el fin ("1 año, 9 meses, 14 días"); en
 * una fila vigente se cuenta hasta hoy. Las fechas null son fechas que no se
 * conocen y se muestran como "sin fecha".
 */

import { useTranslation } from "react-i18next";
import Tarjeta from "../ui/Tarjeta";
import TituloSeccion from "../ui/TituloSeccion";
import Etiqueta from "../ui/Etiqueta";
import { fechaCorta, hoyISO, textoDuracion } from "../../lib/fechas";
import { ROLES } from "../../config/personasConfig";

// Una fecha en su bloque: siempre de izquierda a derecha (también en idiomas
// RTL). Una fecha que no se conoce se ve atenuada y en cursiva.
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

// Fecha de fin: una fila vigente no tiene fin.
function Hasta({ fecha, vigente }) {
  return vigente ? <span aria-hidden="true">—</span> : <Fecha valor={fecha} />;
}

// Duración de una fila (hasta hoy si es vigente), o "—" si no se puede calcular.
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

// Líneas de detalle, discretas, debajo del dato principal.
function Detalles({ lineas }) {
  if (!lineas || lineas.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {lineas.map((linea, i) => (
        <p
          key={i}
          className="text-xs text-jw-text-main opacity-60 break-words"
        >
          {linea}
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

/**
 * Un historial. `filas`: [{ clave, principal, detalles[], desde, hasta,
 * vigente }]. `cabeceras`: { principal, desde, hasta }.
 */
function Tabla({ titulo, cabeceras, filas, vacio }) {
  const { t } = useTranslation();
  const th = "py-2 pe-4 text-start text-xs font-medium whitespace-nowrap opacity-60";

  return (
    <Tarjeta>
      <TituloSeccion>{titulo}</TituloSeccion>

      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-jw-text-main opacity-60">{vacio}</p>
      ) : (
        <>
          {/* Pantallas anchas: tabla de columnas fijas */}
          <table className="hidden sm:table mt-2 w-full table-fixed text-start text-sm text-jw-text-main">
            <caption className="sr-only">{titulo}</caption>
            <colgroup>
              <col />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-44" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="border-b border-jw-border">
                <th scope="col" className={th}>
                  {cabeceras.principal}
                </th>
                <th scope="col" className={th}>
                  {cabeceras.desde}
                </th>
                <th scope="col" className={th}>
                  {cabeceras.hasta}
                </th>
                <th scope="col" className={th}>
                  {t("per_h_duracion", "Duración")}
                </th>
                <th scope="col" className="py-2 text-start text-xs font-medium whitespace-nowrap opacity-60">
                  {t("per_h_vigencia", "Vigencia")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jw-border">
              {filas.map((f) => (
                <tr key={f.clave} className="align-top">
                  <td className="py-3 pe-4 text-start break-words">
                    {f.principal}
                    <Detalles lineas={f.detalles} />
                  </td>
                  <td className="py-3 pe-4 text-start whitespace-nowrap">
                    <Fecha valor={f.desde} />
                  </td>
                  <td className="py-3 pe-4 text-start whitespace-nowrap">
                    <Hasta fecha={f.hasta} vigente={f.vigente} />
                  </td>
                  <td className="py-3 pe-4 text-start">
                    <Duracion desde={f.desde} hasta={f.hasta} vigente={f.vigente} />
                  </td>
                  <td className="py-3 text-start">
                    <Vigencia vigente={f.vigente} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Celular y tableta: una tarjeta por fila */}
          <ul className="sm:hidden mt-1 divide-y divide-jw-border text-start">
            {filas.map((f) => (
              <li key={f.clave} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm text-jw-text-main">
                    {f.principal}
                  </div>
                  <div className="shrink-0">
                    <Vigencia vigente={f.vigente} />
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  <Dato rotulo={cabeceras.desde}>
                    <Fecha valor={f.desde} />
                  </Dato>
                  <Dato rotulo={cabeceras.hasta}>
                    <Hasta fecha={f.hasta} vigente={f.vigente} />
                  </Dato>
                  <Dato rotulo={t("per_h_duracion", "Duración")} className="col-span-2">
                    <Duracion desde={f.desde} hasta={f.hasta} vigente={f.vigente} />
                  </Dato>
                </dl>
                <Detalles lineas={f.detalles} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  );
}

// Dato principal de una fila (en negrita) con una etiqueta opcional al lado.
function Principal({ texto, etiqueta }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-medium">{texto}</span>
      {etiqueta}
    </span>
  );
}

function HistorialPersona({ historial }) {
  const { t } = useTranslation();
  const vacio = t("per_sin_registros", "Sin registros.");

  const estado = historial?.estado || [];
  const situaciones = historial?.situaciones || [];
  const grupos = historial?.grupos || [];
  const encargados = historial?.encargados || [];
  const roles = historial?.roles || [];

  const desdeHasta = {
    desde: t("per_h_desde", "Desde"),
    hasta: t("per_h_hasta", "Hasta"),
  };

  // "Asignado por X · Quitado por Y" (solo lo que hay).
  const quien = (asignado, quitado) =>
    [
      asignado && `${t("per_asignado_por", "Asignado por")} ${asignado}`,
      quitado && `${t("per_quitado_por", "Quitado por")} ${quitado}`,
    ]
      .filter(Boolean)
      .join(" · ");

  // Nombre de un grupo a partir del número que guardó el historial.
  const nombreGrupo = (numero) =>
    numero != null && numero !== ""
      ? `${t("per_grupo", "Grupo")} ${numero}`
      : t("per_grupo", "Grupo");

  // --- Altas y bajas ---
  const filasEstado = estado.map((e) => ({
    clave: `estado-${e.id}`,
    principal: (
      <Principal texto={t("per_h_periodo_alta", "Período de alta")} />
    ),
    detalles: [
      e.motivo_alta && `${t("per_motivo_alta", "Motivo de alta")}: ${e.motivo_alta}`,
      e.detalles_alta && `${t("per_detalles_alta", "Detalles del alta")}: ${e.detalles_alta}`,
      e.motivo_baja && `${t("per_motivo_baja", "Motivo de baja")}: ${e.motivo_baja}`,
      e.detalles && `${t("per_detalles_baja", "Detalles de la baja")}: ${e.detalles}`,
      [
        e.alta_por && `${t("per_alta_por", "Alta por")} ${e.alta_por}`,
        e.baja_por && `${t("per_baja_por", "Baja por")} ${e.baja_por}`,
      ]
        .filter(Boolean)
        .join(" · "),
    ].filter(Boolean),
    desde: e.fecha_alta,
    hasta: e.fecha_baja,
    vigente: e.vigente,
  }));

  // --- Situaciones (ordenadas por campo: 1, 2 y 3) ---
  const filasSituaciones = [...situaciones]
    .sort((a, b) => a.campo - b.campo)
    .map((s) => ({
      clave: `situacion-${s.id}`,
      principal: <Principal texto={s.valor} />,
      detalles: [
        `${t("per_situacion", "Situación")} ${s.campo}`,
        quien(s.asignado_por, s.quitado_por),
      ].filter(Boolean),
      desde: s.fecha_inicio,
      hasta: s.fecha_fin,
      vigente: s.vigente,
    }));

  // --- Grupos (movimientos de la persona entre grupos) ---
  const filasGrupos = grupos.map((g) => ({
    clave: `grupo-${g.id}`,
    principal: <Principal texto={nombreGrupo(g.numero_grupo)} />,
    detalles: [
      g.motivo_entrada && `${t("per_h_entrada", "Entrada")}: ${g.motivo_entrada}`,
      g.detalles_entrada,
      g.motivo_salida && `${t("per_h_salida", "Salida")}: ${g.motivo_salida}`,
      g.detalles_salida,
      quien(g.asignado_por, g.quitado_por),
    ].filter(Boolean),
    desde: g.fecha_inicio,
    hasta: g.fecha_fin,
    vigente: g.vigente,
  }));

  // --- Cargos de encargado de grupo ---
  const nombreCargo = {
    superintendente: t("per_cargo_superintendente", "Superintendente"),
    auxiliar: t("per_cargo_auxiliar", "Auxiliar de grupo"),
  };
  const filasEncargados = encargados.map((c) => {
    const numero = c.numero_grupo ?? c.numero;
    return {
      clave: `encargado-${c.id}`,
      principal: (
        <Principal
          texto={nombreCargo[c.cargo] || c.cargo}
          etiqueta={
            c.excepcion ? (
              <Etiqueta tono="aviso">{t("per_excepcion", "Excepción")}</Etiqueta>
            ) : null
          }
        />
      ),
      detalles: [
        numero != null && numero !== "" && nombreGrupo(numero),
        c.detalles,
        quien(c.asignado_por, c.quitado_por),
      ].filter(Boolean),
      desde: c.fecha_inicio,
      hasta: c.fecha_fin,
      vigente: c.vigente,
    };
  });

  // --- Roles de la aplicación ---
  const filasRoles = roles.map((r) => {
    const rol = ROLES[r.rol];
    return {
      clave: `rol-${r.id}`,
      principal: <Principal texto={rol ? t(rol[0], rol[1]) : r.rol} />,
      detalles: [quien(r.asignado_por, r.quitado_por)].filter(Boolean),
      desde: r.fecha_inicio,
      hasta: r.fecha_fin,
      vigente: r.vigente,
    };
  });

  return (
    <div className="space-y-4 text-start">
      <Tabla
        titulo={t("per_h_estado", "Altas y bajas")}
        cabeceras={{
          principal: t("per_h_periodo", "Período"),
          desde: t("per_h_alta", "Alta"),
          hasta: t("per_h_baja", "Baja"),
        }}
        filas={filasEstado}
        vacio={vacio}
      />
      <Tabla
        titulo={t("per_h_situaciones", "Situaciones")}
        cabeceras={{
          principal: t("per_situacion", "Situación"),
          ...desdeHasta,
        }}
        filas={filasSituaciones}
        vacio={vacio}
      />
      <Tabla
        titulo={t("per_h_grupos", "Grupos")}
        cabeceras={{ principal: t("per_f_grupo", "Grupo"), ...desdeHasta }}
        filas={filasGrupos}
        vacio={vacio}
      />
      <Tabla
        titulo={t("per_h_encargados", "Encargado de grupo")}
        cabeceras={{ principal: t("per_h_cargo", "Cargo"), ...desdeHasta }}
        filas={filasEncargados}
        vacio={vacio}
      />
      <Tabla
        titulo={t("per_h_roles", "Roles")}
        cabeceras={{ principal: t("per_h_rol", "Rol"), ...desdeHasta }}
        filas={filasRoles}
        vacio={vacio}
      />
    </div>
  );
}

export default HistorialPersona;
