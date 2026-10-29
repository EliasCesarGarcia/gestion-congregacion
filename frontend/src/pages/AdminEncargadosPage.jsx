/**
 * ARCHIVO: AdminEncargadosPage.jsx
 * UBICACIÓN: frontend/src/pages/AdminEncargadosPage.jsx
 * DESCRIPCIÓN: Pantalla de departamentos y puestos (encargado, auxiliar y
 * segundo auxiliar). Coordinador, secretario, servicio y superadmin asignan
 * y quitan personas de cada puesto. Al asignar o quitar se puede elegir un
 * motivo (lista que configura el superadmin) y escribir un detalle corto.
 *
 * REGLAS (las hace cumplir el backend; esta pantalla solo las muestra):
 *  - El encargado edita dentro del departamento; los auxiliares solo ven.
 *  - Un solo encargado, un solo auxiliar y un solo segundo auxiliar.
 *  - Una persona no puede tener dos puestos en el mismo departamento.
 *  - Solo se pueden asignar personas dadas de alta en la gestión de personas.
 *  - Motivo y detalle son opcionales; el detalle admite hasta 100 palabras
 *    y 1000 caracteres.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. Las rutas
 * /api/modulos/* devuelven 403 a quien no tenga permiso.
 *
 * NOTA: en el código el departamento se sigue llamando "módulo".
 */

import React, { useContext, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, UserPlus, UserMinus, X } from "lucide-react";
import { AppContext } from "../context/AppContext";

const LIMITE = 20; // personas por página en el selector (el backend admite hasta 50)
const MAX_PALABRAS = 100; // igual que el backend
const MAX_CARACTERES = 1000; // igual que el backend

const PUESTOS = [
  { id: "encargado", clave: "enc_puesto_encargado", texto: "Encargado" },
  { id: "auxiliar", clave: "enc_puesto_auxiliar", texto: "Auxiliar" },
  {
    id: "auxiliar_2",
    clave: "enc_puesto_auxiliar_2",
    texto: "Segundo auxiliar (opcional)",
  },
];

// Estilos reutilizables (solo variables de tema, propiedades lógicas para RTL).
const CLASE_BTN_PRIMARIO =
  "inline-flex items-center justify-center gap-2 bg-jw-navy text-jw-text-light rounded-xl px-3 py-2 text-sm font-medium hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none";
const CLASE_BTN_SUAVE =
  "inline-flex items-center justify-center gap-2 border border-jw-border text-jw-text-main rounded-xl px-3 py-2 text-sm hover:bg-jw-accent/20 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none";
const CLASE_CAMPO =
  "w-full bg-jw-body text-jw-text-main border border-jw-border rounded-xl px-3 py-2 text-sm outline-none focus:border-jw-accent transition-colors";

// Cuenta palabras como el backend (separadas por espacios).
const contarPalabras = (texto) => {
  const limpio = texto.trim();
  return limpio ? limpio.split(/\s+/).length : 0;
};

/**
 * Campos de motivo (desplegable) y detalle (texto corto). Está fuera de la
 * pantalla principal a propósito: si se definiera adentro, se volvería a
 * crear en cada tecla y el cursor se perdería.
 */
