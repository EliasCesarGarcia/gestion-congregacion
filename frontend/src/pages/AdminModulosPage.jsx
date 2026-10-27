/**
 * ARCHIVO: AdminModulosPage.jsx
 * UBICACIÓN: frontend/src/pages/AdminModulosPage.jsx
 * DESCRIPCIÓN: Panel de superadmin para administrar los módulos del sistema
 * (listar, crear, editar, activar/desactivar y eliminar).
 *
 * SEGURIDAD: este chequeo solo oculta la pantalla. La seguridad real está en
 * el backend (SuperAdminMiddleware): las rutas /api/admin/modulos/* devuelven
 * 403 a quien no sea superadmin.
 */

import React, { useContext, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, Plus, Pencil, Trash2, Power, Check, X } from "lucide-react";
import { AppContext } from "../context/AppContext";
import { MODULOS_UI } from "../config/modulosConfig";

// Misma regla que el backend: minúsculas, números y _, empieza con letra, máx. 60.
const REGEX_ID = /^[a-z][a-z0-9_]{0,59}$/;

const FORM_VACIO = { id: "", nombre: "", descripcion: "", es_comun: false };

// Genera el id a partir del nombre: "Informes mensuales" -> "informes_mensuales".
// Quita tildes, pasa a minúsculas y deja solo a-z, 0-9 y _. Si el id ya existe
// agrega _2, _3... Si el nombre no tiene letras latinas ni números (por ejemplo
// un nombre en árabe), usa un id técnico "modulo_xxxx".
function generarId(nombre, existentes) {
  let base = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!base) base = `modulo_${Date.now().toString(36)}`;
  if (!/^[a-z]/.test(base)) base = `m_${base}`;
  base = base.slice(0, 50).replace(/_+$/, "");

  let id = base;
  let n = 2;
  while (existentes.some((m) => m.id === id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  return id;
}

// Estilos reutilizables (solo variables de tema, propiedades lógicas para RTL).
const CLASE_INPUT =
  "w-full bg-jw-body text-jw-text-main border border-jw-border rounded-xl px-3 py-2 text-sm outline-none focus:border-jw-accent transition-colors";
const CLASE_BTN_PRIMARIO =
  "inline-flex items-center justify-center gap-2 bg-jw-navy text-jw-text-light rounded-xl px-4 py-2 text-sm font-medium hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none";
const CLASE_BTN_SUAVE =
  "inline-flex items-center justify-center gap-2 border border-jw-border text-jw-text-main rounded-xl px-3 py-2 text-sm hover:bg-jw-accent/20 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none";

function AdminModulosPage() {
  const { t } = useTranslation();
  const { permisos, recargarModulos } = useContext(AppContext);
  const esSuperadmin = permisos.es_superadmin;

  // --- Estado de la lista ---
  const [modulos, setModulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState("");
  const [version, setVersion] = useState(0);

  // --- Estado de las acciones ---
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [ocupado, setOcupado] = useState(""); // id del módulo (o "crear") en curso
  const [formCrear, setFormCrear] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState("");
  const [formEditar, setFormEditar] = useState(FORM_VACIO);
  const [confirmandoId, setConfirmandoId] = useState("");

  // Carga la lista cuando se sabe que es superadmin y cada vez que cambia `version`.
  useEffect(() => {
    if (!esSuperadmin) return;
    let cancelado = false;

    axios
      .get("/api/admin/modulos")
      .then(({ data }) => {
        if (cancelado) return;
        setModulos(Array.isArray(data.modulos) ? data.modulos : []);
        setErrorLista("");
        setCargando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErrorLista(
          t(
            "admin_mod_error_lista",
            "No se pudo cargar la lista de módulos. Actualice la página.",
          ),
        );
        setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [esSuperadmin, version, t]);

  // Mientras no se sepa el permiso, no se decide nada (evita redirigir de más).
  if (!permisos.cargado) {
    return (
      <div className="flex justify-center py-20" role="status">
        <Loader2 className="w-7 h-7 animate-spin text-jw-accent" />
      </div>
    );
  }
  if (!esSuperadmin) return <Navigate to="/" replace />;

  // --- Funciones auxiliares ---

  const mensajeError = (err, accion) => {
    const status = err.response?.status;
    if (!err.response) {
      return t("admin_mod_err_red", "No se pudo conectar con el servidor.");
    }
    if (status === 401) {
      return t(
        "admin_mod_err_401",
        "Su sesión expiró. Vuelva a iniciar sesión.",
      );
    }
    if (status === 403) {
      return t("admin_mod_err_403", "No tiene permiso para esta acción.");
    }
    if (status === 404) {
      return t(
        "admin_mod_err_404",
        "El módulo ya no existe. Se actualizó la lista.",
      );
    }
    if (status === 400) {
      return t(
        "admin_mod_err_400",
        "Datos no válidos. Revise el id, el nombre y la descripción.",
      );
    }
    if (status === 409) {
      if (accion === "crear") {
        return t("admin_mod_err_409_crear", "Ya existe un módulo con ese id.");
      }
      if (accion === "eliminar") {
        return t(
          "admin_mod_err_409_eliminar",
          "Tiene personas asignadas o anuncios. Desactívelo en vez de eliminarlo.",
        );
      }
      return t(
        "admin_mod_err_409_editar",
        "No se puede marcar como común mientras tenga personas asignadas. Quíteles el módulo primero.",
      );
    }
    return t("admin_mod_err_general", "Ocurrió un error. Intente de nuevo.");
  };

  // Tras un cambio: refresca esta lista y el menú lateral.
  const refrescarTodo = () => {
    setVersion((v) => v + 1);
    recargarModulos();
  };

  const ejecutar = async (clave, accion, ruta, cuerpo, textoOk) => {
    setOcupado(clave);
    setAviso(null);
    try {
      await axios.post(ruta, cuerpo);
      setAviso({ tipo: "ok", texto: textoOk });
      refrescarTodo();
      return true;
    } catch (err) {
      setAviso({ tipo: "error", texto: mensajeError(err, accion) });
      if (err.response?.status === 404) refrescarTodo();
      return false;
    } finally {
      setOcupado("");
    }
  };

  // --- Acciones ---

  const crear = async (e) => {
    e.preventDefault();
    const nombre = formCrear.nombre.trim();

    if (!nombre) {
      setAviso({
        tipo: "error",
        texto: t("admin_mod_err_nombre", "El nombre es obligatorio."),
      });
      return;
    }

    const id = generarId(nombre, modulos);
    if (!REGEX_ID.test(id)) {
      setAviso({
        tipo: "error",
        texto: t(
          "admin_mod_err_id",
          "No se pudo generar un id válido a partir del nombre. Pruebe con otro nombre.",
        ),
      });
      return;
    }

    const ok = await ejecutar(
      "crear",
      "crear",
      "/api/admin/modulos/crear",
      {
        id,
        nombre,
        descripcion: formCrear.descripcion.trim(),
        es_comun: formCrear.es_comun,
      },
      `${t("admin_mod_ok_crear", "Módulo creado.")} Id: ${id}`,
    );
    if (ok) setFormCrear(FORM_VACIO);
  };

  const empezarEdicion = (m) => {
    setConfirmandoId("");
    setAviso(null);
    setEditandoId(m.id);
    setFormEditar({
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion || "",
      es_comun: m.es_comun,
    });
  };

  const guardarEdicion = async (m) => {
    const nombre = formEditar.nombre.trim();
    if (!nombre) {
      setAviso({
        tipo: "error",
        texto: t("admin_mod_err_nombre", "El nombre es obligatorio."),
      });
      return;
    }

    // Se envían solo los campos que cambiaron.
    const cuerpo = { id: m.id };
    if (nombre !== m.nombre) cuerpo.nombre = nombre;
    const descripcion = formEditar.descripcion.trim();
    if (descripcion !== (m.descripcion || "")) cuerpo.descripcion = descripcion;
    if (formEditar.es_comun !== m.es_comun) cuerpo.es_comun = formEditar.es_comun;

    if (Object.keys(cuerpo).length === 1) {
      setEditandoId("");
      return;
    }

    const ok = await ejecutar(
      m.id,
      "editar",
      "/api/admin/modulos/editar",
      cuerpo,
      t("admin_mod_ok_editar", "Cambios guardados."),
    );
    if (ok) setEditandoId("");
  };

  const alternarActivo = (m) =>
    ejecutar(
      m.id,
      "editar",
      "/api/admin/modulos/editar",
      { id: m.id, activo: !m.activo },
      m.activo
        ? t("admin_mod_ok_desactivar", "Módulo desactivado.")
        : t("admin_mod_ok_activar", "Módulo activado."),
    );

  const eliminar = async (m) => {
    const ok = await ejecutar(
      m.id,
      "eliminar",
      "/api/admin/modulos/eliminar",
      { id: m.id },
      t("admin_mod_ok_eliminar", "Módulo eliminado."),
    );
    if (ok) setConfirmandoId("");
  };

  // --- Presentación ---

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-jw-text-main">
          {t("admin_mod_titulo", "Módulos del sistema")}
        </h1>
        <p className="text-sm text-jw-text-main opacity-70 mt-1">
          {t(
            "admin_mod_subtitulo",
            "Un módulo nuevo solo aparece en el menú si ya existe su pantalla en el código.",
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

      {/* --- CREAR --- */}
      <section className="bg-jw-card border border-jw-border rounded-2xl p-5">
        <h2 className="text-base font-medium text-jw-text-main mb-4">
          {t("admin_mod_nuevo", "Nuevo módulo")}
        </h2>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2" noValidate>
          <label className="text-sm text-jw-text-main sm:col-span-2">
            {t("admin_mod_campo_nombre", "Nombre")}
            <input
              type="text"
              name="modulo_nombre"
              autoComplete="off"
              maxLength={100}
              value={formCrear.nombre}
              onChange={(e) =>
                setFormCrear({ ...formCrear, nombre: e.target.value })
              }
              className={`${CLASE_INPUT} mt-1`}
            />
            {formCrear.nombre.trim() && (
              <span className="block text-xs opacity-60 mt-1" dir="ltr">
                {t("admin_mod_id_auto", "Id interno (automático)")}:{" "}
                {generarId(formCrear.nombre.trim(), modulos)}
              </span>
            )}
          </label>
          <label className="text-sm text-jw-text-main sm:col-span-2">
            {t("admin_mod_campo_desc", "Descripción (opcional)")}
            <textarea
              name="modulo_descripcion"
              maxLength={500}
              rows={2}
              value={formCrear.descripcion}
              onChange={(e) =>
                setFormCrear({ ...formCrear, descripcion: e.target.value })
              }
              className={`${CLASE_INPUT} mt-1 resize-y`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-jw-text-main sm:col-span-2">
            <input
              type="checkbox"
              checked={formCrear.es_comun}
              onChange={(e) =>
                setFormCrear({ ...formCrear, es_comun: e.target.checked })
              }
              className="w-4 h-4 accent-jw-navy"
            />
            {t(
              "admin_mod_campo_comun",
              "Módulo común (lo ven todas las personas sin asignarlo)",
            )}
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={ocupado !== ""}
              className={CLASE_BTN_PRIMARIO}
            >
              {ocupado === "crear" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {t("admin_mod_crear", "Crear módulo")}
            </button>
          </div>
        </form>
      </section>

      {/* --- LISTA --- */}
      <section className="space-y-3">
        <h2 className="text-base font-medium text-jw-text-main">
          {t("admin_mod_lista", "Módulos registrados")}
        </h2>

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

        {!cargando && !errorLista && modulos.length === 0 && (
          <p className="text-sm text-jw-text-main opacity-70">
            {t(
              "admin_mod_vacio",
              "Todavía no hay módulos. Cree el primero con el formulario de arriba.",
            )}
          </p>
        )}

        {modulos.map((m) => {
          const enEdicion = editandoId === m.id;
          const enBorrado = confirmandoId === m.id;
          const enUso = m.asignaciones > 0 || m.anuncios > 0;
          const tienePantalla = Object.hasOwn(MODULOS_UI, m.id);
          const trabajando = ocupado === m.id;

          return (
            <article
              key={m.id}
              className={`bg-jw-card border border-jw-border rounded-2xl p-5 ${
                m.activo ? "" : "opacity-70"
              }`}
            >
              {enEdicion ? (
                <div className="space-y-3">
                  <p className="text-xs text-jw-text-main opacity-60" dir="ltr">
                    {m.id}
                  </p>
                  <label className="block text-sm text-jw-text-main">
                    {t("admin_mod_campo_nombre", "Nombre")}
                    <input
                      type="text"
                      maxLength={100}
                      value={formEditar.nombre}
                      onChange={(e) =>
                        setFormEditar({ ...formEditar, nombre: e.target.value })
                      }
                      className={`${CLASE_INPUT} mt-1`}
                    />
                  </label>
                  <label className="block text-sm text-jw-text-main">
                    {t("admin_mod_campo_desc", "Descripción (opcional)")}
                    <textarea
                      maxLength={500}
                      rows={2}
                      value={formEditar.descripcion}
                      onChange={(e) =>
                        setFormEditar({
                          ...formEditar,
                          descripcion: e.target.value,
                        })
                      }
                      className={`${CLASE_INPUT} mt-1 resize-y`}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-jw-text-main">
                    <input
                      type="checkbox"
                      checked={formEditar.es_comun}
                      onChange={(e) =>
                        setFormEditar({
                          ...formEditar,
                          es_comun: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-jw-navy"
                    />
                    {t("admin_mod_comun", "Módulo común")}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => guardarEdicion(m)}
                      disabled={ocupado !== ""}
                      className={CLASE_BTN_PRIMARIO}
                    >
                      {trabajando ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {t("admin_mod_guardar", "Guardar cambios")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoId("")}
                      disabled={ocupado !== ""}
                      className={CLASE_BTN_SUAVE}
                    >
                      <X className="w-4 h-4" />
                      {t("admin_mod_cancelar", "Cancelar")}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 text-start">
                      <h3 className="text-base font-medium text-jw-text-main">
                        {m.nombre}
                      </h3>
                      <p
                        className="text-xs text-jw-text-main opacity-60"
                        dir="ltr"
                      >
                        {m.id}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="border border-jw-border rounded-full px-2 py-0.5 text-jw-text-main">
                        {m.activo
                          ? t("admin_mod_activo", "Activo")
                          : t("admin_mod_inactivo", "Inactivo")}
                      </span>
                      {m.es_comun && (
                        <span className="border border-jw-border rounded-full px-2 py-0.5 text-jw-text-main">
                          {t("admin_mod_comun", "Módulo común")}
                        </span>
                      )}
                    </div>
                  </div>

                  {m.descripcion && (
                    <p className="text-sm text-jw-text-main opacity-80 mt-2 text-start">
                      {m.descripcion}
                    </p>
                  )}

                  <p className="text-xs text-jw-text-main opacity-70 mt-2">
                    {t("admin_mod_asignaciones", "Personas asignadas")}:{" "}
                    {m.asignaciones} · {t("admin_mod_anuncios", "Anuncios")}:{" "}
                    {m.anuncios}
                  </p>

                  {!tienePantalla && (
                    <p className="text-xs text-jw-text-main opacity-70 mt-1">
                      {t(
                        "admin_mod_sin_pantalla",
                        "Sin pantalla en el código: no aparece en el menú.",
                      )}
                    </p>
                  )}

                  {enBorrado ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-jw-text-main">
                        {t(
                          "admin_mod_confirmar",
                          "¿Eliminar este módulo definitivamente?",
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminar(m)}
                        disabled={ocupado !== ""}
                        className="inline-flex items-center gap-2 bg-red-600 text-white rounded-xl px-3 py-2 text-sm hover:bg-red-700 active:scale-95 transition disabled:opacity-50"
                      >
                        {trabajando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        {t("admin_mod_si_eliminar", "Sí, eliminar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoId("")}
                        disabled={ocupado !== ""}
                        className={CLASE_BTN_SUAVE}
                      >
                        {t("admin_mod_cancelar", "Cancelar")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => empezarEdicion(m)}
                        disabled={ocupado !== ""}
                        className={CLASE_BTN_SUAVE}
                      >
                        <Pencil className="w-4 h-4" />
                        {t("admin_mod_editar", "Editar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarActivo(m)}
                        disabled={ocupado !== ""}
                        className={CLASE_BTN_SUAVE}
                      >
                        {trabajando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Power className="w-4 h-4" />
                        )}
                        {m.activo
                          ? t("admin_mod_desactivar", "Desactivar")
                          : t("admin_mod_activar", "Activar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAviso(null);
                          setConfirmandoId(m.id);
                        }}
                        disabled={ocupado !== "" || enUso}
                        title={
                          enUso
                            ? t(
                                "admin_mod_no_eliminar",
                                "Tiene asignaciones o anuncios: desactívelo.",
                              )
                            : undefined
                        }
                        className={CLASE_BTN_SUAVE}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t("admin_mod_eliminar", "Eliminar")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}

export default AdminModulosPage;
