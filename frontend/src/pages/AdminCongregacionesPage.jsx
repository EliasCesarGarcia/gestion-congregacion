/**
 * ARCHIVO: AdminCongregacionesPage.jsx
 * UBICACIÓN: frontend/src/pages/AdminCongregacionesPage.jsx
 * DESCRIPCIÓN: Panel de congregaciones. Solo el superadmin las crea, edita,
 * habilita, deshabilita y elimina, y ve el historial de cambios.
 *
 * REGLAS (las hace cumplir el backend; esta pantalla solo las muestra):
 *  - Una congregación nueva nace deshabilitada.
 *  - Habilitarla exige coordinador, secretario y servicio en estado ALTA.
 *  - Todos los datos se pueden corregir (menos el id interno).
 *  - Eliminar de verdad solo se puede si está deshabilitada y no tiene datos
 *    asociados; hay que escribir su número para confirmar. Si tiene datos,
 *    solo se deshabilita.
 *  - No se repite el número dentro del mismo país.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. Las rutas
 * /api/admin/congregaciones/* devuelven 403 a quien no sea superadmin.
 */

import React, { useContext, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  Loader2,
  Pencil,
  Plus,
  Check,
  X,
  Trash2,
  Power,
  Search,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AppContext } from "../context/AppContext";

const POR_PAGINA = 10; // congregaciones por página
const POR_PAGINA_HIST = 20; // líneas del historial por página

// Campos editables. Los máximos son los mismos que valida el backend.
const CAMPOS = [
  { clave: "nombre", claveT: "cong_f_nombre", textoT: "Nombre", max: 100, obligatorio: true },
  { clave: "numero_congregacion", claveT: "cong_f_numero", textoT: "Número", max: 20, obligatorio: true },
  { clave: "pais", claveT: "cong_f_pais", textoT: "País", max: 100, obligatorio: true },
  { clave: "provincia_estado", claveT: "cong_f_provincia", textoT: "Provincia o estado", max: 100, obligatorio: true },
  { clave: "ciudad", claveT: "cong_f_ciudad", textoT: "Ciudad", max: 100, obligatorio: true },
  { clave: "partido", claveT: "cong_f_partido", textoT: "Partido", max: 100, obligatorio: false },
  { clave: "region", claveT: "cong_f_region", textoT: "Región", max: 100, obligatorio: false },
  { clave: "direccion", claveT: "cong_f_direccion", textoT: "Dirección", max: 200, obligatorio: false },
  { clave: "circuito", claveT: "cong_f_circuito", textoT: "Circuito", max: 20, obligatorio: false },
  { clave: "zona_horaria", claveT: "cong_f_zona", textoT: "Zona horaria", max: 64, obligatorio: true, lista: true },
];

const VACIO = Object.fromEntries(CAMPOS.map((c) => [c.clave, ""]));

// Sugerencias para la zona horaria (el backend valida igual).
const ZONAS = (() => {
  try {
    return typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  } catch {
    return [];
  }
})();

const FILTROS = [
  { id: "todas", clave: "cong_filtro_todas", texto: "Todas" },
  { id: "activas", clave: "cong_filtro_activas", texto: "Habilitadas" },
  { id: "deshabilitadas", clave: "cong_filtro_deshab", texto: "Deshabilitadas" },
];

const ACCIONES_HIST = {
  crear: ["cong_hist_crear", "Creada"],
  editar: ["cong_hist_editar", "Editada"],
  habilitar: ["cong_hist_habilitar", "Habilitada"],
  deshabilitar: ["cong_hist_deshabilitar", "Deshabilitada"],
  eliminar: ["cong_hist_eliminar", "Eliminada"],
};

// Estilos reutilizables (solo variables de tema, propiedades lógicas para RTL).
const CLASE_BTN_PRIMARIO =
  "inline-flex items-center justify-center gap-2 bg-jw-navy text-jw-text-light rounded-xl px-3 py-2 text-sm font-medium hover:opacity-90 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none";
const CLASE_BTN_SUAVE =
  "inline-flex items-center justify-center gap-2 border border-jw-border text-jw-text-main rounded-xl px-3 py-2 text-sm hover:bg-jw-accent/20 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none";