function CamposMotivo({
  idBase,
  lista,
  motivo,
  setMotivo,
  detalles,
  setDetalles,
  deshabilitado,
  t,
}) {
  const palabras = contarPalabras(detalles);
  const excedido = palabras > MAX_PALABRAS;

  return (
    <div className="space-y-2">
      <div>
        <label
          htmlFor={`${idBase}-motivo`}
          className="block text-xs text-jw-text-main opacity-70 mb-1"
        >
          {t("enc_motivo", "Motivo (opcional)")}
        </label>
        <select
          id={`${idBase}-motivo`}
          value={motivo}
          disabled={deshabilitado}
          onChange={(e) => setMotivo(e.target.value)}
          className={CLASE_CAMPO}
        >
          <option value="">{t("enc_sin_motivo", "Sin motivo")}</option>
          {lista.map((m) => (
            <option key={m.id} value={String(m.id)}>
              {m.texto}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`${idBase}-detalles`}
          className="block text-xs text-jw-text-main opacity-70 mb-1"
        >
          {t("enc_detalles", "Detalles (opcional)")}
        </label>
        <textarea
          id={`${idBase}-detalles`}
          rows={2}
          maxLength={MAX_CARACTERES}
          value={detalles}
          disabled={deshabilitado}
          onChange={(e) => setDetalles(e.target.value)}
          className={`${CLASE_CAMPO} resize-y`}
        />
        <p
          className={`text-xs mt-1 text-end ${
            excedido ? "text-red-500" : "text-jw-text-main opacity-60"
          }`}
        >
          {palabras} / {MAX_PALABRAS}{" "}
          {t("enc_palabras", "palabras")}
        </p>
      </div>
    </div>
  );
}

function AdminEncargadosPage() {
  const { t } = useTranslation();
  const { permisos, modulos } = useContext(AppContext);
  const autorizado = permisos.es_superadmin || permisos.es_encargado_general;

  // --- Puestos ocupados ---
  const [asignaciones, setAsignaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState("");
  const [version, setVersion] = useState(0);

  // --- Motivos (listas para los desplegables) ---
  const [motivos, setMotivos] = useState({ asignar: [], quitar: [] });
  const [versionMotivos, setVersionMotivos] = useState(0);

  // --- Acciones ---
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [ocupado, setOcupado] = useState(""); // acción en curso
  const [confirmando, setConfirmando] = useState(""); // "modulo|puesto"

  // --- Motivo y detalle al asignar / al quitar ---
  const [motivoAsignar, setMotivoAsignar] = useState("");
  const [detallesAsignar, setDetallesAsignar] = useState("");
  const [motivoQuitar, setMotivoQuitar] = useState("");
  const [detallesQuitar, setDetallesQuitar] = useState("");

  // --- Selector de personas (paginado) ---
  const [eligiendo, setEligiendo] = useState(null); // { moduloId, puesto }
  const [pagina, setPagina] = useState(1);
  const [personas, setPersonas] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargandoPersonas, setCargandoPersonas] = useState(false);
  const [errorPersonas, setErrorPersonas] = useState("");
  const [busqueda, setBusqueda] = useState(""); // lo que se escribe
  const [terminoActivo, setTerminoActivo] = useState(""); // lo que se buscó

  // Carga los puestos cuando se sabe que hay permiso y cada vez que cambia `version`.
  useEffect(() => {
    if (!autorizado) return;
    let cancelado = false;

    axios
      .get("/api/modulos/asignaciones")
      .then(({ data }) => {
        if (cancelado) return;
        setAsignaciones(
          Array.isArray(data.asignaciones) ? data.asignaciones : [],
        );
        setErrorLista("");
        setCargando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErrorLista(
          t(
            "enc_error_lista",
            "No se pudo cargar la lista de puestos. Actualice la página.",
          ),
        );
        setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [autorizado, version, t]);

  // Carga los motivos activos (ambos tipos en una sola llamada). Si falla, los
  // desplegables quedan solo con "Sin motivo": el motivo es opcional.
  useEffect(() => {
    if (!autorizado) return;
    let cancelado = false;

    axios
      .get("/api/modulos/motivos")
      .then(({ data }) => {
        if (cancelado) return;
        const lista = Array.isArray(data.motivos) ? data.motivos : [];
        setMotivos({
          asignar: lista.filter((m) => m.tipo === "asignar"),
          quitar: lista.filter((m) => m.tipo === "quitar"),
        });
      })
      .catch(() => {
        if (cancelado) return;
        setMotivos({ asignar: [], quitar: [] });
      });

    return () => {
      cancelado = true;
    };
  }, [autorizado, versionMotivos]);

  // Mientras no se sepa el permiso, no se decide nada (evita redirigir de más).
  if (!permisos.cargado) {
    return (
      <div className="flex justify-center py-20" role="status">
        <Loader2 className="w-7 h-7 animate-spin text-jw-accent" />
      </div>
    );
  }
  if (!autorizado) return <Navigate to="/" replace />;

  // Solo los departamentos que se asignan (los comunes no tienen encargado).
  const departamentos = modulos.filter((m) => !m.es_comun);
  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE));
  const asignarExcedido = contarPalabras(detallesAsignar) > MAX_PALABRAS;
  const quitarExcedido = contarPalabras(detallesQuitar) > MAX_PALABRAS;

  // --- Funciones auxiliares ---

  const mensajeError = (err, accion) => {
    const status = err.response?.status;
    if (!err.response) {
      return t("enc_err_red", "No se pudo conectar con el servidor.");
    }
    if (status === 401) {
      return t("enc_err_401", "Su sesión expiró. Vuelva a iniciar sesión.");
    }
    if (status === 403) {
      return t("enc_err_403", "No tiene permiso para esta acción.");
    }
    if (status === 404) {
      return accion === "quitar"
        ? t(
            "enc_err_404_quitar",
            "Esa persona ya no tiene ese puesto. Se actualizó la lista.",
          )
        : t(
            "enc_err_404_asignar",
            "La persona o el departamento ya no están disponibles. Se actualizó la lista.",
          );
    }
    if (status === 409) {
      return t(
        "enc_err_409",
        "Ese puesto ya está ocupado, o la persona ya tiene otro puesto en este departamento. Quite primero el puesto actual.",
      );
    }
    if (status === 400) {
      return t(
        "enc_err_400",
        "Datos no válidos. Revise el motivo y los detalles (máximo 100 palabras).",
      );
    }
    return t("enc_err_general", "Ocurrió un error. Intente de nuevo.");
  };

  const refrescar = () => setVersion((v) => v + 1);
  const refrescarMotivos = () => setVersionMotivos((v) => v + 1);

  // El cuerpo lleva motivo_id y detalles solo si se completaron.
  const camposOpcionales = (motivo, detalles) => {
    const extra = {};
    if (motivo) extra.motivo_id = Number(motivo);
    if (detalles.trim()) extra.detalles = detalles.trim();
    return extra;
  };

  const cargarPersonas = async (pag, termino) => {
    setCargandoPersonas(true);
    setErrorPersonas("");
    try {
      const { data } = await axios.get("/api/personas", {
        params: { page: pag, limit: LIMITE, q: termino || undefined },
      });
      setPersonas(Array.isArray(data.personas) ? data.personas : []);
      setTotal(Number(data.total) || 0);
      setPagina(pag);
      setTerminoActivo(termino || "");
    } catch {
      setErrorPersonas(
        t("enc_error_personas", "No se pudo cargar la lista de personas."),
      );
    } finally {
      setCargandoPersonas(false);
    }
  };

  const abrirSelector = (moduloId, puesto) => {
    setAviso(null);
    setConfirmando("");
    setEligiendo({ moduloId, puesto });
    setMotivoAsignar("");
    setDetallesAsignar("");
    setPersonas([]);
    setBusqueda("");
    cargarPersonas(1, "");
  };

  const cerrarSelector = () => setEligiendo(null);

  const abrirConfirmacion = (clave) => {
    setAviso(null);
    setMotivoQuitar("");
    setDetallesQuitar("");
    setConfirmando(clave);
  };

  // --- Acciones ---

  const asignar = async (persona) => {
    const { moduloId, puesto } = eligiendo;
    setOcupado(`asignar|${persona.id}`);
    setAviso(null);
    try {
      await axios.post("/api/modulos/asignar", {
        persona_id: persona.id,
        modulo_id: moduloId,
        puesto,
        ...camposOpcionales(motivoAsignar, detallesAsignar),
      });
      setAviso({
        tipo: "ok",
        texto: t("enc_ok_asignar", "Puesto asignado."),
      });
      setEligiendo(null);
      refrescar();
    } catch (err) {
      setAviso({ tipo: "error", texto: mensajeError(err, "asignar") });
      if (err.response?.status === 400) {
        // Puede ser un motivo que el superadmin desactivó mientras tanto.
        setMotivoAsignar("");
        refrescarMotivos();
      }
      if (err.response?.status === 404 || err.response?.status === 409) {
        setEligiendo(null);
        refrescar();
      }
    } finally {
      setOcupado("");
    }
  };

  const quitar = async (moduloId, personaId) => {
    setOcupado(`quitar|${moduloId}|${personaId}`);
    setAviso(null);
    try {
      await axios.post("/api/modulos/quitar", {
        persona_id: personaId,
        modulo_id: moduloId,
        ...camposOpcionales(motivoQuitar, detallesQuitar),
      });
      setAviso({ tipo: "ok", texto: t("enc_ok_quitar", "Puesto quitado.") });
      setConfirmando("");
      refrescar();
    } catch (err) {
      setAviso({ tipo: "error", texto: mensajeError(err, "quitar") });
      if (err.response?.status === 400) {
        setMotivoQuitar("");
        refrescarMotivos();
      }
      if (err.response?.status === 404) {
        setConfirmando("");
        refrescar();
      }
    } finally {
      setOcupado("");
    }
  };

  // --- Presentación ---

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-jw-text-main">
          {t("enc_titulo", "Encargados de departamentos")}
        </h1>
        <p className="text-sm text-jw-text-main opacity-70 mt-1">
          {t(
            "enc_subtitulo",
            "El encargado edita dentro de su departamento; los auxiliares solo pueden ver. Solo se asignan personas dadas de alta.",
          )}
        </p>
      </header>

      {aviso && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            aviso.tipo === "ok"
              ? "border-green-600/40 bg-green-600/10 text-jw-text-main"
              : "border-red-500/50 bg-red-500/10 text-jw-text-main"
          }`}
        >
          {aviso.texto}
        </div>
      )}

      {cargando && (
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-jw-accent" />
        </div>
      )}

      {errorLista && (
        <p className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-4 py-3">
          {errorLista}
        </p>
      )}

      {!cargando && !errorLista && departamentos.length === 0 && (
        <p className="text-sm text-jw-text-main opacity-70">
          {t("enc_vacio", "Todavía no hay departamentos para asignar.")}
        </p>
      )}

      {!cargando &&
        !errorLista &&
        departamentos.map((m) => {
          const delDepto = asignaciones.filter((a) => a.modulo_id === m.id);
          const eligiendoAqui = eligiendo?.moduloId === m.id;

          return (
            <section
              key={m.id}
              className="bg-jw-card border border-jw-border rounded-2xl p-5 space-y-4"
            >
              <div>
                <h2 className="text-base font-medium text-jw-text-main">
                  {m.nombre}
                </h2>
                {m.descripcion && (
                  <p className="text-sm text-jw-text-main opacity-70">
                    {m.descripcion}
                  </p>
                )}
              </div>

              <ul className="space-y-2">
                {PUESTOS.map((p) => {
                  const ocupante = delDepto.find((a) => a.puesto === p.id);
                  const claveConfirmar = `${m.id}|${p.id}`;
                  const enConfirmacion = confirmando === claveConfirmar;

                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-2 border border-jw-border rounded-xl px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-jw-text-main opacity-60">
                          {t(p.clave, p.texto)}
                        </p>
                        <p className="text-sm text-jw-text-main">
                          {ocupante
                            ? ocupante.nombre_completo ||
                              `#${ocupante.persona_id}`
                            : t("enc_libre", "Sin asignar")}
                        </p>
                      </div>

                      {!ocupante && (
                        <button
                          type="button"
                          disabled={ocupado !== "" || cargandoPersonas}
                          onClick={() => abrirSelector(m.id, p.id)}
                          className={CLASE_BTN_SUAVE}
                        >
                          <UserPlus className="w-4 h-4" />
                          {t("enc_asignar", "Asignar")}
                        </button>
                      )}

                      {ocupante && !enConfirmacion && (
                        <button
                          type="button"
                          disabled={ocupado !== ""}
                          onClick={() => abrirConfirmacion(claveConfirmar)}
                          className={CLASE_BTN_SUAVE}
                        >
                          <UserMinus className="w-4 h-4" />
                          {t("enc_quitar", "Quitar")}
                        </button>
                      )}

                      {ocupante && enConfirmacion && (
                        <div className="w-full space-y-3 border-t border-jw-border pt-3">
                          <p className="text-sm text-jw-text-main">
                            {t("enc_confirmar_quitar", "¿Quitar este puesto?")}
                          </p>

                          <CamposMotivo
                            idBase={`quitar-${m.id}-${p.id}`}
                            lista={motivos.quitar}
                            motivo={motivoQuitar}
                            setMotivo={setMotivoQuitar}
                            detalles={detallesQuitar}
                            setDetalles={setDetallesQuitar}
                            deshabilitado={ocupado !== ""}
                            t={t}
                          />

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={ocupado !== "" || quitarExcedido}
                              onClick={() => quitar(m.id, ocupante.persona_id)}
                              className={CLASE_BTN_PRIMARIO}
                            >
                              {ocupado ===
                              `quitar|${m.id}|${ocupante.persona_id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                t("enc_si_quitar", "Sí, quitar")
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={ocupado !== ""}
                              onClick={() => setConfirmando("")}
                              className={CLASE_BTN_SUAVE}
                            >
                              {t("enc_cancelar", "Cancelar")}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* --- SELECTOR DE PERSONAS --- */}
              {eligiendoAqui && (
                <div className="border border-jw-accent rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-jw-text-main">
                      {t("enc_elegir", "Elegir persona para")}{" "}
                      {t(
                        PUESTOS.find((p) => p.id === eligiendo.puesto).clave,
                        PUESTOS.find((p) => p.id === eligiendo.puesto).texto,
                      )}
                    </h3>
                    <button
                      type="button"
                      onClick={cerrarSelector}
                      aria-label={t("enc_cerrar", "Cerrar")}
                      className={CLASE_BTN_SUAVE}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Motivo y detalle: se aplican a la persona que se elija. */}
                  <CamposMotivo
                    idBase={`asignar-${m.id}`}
                    lista={motivos.asignar}
                    motivo={motivoAsignar}
                    setMotivo={setMotivoAsignar}
                    detalles={detallesAsignar}
                    setDetalles={setDetallesAsignar}
                    deshabilitado={ocupado !== ""}
                    t={t}
                  />

                  <form
                    role="search"
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      cargarPersonas(1, busqueda.trim());
                    }}
                  >
                    <input
                      type="search"
                      name="buscar_persona"
                      autoComplete="off"
                      maxLength={60}
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder={t("enc_buscar_ph", "Buscar por nombre")}
                      aria-label={t("enc_buscar_ph", "Buscar por nombre")}
                      className={CLASE_CAMPO}
                    />
                    <button
                      type="submit"
                      disabled={cargandoPersonas}
                      className={CLASE_BTN_PRIMARIO}
                    >
                      {t("enc_buscar", "Buscar")}
                    </button>
                  </form>

                  {cargandoPersonas && (
                    <div className="flex justify-center py-4" role="status">
                      <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
                    </div>
                  )}

                  {errorPersonas && (
                    <p className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2">
                      {errorPersonas}
                    </p>
                  )}

                  {!cargandoPersonas && !errorPersonas && (
                    <ul className="divide-y divide-jw-border border border-jw-border rounded-xl">
                      {personas.length === 0 && (
                        <li className="px-3 py-2 text-sm text-jw-text-main opacity-70">
                          {t(
                            "enc_sin_personas",
                            "No hay personas para mostrar.",
                          )}
                        </li>
                      )}
                      {personas.map((per) => {
                        const yaTiene = delDepto.some(
                          (a) => a.persona_id === per.id,
                        );
                        return (
                          <li
                            key={per.id}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <span className="text-sm text-jw-text-main min-w-0">
                              {per.nombre_completo}
                              {per.rol_app && per.rol_app !== "publicador" && (
                                <span className="ms-2 text-xs opacity-60 capitalize">
                                  {per.rol_app}
                                </span>
                              )}
                            </span>
                            {yaTiene ? (
                              <span className="text-xs text-jw-text-main opacity-60">
                                {t("enc_ya_tiene", "Ya tiene un puesto aquí")}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={ocupado !== "" || asignarExcedido}
                                onClick={() => asignar(per)}
                                className={CLASE_BTN_PRIMARIO}
                              >
                                {ocupado === `asignar|${per.id}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  t("enc_elegir_btn", "Elegir")
                                )}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={cargandoPersonas || pagina <= 1}
                      onClick={() => cargarPersonas(pagina - 1, terminoActivo)}
                      className={CLASE_BTN_SUAVE}
                    >
                      {t("enc_anterior", "Anterior")}
                    </button>
                    <span className="text-xs text-jw-text-main opacity-70">
                      {t("enc_pagina", "Página")} {pagina} / {totalPaginas}
                    </span>
                    <button
                      type="button"
                      disabled={cargandoPersonas || pagina >= totalPaginas}
                      onClick={() => cargarPersonas(pagina + 1, terminoActivo)}
                      className={CLASE_BTN_SUAVE}
                    >
                      {t("enc_siguiente", "Siguiente")}
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}

export default AdminEncargadosPage;
