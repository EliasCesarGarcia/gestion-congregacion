/**
 * ARCHIVO: EncargadosGrupo.jsx
 * UBICACIÓN: frontend/src/components/personas/EncargadosGrupo.jsx
 * DESCRIPCIÓN: Ventana para asignar, cambiar y quitar el superintendente y el
 * auxiliar de un grupo (paso G3). Usa POST /api/personas/grupos/encargados.
 *
 * REGLAS (las hace cumplir el backend; acá se avisa antes):
 *  - El encargado debe ser integrante del grupo, estar en ALTA y ser Anciano o
 *    Siervo Ministerial. Una persona no puede tener los dos cargos.
 *  - Excepción: solo si ningún integrante libre cumple el requisito; hay que
 *    escribir el motivo, y queda marcada en el historial.
 *  - Asignar no cambia el grupo de la persona: ya es integrante.
 *  - La situación 3 de la persona se actualiza sola.
 *
 * Tres vistas dentro de la misma ventana: lista de cargos -> formulario
 * (asignar o quitar) -> resumen y confirmación. Se cierra con la X, Cancelar o
 * Esc (no mientras se guarda); un clic afuera no la cierra.
 *
 * Props: grupo (de GET /api/personas/grupos), esSuper, congregacionId,
 *        onCerrar(), onListo(textoDelResultado)
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, X } from "lucide-react";
import Boton from "../ui/Boton";
import Etiqueta from "../ui/Etiqueta";
import { CampoArea, CampoSelect, CampoTexto } from "../ui/Campo";
import { fechaCorta, hoyISO } from "../../lib/fechas";
import { cargarIntegrantes, textoError } from "../../lib/gruposApi";

const ENFOCABLES =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

const SITUACIONES_HABILITADAS = ["Anciano", "Siervo Ministerial"];
const MAX_PALABRAS = 100;

// [cargo del backend, clave de traducción, texto por defecto]
const CARGOS = [
  ["superintendente", "per_cargo_superintendente", "Superintendente"],
  ["auxiliar", "per_cargo_auxiliar", "Auxiliar de grupo"],
];

const nombreDe = (p) => `${p.apellido} ${p.nombre}`;
const contarPalabras = (texto) =>
  texto.trim().split(/\s+/).filter(Boolean).length;

// Una fila "etiqueta ........ valor" del resumen de confirmación. Celular: el
// valor a la derecha; PC: dos columnas, con el valor alineado a la izquierda.
function Resumen({ etiqueta, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 sm:grid sm:grid-cols-[9rem_1fr] sm:justify-start">
      <dt className="opacity-60 shrink-0">{etiqueta}</dt>
      <dd className="font-medium text-end sm:text-start break-words min-w-0">{children}</dd>
    </div>
  );
}

function EncargadosGrupo({ grupo, esSuper, congregacionId, onCerrar, onListo }) {
  const { t } = useTranslation();
  const cuadro = useRef(null);
  const botonCerrar = useRef(null);

  // --- Estado ---
  const [vista, setVista] = useState("lista"); // "lista" | "formulario" | "confirmar"
  const [accion, setAccion] = useState(null); // { cargo, tipo: "asignar" | "quitar" }
  const [lista, setLista] = useState({ personas: null, error: "" }); // null = cargando
  const [personaId, setPersonaId] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [detalles, setDetalles] = useState("");
  const [errores, setErrores] = useState({});
  const [envio, setEnvio] = useState({ enviando: false, error: "" });

  const cerrarRef = useRef(onCerrar);
  const enviandoRef = useRef(false);
  useEffect(() => {
    cerrarRef.current = onCerrar;
    enviandoRef.current = envio.enviando;
  });

  // --- Foco, bloqueo del fondo y teclado ---
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

  useEffect(() => {
    const alTeclear = (e) => {
      if (e.key === "Escape") {
        if (!enviandoRef.current) {
          e.preventDefault();
          cerrarRef.current?.();
        }
        return;
      }
      if (e.key !== "Tab" || !cuadro.current) return;
      const items = cuadro.current.querySelectorAll(ENFOCABLES);
      if (items.length === 0) return;
      const primero = items[0];
      const ultimo = items[items.length - 1];
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

  // --- Integrantes del grupo (los candidatos salen de acá) ---
  useEffect(() => {
    const control = new AbortController();
    cargarIntegrantes({
      grupo: grupo.numero,
      esSuper,
      congregacionId,
      signal: control.signal,
    })
      .then((personas) => setLista({ personas, error: "" }))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setLista({
          personas: [],
          error: textoError(
            err,
            t("per_error_integrantes", "No se pudieron cargar los integrantes."),
          ),
        });
      });
    return () => control.abort();
  }, [grupo.numero, esSuper, congregacionId, t]);

  const personas = lista.personas || [];
  const cargando = lista.personas === null;

  // --- Candidatos del cargo elegido ---
  const cargoActual = accion?.cargo;
  const nombreCargo = (cargo) => {
    const c = CARGOS.find((x) => x[0] === cargo);
    return c ? t(c[1], c[2]) : cargo;
  };
  const titular = cargoActual ? grupo[cargoActual] || null : null;
  const otroCargo = cargoActual === "superintendente" ? "auxiliar" : "superintendente";
  const otroId = cargoActual ? grupo[otroCargo]?.persona_id : undefined;

  // Libres: integrantes que no tienen el otro cargo. Calificados: además son
  // Anciano o Siervo Ministerial. Si ninguno califica, se puede pedir una
  // excepción (el titular actual del mismo cargo cuenta como candidato).
  const libres = personas.filter((p) => p.id !== otroId);
  const calificados = libres.filter((p) =>
    SITUACIONES_HABILITADAS.includes(p.situacion_2),
  );
  const esExcepcion = accion?.tipo === "asignar" && calificados.length === 0;
  const opciones = (esExcepcion ? libres : calificados).filter(
    (p) => p.id !== titular?.persona_id,
  );
  const elegida = personas.find((p) => String(p.id) === personaId);

  // --- Acciones ---
  const abrirFormulario = (cargo, tipo) => {
    setAccion({ cargo, tipo });
    setPersonaId("");
    setFecha(hoyISO());
    setDetalles("");
    setErrores({});
    setEnvio({ enviando: false, error: "" });
    setVista("formulario");
  };

  const volverALista = () => {
    setVista("lista");
    setAccion(null);
    setEnvio({ enviando: false, error: "" });
  };

  const validar = () => {
    const e = {};
    if (accion.tipo === "asignar" && !personaId) {
      e.persona = t("per_err_enc_persona", "Elija a la persona.");
    }
    if (!fecha) {
      e.fecha = t("per_err_fecha", "Falta la fecha.");
    } else if (fecha > hoyISO()) {
      e.fecha = t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
    }
    if (esExcepcion) {
      if (!detalles.trim()) {
        e.detalles = t(
          "per_err_enc_motivo",
          "Escriba el motivo de la excepción.",
        );
      } else if (contarPalabras(detalles) > MAX_PALABRAS) {
        e.detalles = t("per_err_detalles_100", "Máximo 100 palabras.");
      }
    }
    return e;
  };

  const revisar = () => {
    const e = validar();
    setErrores(e);
    const primero = ["persona", "fecha", "detalles"].find((k) => e[k]);
    if (primero) {
      document.getElementById(`enc-${primero}`)?.focus();
      return;
    }
    setEnvio({ enviando: false, error: "" });
    setVista("confirmar");
  };

  const guardar = async () => {
    setEnvio({ enviando: true, error: "" });
    const cuerpo = {
      grupo_id: grupo.id,
      cargo: accion.cargo,
      persona_id: accion.tipo === "quitar" ? 0 : Number(personaId),
      fecha,
    };
    if (esExcepcion) {
      cuerpo.excepcion = true;
      cuerpo.detalles = detalles.trim();
    }
    try {
      await axios.post("/api/personas/grupos/encargados", cuerpo);
      onListo(
        accion.tipo === "quitar"
          ? t("per_enc_ok_quitado", {
              defaultValue: "{{cargo}} del grupo {{numero}}: cargo sin asignar.",
              cargo: nombreCargo(accion.cargo),
              numero: grupo.numero,
            })
          : t("per_enc_ok_asignado", {
              defaultValue: "{{cargo}} del grupo {{numero}}: {{nombre}}.",
              cargo: nombreCargo(accion.cargo),
              numero: grupo.numero,
              nombre: elegida ? nombreDe(elegida) : "",
            }),
      );
    } catch (err) {
      setEnvio({
        enviando: false,
        error: textoError(
          err,
          t("per_error_encargado", "No se pudo guardar el cambio."),
        ),
      });
    }
  };

  // --- Dibujo ---
  const tituloGrupo = `${t("per_grupo", "Grupo")} ${grupo.numero}`;
  const titulo =
    vista === "lista"
      ? t("per_enc_titulo", {
          defaultValue: "Encargados del grupo {{numero}}",
          numero: grupo.numero,
        })
      : vista === "confirmar"
        ? t("per_enc_confirma_titulo", "¿Guardar este cambio?")
        : accion?.tipo === "quitar"
          ? t("per_enc_quitar_titulo", {
              defaultValue: "Quitar: {{cargo}}",
              cargo: nombreCargo(accion.cargo),
            })
          : t("per_enc_asignar_titulo", {
              defaultValue: "{{cargo}} de {{grupo}}",
              cargo: nombreCargo(accion?.cargo),
              grupo: tituloGrupo,
            });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        ref={cuadro}
        role="dialog"
        aria-modal="true"
        aria-labelledby="enc-titulo"
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-jw-card text-jw-text-main border border-jw-border rounded-t-2xl sm:rounded-2xl p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="enc-titulo" className="text-lg font-semibold min-w-0 break-words">
            {titulo}
          </h2>
          <button
            ref={botonCerrar}
            type="button"
            onClick={() => onCerrar()}
            disabled={envio.enviando}
            aria-label={t("ui_cerrar", "Cerrar")}
            className="shrink-0 rounded-lg p-1.5 opacity-70 hover:opacity-100 hover:bg-jw-accent/20 transition disabled:opacity-30"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* ---------- Vista 1: los dos cargos ---------- */}
        {vista === "lista" && (
          <div className="mt-4">
            <p className="text-sm opacity-70">
              {t(
                "per_enc_regla",
                "El encargado debe ser integrante del grupo, estar en alta y ser Anciano o Siervo Ministerial.",
              )}
            </p>

            {cargando && (
              <div className="flex justify-center py-8" role="status">
                <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
              </div>
            )}
            {!cargando && lista.error && (
              <p
                role="alert"
                className="mt-4 text-sm border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2 break-words"
              >
                {lista.error}
              </p>
            )}

            {!cargando && !lista.error && (
              <ul className="mt-4 divide-y divide-jw-border border border-jw-border rounded-xl">
                {CARGOS.map(([cargo]) => {
                  const actual = grupo[cargo];
                  return (
                    <li key={cargo} className="p-3">
                      <p className="text-xs font-medium uppercase tracking-wide opacity-60">
                        {nombreCargo(cargo)}
                      </p>
                      <p className="mt-1 text-sm font-medium break-words">
                        {actual ? (
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <Link
                              to={`/personas/${actual.persona_id}`}
                              className="hover:underline"
                            >
                              {actual.apellido} {actual.nombre}
                            </Link>
                            {actual.excepcion && (
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
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Boton
                          variante="suave"
                          onClick={() => abrirFormulario(cargo, "asignar")}
                          disabled={personas.length === 0}
                        >
                          {actual
                            ? t("per_enc_cambiar", "Cambiar")
                            : t("per_enc_asignar", "Asignar")}
                        </Boton>
                        {actual && (
                          <Boton
                            variante="peligro"
                            onClick={() => abrirFormulario(cargo, "quitar")}
                          >
                            {t("per_enc_quitar", "Quitar")}
                          </Boton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!cargando && !lista.error && personas.length === 0 && (
              <p className="mt-3 text-sm opacity-60">
                {t(
                  "per_enc_sin_integrantes",
                  "Este grupo no tiene integrantes: primero hay que asignarle personas.",
                )}
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <Boton variante="suave" onClick={() => onCerrar()}>
                {t("ui_cerrar", "Cerrar")}
              </Boton>
            </div>
          </div>
        )}

        {/* ---------- Vista 2: formulario ---------- */}
        {vista === "formulario" && accion && (
          <div className="mt-4 space-y-5">
            {accion.tipo === "quitar" ? (
              <p className="text-sm opacity-70">
                {t("per_enc_quitar_msg", {
                  defaultValue:
                    "El cargo de {{cargo}} del {{grupo}} quedará sin asignar. {{nombre}} sigue siendo integrante del grupo.",
                  cargo: nombreCargo(accion.cargo).toLowerCase(),
                  grupo: tituloGrupo.toLowerCase(),
                  nombre: titular ? `${titular.apellido} ${titular.nombre}` : "",
                })}
              </p>
            ) : (
              <>
                {esExcepcion && (
                  <p
                    role="note"
                    className="text-sm border border-amber-500/40 bg-amber-500/10 rounded-xl px-3 py-2"
                  >
                    {t(
                      "per_enc_aviso_excepcion",
                      "Ningún integrante libre es Anciano ni Siervo Ministerial. Solo de forma extraordinaria se puede habilitar a otro integrante: escriba el motivo y quedará marcado en el historial.",
                    )}
                  </p>
                )}
                <CampoSelect
                  id="enc-persona"
                  label={t("per_enc_persona", "Persona")}
                  obligatorio
                  value={personaId}
                  error={errores.persona}
                  ayuda={
                    opciones.length === 0
                      ? t(
                          "per_enc_sin_opciones",
                          "No hay otro integrante que pueda ocupar el cargo.",
                        )
                      : t(
                          "per_enc_ayuda_persona",
                          "Solo se ofrecen integrantes del grupo que pueden ocupar el cargo.",
                        )
                  }
                  onChange={(e) => {
                    setPersonaId(e.target.value);
                    setErrores((x) => ({ ...x, persona: "" }));
                  }}
                >
                  <option value="">{t("per_elegir", "Elegir…")}</option>
                  {opciones.map((p) => (
                    <option key={p.id} value={p.id}>
                      {nombreDe(p)}
                      {p.situacion_2 ? ` — ${p.situacion_2}` : ""}
                    </option>
                  ))}
                </CampoSelect>
              </>
            )}

            <CampoTexto
              id="enc-fecha"
              type="date"
              max={hoyISO()}
              label={t("per_enc_fecha", "Fecha del cambio")}
              obligatorio
              value={fecha}
              error={errores.fecha}
              ayuda={t(
                "per_mover_ayuda_fecha",
                "Por defecto es hoy; puede ser una fecha pasada.",
              )}
              onChange={(e) => {
                setFecha(e.target.value);
                setErrores((x) => ({ ...x, fecha: "" }));
              }}
            />

            {esExcepcion && (
              <CampoArea
                id="enc-detalles"
                rows={3}
                maxLength={600}
                label={t("per_enc_motivo_excepcion", "Motivo de la excepción")}
                obligatorio
                value={detalles}
                error={errores.detalles}
                placeholder={t(
                  "per_enc_ph_motivo",
                  "Ej.: El grupo no tiene ancianos ni siervos ministeriales",
                )}
                ayuda={t(
                  "per_enc_ayuda_motivo",
                  "Hasta 100 palabras. Queda en el historial del grupo.",
                )}
                onChange={(e) => {
                  setDetalles(e.target.value);
                  setErrores((x) => ({ ...x, detalles: "" }));
                }}
              />
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <Boton variante="suave" onClick={volverALista}>
                {t("per_mover_volver", "Volver")}
              </Boton>
              <Boton onClick={revisar}>
                {t("per_mover_revisar", "Revisar")}
              </Boton>
            </div>
          </div>
        )}

        {/* ---------- Vista 3: confirmar ---------- */}
        {vista === "confirmar" && accion && (
          <div className="mt-4">
            <dl className="divide-y divide-jw-border text-sm">
              <Resumen etiqueta={t("per_h_cargo", "Cargo")}>
                {nombreCargo(accion.cargo)} · {tituloGrupo}
              </Resumen>
              {accion.tipo === "quitar" ? (
                <Resumen etiqueta={t("per_enc_se_quita", "Se quita a")}>
                  {titular ? `${titular.apellido} ${titular.nombre}` : ""}
                </Resumen>
              ) : (
                <Resumen etiqueta={t("per_enc_persona", "Persona")}>
                  {elegida ? nombreDe(elegida) : ""}
                </Resumen>
              )}
              {accion.tipo === "asignar" && titular && (
                <Resumen etiqueta={t("per_enc_reemplaza", "Reemplaza a")}>
                  {titular.apellido} {titular.nombre}
                </Resumen>
              )}
              <Resumen etiqueta={t("per_enc_fecha", "Fecha del cambio")}>
                <span dir="ltr" className="tabular-nums">
                  {fechaCorta(fecha)}
                </span>
              </Resumen>
              {esExcepcion && (
                <>
                  <Resumen etiqueta={t("per_excepcion", "Excepción")}>
                    {t("per_si", "Sí")}
                  </Resumen>
                  <Resumen etiqueta={t("per_enc_motivo_excepcion", "Motivo de la excepción")}>
                    {detalles.trim()}
                  </Resumen>
                </>
              )}
            </dl>

            {envio.error && (
              <p
                role="alert"
                className="mt-4 text-sm border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2 break-words"
              >
                {envio.error}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Boton
                variante="suave"
                onClick={() => setVista("formulario")}
                disabled={envio.enviando}
              >
                {t("per_mover_volver", "Volver")}
              </Boton>
              <Boton
                variante={accion.tipo === "quitar" ? "peligro" : "primario"}
                onClick={guardar}
                disabled={envio.enviando}
              >
                {envio.enviando
                  ? t("ui_procesando", "Procesando…")
                  : accion.tipo === "quitar"
                    ? t("per_enc_quitar", "Quitar")
                    : t("per_enc_confirmar", "Guardar")}
              </Boton>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default EncargadosGrupo;