const CLASE_BTN_PELIGRO =
  "inline-flex items-center justify-center gap-2 border border-red-500/60 text-jw-text-main rounded-xl px-3 py-2 text-sm hover:bg-red-500/10 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none";
const CLASE_CAMPO =
  "w-full bg-jw-body text-jw-text-main border border-jw-border rounded-xl px-3 py-2 text-sm outline-none focus:border-jw-accent transition-colors";

// Recorta espacios de todos los campos.
const limpiar = (valores) =>
  Object.fromEntries(CAMPOS.map((c) => [c.clave, (valores[c.clave] || "").trim()]));

const obligatoriosCompletos = (datos) =>
  CAMPOS.filter((c) => c.obligatorio).every((c) => datos[c.clave] !== "");

// Formulario de datos, usado para crear y para editar.
function CamposCongregacion({ valores, alCambiar, prefijo, deshabilitado, t }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {CAMPOS.map((c) => (
        <div
          key={c.clave}
          className={c.clave === "direccion" ? "sm:col-span-2" : ""}
        >
          <label
            htmlFor={`${prefijo}-${c.clave}`}
            className="block text-xs text-jw-text-main opacity-70 mb-1"
          >
            {t(c.claveT, c.textoT)}
            {c.obligatorio ? " *" : ""}
          </label>
          <input
            id={`${prefijo}-${c.clave}`}
            type="text"
            maxLength={c.max}
            autoComplete="off"
            list={c.lista ? "cong-zonas" : undefined}
            value={valores[c.clave]}
            disabled={deshabilitado}
            onChange={(e) => alCambiar(c.clave, e.target.value)}
            className={CLASE_CAMPO}
          />
        </div>
      ))}
    </div>
  );
}

// Anterior / siguiente. Las flechas se invierten solas en idiomas RTL.
function Paginador({ pagina, total, porPagina, alCambiar, deshabilitado, t }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        type="button"
        disabled={deshabilitado || pagina <= 1}
        onClick={() => alCambiar(pagina - 1)}
        aria-label={t("cong_pag_anterior", "Página anterior")}
        className={CLASE_BTN_SUAVE}
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
      </button>
      <span className="text-sm text-jw-text-main opacity-70">
        {pagina} / {paginas}
      </span>
      <button
        type="button"
        disabled={deshabilitado || pagina >= paginas}
        onClick={() => alCambiar(pagina + 1)}
        aria-label={t("cong_pag_siguiente", "Página siguiente")}
        className={CLASE_BTN_SUAVE}
      >
        <ChevronRight className="w-4 h-4 rtl:rotate-180" />
      </button>
    </div>
  );
}

