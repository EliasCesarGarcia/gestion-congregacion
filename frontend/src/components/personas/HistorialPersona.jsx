/**
 * ARCHIVO: HistorialPersona.jsx
 * UBICACIÓN: frontend/src/components/personas/HistorialPersona.jsx
 * DESCRIPCIÓN: Los historiales de una persona, solo lectura: altas y bajas,
 * situaciones, grupos, cargos de encargado y roles.
 *
 * Cada historial se ve como una tabla con columnas alineadas (principal,
 * desde, hasta y vigencia) en pantallas anchas, y como una lista de tarjetas
 * en el celular. Las fechas que el backend manda como null son fechas que no
 * se conocen y se muestran como "sin fecha".
 */

import { useTranslation } from "react-i18next";
import Tarjeta from "../ui/Tarjeta";
import Etiqueta from "../ui/Etiqueta";
import { fechaCorta } from "../../lib/fechas";
import { ROLES } from "../../config/personasConfig";

// Fecha corta, siempre de izquierda a derecha (también en idiomas RTL).
function Fecha({ valor }) {
  const { t } = useTranslation();
  return (
    <span dir="ltr" className="tabular-nums whitespace-nowrap">
      {fechaCorta(valor, t("per_sin_fecha", "sin fecha"))}
    </span>
  );
}

// Fecha de fin: una fila vigente no tiene fin.
function Hasta({ fecha, vigente }) {
  return vigente ? <span aria-hidden="true">—</span> : <Fecha valor={fecha} />;
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
        <p key={i} className="text-xs text-jw-text-main opacity-60 break-words">
          {linea}
        </p>
      ))}
    </div>
  );
}

/**
 * Un historial. `filas`: [{ clave, principal, detalles[], desde, hasta,
 * vigente }]. `cabeceras`: { principal, desde, hasta }.
 */
function Tabla({ titulo, cabeceras, filas, vacio }) {
  const { t } = useTranslation();
  const columna = "py-2 pe-4 text-start font-medium whitespace-nowrap";

  return (
    <Tarjeta>
      <h2 className="text-xs font-medium uppercase tracking-wide text-jw-text-main opacity-60 mb-2">
        {titulo}
      </h2>

      {filas.length === 0 ? (
        <p className="text-sm text-jw-text-main opacity-60">{vacio}</p>
      ) : (
        <>
          {/* Pantallas anchas: tabla */}
          <table className="hidden sm:table w-full text-sm text-jw-text-main">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="text-xs text-jw-text-main border-b border-jw-border">
                <th scope="col" className={`${columna} opacity-60`}>
                  {cabeceras.principal}
                </th>
                <th scope="col" className={`${columna} opacity-60`}>
                  {cabeceras.desde}
                </th>
                <th scope="col" className={`${columna} opacity-60`}>
                  {cabeceras.hasta}
                </th>
                <th
                  scope="col"
                  className="py-2 text-start font-medium whitespace-nowrap opacity-60"
                >
                  {t("per_h_vigencia", "Vigencia")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jw-border">
              {filas.map((f) => (
                <tr key={f.clave} className="align-top">
                  <td className="py-3 pe-4">
                    {f.principal}
                    <Detalles lineas={f.detalles} />
                  </td>
                  <td className="py-3 pe-4 whitespace-nowrap">
                    <Fecha valor={f.desde} />
                  </td>
                  <td className="py-3 pe-4 whitespace-nowrap">
                    <Hasta fecha={f.hasta} vigente={f.vigente} />
                  </td>
                  <td className="py-3">
                    <Vigencia vigente={f.vigente} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Celular: una tarjeta por fila */}
          <ul className="sm:hidden divide-y divide-jw-border">
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
                <p className="mt-1 text-xs text-jw-text-main opacity-70">
                  {cabeceras.desde} <Fecha valor={f.desde} />
                  {" · "}
                  {cabeceras.hasta}{" "}
                  <Hasta fecha={f.hasta} vigente={f.vigente} />
                </p>
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
    principal: <Principal texto={t("per_h_periodo_alta", "Período de alta")} />,
    detalles: [
      e.motivo_alta &&
        `${t("per_motivo_alta", "Motivo de alta")}: ${e.motivo_alta}`,
      e.detalles_alta &&
        `${t("per_detalles_alta", "Detalles del alta")}: ${e.detalles_alta}`,
      e.motivo_baja &&
        `${t("per_motivo_baja", "Motivo de baja")}: ${e.motivo_baja}`,
      e.detalles &&
        `${t("per_detalles_baja", "Detalles de la baja")}: ${e.detalles}`,
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
      g.motivo_entrada &&
        `${t("per_h_entrada", "Entrada")}: ${g.motivo_entrada}`,
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
              <Etiqueta tono="aviso">
                {t("per_excepcion", "Excepción")}
              </Etiqueta>
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
    <div className="space-y-4">
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
