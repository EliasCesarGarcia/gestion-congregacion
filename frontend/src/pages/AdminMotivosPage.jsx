/**
 * ARCHIVO: AdminMotivosPage.jsx
 * UBICACIÓN: frontend/src/pages/AdminMotivosPage.jsx
 * DESCRIPCIÓN: Catálogo de motivos para asignar o quitar un puesto. Solo el
 * superadmin los crea, renombra, reordena y desactiva; los demás solo eligen
 * (en AdminEncargadosPage).
 *
 * REGLAS (las hace cumplir el backend; esta pantalla solo las muestra):
 *  - Dos listas: motivos "al asignar" y motivos "al quitar".
 *  - Un motivo no se borra: se desactiva. Un motivo desactivado deja de
 *    ofrecerse, pero el historial conserva el texto con que se usó.
 *  - Renombrar un motivo NO cambia cómo se lee el historial anterior.
 *  - Texto obligatorio de hasta 100 caracteres, sin repetir dentro de un tipo.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. Las rutas
 * /api/admin/motivos/* devuelven 403 a quien no sea superadmin.
 */

import React, { useContext, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, Pencil, Plus, Eye, EyeOff } from "lucide-react";
import { AppContext } from "../context/AppContext";

const MAX_TEXTO = 100; // igual que el backend
const MAX_ORDEN = 9999; // igual que el backend

const TIPOS = [
  {
    id: "asignar",
    claveTitulo: "mot_tipo_asignar",
    textoTitulo: "Motivos al asignar un puesto",
    claveAyuda: "mot_ayuda_asignar",
    textoAyuda: "Ejemplo: nombramiento nuevo, reemplazo, cambio de equipo.",
  },
  {
    id: "quitar",
    claveTitulo: "mot_tipo_quitar",
    textoTitulo: "Motivos al quitar un puesto",
    claveAyuda: "mot_ayuda_quitar",
    textoAyuda: "Ejemplo: renuncia, traslado, cambio de equipo.",
  },
];

// Estilos reutilizables (solo variables de tema, propiedades lógicas para RTL).
const CLASE_BTN_PRIMARIO =
  "inline-flex items-center justify-center gap-2 bg-jw-navy text-jw-text-light rounded-xl px-3 py-2 text-sm font-medium hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none";
const CLASE_BTN_SUAVE =
  "inline-flex items-center justify-center gap-2 border border-jw-border text-jw-text-main rounded-xl px-3 py-2 text-sm hover:bg-jw-accent/20 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none";
const CLASE_CAMPO =
  "w-full bg-jw-body text-jw-text-main border border-jw-border rounded-xl px-3 py-2 text-sm outline-none focus:border-jw-accent transition-colors";

