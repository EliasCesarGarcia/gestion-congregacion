/**
 * ARCHIVO: MotivosCatalogoPage.jsx
 * UBICACIÓN: frontend/src/pages/MotivosCatalogoPage.jsx
 * DESCRIPCIÓN: Panel del catálogo único de motivos de personas y cargos.
 * Ruta: /admin/catalogo-motivos. SOLO la ve el superadmin.
 *
 * Un motivo existe una sola vez y dice en qué listas se ofrece (sus "usos"):
 * alta de persona, baja de persona, cambio de grupo, alta de cargo y baja de
 * cargo. Desde acá se puede:
 *  - activar o desactivar un uso (así un motivo deja de ofrecerse en una lista
 *    sin borrarlo ni tocar el historial);
 *  - cambiar el orden de un uso (no aplica a los usos de cargos, que salen
 *    siempre en orden alfabético);
 *  - renombrar un motivo (el historial anterior conserva su propia copia);
 *  - agregarle un uso que no tenía y crear un motivo nuevo.
 *
 * Backend (solo superadmin):
 *  - GET  /api/admin/catalogo-motivos        -> { motivos: [{ id, nombre, usos: [{ uso, activo, orden }] }] }
 *  - POST /api/admin/catalogo-motivos/crear  -> { nombre, usos: [{ uso, orden }] }
 *         (si el nombre ya existe, le suma los usos; si alguno ya estaba: 409)
 *  - POST /api/admin/catalogo-motivos/editar -> { id, nombre }
 *  - POST /api/admin/catalogo-motivos/uso    -> { motivo_id, uso, orden?, activo? }
 * Los errores llegan como texto plano.
 *
 * Diseño: todo el texto a la izquierda (solo los títulos van centrados); los
 * usos de cada motivo en columnas fijas (Uso, Estado, Orden, Acciones) para que
 * queden alineados; rótulos con dos puntos en negrita (LineaRotulada).
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. El backend devuelve
 * 403 a quien no sea superadmin.
 */

import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { ArrowUpDown, Eye, EyeOff, Loader2, Pencil, Plus } from "lucide-react";
import { AppContext } from "../context/AppContext";
import Boton from "../components/ui/Boton";
import Confirmacion from "../components/ui/Confirmacion";
import Etiqueta from "../components/ui/Etiqueta";
import LineaRotulada from "../components/ui/LineaRotulada";
import Tarjeta from "../components/ui/Tarjeta";
import TituloSeccion from "../components/ui/TituloSeccion";
import { CampoSelect, CampoTexto } from "../components/ui/Campo";
import { textoError } from "../lib/gruposApi";

const MAX_TEXTO = 100; // igual que el backend
const MAX_ORDEN = 9999; // igual que el backend

// Usos que existen hoy (los mismos que acepta el backend). `cargo` = el uso
// sale siempre en orden alfabético y su número de orden no se usa.
const USOS = [
  { id: "personas.alta", clave: "mc_uso_alta", texto: "Alta de persona", cargo: false },
  { id: "personas.baja", clave: "mc_uso_baja", texto: "Baja de persona", cargo: false },
  { id: "personas.grupo", clave: "mc_uso_grupo", texto: "Cambio de grupo", cargo: false },
  { id: "personas.cargo_alta", clave: "mc_uso_cargo_alta", texto: "Alta de cargo", cargo: true },
  { id: "personas.cargo_baja", clave: "mc_uso_cargo_baja", texto: "Baja de cargo", cargo: true },
];

// Columnas de los usos: Uso, Estado, Orden y Acciones. La última es fija para
// que las columnas de todas las filas queden alineadas entre sí.
const COLUMNAS_MD = "md:grid-cols-[minmax(0,1fr)_6rem_5rem_16rem]";

const sinTildes = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const posicionUso = (uso) => {
  const i = USOS.findIndex((u) => u.id === uso);
  return i === -1 ? USOS.length : i;
};

