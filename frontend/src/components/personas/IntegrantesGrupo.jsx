/**
 * ARCHIVO: IntegrantesGrupo.jsx
 * UBICACIÓN: frontend/src/components/personas/IntegrantesGrupo.jsx
 * DESCRIPCIÓN: Ventana emergente con los integrantes de un grupo (solo
 * lectura). Muestra el resumen (total, activos e inactivos), los encargados
 * (superintendente y auxiliar), los precursores regulares, auxiliares de
 * continuo, especiales y misioneros (con su total y de forma individual, solo
 * si los hay) y la lista de todos los integrantes.
 *
 * Se cierra con clic fuera de la ventana, con Esc o con el botón de cerrar, y
 * se vuelve a la pantalla de grupos. Los datos salen de
 * GET /api/personas/buscar (grupo + estado ALTA), sin rutas nuevas.
 *
 * Uso: <IntegrantesGrupo key={grupo.id} grupo={grupo} esSuper congregacionId
 *        onCerrar={...} />
 * Se monta solo mientras está abierta (así cada apertura empieza limpia).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, X } from "lucide-react";
import Etiqueta from "../ui/Etiqueta";

const ENFOCABLES =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

// situacion_1 del backend -> [clave de traducción, título por defecto]
const SERVICIO_ESPECIAL = [
  ["Precursor Regular", "per_prec_regular", "Precursores regulares"],
  [
    "Precursor Auxiliar de Continuo",
    "per_prec_aux_continuo",
    "Precursores auxiliares de continuo",
  ],
  ["Precursor Especial", "per_prec_especial", "Precursores especiales"],
  ["Misionero", "per_misionero", "Misioneros"],
];

const LIMITE_PAGINA = 50; // máximo que acepta el backend
const MAX_PAGINAS = 10; // tope de seguridad

const nombreDe = (p) => `${p.apellido} ${p.nombre}`;
const porNombre = (a, b) => nombreDe(a).localeCompare(nombreDe(b));

function Seccion({ titulo, derecha, children }) {
  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 className="text-xs font-medium uppercase tracking-wide opacity-60">
          {titulo}
        </h3>
        {derecha}
      </div>
      {children}
    </section>
  );
}

function IntegrantesGrupo({ grupo, esSuper, congregacionId, onCerrar }) {
  const { t } = useTranslation();
  const cuadro = useRef(null);
  const botonCerrar = useRef(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => {
    cerrarRef.current = onCerrar;
  });

  // `personas: null` = cargando.
  const [datos, setDatos] = useState({ personas: null, error: "" });

  // Bloquea el desplazamiento de fondo, enfoca el botón de cerrar y devuelve
  // el foco al cerrar.
  useEffect(() => {
    const previo = document.activeElement;
    const desborde = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    botonCerrar.current?.focus();
    return () => {
      document.body.style.overflow = desborde;
      if (previo instanceof HTMLElement) previo.focus();
    };
  }, []);

  // Esc cierra; Tab y Shift+Tab se quedan dentro de la ventana.
  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !cuadro.current) return;
      const lista = cuadro.current.querySelectorAll(ENFOCABLES);
      if (lista.length === 0) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, []);

  // Integrantes del grupo: todas las páginas que hagan falta.
  useEffect(() => {
    const control = new AbortController();
    (async () => {
      try {
        const base = { grupo: String(grupo.numero), estado: "ALTA" };
        if (esSuper) base.congregacion_id = congregacionId;
        let todas = [];
        let total = 0;
        let pagina = 1;
        do {
          const { data } = await axios.get("/api/personas/buscar", {
            params: { ...base, page: pagina, limit: LIMITE_PAGINA },
            signal: control.signal,
          });
          todas = todas.concat(Array.isArray(data.personas) ? data.personas : []);
          total = data.total || 0;
          pagina += 1;
        } while (todas.length < total && pagina <= MAX_PAGINAS);
        setDatos({ personas: todas.sort(porNombre), error: "" });
      } catch (err) {
        if (axios.isCancel(err)) return;
        setDatos({
          personas: [],
          error:
            (typeof err.response?.data === "string" && err.response.data) ||
            t("per_error_integrantes", "No se pudieron cargar los integrantes."),
        });
      }
    })();
    return () => control.abort();
  }, [grupo.numero, esSuper, congregacionId, t]);

  const personas = datos.personas || [];
  const cargando = datos.personas === null;
  const activos = personas.filter((p) => p.condicion === "A").length;
  const inactivos = personas.filter((p) => p.condicion === "I").length;
  const sinCondicion = personas.length - activos - inactivos;

  // Precursores y misioneros: solo los grupos de situación que tienen gente.
  const especiales = SERVICIO_ESPECIAL.map(([valor, clave, titulo]) => ({
    valor,
    titulo: t(clave, titulo),
    gente: personas.filter((p) => p.situacion_1 === valor),
  })).filter((c) => c.gente.length > 0);

  const encargados = [
    [t("per_cargo_superintendente", "Superintendente"), grupo.superintendente],
    [t("per_cargo_auxiliar", "Auxiliar de grupo"), grupo.auxiliar],
  ];

  const enlacePersona = (p) => (
    <Link to={`/personas/${p.id}`} className="hover:underline">
      {nombreDe(p)}
    </Link>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => onCerrar?.()}
      />
      <div
        ref={cuadro}
        role="dialog"
        aria-modal="true"
        aria-labelledby="integrantes-titulo"
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto text-start bg-jw-card text-jw-text-main border border-jw-border rounded-t-2xl sm:rounded-2xl p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="integrantes-titulo" className="text-lg font-semibold">
              {t("per_grupo", "Grupo")} {grupo.numero}
            </h2>
            {!cargando && !datos.error && (
              <p className="text-sm opacity-70">
                {personas.length} {t("per_integrantes", "integrantes")} ·{" "}
                {activos} {t("per_activos", "activos")} · {inactivos}{" "}
                {t("per_inactivos", "inactivos")}
                {sinCondicion > 0 &&
                  ` · ${sinCondicion} ${t("per_sin_condicion_corto", "sin condición")}`}
              </p>
            )}
          </div>
          <button
            ref={botonCerrar}
            type="button"
            onClick={() => onCerrar?.()}
            aria-label={t("ui_cerrar", "Cerrar")}
            className="shrink-0 rounded-lg p-1.5 opacity-70 hover:opacity-100 hover:bg-jw-accent/20 transition"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {cargando && (
          <div className="flex justify-center py-10" role="status">
            <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
          </div>
        )}

        {!cargando && datos.error && (
          <p
            role="alert"
            className="mt-4 text-sm border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2 break-words"
          >
            {datos.error}
          </p>
        )}

        {!cargando && !datos.error && (
          <>
            {/* Encargados */}
            <Seccion titulo={t("per_encargados", "Encargados")}>
              <dl className="divide-y divide-jw-border">
                {encargados.map(([cargo, persona]) => (
                  <div
                    key={cargo}
                    className="flex flex-col gap-0.5 py-2 text-sm sm:grid sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4"
                  >
                    <dt className="opacity-60">{cargo}</dt>
                    <dd className="font-medium text-start min-w-0 break-words">
                      {persona ? (
                        <span className="inline-flex flex-wrap items-center justify-start gap-2">
                          <Link
                            to={`/personas/${persona.persona_id}`}
                            className="hover:underline"
                          >
                            {persona.apellido} {persona.nombre}
                          </Link>
                          {persona.excepcion && (
                            <Etiqueta tono="aviso">
                              {t("per_excepcion", "Excepción")}
                            </Etiqueta>
                          )}
                        </span>
                      ) : (
                        <span className="font-normal opacity-60">
                          {t("per_sin_asignar", "Sin asignar")}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Seccion>

            {/* Precursores y misioneros, solo si los hay */}
            {especiales.map((c) => (
              <Seccion
                key={c.valor}
                titulo={c.titulo}
                derecha={
                  <span className="text-sm font-medium tabular-nums">
                    {c.gente.length}
                  </span>
                }
              >
                <ul className="divide-y divide-jw-border">
                  {c.gente.map((p) => (
                    <li key={p.id} className="py-2 text-sm">
                      {enlacePersona(p)}
                    </li>
                  ))}
                </ul>
              </Seccion>
            ))}

            {/* Todos los integrantes */}
            <Seccion
              titulo={t("per_todos_integrantes", "Todos los integrantes")}
              derecha={
                <span className="text-sm font-medium tabular-nums">
                  {personas.length}
                </span>
              }
            >
              {personas.length === 0 ? (
                <p className="py-2 text-sm opacity-60">
                  {t("per_grupo_sin_integrantes", "Este grupo no tiene integrantes.")}
                </p>
              ) : (
                <ul className="divide-y divide-jw-border">
                  {personas.map((p) => (
                    <li
                      key={p.id}
                      className="py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
                    >
                      <span className="min-w-0 break-words">
                        {enlacePersona(p)}
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        {p.situacion_3 && <Etiqueta>{p.situacion_3}</Etiqueta>}
                        {p.situacion_2 && <Etiqueta>{p.situacion_2}</Etiqueta>}
                        {p.situacion_1 && p.situacion_1 !== "Publicador" && (
                          <Etiqueta>{p.situacion_1}</Etiqueta>
                        )}
                        {p.condicion === "I" && (
                          <Etiqueta tono="aviso">
                            {t("per_inactivo", "Inactivo")}
                          </Etiqueta>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default IntegrantesGrupo;