function AdminMotivosPage() {
  const { t } = useTranslation();
  const { permisos } = useContext(AppContext);
  const autorizado = permisos.es_superadmin;

  // --- Catálogo ---
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState("");
  const [version, setVersion] = useState(0);

  // --- Acciones ---
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [ocupado, setOcupado] = useState(""); // acción en curso

  // --- Alta (un campo de texto por tipo) ---
  const [nuevo, setNuevo] = useState({ asignar: "", quitar: "" });

  // --- Edición de un motivo ---
  const [editando, setEditando] = useState(null); // id del motivo
  const [textoEdit, setTextoEdit] = useState("");
  const [ordenEdit, setOrdenEdit] = useState("0");

  // Carga TODOS los motivos (activos y desactivados) cuando se sabe que hay
  // permiso y cada vez que cambia `version`.
  useEffect(() => {
    if (!autorizado) return;
    let cancelado = false;

    axios
      .get("/api/admin/motivos")
      .then(({ data }) => {
        if (cancelado) return;
        setLista(Array.isArray(data.motivos) ? data.motivos : []);
        setErrorLista("");
        setCargando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErrorLista(
          t(
            "mot_error_lista",
            "No se pudo cargar la lista de motivos. Actualice la página.",
          ),
        );
        setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [autorizado, version, t]);

  // Mientras no se sepa el permiso, no se decide nada (evita redirigir de más).
  if (!permisos.cargado) {
    return (
      <div className="flex justify-center py-20" role="status">
        <Loader2 className="w-7 h-7 animate-spin text-jw-accent" />
      </div>
    );
  }
  if (!autorizado) return <Navigate to="/" replace />;

  // --- Funciones auxiliares ---

  const refrescar = () => setVersion((v) => v + 1);

  const mensajeError = (err) => {
    const status = err.response?.status;
    if (!err.response) {
      return t("mot_err_red", "No se pudo conectar con el servidor.");
    }
    if (status === 401) {
      return t("mot_err_401", "Su sesión expiró. Vuelva a iniciar sesión.");
    }
    if (status === 403) {
      return t("mot_err_403", "No tiene permiso para esta acción.");
    }
    if (status === 404) {
      return t(
        "mot_err_404",
        "Ese motivo ya no existe. Se actualizó la lista.",
      );
    }
    if (status === 409) {
      return t(
        "mot_err_409",
        "Ya existe un motivo con ese texto en esta lista.",
      );
    }
    if (status === 400) {
      return t(
        "mot_err_400",
        "Datos no válidos. El texto es obligatorio (máximo 100 caracteres).",
      );
    }
    return t("mot_err_general", "Ocurrió un error. Intente de nuevo.");
  };

  // Orden del motivo nuevo: uno más que el mayor de su lista.
  const ordenSiguiente = (tipo) => {
    const ordenes = lista.filter((m) => m.tipo === tipo).map((m) => m.orden);
    if (ordenes.length === 0) return 1;
    return Math.min(MAX_ORDEN, Math.max(...ordenes) + 1);
  };

  // --- Acciones ---

  const crear = async (e, tipo) => {
    e.preventDefault();
    const texto = nuevo[tipo].trim();
    if (!texto) return;
    setOcupado(`crear|${tipo}`);
    setAviso(null);
    try {
      await axios.post("/api/admin/motivos/crear", {
        tipo,
        texto,
        orden: ordenSiguiente(tipo),
      });
      setNuevo((n) => ({ ...n, [tipo]: "" }));
      setAviso({ tipo: "ok", texto: t("mot_ok_crear", "Motivo creado.") });
      refrescar();
    } catch (err) {
      setAviso({ tipo: "error", texto: mensajeError(err) });
    } finally {
      setOcupado("");
    }
  };

  const empezarEdicion = (m) => {
    setAviso(null);
    setEditando(m.id);
    setTextoEdit(m.texto);
    setOrdenEdit(String(m.orden));
  };

  const guardarEdicion = async (e, m) => {
    e.preventDefault();
    const texto = textoEdit.trim();
    const orden = Number.parseInt(ordenEdit, 10);
    if (!texto || !Number.isInteger(orden) || orden < 0 || orden > MAX_ORDEN) {
      setAviso({
        tipo: "error",
        texto: t(
          "mot_err_400",
          "Datos no válidos. El texto es obligatorio (máximo 100 caracteres).",
        ),
      });
      return;
    }
    setOcupado(`editar|${m.id}`);
    setAviso(null);
    try {
      await axios.post("/api/admin/motivos/editar", {
        id: m.id,
        texto,
        orden,
      });
      setEditando(null);
      setAviso({ tipo: "ok", texto: t("mot_ok_editar", "Motivo guardado.") });
      refrescar();
    } catch (err) {
      setAviso({ tipo: "error", texto: mensajeError(err) });
      if (err.response?.status === 404) {
        setEditando(null);
        refrescar();
      }
    } finally {
      setOcupado("");
    }
  };

  // Desactivar y reactivar se pueden deshacer, por eso no piden confirmación.
  const cambiarActivo = async (m, activo) => {
    setOcupado(`activo|${m.id}`);
    setAviso(null);
    try {
      await axios.post("/api/admin/motivos/editar", { id: m.id, activo });
      setAviso({
        tipo: "ok",
        texto: activo
          ? t("mot_ok_reactivar", "Motivo reactivado.")
          : t("mot_ok_desactivar", "Motivo desactivado."),
      });
      refrescar();
    } catch (err) {
      setAviso({ tipo: "error", texto: mensajeError(err) });
      if (err.response?.status === 404) refrescar();
    } finally {
      setOcupado("");
    }
  };

  // --- Presentación ---

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-jw-text-main">
          {t("mot_titulo", "Motivos de puestos")}
        </h1>
        <p className="text-sm text-jw-text-main opacity-70 mt-1">
          {t(
            "mot_subtitulo",
            "Lista que ven los encargados al asignar o quitar un puesto. Un motivo no se borra: se desactiva. Renombrarlo no cambia el historial anterior.",
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

      {!cargando &&
        !errorLista &&
        TIPOS.map((tp) => {
          const delTipo = lista.filter((m) => m.tipo === tp.id);

          return (
            <section
              key={tp.id}
              className="bg-jw-card border border-jw-border rounded-2xl p-5 space-y-4"
            >
              <div>
                <h2 className="text-base font-medium text-jw-text-main">
                  {t(tp.claveTitulo, tp.textoTitulo)}
                </h2>
                <p className="text-sm text-jw-text-main opacity-70">
                  {t(tp.claveAyuda, tp.textoAyuda)}
                </p>
              </div>

              {delTipo.length === 0 && (
                <p className="text-sm text-jw-text-main opacity-70">
                  {t("mot_vacio", "Todavía no hay motivos en esta lista.")}
                </p>
              )}

              <ul className="space-y-2">
                {delTipo.map((m) => {
                  const enEdicion = editando === m.id;

                  return (
                    <li
                      key={m.id}
                      className={`border border-jw-border rounded-xl px-3 py-2 ${
                        m.activo ? "" : "opacity-60"
                      }`}
                    >
                      {enEdicion ? (
                        <form
                          onSubmit={(e) => guardarEdicion(e, m)}
                          className="space-y-2"
                        >
                          <div>
                            <label
                              htmlFor={`texto-${m.id}`}
                              className="block text-xs text-jw-text-main opacity-70 mb-1"
                            >
                              {t("mot_texto", "Texto")}
                            </label>
                            <input
                              id={`texto-${m.id}`}
                              type="text"
                              maxLength={MAX_TEXTO}
                              autoComplete="off"
                              value={textoEdit}
                              disabled={ocupado !== ""}
                              onChange={(e) => setTextoEdit(e.target.value)}
                              className={CLASE_CAMPO}
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`orden-${m.id}`}
                              className="block text-xs text-jw-text-main opacity-70 mb-1"
                            >
                              {t("mot_orden", "Orden en la lista (0 a 9999)")}
                            </label>
                            <input
                              id={`orden-${m.id}`}
                              type="number"
                              min={0}
                              max={MAX_ORDEN}
                              value={ordenEdit}
                              disabled={ocupado !== ""}
                              onChange={(e) => setOrdenEdit(e.target.value)}
                              className={CLASE_CAMPO}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={ocupado !== "" || !textoEdit.trim()}
                              className={CLASE_BTN_PRIMARIO}
                            >
                              {ocupado === `editar|${m.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                t("mot_guardar", "Guardar")
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={ocupado !== ""}
                              onClick={() => setEditando(null)}
                              className={CLASE_BTN_SUAVE}
                            >
                              {t("mot_cancelar", "Cancelar")}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-jw-text-main">
                              {m.texto}
                            </p>
                            <p className="text-xs text-jw-text-main opacity-60">
                              {t("mot_orden_corto", "Orden")} {m.orden}
                              {!m.activo && (
                                <span className="ms-2">
                                  · {t("mot_desactivado", "Desactivado")}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={ocupado !== ""}
                              onClick={() => empezarEdicion(m)}
                              className={CLASE_BTN_SUAVE}
                            >
                              <Pencil className="w-4 h-4" />
                              {t("mot_editar", "Editar")}
                            </button>
                            <button
                              type="button"
                              disabled={ocupado !== ""}
                              onClick={() => cambiarActivo(m, !m.activo)}
                              className={CLASE_BTN_SUAVE}
                            >
                              {ocupado === `activo|${m.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : m.activo ? (
                                <>
                                  <EyeOff className="w-4 h-4" />
                                  {t("mot_desactivar", "Desactivar")}
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4" />
                                  {t("mot_reactivar", "Reactivar")}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* --- ALTA --- */}
              <form
                onSubmit={(e) => crear(e, tp.id)}
                className="flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  name={`nuevo_${tp.id}`}
                  maxLength={MAX_TEXTO}
                  autoComplete="off"
                  value={nuevo[tp.id]}
                  disabled={ocupado !== ""}
                  onChange={(e) =>
                    setNuevo((n) => ({ ...n, [tp.id]: e.target.value }))
                  }
                  placeholder={t("mot_nuevo_ph", "Nuevo motivo")}
                  aria-label={t("mot_nuevo_ph", "Nuevo motivo")}
                  className={`${CLASE_CAMPO} flex-1 min-w-0`}
                />
                <button
                  type="submit"
                  disabled={ocupado !== "" || !nuevo[tp.id].trim()}
                  className={CLASE_BTN_PRIMARIO}
                >
                  {ocupado === `crear|${tp.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {t("mot_agregar", "Agregar")}
                    </>
                  )}
                </button>
              </form>
            </section>
          );
        })}
    </div>
  );
}

export default AdminMotivosPage;
