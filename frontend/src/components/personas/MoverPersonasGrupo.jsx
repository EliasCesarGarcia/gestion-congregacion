/**
 * ARCHIVO: MoverPersonasGrupo.jsx
 * UBICACIÓN: frontend/src/components/personas/MoverPersonasGrupo.jsx
 * DESCRIPCIÓN: Ventana para mover personas de grupo (paso G2): las de un
 * grupo a otro grupo o a "sin grupo", o las que no tienen grupo a uno.
 * Se eligen una, algunas o todas, con una sola fecha, motivo y detalle, y se
 * mandan juntas a POST /api/personas/grupos/mover-varios (todo o nada).
 *
 * Dos pasos dentro de la misma ventana: completar -> "Revisar" -> resumen y
 * "Mover". No se cierra con un clic afuera (para no perder lo elegido): se
 * cierra con Cancelar, la X o Esc (no mientras se guarda).
 *
 * Los superintendentes y auxiliares del grupo no se mueven: aparecen
 * bloqueados (primero hay que reemplazarlos, paso G3).
 *
 * Props:
 *   origen: { tipo: "grupo", grupo } | { tipo: "sin" }
 *   grupos: grupos ACTIVOS de la congregación (candidatos a destino)
 *   esSuper, congregacionId
 *   onCerrar(): cerrar sin guardar
 *   onListo({ movidas, sinCambio, destino }): se guardó
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, X } from "lucide-react";
import Boton from "../ui/Boton";
import Etiqueta from "../ui/Etiqueta";
import { CampoArea, CampoSelect, CampoTexto } from "../ui/Campo";
import { hoyISO, fechaCorta } from "../../lib/fechas";
import { cargarIntegrantes, textoError } from "../../lib/gruposApi";

const ENFOCABLES =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

const MAX_PERSONAS = 100; // igual que el backend
const MAX_PALABRAS = 100; // igual que el backend
const MOSTRAR_FILTRO_DESDE = 10; // con más personas que esto se ofrece buscar

const nombreDe = (p) => `${p.apellido} ${p.nombre}`;
const contarPalabras = (texto) =>
  texto.trim().split(/\s+/).filter(Boolean).length;

function MoverPersonasGrupo({
  origen,
  grupos,
  esSuper,
  congregacionId,
  onCerrar,
  onListo,
}) {
  const { t } = useTranslation();
  const cuadro = useRef(null);
  const botonCerrar = useRef(null);

  // --- Estado ---
  const [paso, setPaso] = useState("form"); // "form" | "confirmar"
  const [lista, setLista] = useState({ personas: null, error: "" }); // null = cargando
  const [motivos, setMotivos] = useState([]);
  const [seleccion, setSeleccion] = useState({}); // { [id]: true }
  const [filtro, setFiltro] = useState("");
  const [destino, setDestino] = useState(""); // "" = sin elegir; "0" = sin grupo
  const [fecha, setFecha] = useState(hoyISO());
  const [motivoId, setMotivoId] = useState("");
  const [detalles, setDetalles] = useState("");
  const [errores, setErrores] = useState({});
  const [envio, setEnvio] = useState({ enviando: false, error: "" });

  // Las funciones de cerrar y el estado "enviando" se guardan en referencias
  // para que el efecto del teclado no se reinicie en cada dibujo.
  const cerrarRef = useRef(onCerrar);
  const enviandoRef = useRef(false);
  useEffect(() => {
    cerrarRef.current = onCerrar;
    enviandoRef.current = envio.enviando;
  });

  const esGrupo = origen.tipo === "grupo";

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

  // --- Datos: personas del origen y motivos de grupo ---
  const numeroOrigen = esGrupo ? origen.grupo.numero : "sin";
  useEffect(() => {
    const control = new AbortController();
    cargarIntegrantes({
      grupo: numeroOrigen,
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
  }, [numeroOrigen, esSuper, congregacionId, t]);

  useEffect(() => {
    const control = new AbortController();
    axios
      .get("/api/personas/motivos", {
        params: { uso: "grupo" },
        signal: control.signal,
      })
      .then(({ data }) =>
        setMotivos(Array.isArray(data.motivos) ? data.motivos : []),
      )
      .catch(() => {}); // sin motivos el campo queda en "Sin motivo"
    return () => control.abort();
  }, []);

  // --- Derivados ---
  const personas = lista.personas || [];
  const cargando = lista.personas === null;

  // Superintendente y auxiliar del grupo: no se mueven.
  const idsEncargados = new Set(
    esGrupo
      ? [
          origen.grupo.superintendente?.persona_id,
          origen.grupo.auxiliar?.persona_id,
        ].filter(Boolean)
      : [],
  );
  const esEncargado = (p) => idsEncargados.has(p.id);

  const visibles = personas.filter((p) =>
    nombreDe(p).toLowerCase().includes(filtro.trim().toLowerCase()),
  );
  const visiblesMovibles = visibles.filter((p) => !esEncargado(p));
  const seleccionadas = personas.filter(
    (p) => seleccion[p.id] && !esEncargado(p),
  );
  const todasVisiblesMarcadas =
    visiblesMovibles.length > 0 &&
    visiblesMovibles.every((p) => seleccion[p.id]);

  // Destinos: los grupos activos menos el de origen; "sin grupo" solo si se
  // sale de un grupo.
  const destinos = grupos
    .filter((g) => !(esGrupo && g.id === origen.grupo.id))
    .sort((a, b) => a.numero - b.numero);

  const textoDestino =
    destino === "0"
      ? t("per_sin_grupo", "Sin grupo")
      : `${t("per_grupo", "Grupo")} ${
          destinos.find((g) => String(g.id) === destino)?.numero ?? ""
        }`;
  const motivoElegido = motivos.find((m) => String(m.id) === motivoId);

  // --- Acciones ---
  const alternar = (id) => {
    setSeleccion((s) => ({ ...s, [id]: !s[id] }));
    setErrores((e) => ({ ...e, personas: "" }));
  };

  const alternarTodas = () => {
    const marcar = !todasVisiblesMarcadas;
    setSeleccion((s) => {
      const n = { ...s };
      visiblesMovibles.forEach((p) => {
        n[p.id] = marcar;
      });
      return n;
    });
    setErrores((e) => ({ ...e, personas: "" }));
  };

  const validar = () => {
    const e = {};
    if (seleccionadas.length === 0) {
      e.personas = t("per_err_mover_personas", "Elija al menos una persona.");
    } else if (seleccionadas.length > MAX_PERSONAS) {
      e.personas = t(
        "per_err_mover_max",
        "Se pueden mover hasta 100 personas a la vez.",
      );
    }
    if (destino === "") {
      e.destino = t("per_err_mover_destino", "Elija el grupo de destino.");
    }
    if (!fecha) {
      e.fecha = t("per_err_fecha", "Falta la fecha.");
    } else if (fecha > hoyISO()) {
      e.fecha = t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
    }
    if (contarPalabras(detalles) > MAX_PALABRAS) {
      e.detalles = t("per_err_detalles_100", "Máximo 100 palabras.");
    }
    return e;
  };

  const revisar = () => {
    const e = validar();
    setErrores(e);
    const primero = ["destino", "fecha", "detalles"].find((k) => e[k]);
    if (Object.keys(e).length > 0) {
      if (!e.personas && primero) {
        document.getElementById(`mov-${primero}`)?.focus();
      }
      return;
    }
    setEnvio({ enviando: false, error: "" });
    setPaso("confirmar");
  };

  const mover = async () => {
    setEnvio({ enviando: true, error: "" });
    const cuerpo = {
      persona_ids: seleccionadas.map((p) => p.id),
      grupo_id: Number(destino),
      fecha,
    };
    if (motivoId) cuerpo.motivo_id = Number(motivoId);
    if (detalles.trim()) cuerpo.detalles = detalles.trim();
    try {
      const { data } = await axios.post(
        "/api/personas/grupos/mover-varios",
        cuerpo,
      );
      onListo({
        movidas: data?.movidas ?? seleccionadas.length,
        sinCambio: data?.sin_cambio ?? 0,
        destino: textoDestino,
      });
    } catch (err) {
      setEnvio({
        enviando: false,
        error: textoError(
          err,
          t("per_error_mover", "No se pudieron mover las personas."),
        ),
      });
    }
  };

  // --- Dibujo ---
  const titulo = esGrupo
    ? t("per_mover_titulo_grupo", {
        defaultValue: "Mover integrantes del grupo {{numero}}",
        numero: origen.grupo.numero,
      })
    : t("per_mover_titulo_sin", "Asignar personas sin grupo");

  const chips = (p) => (
    <span className="flex flex-wrap items-center gap-1">
      {p.situacion_2 && <Etiqueta>{p.situacion_2}</Etiqueta>}
      {p.situacion_1 && p.situacion_1 !== "Publicador" && (
        <Etiqueta>{p.situacion_1}</Etiqueta>
      )}
      {p.condicion === "I" && (
        <Etiqueta tono="aviso">{t("per_inactivo", "Inactivo")}</Etiqueta>
      )}
    </span>
  );

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
        aria-labelledby="mover-titulo"
        className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto text-start bg-jw-card text-jw-text-main border border-jw-border rounded-t-2xl sm:rounded-2xl p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="mover-titulo" className="text-lg font-semibold min-w-0">
            {paso === "form"
              ? titulo
              : t("per_mover_confirma_titulo", "¿Mover estas personas?")}
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

        {/* ---------- Paso 1: completar ---------- */}
        {paso === "form" && (
          <div className="mt-4 space-y-5">
            {/* Personas */}
            <div>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="text-xs font-medium opacity-70">
                  {t("per_mover_personas", "Personas")}{" "}
                  <span className="text-red-500" aria-hidden="true">
                    *
                  </span>
                </span>
                {!cargando && !lista.error && (
                  <span className="text-xs opacity-70 tabular-nums">
                    {seleccionadas.length} {t("per_de", "de")}{" "}
                    {personas.length - idsEncargados.size}{" "}
                    {t("per_seleccionadas", "seleccionadas")}
                  </span>
                )}
              </div>

              {cargando && (
                <div className="flex justify-center py-8" role="status">
                  <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
                </div>
              )}

              {!cargando && lista.error && (
                <p
                  role="alert"
                  className="text-sm border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2 break-words"
                >
                  {lista.error}
                </p>
              )}

              {!cargando && !lista.error && personas.length === 0 && (
                <p className="text-sm opacity-60 py-2">
                  {t(
                    "per_mover_sin_personas",
                    "No hay personas para mover.",
                  )}
                </p>
              )}

              {!cargando && !lista.error && personas.length > 0 && (
                <>
                  {personas.length > MOSTRAR_FILTRO_DESDE && (
                    <input
                      id="mov-filtro"
                      type="search"
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value)}
                      placeholder={t("per_mover_buscar", "Buscar por nombre")}
                      aria-label={t("per_mover_buscar", "Buscar por nombre")}
                      className="w-full mb-2 bg-jw-body text-jw-text-main border border-jw-border rounded-xl px-3 py-2 text-sm outline-none focus:border-jw-accent"
                    />
                  )}
                  <div
                    className={`border rounded-xl ${
                      errores.personas ? "border-red-500" : "border-jw-border"
                    }`}
                  >
                    <label className="flex items-center gap-3 px-3 py-2 text-sm font-medium border-b border-jw-border cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-current"
                        checked={todasVisiblesMarcadas}
                        disabled={visiblesMovibles.length === 0}
                        onChange={alternarTodas}
                      />
                      {t("per_seleccionar_todas", "Seleccionar todas")}
                    </label>
                    <ul className="max-h-64 overflow-y-auto divide-y divide-jw-border">
                      {visibles.map((p) => {
                        const bloqueada = esEncargado(p);
                        return (
                          <li key={p.id}>
                            <label
                              className={`flex items-start gap-3 px-3 py-2 text-sm ${
                                bloqueada ? "opacity-60" : "cursor-pointer"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 w-4 h-4 accent-current shrink-0"
                                checked={!!seleccion[p.id] && !bloqueada}
                                disabled={bloqueada}
                                onChange={() => alternar(p.id)}
                              />
                              {/* Celular: el nombre ocupa todo el ancho y las etiquetas
                                  van debajo. PC: nombre a la izquierda y etiquetas a la derecha. */}
                              <span className="min-w-0 flex-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <span className="min-w-0 break-words">
                                  {nombreDe(p)}
                                  {bloqueada && (
                                    <span className="block text-xs opacity-80">
                                      {t(
                                        "per_encargado_no_mueve",
                                        "Encargado: hay que reemplazarlo antes de moverlo.",
                                      )}
                                    </span>
                                  )}
                                </span>
                                {chips(p)}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                      {visibles.length === 0 && (
                        <li className="px-3 py-3 text-sm opacity-60">
                          {t("per_sin_resultados", "Sin resultados.")}
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}
              {errores.personas && (
                <p role="alert" className="text-xs text-red-500 mt-1">
                  {errores.personas}
                </p>
              )}
            </div>

            {/* Destino, fecha, motivo y detalles */}
            <CampoSelect
              id="mov-destino"
              label={t("per_mover_destino", "Grupo de destino")}
              obligatorio
              value={destino}
              error={errores.destino}
              onChange={(e) => {
                setDestino(e.target.value);
                setErrores((x) => ({ ...x, destino: "" }));
              }}
            >
              <option value="">{t("per_elegir", "Elegir…")}</option>
              {destinos.map((g) => (
                <option key={g.id} value={g.id}>
                  {t("per_grupo", "Grupo")} {g.numero}
                </option>
              ))}
              {esGrupo && (
                <option value="0">{t("per_sin_grupo", "Sin grupo")}</option>
              )}
            </CampoSelect>

            <CampoTexto
              id="mov-fecha"
              type="date"
              max={hoyISO()}
              label={t("per_mover_fecha", "Fecha del movimiento")}
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

            <CampoSelect
              id="mov-motivo"
              label={t("per_mover_motivo", "Motivo")}
              value={motivoId}
              ayuda={t("per_ayuda_motivo", "Opcional.")}
              onChange={(e) => setMotivoId(e.target.value)}
            >
              <option value="">{t("per_sin_motivo", "Sin motivo")}</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </CampoSelect>

            <CampoArea
              id="mov-detalles"
              rows={3}
              maxLength={600}
              label={t("per_mover_detalles", "Detalles")}
              value={detalles}
              error={errores.detalles}
              placeholder={t(
                "per_mover_ph_detalles",
                "Ej.: Reestructuración de grupos",
              )}
              ayuda={t(
                "per_mover_ayuda_detalles",
                "Opcional, hasta 100 palabras. Queda en el historial de cada persona.",
              )}
              onChange={(e) => {
                setDetalles(e.target.value);
                setErrores((x) => ({ ...x, detalles: "" }));
              }}
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
              <Boton variante="suave" onClick={() => onCerrar()}>
                {t("ui_cancelar", "Cancelar")}
              </Boton>
              <Boton onClick={revisar} disabled={cargando || !!lista.error}>
                {t("per_mover_revisar", "Revisar")}
              </Boton>
            </div>
          </div>
        )}

        {/* ---------- Paso 2: confirmar ---------- */}
        {paso === "confirmar" && (
          <div className="mt-4">
            <dl className="divide-y divide-jw-border text-sm">
              <div className="flex flex-col gap-0.5 py-2 sm:grid sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
                <dt className="opacity-60">
                  {t("per_mover_personas", "Personas")}
                </dt>
                <dd className="font-medium text-start">
                  {seleccionadas.length}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:grid sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
                <dt className="opacity-60">
                  {t("per_mover_hacia", "Destino")}
                </dt>
                <dd className="font-medium text-start">{textoDestino}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:grid sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
                <dt className="opacity-60">
                  {t("per_mover_fecha", "Fecha del movimiento")}
                </dt>
                <dd className="font-medium text-start tabular-nums" dir="ltr">
                  {fechaCorta(fecha)}
                </dd>
              </div>
              {motivoElegido && (
                <div className="flex flex-col gap-0.5 py-2 sm:grid sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
                  <dt className="opacity-60">
                    {t("per_mover_motivo", "Motivo")}
                  </dt>
                  <dd className="font-medium text-start">
                    {motivoElegido.nombre}
                  </dd>
                </div>
              )}
              {detalles.trim() && (
                <div className="flex flex-col gap-0.5 py-2 sm:grid sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
                  <dt className="opacity-60">
                    {t("per_mover_detalles", "Detalles")}
                  </dt>
                  <dd className="text-start break-words min-w-0">
                    {detalles.trim()}
                  </dd>
                </div>
              )}
            </dl>

            <ul className="mt-3 max-h-40 overflow-y-auto text-sm divide-y divide-jw-border border border-jw-border rounded-xl">
              {seleccionadas.map((p) => (
                <li key={p.id} className="px-3 py-1.5 break-words">
                  {nombreDe(p)}
                </li>
              ))}
            </ul>

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
                onClick={() => setPaso("form")}
                disabled={envio.enviando}
              >
                {t("per_mover_volver", "Volver")}
              </Boton>
              <Boton onClick={mover} disabled={envio.enviando}>
                {envio.enviando
                  ? t("ui_procesando", "Procesando…")
                  : t("per_mover_confirmar", "Mover")}
              </Boton>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default MoverPersonasGrupo;