// Una fila de uso: Uso | Estado | Orden | Acciones.
function FilaUso({ uso, ocupado, onActivo, onOrden }) {
  const { t } = useTranslation();
  const def = USOS.find((u) => u.id === uso.uso);
  const nombreUso = def ? t(def.clave, def.texto) : uso.uso;
  const esCargo = !!def?.cargo;
  const textoOrden = esCargo ? "—" : String(uso.orden);

  return (
    <li
      className={`grid grid-cols-1 ${COLUMNAS_MD} gap-x-4 gap-y-2 items-center rounded-xl border border-jw-border bg-jw-body px-3 py-2`}
    >
      <p className="text-sm font-medium text-jw-text-main break-words">
        {nombreUso}
      </p>

      <div>
        <Etiqueta tono={uso.activo ? "ok" : "neutro"}>
          {uso.activo
            ? t("mc_estado_activo", "Activo")
            : t("mc_estado_inactivo", "Inactivo")}
        </Etiqueta>
      </div>

      <p className="text-sm text-jw-text-main">
        <span className="md:hidden">
          <LineaRotulada rotulo={t("mc_orden", "Orden")}>
            {textoOrden}
          </LineaRotulada>
        </span>
        <span className="hidden md:inline tabular-nums">{textoOrden}</span>
      </p>

      <div className="flex flex-wrap gap-2">
        <Boton
          variante="suave"
          icono={uso.activo ? EyeOff : Eye}
          disabled={ocupado}
          onClick={onActivo}
        >
          {uso.activo
            ? t("mc_desactivar", "Desactivar")
            : t("mc_activar", "Activar")}
        </Boton>
        {!esCargo && (
          <Boton
            variante="suave"
            icono={ArrowUpDown}
            disabled={ocupado}
            onClick={onOrden}
          >
            {t("mc_orden", "Orden")}
          </Boton>
        )}
      </div>
    </li>
  );
}

