/**
 * ARCHIVO: ResumenPersonas.jsx
 * UBICACIÓN: frontend/src/components/personas/ResumenPersonas.jsx
 * DESCRIPCIÓN: Números de la congregación (en alta, activos, inactivos, de
 * baja) y cuántas personas hay por situación. Cada número es un atajo: al
 * tocarlo se aplica ese filtro a la lista.
 */

import { useTranslation } from "react-i18next";

function Mosaico({ etiqueta, valor, activo, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={`text-start bg-jw-card border rounded-2xl p-4 transition active:scale-[0.98] ${
        activo ? "border-jw-accent" : "border-jw-border hover:bg-jw-accent/10"
      }`}
    >
      <span className="block text-2xl font-semibold text-jw-text-main">
        {valor}
      </span>
      <span className="block text-xs text-jw-text-main opacity-70 mt-1">
        {etiqueta}
      </span>
    </button>
  );
}

function ResumenPersonas({ conteos, error, filtros, onFiltro }) {
  const { t } = useTranslation();

  if (error) {
    return (
      <p className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2">
        {t("per_error_conteos", "No se pudieron cargar los números.")}
      </p>
    );
  }

  if (!conteos) {
    return (
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse"
        role="status"
        aria-label={t("per_cargando", "Cargando…")}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-jw-card border border-jw-border" />
        ))}
      </div>
    );
  }

  const enAlta = filtros.estado === "ALTA";
  const situaciones = (conteos.situaciones || [])
    .filter((s) => s.total > 0)
    .sort((a, b) => a.campo - b.campo);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Mosaico
          etiqueta={t("per_en_alta", "En alta")}
          valor={conteos.alta}
          activo={enAlta && filtros.condicion === ""}
          onClick={() => onFiltro({ estado: "ALTA", condicion: "" })}
        />
        <Mosaico
          etiqueta={t("per_activos", "Activos")}
          valor={conteos.activos}
          activo={enAlta && filtros.condicion === "A"}
          onClick={() => onFiltro({ estado: "ALTA", condicion: "A" })}
        />
        <Mosaico
          etiqueta={t("per_inactivos", "Inactivos")}
          valor={conteos.inactivos}
          activo={enAlta && filtros.condicion === "I"}
          onClick={() => onFiltro({ estado: "ALTA", condicion: "I" })}
        />
        <Mosaico
          etiqueta={t("per_de_baja", "De baja")}
          valor={conteos.bajas}
          activo={filtros.estado === "BAJA"}
          onClick={() => onFiltro({ estado: "BAJA", condicion: "" })}
        />
      </div>

      {situaciones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {situaciones.map((s) => {
            const clave = `situacion_${s.campo}`;
            const activo = filtros[clave] === s.valor;
            return (
              <button
                key={`${s.campo}-${s.valor}`}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  activo
                    ? onFiltro({ [clave]: "" })
                    : onFiltro({ estado: "ALTA", [clave]: s.valor })
                }
                className={`text-xs border rounded-full px-3 py-1 text-jw-text-main transition ${
                  activo
                    ? "border-jw-accent bg-jw-accent/20"
                    : "border-jw-border hover:bg-jw-accent/10"
                }`}
              >
                {s.valor} <span className="opacity-60">{s.total}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ResumenPersonas;