function AdminCongregacionesPage() {
  const { t, i18n } = useTranslation();
  const { permisos } = useContext(AppContext);
  const autorizado = permisos.es_superadmin;

  // --- Lista ---
  const [lista, setLista] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState(""); // lo que se escribe
  const [q, setQ] = useState(""); // lo que se busca (al enviar)
  const [estado, setEstado] = useState("todas");
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState("");
  const [version, setVersion] = useState(0);

  // --- Acciones ---
  const [aviso, setAviso] = useState(null); // { tipo: "ok" | "error", texto }
  const [ocupado, setOcupado] = useState(""); // acción en curso

  // --- Alta ---
  const [formAbierto, setFormAbierto] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);

  // --- Edición y confirmaciones (una a la vez) ---
  const [editando, setEditando] = useState(null); // id
  const [valoresEdit, setValoresEdit] = useState(VACIO);
  const [confirmando, setConfirmando] = useState(null); // { id, tipo }
  const [textoConfirm, setTextoConfirm] = useState("");

  // --- Historial (cerrado por defecto: se pide al abrirlo) ---
  const [histAbierto, setHistAbierto] = useState(false);
  const [hist, setHist] = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPagina, setHistPagina] = useState(1);
  const [histCargando, setHistCargando] = useState(false);
  const [histError, setHistError] = useState("");

  // Carga la página de congregaciones cuando se sabe que hay permiso y cada
  // vez que cambia el filtro, la página o `version`.
  useEffect(() => {
    if (!autorizado) return;
    let cancelado = false;

    axios
      .get("/api/admin/congregaciones", {
        params: { q, estado, page: pagina, limit: POR_PAGINA },
      })
      .then(({ data }) => {
        if (cancelado) return;
        const filas = Array.isArray(data.congregaciones)
          ? data.congregaciones
          : [];
        // Si se borró lo último de una página, se vuelve a la anterior.
        if (filas.length === 0 && pagina > 1) {
          setPagina((p) => p - 1);
          return;
        }
        setLista(filas);
        setTotal(Number(data.total) || 0);
        setErrorLista("");
        setCargando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setErrorLista(
          t(
            "cong_error_lista",
            "No se pudo cargar la lista de congregaciones. Actualice la página.",
          ),
        );
        setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [autorizado, q, estado, pagina, version, t]);

  // Carga el historial solo mientras está abierto.
  useEffect(() => {
    if (!autorizado || !histAbierto) return;
    let cancelado = false;

    axios
      .get("/api/admin/congregaciones/historial", {
        params: { page: histPagina, limit: POR_PAGINA_HIST },
      })
      .then(({ data }) => {
        if (cancelado) return;
        setHist(Array.isArray(data.historial) ? data.historial : []);
        setHistTotal(Number(data.total) || 0);
        setHistError("");
        setHistCargando(false);
      })
      .catch(() => {
        if (cancelado) return;
        setHistError(
          t(
            "cong_hist_error",
            "No se pudo cargar el historial. Intente de nuevo.",
          ),
        );
        setHistCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [autorizado, histAbierto, histPagina, version, t]);

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

  const mensajeError = (err, accion) => {
    const status = err.response?.status;
    if (!err.response) {
      return t("cong_err_red", "No se pudo conectar con el servidor.");
    }
    if (status === 401) {
      return t("cong_err_401", "Su sesión expiró. Vuelva a iniciar sesión.");
    }
    if (status === 403) {
      return t("cong_err_403", "No tiene permiso para esta acción.");
    }
    if (status === 404) {
      return t(
        "cong_err_404",
        "Esa congregación ya no existe. Se actualizó la lista.",
      );
    }
    if (status === 409) {
      if (accion === "estado") {
        return t(
          "cong_err_409_estado",
          "Para habilitarla faltan coordinador, secretario o servicio en estado ALTA.",
        );
      }
      if (accion === "eliminar") {
        return t(
          "cong_err_409_eliminar",
          "No se puede eliminar: tiene datos asociados. Solo se puede deshabilitar.",
        );
      }
      return t(
        "cong_err_409",
        "Ya existe una congregación con ese número en ese país.",
      );
    }
    if (status === 400) {
      if (accion === "eliminar") {
        return t(
          "cong_err_400_eliminar",
          "El número escrito no coincide con el de la congregación.",
        );
      }
      return t(
        "cong_err_400",
        "Datos no válidos. Revise los campos obligatorios y la zona horaria.",
      );
    }
    return t("cong_err_general", "Ocurrió un error. Intente de nuevo.");
  };

  // Ejecuta una acción con el mismo manejo de carga, aviso y errores.
  const ejecutar = async (clave, accion, peticion, textoOk, alExito) => {
    setOcupado(clave);
    setAviso(null);
    try {
      await peticion();
      setAviso({ tipo: "ok", texto: textoOk });
      if (alExito) alExito();
      refrescar();
    } catch (err) {
      setAviso({ tipo: "error", texto: mensajeError(err, accion) });
      if (err.response?.status === 404) {
        setEditando(null);
        setConfirmando(null);
        refrescar();
      }
    } finally {
      setOcupado("");
    }
  };

  const avisoDatosInvalidos = () =>
    setAviso({
      tipo: "error",
      texto: t(
        "cong_err_400",
        "Datos no válidos. Revise los campos obligatorios y la zona horaria.",
      ),
    });

  // --- Acciones ---

  const buscar = (e) => {
    e.preventDefault();
    setPagina(1);
    setQ(busqueda.trim());
  };

  const cambiarFiltro = (valor) => {
    setPagina(1);
    setEstado(valor);
  };

  const abrirHistorial = () => {
    if (!histAbierto) {
      setHistCargando(true);
      setHistPagina(1);
    }
    setHistAbierto((a) => !a);
  };

  const cambiarPaginaHist = (p) => {
    setHistCargando(true);
    setHistPagina(p);
  };

  const crear = (e) => {
    e.preventDefault();
    const datos = limpiar(nuevo);
    if (!obligatoriosCompletos(datos)) {
      avisoDatosInvalidos();
      return;
    }
    ejecutar(
      "crear",
      "crear",
      () => axios.post("/api/admin/congregaciones/crear", datos),
      t(
        "cong_ok_crear",
        "Congregación creada. Queda deshabilitada hasta que tenga coordinador, secretario y servicio.",
      ),
      () => {
        setNuevo(VACIO);
        setFormAbierto(false);
      },
    );
  };

  const empezarEdicion = (c) => {
    setAviso(null);
    setConfirmando(null);
    setEditando(c.id);
    setValoresEdit(
      Object.fromEntries(CAMPOS.map((f) => [f.clave, c[f.clave] || ""])),
    );
  };

  const guardarEdicion = (e, c) => {
    e.preventDefault();
    const datos = limpiar(valoresEdit);
    if (!obligatoriosCompletos(datos)) {
      avisoDatosInvalidos();
      return;
    }
    // Solo se envía lo que cambió (así el historial dice qué se tocó).
    const cambios = {};
    CAMPOS.forEach((f) => {
      if (datos[f.clave] !== (c[f.clave] || "")) cambios[f.clave] = datos[f.clave];
    });
    if (Object.keys(cambios).length === 0) {
      setEditando(null);
      setAviso({
        tipo: "ok",
        texto: t("cong_sin_cambios", "No hay cambios para guardar."),
      });
      return;
    }
    ejecutar(
      `editar|${c.id}`,
      "editar",
      () => axios.post("/api/admin/congregaciones/editar", { id: c.id, ...cambios }),
      t("cong_ok_editar", "Congregación guardada."),
      () => setEditando(null),
    );
  };

  const abrirConfirmacion = (c, tipo) => {
    setAviso(null);
    setEditando(null);
    setTextoConfirm("");
    setConfirmando({ id: c.id, tipo });
  };

  const cambiarEstado = (c, activa) =>
    ejecutar(
      `estado|${c.id}`,
      "estado",
      () => axios.post("/api/admin/congregaciones/estado", { id: c.id, activa }),
      activa
        ? t("cong_ok_habilitar", "Congregación habilitada.")
        : t("cong_ok_deshabilitar", "Congregación deshabilitada."),
      () => setConfirmando(null),
    );

  const eliminar = (c) =>
    ejecutar(
      `eliminar|${c.id}`,
      "eliminar",
      () =>
        axios.post("/api/admin/congregaciones/eliminar", {
          id: c.id,
          numero_confirmacion: textoConfirm.trim(),
        }),
      t("cong_ok_eliminar", "Congregación eliminada."),
      () => setConfirmando(null),
    );

  const fechaLegible = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(i18n.language);
  };

  // --- Presentación ---

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-jw-text-main">
          {t("cong_titulo", "Congregaciones")}
        </h1>
        <p className="text-sm text-jw-text-main opacity-70 mt-1">
          {t(
            "cong_subtitulo",
            "Alta, corrección, habilitación y baja de congregaciones. Una congregación nueva queda deshabilitada hasta que tenga coordinador, secretario y servicio. Si ya tiene datos, no se elimina: se deshabilita.",
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

      <datalist id="cong-zonas">
        {ZONAS.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>

      {/* --- BÚSQUEDA, FILTRO Y ALTA --- */}
      <section className="bg-jw-card border border-jw-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <form onSubmit={buscar} className="flex flex-1 min-w-0 gap-2">
            <input
              type="text"
              name="busqueda"
              maxLength={100}
              autoComplete="off"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={t("cong_buscar_ph", "Buscar por nombre, número o ciudad")}
              aria-label={t("cong_buscar_ph", "Buscar por nombre, número o ciudad")}
              className={`${CLASE_CAMPO} flex-1 min-w-0`}
            />
            <button type="submit" className={CLASE_BTN_SUAVE}>
              <Search className="w-4 h-4" />
              {t("cong_buscar", "Buscar")}
            </button>
          </form>

          <select
            value={estado}
            onChange={(e) => cambiarFiltro(e.target.value)}
            aria-label={t("cong_filtro", "Filtrar por estado")}
            className={`${CLASE_CAMPO} w-auto`}
          >
            {FILTROS.map((f) => (
              <option key={f.id} value={f.id}>
                {t(f.clave, f.texto)}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={ocupado !== ""}
            onClick={() => setFormAbierto((a) => !a)}
            className={CLASE_BTN_PRIMARIO}
          >
            <Plus className="w-4 h-4" />
            {t("cong_nueva", "Nueva congregación")}
          </button>
        </div>

        {formAbierto && (
          <form onSubmit={crear} className="space-y-3 border-t border-jw-border pt-4">
            <CamposCongregacion
              valores={nuevo}
              alCambiar={(clave, valor) =>
                setNuevo((n) => ({ ...n, [clave]: valor }))
              }
              prefijo="nueva"
              deshabilitado={ocupado !== ""}
              t={t}
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={ocupado !== ""}
                className={CLASE_BTN_PRIMARIO}
              >
                {ocupado === "crear" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("cong_crear", "Crear")
                )}
              </button>
              <button
                type="button"
                disabled={ocupado !== ""}
                onClick={() => {
                  setFormAbierto(false);
                  setNuevo(VACIO);
                }}
                className={CLASE_BTN_SUAVE}
              >
                {t("cong_cancelar", "Cancelar")}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* --- LISTA --- */}
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

      {!cargando && !errorLista && (
        <section className="space-y-3">
          {lista.length === 0 && (
            <p className="text-sm text-jw-text-main opacity-70">
              {t("cong_vacio", "No hay congregaciones que coincidan.")}
            </p>
          )}

          {lista.map((c) => {
            const enEdicion = editando === c.id;
            const confirmaAca = confirmando?.id === c.id ? confirmando.tipo : "";
            const completa =
              c.tiene_coordinador && c.tiene_secretario && c.tiene_servicio;
            const ubicacion = [c.ciudad, c.partido, c.provincia_estado, c.pais]
              .filter(Boolean)
              .join(", ");
            const roles = [
              [c.tiene_coordinador, "cong_rol_coordinador", "Coordinador"],
              [c.tiene_secretario, "cong_rol_secretario", "Secretario"],
              [c.tiene_servicio, "cong_rol_servicio", "Servicio"],
            ];

            return (
              <article
                key={c.id}
                className={`bg-jw-card border border-jw-border rounded-2xl p-5 space-y-3 ${
                  c.activa ? "" : "opacity-90"
                }`}
              >
                {enEdicion ? (
                  <form onSubmit={(e) => guardarEdicion(e, c)} className="space-y-3">
                    <CamposCongregacion
                      valores={valoresEdit}
                      alCambiar={(clave, valor) =>
                        setValoresEdit((v) => ({ ...v, [clave]: valor }))
                      }
                      prefijo={`edit-${c.id}`}
                      deshabilitado={ocupado !== ""}
                      t={t}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={ocupado !== ""}
                        className={CLASE_BTN_PRIMARIO}
                      >
                        {ocupado === `editar|${c.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t("cong_guardar", "Guardar")
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={ocupado !== ""}
                        onClick={() => setEditando(null)}
                        className={CLASE_BTN_SUAVE}
                      >
                        {t("cong_cancelar", "Cancelar")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-base font-medium text-jw-text-main">
                          {c.nombre}
                          {c.numero_congregacion ? ` · ${c.numero_congregacion}` : ""}
                        </h2>
                        <p className="text-sm text-jw-text-main opacity-70">
                          {ubicacion}
                        </p>
                      </div>
                      <span
                        className={`text-xs rounded-full border px-2 py-1 ${
                          c.activa
                            ? "border-green-600/40 bg-green-600/10 text-jw-text-main"
                            : "border-jw-border text-jw-text-main opacity-80"
                        }`}
                      >
                        {c.activa
                          ? t("cong_estado_activa", "Habilitada")
                          : t("cong_estado_deshab", "Deshabilitada")}
                      </span>
                    </div>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm text-jw-text-main">
                      {c.circuito && (
                        <div>
                          <dt className="inline opacity-60">
                            {t("cong_f_circuito", "Circuito")}:{" "}
                          </dt>
                          <dd className="inline">{c.circuito}</dd>
                        </div>
                      )}
                      {c.region && (
                        <div>
                          <dt className="inline opacity-60">
                            {t("cong_f_region", "Región")}:{" "}
                          </dt>
                          <dd className="inline">{c.region}</dd>
                        </div>
                      )}
                      {c.direccion && (
                        <div className="sm:col-span-2">
                          <dt className="inline opacity-60">
                            {t("cong_f_direccion", "Dirección")}:{" "}
                          </dt>
                          <dd className="inline">{c.direccion}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline opacity-60">
                          {t("cong_f_zona", "Zona horaria")}:{" "}
                        </dt>
                        <dd className="inline">{c.zona_horaria}</dd>
                      </div>
                      <div>
                        <dt className="inline opacity-60">
                          {t("cong_personas_lbl", "Personas en alta")}:{" "}
                        </dt>
                        <dd className="inline">{c.personas}</dd>
                      </div>
                    </dl>

                    <ul className="flex flex-wrap gap-2" aria-label={t("cong_encargados", "Encargados generales")}>
                      {roles.map(([tiene, clave, texto]) => (
                        <li
                          key={clave}
                          className={`inline-flex items-center gap-1 text-xs rounded-full border px-2 py-1 text-jw-text-main ${
                            tiene
                              ? "border-green-600/40 bg-green-600/10"
                              : "border-red-500/50 bg-red-500/10"
                          }`}
                        >
                          {tiene ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                          {t(clave, texto)}
                        </li>
                      ))}
                    </ul>

                    {!c.activa && !completa && (
                      <p className="text-xs text-jw-text-main opacity-70">
                        {t(
                          "cong_ayuda_habilitar",
                          "Para habilitarla hacen falta los tres encargados en estado ALTA.",
                        )}
                      </p>
                    )}

                    {confirmaAca === "" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={ocupado !== ""}
                          onClick={() => empezarEdicion(c)}
                          className={CLASE_BTN_SUAVE}
                        >
                          <Pencil className="w-4 h-4" />
                          {t("cong_editar", "Editar")}
                        </button>

                        {c.activa ? (
                          <button
                            type="button"
                            disabled={ocupado !== ""}
                            onClick={() => abrirConfirmacion(c, "deshabilitar")}
                            className={CLASE_BTN_SUAVE}
                          >
                            <Power className="w-4 h-4" />
                            {t("cong_deshabilitar", "Deshabilitar")}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={ocupado !== "" || !completa}
                              onClick={() => cambiarEstado(c, true)}
                              className={CLASE_BTN_SUAVE}
                            >
                              {ocupado === `estado|${c.id}` ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Power className="w-4 h-4" />
                                  {t("cong_habilitar", "Habilitar")}
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={ocupado !== ""}
                              onClick={() => abrirConfirmacion(c, "eliminar")}
                              className={CLASE_BTN_PELIGRO}
                            >
                              <Trash2 className="w-4 h-4" />
                              {t("cong_eliminar", "Eliminar")}
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {confirmaAca === "deshabilitar" && (
                      <div className="border border-jw-border rounded-xl p-3 space-y-2">
                        <p className="text-sm text-jw-text-main">
                          {t(
                            "cong_confirmar_deshab",
                            "Al deshabilitarla, las personas de esta congregación no podrán entrar al sistema hasta que se vuelva a habilitar. No se borra ningún dato.",
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={ocupado !== ""}
                            onClick={() => cambiarEstado(c, false)}
                            className={CLASE_BTN_PRIMARIO}
                          >
                            {ocupado === `estado|${c.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              t("cong_confirmar_si", "Sí, deshabilitar")
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={ocupado !== ""}
                            onClick={() => setConfirmando(null)}
                            className={CLASE_BTN_SUAVE}
                          >
                            {t("cong_cancelar", "Cancelar")}
                          </button>
                        </div>
                      </div>
                    )}

                    {confirmaAca === "eliminar" && (
                      <div className="border border-red-500/50 rounded-xl p-3 space-y-2">
                        <p className="text-sm text-jw-text-main">
                          {t(
                            "cong_confirmar_elim",
                            "Se elimina de verdad y no se puede deshacer. Solo es posible si no tiene datos asociados. Para confirmar, escriba su número:",
                          )}{" "}
                          <strong>{c.numero_congregacion}</strong>
                        </p>
                        <input
                          type="text"
                          autoComplete="off"
                          value={textoConfirm}
                          disabled={ocupado !== ""}
                          onChange={(e) => setTextoConfirm(e.target.value)}
                          aria-label={t("cong_confirmar_num", "Número de la congregación")}
                          className={CLASE_CAMPO}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={
                              ocupado !== "" ||
                              !c.numero_congregacion ||
                              textoConfirm.trim() !== c.numero_congregacion
                            }
                            onClick={() => eliminar(c)}
                            className={CLASE_BTN_PELIGRO}
                          >
                            {ocupado === `eliminar|${c.id}` ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                {t("cong_confirmar_elim_si", "Eliminar definitivamente")}
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={ocupado !== ""}
                            onClick={() => setConfirmando(null)}
                            className={CLASE_BTN_SUAVE}
                          >
                            {t("cong_cancelar", "Cancelar")}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}

          <Paginador
            pagina={pagina}
            total={total}
            porPagina={POR_PAGINA}
            alCambiar={setPagina}
            deshabilitado={ocupado !== ""}
            t={t}
          />
        </section>
      )}

      {/* --- HISTORIAL DE CAMBIOS --- */}
      <section className="bg-jw-card border border-jw-border rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-medium text-jw-text-main">
              {t("cong_hist_titulo", "Historial de cambios")}
            </h2>
            <p className="text-sm text-jw-text-main opacity-70">
              {t(
                "cong_hist_subtitulo",
                "Quién creó, corrigió, habilitó, deshabilitó o eliminó cada congregación.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={abrirHistorial}
            aria-expanded={histAbierto}
            className={CLASE_BTN_SUAVE}
          >
            <History className="w-4 h-4" />
            {histAbierto
              ? t("cong_hist_ocultar", "Ocultar historial")
              : t("cong_hist_ver", "Ver historial")}
          </button>
        </div>

        {histAbierto && (
          <>
            {histCargando && (
              <div className="flex justify-center py-6" role="status">
                <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
              </div>
            )}

            {histError && (
              <p className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-4 py-3">
                {histError}
              </p>
            )}

            {!histCargando && !histError && hist.length === 0 && (
              <p className="text-sm text-jw-text-main opacity-70">
                {t("cong_hist_vacio", "Todavía no hay cambios registrados.")}
              </p>
            )}

            {!histCargando && !histError && hist.length > 0 && (
              <ul className="space-y-2">
                {hist.map((h) => {
                  const [clave, texto] = ACCIONES_HIST[h.accion] || [
                    "cong_hist_otra",
                    h.accion,
                  ];
                  return (
                    <li
                      key={h.id}
                      className="border border-jw-border rounded-xl px-3 py-2"
                    >
                      <p className="text-sm text-jw-text-main">
                        <strong>{t(clave, texto)}</strong> · {h.congregacion_nombre}
                        {h.congregacion_numero ? ` · ${h.congregacion_numero}` : ""}
                      </p>
                      <p className="text-xs text-jw-text-main opacity-60">
                        {h.actor_nombre}
                        {fechaLegible(h.creado_en)
                          ? ` · ${fechaLegible(h.creado_en)}`
                          : ""}
                        {h.detalle ? ` · ${h.detalle}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            <Paginador
              pagina={histPagina}
              total={histTotal}
              porPagina={POR_PAGINA_HIST}
              alCambiar={cambiarPaginaHist}
              deshabilitado={histCargando}
              t={t}
            />
          </>
        )}
      </section>
    </div>
  );
}

export default AdminCongregacionesPage;