// Tarjeta de un motivo: nombre, sus usos en columnas y las acciones del motivo.
function TarjetaMotivo({
  motivo,
  filas,
  faltantes,
  mostrarAcciones,
  ocupado,
  onRenombrar,
  onAgregarUso,
  onActivo,
  onOrden,
}) {
  const { t } = useTranslation();

  return (
    <Tarjeta className="flex flex-col gap-4">
      <TituloSeccion>{motivo.nombre}</TituloSeccion>

      {filas.length === 0 ? (
        <p className="text-sm text-jw-text-main opacity-70">
          {t(
            "mc_sin_usos",
            "Este motivo todavía no se ofrece en ninguna lista.",
          )}
        </p>
      ) : (
        <div className="space-y-2">
          <div
            className={`hidden md:grid ${COLUMNAS_MD} gap-x-4 px-3 text-xs font-semibold text-jw-text-main`}
          >
            <span>{t("mc_col_uso", "Uso")}</span>
            <span>{t("mc_col_estado", "Estado")}</span>
            <span>{t("mc_orden", "Orden")}</span>
            <span>{t("mc_col_acciones", "Acciones")}</span>
          </div>
          <ul className="space-y-2">
            {filas.map((u) => (
              <FilaUso
                key={u.uso}
                uso={u}
                ocupado={ocupado}
                onActivo={() => onActivo(motivo, u)}
                onOrden={() => onOrden(motivo, u)}
              />
            ))}
          </ul>
        </div>
      )}

      {mostrarAcciones && (
        <div className="flex flex-wrap gap-2">
          <Boton
            variante="suave"
            icono={Pencil}
            disabled={ocupado}
            onClick={() => onRenombrar(motivo)}
          >
            {t("mc_renombrar", "Renombrar")}
          </Boton>
          {faltantes.length > 0 && (
            <Boton
              variante="suave"
              icono={Plus}
              disabled={ocupado}
              onClick={() => onAgregarUso(motivo)}
            >
              {t("mc_agregar_uso", "Agregar uso")}
            </Boton>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

function MotivosCatalogoPage() {
  const { t } = useTranslation();
  const { permisos } = useContext(AppContext);
  const autorizado = permisos.cargado && !!permisos.es_superadmin;

  // --- Catálogo. `recarga` vuelve a pedirlo después de cada cambio; mientras
  // se vuelve a pedir se sigue viendo la lista anterior. ---
  const [datos, setDatos] = useState({ data: null, error: "" });
  const [recarga, setRecarga] = useState(0);
  const [aviso, setAviso] = useState("");

  // --- Filtros ---
  const [busqueda, setBusqueda] = useState("");
  const [filtroUso, setFiltroUso] = useState("");

  // --- Ventana de confirmación: { tipo, motivo, uso } o null. Tipos: "activo",
  // "orden", "renombrar", "agregar-uso" y "nuevo". ---
  const [dialogo, setDialogo] = useState(null);
  const [texto, setTexto] = useState("");
  const [orden, setOrden] = useState("");
  const [usoElegido, setUsoElegido] = useState("");
  const [usosNuevo, setUsosNuevo] = useState([]);
  const [errorCampo, setErrorCampo] = useState("");
  const [errorDlg, setErrorDlg] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!autorizado) return;
    const control = new AbortController();
    axios
      .get("/api/admin/catalogo-motivos", { signal: control.signal })
      .then(({ data }) => {
        setDatos({
          data: Array.isArray(data.motivos) ? data.motivos : [],
          error: "",
        });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setDatos((d) => ({
          ...d,
          error: textoError(
            err,
            t("mc_error_lista", "No se pudo cargar el catálogo de motivos."),
          ),
        }));
      });
    return () => control.abort();
  }, [autorizado, recarga, t]);

  if (!permisos.cargado) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Loader2 className="w-6 h-6 animate-spin text-jw-accent" />
      </div>
    );
  }
  if (!autorizado) {
    return <Navigate to="/" replace />;
  }

  const motivos = datos.data || [];
  const cargando = datos.data === null && !datos.error;

  const nombreUso = (id) => {
    const def = USOS.find((u) => u.id === id);
    return def ? t(def.clave, def.texto) : id;
  };

  // Usos conocidos que el motivo todavía no tiene.
  const faltantes = (m) =>
    USOS.filter((u) => !m.usos.some((x) => x.uso === u.id));

  // Orden de un motivo nuevo en un uso: uno más que el mayor de esa lista
  // (los usos de cargos no usan el número de orden).
  const ordenSiguiente = (idUso) => {
    const def = USOS.find((u) => u.id === idUso);
    if (!def || def.cargo) return 0;
    const ordenes = motivos
      .flatMap((m) => m.usos)
      .filter((u) => u.uso === idUso)
      .map((u) => u.orden);
    if (ordenes.length === 0) return 1;
    return Math.min(MAX_ORDEN, Math.max(...ordenes) + 1);
  };

  // --- Lista visible: por nombre y por uso. Con un uso elegido, cada motivo
  // muestra solo la fila de ese uso. ---
  const q = sinTildes(busqueda);
  const visibles = motivos
    .filter(
      (m) =>
        (!q || sinTildes(m.nombre).includes(q)) &&
        (!filtroUso || m.usos.some((u) => u.uso === filtroUso)),
    )
    .map((m) => ({
      motivo: m,
      filas: m.usos
        .filter((u) => !filtroUso || u.uso === filtroUso)
        .slice()
        .sort((a, b) => posicionUso(a.uso) - posicionUso(b.uso)),
    }));

  // --- Abrir y cerrar la ventana ---
  const abrir = (tipo, motivo = null, uso = null) => {
    setAviso("");
    setErrorCampo("");
    setErrorDlg("");
    setTexto(tipo === "renombrar" && motivo ? motivo.nombre : "");
    setOrden(tipo === "orden" && uso ? String(uso.orden) : "");
    setUsoElegido(
      tipo === "agregar-uso" && motivo ? faltantes(motivo)[0]?.id || "" : "",
    );
    setUsosNuevo([]);
    setDialogo({ tipo, motivo, uso });
  };

  const cerrar = () => {
    if (!enviando) setDialogo(null);
  };

  const alternarUsoNuevo = (id) => {
    setErrorDlg("");
    setUsosNuevo((lista) =>
      lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id],
    );
  };

  // --- Guardar: valida en pantalla y manda al backend (que vuelve a validar) ---
  const aceptar = async () => {
    if (!dialogo) return;
    const { tipo, motivo, uso } = dialogo;
    setErrorCampo("");
    setErrorDlg("");

    let url = "";
    let cuerpo = {};
    let ok = "";

    if (tipo === "renombrar" || tipo === "nuevo") {
      const nombre = texto.trim();
      if (!nombre) {
        setErrorCampo(t("mc_err_nombre", "Escriba el nombre del motivo."));
        return;
      }
      if (tipo === "renombrar") {
        url = "/api/admin/catalogo-motivos/editar";
        cuerpo = { id: motivo.id, nombre };
        ok = t("mc_ok_renombrar", "Motivo renombrado.");
      } else {
        if (usosNuevo.length === 0) {
          setErrorDlg(
            t("mc_err_usos", "Elija al menos una lista donde se ofrecerá."),
          );
          return;
        }
        url = "/api/admin/catalogo-motivos/crear";
        cuerpo = {
          nombre,
          usos: usosNuevo.map((id) => ({ uso: id, orden: ordenSiguiente(id) })),
        };
        ok = t("mc_ok_crear", "Motivo guardado.");
      }
    } else if (tipo === "orden") {
      const numero = Number.parseInt(orden, 10);
      if (!/^\d+$/.test(orden.trim()) || numero < 0 || numero > MAX_ORDEN) {
        setErrorCampo(
          t("mc_err_orden", "El orden es un número entero de 0 a 9999."),
        );
        return;
      }
      url = "/api/admin/catalogo-motivos/uso";
      cuerpo = { motivo_id: motivo.id, uso: uso.uso, orden: numero };
      ok = t("mc_ok_orden", "Orden guardado.");
    } else if (tipo === "agregar-uso") {
      if (!usoElegido) {
        setErrorCampo(t("mc_err_uso", "Elija la lista donde se ofrecerá."));
        return;
      }
      url = "/api/admin/catalogo-motivos/uso";
      cuerpo = {
        motivo_id: motivo.id,
        uso: usoElegido,
        orden: ordenSiguiente(usoElegido),
      };
      ok = t("mc_ok_agregar_uso", "Uso agregado.");
    } else if (tipo === "activo") {
      url = "/api/admin/catalogo-motivos/uso";
      cuerpo = { motivo_id: motivo.id, uso: uso.uso, activo: !uso.activo };
      ok = uso.activo
        ? t("mc_ok_desactivado", "Uso desactivado.")
        : t("mc_ok_activado", "Uso activado.");
    } else {
      return;
    }

    setEnviando(true);
    try {
      await axios.post(url, cuerpo);
      setDialogo(null);
      setAviso(ok);
      setRecarga((r) => r + 1);
    } catch (err) {
      setErrorDlg(
        textoError(
          err,
          t("mc_err_general", "No se pudo guardar. Intente de nuevo."),
        ),
      );
    } finally {
      setEnviando(false);
    }
  };

  // --- Contenido de la ventana según el tipo ---
  const lineasMotivo = (m, u) => (
    <div className="space-y-1 text-sm text-jw-text-main">
      <p className="break-words">
        <LineaRotulada rotulo={t("mc_rotulo_motivo", "Motivo")}>
          {m.nombre}
        </LineaRotulada>
      </p>
      {u && (
        <p className="break-words">
          <LineaRotulada rotulo={t("mc_rotulo_uso", "Uso")}>
            {nombreUso(u.uso)}
          </LineaRotulada>
        </p>
      )}
    </div>
  );

  let titulo = "";
  let mensaje = "";
  let textoAceptar = "";
  let cuerpoDialogo = null;
  if (dialogo) {
    const { tipo, motivo, uso } = dialogo;
    if (tipo === "activo") {
      titulo = uso.activo
        ? t("mc_dlg_desactivar", "¿Desactivar este uso?")
        : t("mc_dlg_activar", "¿Activar este uso?");
      mensaje = uso.activo
        ? t(
            "mc_dlg_desactivar_msg",
            "El motivo deja de ofrecerse en esa lista. El historial conserva el texto con que se usó.",
          )
        : t(
            "mc_dlg_activar_msg",
            "El motivo vuelve a ofrecerse en esa lista.",
          );
      textoAceptar = uso.activo
        ? t("mc_desactivar", "Desactivar")
        : t("mc_activar", "Activar");
      cuerpoDialogo = lineasMotivo(motivo, uso);
    } else if (tipo === "orden") {
      titulo = t("mc_dlg_orden", "Cambiar el orden");
      mensaje = t(
        "mc_dlg_orden_msg",
        "En la lista aparece primero el número más chico.",
      );
      textoAceptar = t("mc_guardar", "Guardar");
      cuerpoDialogo = (
        <div className="space-y-4">
          {lineasMotivo(motivo, uso)}
          <CampoTexto
            id="mc-orden"
            label={t("mc_orden", "Orden")}
            obligatorio
            type="number"
            min={0}
            max={MAX_ORDEN}
            placeholder="1"
            value={orden}
            disabled={enviando}
            error={errorCampo}
            ayuda={t("mc_ayuda_orden", "Número entero de 0 a 9999.")}
            onChange={(e) => {
              setErrorCampo("");
              setOrden(e.target.value);
            }}
          />
        </div>
      );
    } else if (tipo === "renombrar") {
      titulo = t("mc_dlg_renombrar", "Renombrar el motivo");
      mensaje = t(
        "mc_dlg_renombrar_msg",
        "El cambio no modifica el historial anterior: cada registro guarda su propia copia del texto.",
      );
      textoAceptar = t("mc_guardar", "Guardar");
      cuerpoDialogo = (
        <div className="space-y-4">
          <p className="text-sm text-jw-text-main break-words">
            <LineaRotulada rotulo={t("mc_rotulo_actual", "Nombre actual")}>
              {motivo.nombre}
            </LineaRotulada>
          </p>
          <CampoTexto
            id="mc-nombre"
            label={t("mc_nombre_nuevo", "Nombre nuevo")}
            obligatorio
            maxLength={MAX_TEXTO}
            autoComplete="off"
            placeholder={t("mc_ph_nombre", "Ej.: Mudanza")}
            value={texto}
            disabled={enviando}
            error={errorCampo}
            ayuda={t(
              "mc_ayuda_nombre",
              "Obligatorio, hasta 100 caracteres y sin repetir otro motivo.",
            )}
            onChange={(e) => {
              setErrorCampo("");
              setTexto(e.target.value);
            }}
          />
        </div>
      );
    } else if (tipo === "agregar-uso") {
      titulo = t("mc_dlg_agregar_uso", "Agregar un uso");
      mensaje = t(
        "mc_dlg_agregar_uso_msg",
        "El motivo se ofrecerá, activo, en la lista que elija.",
      );
      textoAceptar = t("mc_guardar", "Guardar");
      cuerpoDialogo = (
        <div className="space-y-4">
          {lineasMotivo(motivo, null)}
          <CampoSelect
            id="mc-uso"
            label={t("mc_rotulo_uso", "Uso")}
            obligatorio
            value={usoElegido}
            disabled={enviando}
            error={errorCampo}
            onChange={(e) => {
              setErrorCampo("");
              setUsoElegido(e.target.value);
            }}
          >
            {faltantes(motivo).map((u) => (
              <option key={u.id} value={u.id}>
                {t(u.clave, u.texto)}
              </option>
            ))}
          </CampoSelect>
        </div>
      );
    } else if (tipo === "nuevo") {
      titulo = t("mc_dlg_nuevo", "Nuevo motivo");
      mensaje = t(
        "mc_dlg_nuevo_msg",
        "Si el nombre ya existe, se le suman las listas elegidas.",
      );
      textoAceptar = t("mc_guardar", "Guardar");
      cuerpoDialogo = (
        <div className="space-y-4">
          <CampoTexto
            id="mc-nombre"
            label={t("mc_nombre", "Nombre")}
            obligatorio
            maxLength={MAX_TEXTO}
            autoComplete="off"
            placeholder={t("mc_ph_nombre", "Ej.: Mudanza")}
            value={texto}
            disabled={enviando}
            error={errorCampo}
            ayuda={t(
              "mc_ayuda_nombre",
              "Obligatorio, hasta 100 caracteres y sin repetir otro motivo.",
            )}
            onChange={(e) => {
              setErrorCampo("");
              setTexto(e.target.value);
            }}
          />
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-jw-text-main mb-1">
              {t("mc_se_ofrece_en", "Se ofrece en")}
              <span className="text-red-500" aria-hidden="true">
                {" "}
                *
              </span>
            </legend>
            {USOS.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 text-sm text-jw-text-main"
              >
                <input
                  type="checkbox"
                  checked={usosNuevo.includes(u.id)}
                  disabled={enviando}
                  onChange={() => alternarUsoNuevo(u.id)}
                />
                {t(u.clave, u.texto)}
              </label>
            ))}
          </fieldset>
        </div>
      );
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-start">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-jw-text-main">
            {t("mc_titulo", "Motivos de personas y cargos")}
          </h1>
          <p className="text-sm text-jw-text-main opacity-70 mt-1">
            {t(
              "mc_subtitulo",
              "Cada motivo existe una sola vez y se ofrece en las listas donde esté activo. Desactivar un uso lo saca de esa lista; el historial conserva el texto con que se usó.",
            )}
          </p>
        </div>
        <Boton icono={Plus} onClick={() => abrir("nuevo")}>
          {t("mc_nuevo", "Nuevo motivo")}
        </Boton>
      </div>

      {aviso && (
        <div className="sticky top-20 z-20 bg-jw-card rounded-xl">
          <p
            role="status"
            className="text-sm text-jw-text-main border border-green-600/40 bg-green-600/10 rounded-xl px-3 py-2"
          >
            {aviso}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CampoTexto
          id="mc-buscar"
          label={t("mc_buscar", "Buscar por nombre")}
          type="search"
          autoComplete="off"
          placeholder={t("mc_ph_buscar", "Ej.: Reemplazo")}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <CampoSelect
          id="mc-filtro-uso"
          label={t("mc_filtrar_uso", "Mostrar solo un uso")}
          value={filtroUso}
          onChange={(e) => setFiltroUso(e.target.value)}
          ayuda={t(
            "mc_ayuda_filtro",
            "Con un uso elegido se ve solo la fila de ese uso en cada motivo.",
          )}
        >
          <option value="">{t("mc_todos_usos", "Todos los usos")}</option>
          {USOS.map((u) => (
            <option key={u.id} value={u.id}>
              {t(u.clave, u.texto)}
            </option>
          ))}
        </CampoSelect>
      </div>

      <p className="text-xs text-jw-text-main opacity-70">
        {t(
          "mc_nota_cargos",
          "En los usos de cargos la lista sale siempre en orden alfabético, por eso no tienen número de orden.",
        )}
      </p>

      {cargando && (
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
        </div>
      )}

      {datos.error && (
        <p
          role="alert"
          className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2 break-words"
        >
          {datos.error}
        </p>
      )}

      {datos.data && (
        <>
          <p className="text-sm text-jw-text-main opacity-70" role="status">
            {t("mc_cantidad", {
              count: visibles.length,
              defaultValue_one: "{{count}} motivo",
              defaultValue_other: "{{count}} motivos",
            })}
          </p>

          {visibles.length === 0 && (
            <p className="text-sm text-jw-text-main opacity-70">
              {t("mc_sin_resultados", "No hay motivos que coincidan.")}
            </p>
          )}

          <div className="space-y-4">
            {visibles.map(({ motivo, filas }) => (
              <TarjetaMotivo
                key={motivo.id}
                motivo={motivo}
                filas={filas}
                faltantes={faltantes(motivo)}
                mostrarAcciones
                ocupado={enviando}
                onRenombrar={(m) => abrir("renombrar", m)}
                onAgregarUso={(m) => abrir("agregar-uso", m)}
                onActivo={(m, u) => abrir("activo", m, u)}
                onOrden={(m, u) => abrir("orden", m, u)}
              />
            ))}
          </div>
        </>
      )}

      <Confirmacion
        abierto={!!dialogo}
        titulo={titulo}
        mensaje={mensaje}
        textoAceptar={textoAceptar}
        ancho="max-w-lg"
        cargando={enviando}
        error={errorDlg}
        onAceptar={aceptar}
        onCancelar={cerrar}
      >
        {cuerpoDialogo}
      </Confirmacion>
    </div>
  );
}

export default MotivosCatalogoPage;
