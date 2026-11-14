/**
 * ARCHIVO: HistorialPersona.jsx
 * UBICACIÓN: frontend/src/components/personas/HistorialPersona.jsx
 * DESCRIPCIÓN: Los tres historiales de una persona (altas y bajas,
 * situaciones y roles), solo lectura. Las fechas que el backend manda como
 * null son fechas que no se conocen y se muestran como "sin fecha".
 */

import { useTranslation } from "react-i18next";
import Tarjeta from "../ui/Tarjeta";
import Etiqueta from "../ui/Etiqueta";
import { fechaCorta } from "../../lib/fechas";
import { ROLES } from "../../config/personasConfig";

function Periodo({ inicio, fin, vigente }) {
  const { t } = useTranslation();
  const sinFecha = t("per_sin_fecha", "sin fecha");
  return (
    <span>
      {fechaCorta(inicio, sinFecha)} –{" "}
      {vigente ? t("per_vigente", "vigente") : fechaCorta(fin, sinFecha)}
    </span>
  );
}

function Seccion({ titulo, vacio, hayDatos, children }) {
  return (
    <Tarjeta>
      <h2 className="text-sm font-semibold text-jw-text-main mb-2">{titulo}</h2>
      {hayDatos ? (
        children
      ) : (
        <p className="text-sm text-jw-text-main opacity-60">{vacio}</p>
      )}
    </Tarjeta>
  );
}

function HistorialPersona({ historial }) {
  const { t } = useTranslation();
  const estado = historial?.estado || [];
  const situaciones = historial?.situaciones || [];
  const roles = historial?.roles || [];
  const vacio = t("per_sin_registros", "Sin registros.");

  return (
    <div className="space-y-4">
      {/* Altas y bajas */}
      <Seccion
        titulo={t("per_h_estado", "Altas y bajas")}
        vacio={vacio}
        hayDatos={estado.length > 0}
      >
        <ul className="divide-y divide-jw-border">
          {estado.map((e) => (
            <li key={e.id} className="py-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm text-jw-text-main">
                <Periodo inicio={e.fecha_alta} fin={e.fecha_baja} vigente={e.vigente} />
                {e.vigente && <Etiqueta tono="ok">{t("per_alta", "Alta")}</Etiqueta>}
              </div>
              {e.motivo_baja && (
                <p className="text-xs text-jw-text-main opacity-70">
                  {t("per_motivo_baja", "Motivo de baja")}: {e.motivo_baja}
                </p>
              )}
              {e.detalles && (
                <p className="text-xs text-jw-text-main opacity-70">{e.detalles}</p>
              )}
              {(e.alta_por || e.baja_por) && (
                <p className="text-xs text-jw-text-main opacity-50">
                  {e.alta_por && `${t("per_alta_por", "Alta por")} ${e.alta_por}`}
                  {e.alta_por && e.baja_por && " · "}
                  {e.baja_por && `${t("per_baja_por", "Baja por")} ${e.baja_por}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Seccion>

      {/* Situaciones, una lista por cada campo (1, 2 y 3) */}
      <Seccion
        titulo={t("per_h_situaciones", "Situaciones")}
        vacio={vacio}
        hayDatos={situaciones.length > 0}
      >
        <div className="space-y-4">
          {[1, 2, 3].map((campo) => {
            const filas = situaciones.filter((s) => s.campo === campo);
            if (filas.length === 0) return null;
            return (
              <div key={campo}>
                <p className="text-xs font-medium text-jw-text-main opacity-60 mb-1">
                  {t("per_situacion", "Situación")} {campo}
                </p>
                <ul className="divide-y divide-jw-border">
                  {filas.map((s) => (
                    <li key={s.id} className="py-2 flex flex-wrap items-center gap-2 text-sm text-jw-text-main">
                      <span className="font-medium">{s.valor}</span>
                      <Periodo inicio={s.fecha_inicio} fin={s.fecha_fin} vigente={s.vigente} />
                      {s.vigente && <Etiqueta tono="ok">{t("per_vigente", "vigente")}</Etiqueta>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Seccion>

      {/* Roles de la aplicación */}
      <Seccion
        titulo={t("per_h_roles", "Roles")}
        vacio={vacio}
        hayDatos={roles.length > 0}
      >
        <ul className="divide-y divide-jw-border">
          {roles.map((r) => {
            const rol = ROLES[r.rol];
            return (
              <li key={r.id} className="py-2 flex flex-wrap items-center gap-2 text-sm text-jw-text-main">
                <span className="font-medium">{rol ? t(rol[0], rol[1]) : r.rol}</span>
                <Periodo inicio={r.fecha_inicio} fin={r.fecha_fin} vigente={r.vigente} />
                {r.vigente && <Etiqueta tono="ok">{t("per_vigente", "vigente")}</Etiqueta>}
              </li>
            );
          })}
        </ul>
      </Seccion>
    </div>
  );
}

export default HistorialPersona;