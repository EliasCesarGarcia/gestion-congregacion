/**
 * ARCHIVO: GruposPage.jsx
 * UBICACIÓN: frontend/src/pages/GruposPage.jsx
 * DESCRIPCIÓN: Grupos de la congregación (paso G1): ver cada grupo con sus
 * miembros y encargados, crear, renumerar y cerrar. Ruta: /personas/grupos.
 * La usan coordinador, secretario, servicio (de su congregación) y superadmin
 * (que elige la congregación; arranca en la que llega por ?congregacion= o
 * en la suya).
 *
 * REGLAS (las hace cumplir el backend; acá solo se avisa antes):
 *  - El número es único entre los grupos activos de la congregación; el de un
 *    grupo cerrado queda libre.
 *  - Un grupo nunca se borra: se cierra, con fecha, y solo si no tiene
 *    personas ni encargados vigentes.
 *  - Renumerar no cambia el historial: cada movimiento guarda el número de
 *    su momento.
 * Mover personas y elegir encargados son los pasos G2 y G3.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla; el backend decide.
 */

import { useContext, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { ArrowLeft, Loader2, Plus, Users } from "lucide-react";
import { AppContext } from "../context/AppContext";
import IntegrantesGrupo from "../components/personas/IntegrantesGrupo";
import Boton from "../components/ui/Boton";
import Tarjeta from "../components/ui/Tarjeta";
import Etiqueta from "../components/ui/Etiqueta";
import Confirmacion from "../components/ui/Confirmacion";
import { CampoSelect, CampoTexto } from "../components/ui/Campo";
import { fechaCorta, hoyISO } from "../lib/fechas";

const detalleDe = (err) =>
  typeof err.response?.data === "string" ? err.response.data.trim() : "";

const soloFecha = (texto) => (texto ? String(texto).slice(0, 10) : "");

// Estado inicial (cerrado) del diálogo de crear, renumerar y cerrar.
const DIALOGO_CERRADO = {
  tipo: "", // "crear" | "renumerar" | "cerrar"
  grupo: null,
  numero: "",
  fecha: "",
  errNumero: "",
  errFecha: "",
  enviando: false,
  error: "",
};

// Una fila "etiqueta ........ valor" dentro de una tarjeta de grupo.
function Fila({ etiqueta, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-jw-text-main opacity-60 shrink-0">
        {etiqueta}
      </dt>
      <dd className="text-sm font-medium text-jw-text-main text-end min-w-0 break-words">
        {children}
      </dd>
    </div>
  );
}

// Superintendente o auxiliar: enlace a la ficha, o "Sin asignar".
function Encargado({ persona }) {
  const { t } = useTranslation();
  if (!persona) {
    return (
      <span className="font-normal opacity-60">
        {t("per_sin_asignar", "Sin asignar")}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <Link to={`/personas/${persona.persona_id}`} className="hover:underline">
        {persona.apellido} {persona.nombre}
      </Link>
      {persona.excepcion && (
        <Etiqueta tono="aviso">{t("per_excepcion", "Excepción")}</Etiqueta>
      )}
    </span>
  );
}

function GruposPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const { permisos, user } = useContext(AppContext);
  const esSuper = !!permisos.es_superadmin;
  const autorizado =
    permisos.cargado && (esSuper || permisos.es_encargado_general);

  // --- Congregación (solo la elige el superadmin) ---
  const [congregaciones, setCongregaciones] = useState([]);
  const [errorCong, setErrorCong] = useState(false);
  const [congregacionId, setCongregacionId] = useState(
    params.get("congregacion") || user?.congregacion_id || "",
  );
  // El superadmin necesita una congregación concreta antes de pedir datos.
  const listo = autorizado && (!esSuper || congregacionId !== "");

  useEffect(() => {
    if (!autorizado || !esSuper) return;
    const control = new AbortController();
    axios
      .get("/api/admin/congregaciones", {
        params: { q: "", estado: "todas", page: 1, limit: 100 },
        signal: control.signal,
      })
      .then(({ data }) => {
        const filas = Array.isArray(data.congregaciones)
          ? data.congregaciones
          : [];
        setCongregaciones(filas);
        setCongregacionId((actual) => actual || filas[0]?.id || "");
        setErrorCong(false);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setErrorCong(true);
      });
    return () => control.abort();
  }, [autorizado, esSuper]);

  // --- Lista de grupos ---
  // `clave` dice a qué pedido pertenece lo mostrado (si no coincide, carga).
  const [verCerrados, setVerCerrados] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState({
    clave: "",
    grupos: [],
    sinGrupo: 0,
    error: "",
  });
  const clave = JSON.stringify([congregacionId, verCerrados, recarga]);
  const cargando = resultado.clave !== clave;

  useEffect(() => {
    if (!listo) return;
    const control = new AbortController();
    const pedido = {};
    // El superadmin siempre manda la congregación (vacío = todas).
    if (esSuper) pedido.congregacion_id = congregacionId;
    if (verCerrados) pedido.cerrados = 1;
    axios
      .get("/api/personas/grupos", { params: pedido, signal: control.signal })
      .then(({ data }) => {
        setResultado({
          clave,
          grupos: Array.isArray(data.grupos) ? data.grupos : [],
          sinGrupo: data.sin_grupo || 0,
          error: "",
        });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setResultado({
          clave,
          grupos: [],
          sinGrupo: 0,
          error:
            detalleDe(err) ||
            t("per_error_grupos_lista", "No se pudieron cargar los grupos."),
        });
      });
    return () => control.abort();
    // `clave` ya resume congregacionId, verCerrados y recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, clave]);

  // --- Diálogo (crear, renumerar, cerrar) y mensaje de resultado ---
  const [dialogo, setDialogo] = useState(DIALOGO_CERRADO);
  const [mensaje, setMensaje] = useState("");
  const [verGrupo, setVerGrupo] = useState(null);

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

  // Activos primero (por número); después los cerrados, el último cerrado arriba.
  const grupos = [...resultado.grupos].sort((a, b) => {
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    if (a.activo) return a.numero - b.numero;
    return (
      soloFecha(b.fecha_cierre).localeCompare(soloFecha(a.fecha_cierre)) ||
      b.numero - a.numero
    );
  });
  const activos = grupos.filter((g) => g.activo);
  const sinFecha = t("per_sin_fecha", "sin fecha");

  const cambiarCongregacion = (id) => {
    setCongregacionId(id);
    setMensaje("");
  };

  // --- Abrir el diálogo ---
  const abrirCrear = () => {
    const siguiente = activos.reduce((m, g) => Math.max(m, g.numero), 0) + 1;
    setMensaje("");
    setDialogo({
      ...DIALOGO_CERRADO,
      tipo: "crear",
      numero: String(siguiente),
      fecha: hoyISO(),
    });
  };
  const abrirRenumerar = (g) => {
    setMensaje("");
    setDialogo({
      ...DIALOGO_CERRADO,
      tipo: "renumerar",
      grupo: g,
      numero: String(g.numero),
    });
  };
  const abrirCerrar = (g) => {
    setMensaje("");
    setDialogo({
      ...DIALOGO_CERRADO,
      tipo: "cerrar",
      grupo: g,
      fecha: hoyISO(),
    });
  };
  const cancelar = () => setDialogo(DIALOGO_CERRADO);

  const cambiarDialogo = (parcial) =>
    setDialogo((d) => ({ ...d, ...parcial, error: "" }));

  // --- Validación en pantalla (el backend vuelve a validar) ---
  const validarNumero = (texto, idPropio) => {
    if (!/^\d{1,4}$/.test(texto) || Number(texto) < 1) {
      return t(
        "per_err_grupo_numero",
        "Escriba un número de grupo entre 1 y 9999.",
      );
    }
    const repetido = activos.some(
      (g) => g.numero === Number(texto) && g.id !== idPropio,
    );
    if (repetido) {
      return t(
        "per_err_grupo_repetido",
        "Ya hay un grupo activo con ese número.",
      );
    }
    return "";
  };

  const validarFecha = (d) => {
    if (!d.fecha) {
      return d.tipo === "cerrar" ? t("per_err_fecha", "Falta la fecha.") : "";
    }
    if (d.fecha > hoyISO()) {
      return t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
    }
    const inicio = soloFecha(d.grupo?.fecha_inicio);
    if (d.tipo === "cerrar" && inicio && d.fecha < inicio) {
      return t(
        "per_err_cierre_antes_inicio",
        "La fecha no puede ser anterior al inicio del grupo.",
      );
    }
    return "";
  };

  // --- Guardar ---
  const aceptar = async () => {
    const d = dialogo;
    const errNumero =
      d.tipo === "cerrar" ? "" : validarNumero(d.numero, d.grupo?.id);
    const errFecha = d.tipo === "renumerar" ? "" : validarFecha(d);
    if (errNumero || errFecha) {
      setDialogo((x) => ({ ...x, errNumero, errFecha, error: "" }));
      return;
    }
    setDialogo((x) => ({
      ...x,
      enviando: true,
      errNumero: "",
      errFecha: "",
      error: "",
    }));
    try {
      if (d.tipo === "crear") {
        const cuerpo = { numero: Number(d.numero) };
        if (esSuper) cuerpo.congregacion_id = congregacionId;
        if (d.fecha) cuerpo.fecha_inicio = d.fecha;
        await axios.post("/api/personas/grupos/crear", cuerpo);
        setMensaje(
          t("per_grupo_creado", {
            defaultValue: "Se creó el grupo {{numero}}.",
            numero: d.numero,
          }),
        );
      } else if (d.tipo === "renumerar") {
        await axios.post("/api/personas/grupos/editar", {
          id: d.grupo.id,
          numero: Number(d.numero),
        });
        setMensaje(
          t("per_grupo_renumerado", {
            defaultValue: "El grupo {{viejo}} ahora es el grupo {{nuevo}}.",
            viejo: d.grupo.numero,
            nuevo: d.numero,
          }),
        );
      } else {
        await axios.post("/api/personas/grupos/cerrar", {
          id: d.grupo.id,
          fecha: d.fecha,
        });
        setMensaje(
          t("per_grupo_cerrado", {
            defaultValue: "Se cerró el grupo {{numero}}.",
            numero: d.grupo.numero,
          }),
        );
      }
      setDialogo(DIALOGO_CERRADO);
      setRecarga((r) => r + 1);
    } catch (err) {
      setDialogo((x) => ({
        ...x,
        enviando: false,
        error:
          detalleDe(err) ||
          t("per_error_grupo_accion", "No se pudo completar la acción."),
      }));
    }
  };

  // --- Textos del diálogo según la acción ---
  const textosDialogo = {
    crear: {
      titulo: t("per_dlg_crear_titulo", "Nuevo grupo"),
      mensaje: t(
        "per_dlg_crear_msg",
        "El número no puede repetirse entre los grupos activos.",
      ),
      aceptar: t("per_dlg_crear_aceptar", "Crear grupo"),
      tono: "normal",
    },
    renumerar: {
      titulo: t("per_dlg_renum_titulo", {
        defaultValue: "Renumerar el grupo {{numero}}",
        numero: dialogo.grupo?.numero,
      }),
      mensaje: t(
        "per_dlg_renum_msg",
        "El historial no cambia: cada movimiento conserva el número que tenía en su momento.",
      ),
      aceptar: t("per_dlg_renum_aceptar", "Renumerar"),
      tono: "normal",
    },
    cerrar: {
      titulo: t("per_dlg_cerrar_titulo", {
        defaultValue: "¿Cerrar el grupo {{numero}}?",
        numero: dialogo.grupo?.numero,
      }),
      mensaje: t(
        "per_dlg_cerrar_msg",
        "Solo se puede cerrar si no tiene personas ni encargados. El grupo queda en el historial y su número queda libre.",
      ),
      aceptar: t("per_dlg_cerrar_aceptar", "Cerrar grupo"),
      tono: "peligro",
    },
  }[dialogo.tipo || "crear"];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Link
        to="/personas"
        className="inline-flex items-center gap-1 text-sm text-jw-text-main opacity-70 hover:opacity-100"
      >
        <ArrowLeft size={16} aria-hidden="true" className="rtl:rotate-180" />
        {t("per_volver", "Personas")}
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-jw-text-main">
            {t("per_h_grupos", "Grupos")}
          </h1>
          {!cargando && !resultado.error && (
            <span className="text-sm text-jw-text-main opacity-70">
              {activos.length} {t("per_grupos_activos", "grupos activos")}
              {resultado.sinGrupo > 0 &&
                ` · ${resultado.sinGrupo} ${t("per_personas_sin_grupo", "personas sin grupo")}`}
            </span>
          )}
        </div>

        {esSuper && (
          <div className="w-full sm:w-72">
            <CampoSelect
              id="grp-congregacion"
              label={t("per_congregacion", "Congregación")}
              value={congregacionId}
              onChange={(e) => cambiarCongregacion(e.target.value)}
              error={
                errorCong
                  ? t(
                      "per_error_congregaciones",
                      "No se pudo cargar la lista de congregaciones.",
                    )
                  : undefined
              }
            >
              {congregaciones.length === 0 && congregacionId && (
                <option value={congregacionId}>
                  {user?.congregacion_nombre || congregacionId}
                </option>
              )}
              {congregaciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.numero_congregacion ? ` (${c.numero_congregacion})` : ""}
                </option>
              ))}
            </CampoSelect>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-jw-text-main cursor-pointer">
          <input
            type="checkbox"
            checked={verCerrados}
            onChange={(e) => setVerCerrados(e.target.checked)}
            className="w-4 h-4 accent-current"
          />
          {t("per_ver_cerrados", "Ver también los grupos cerrados")}
        </label>
        <Boton icono={Plus} onClick={abrirCrear} disabled={!listo}>
          {t("per_nuevo_grupo", "Nuevo grupo")}
        </Boton>
      </div>

      {mensaje && (
        <p
          role="status"
          className="text-sm text-jw-text-main border border-green-600/40 bg-green-600/10 rounded-xl px-3 py-2"
        >
          {mensaje}
        </p>
      )}

      {cargando && (
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
        </div>
      )}

      {!cargando && resultado.error && (
        <p
          role="alert"
          className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2"
        >
          {resultado.error}
        </p>
      )}

      {!cargando && !resultado.error && grupos.length === 0 && (
        <Tarjeta className="text-center py-10">
          <p className="text-sm text-jw-text-main opacity-70">
            {t(
              "per_sin_grupos_cong",
              "Esta congregación todavía no tiene grupos.",
            )}
          </p>
        </Tarjeta>
      )}

      {!cargando && !resultado.error && grupos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {grupos.map((g) => (
            <Tarjeta
              key={g.id}
              className={`flex flex-col ${g.activo ? "" : "opacity-70"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-jw-text-main">
                  {t("per_grupo", "Grupo")} {g.numero}
                </h2>
                <Etiqueta tono={g.activo ? "ok" : "neutro"}>
                  {g.activo
                    ? t("per_vigente", "Vigente")
                    : t("per_cerrado", "Cerrado")}
                </Etiqueta>
              </div>

              <dl className="mt-2 divide-y divide-jw-border">
                <Fila etiqueta={t("per_miembros", "Miembros")}>
                  {g.miembros ?? 0}
                  <span className="font-normal opacity-60">
                    {" "}
                    ({g.activos ?? 0} {t("per_activos", "activos")} ·{" "}
                    {g.inactivos ?? 0} {t("per_inactivos", "inactivos")})
                  </span>
                </Fila>
                <Fila
                  etiqueta={t("per_cargo_superintendente", "Superintendente")}
                >
                  <Encargado persona={g.superintendente} />
                </Fila>
                <Fila etiqueta={t("per_cargo_auxiliar", "Auxiliar de grupo")}>
                  <Encargado persona={g.auxiliar} />
                </Fila>
                <Fila etiqueta={t("per_h_desde", "Desde")}>
                  <span dir="ltr" className="tabular-nums">
                    {fechaCorta(g.fecha_inicio, sinFecha)}
                  </span>
                </Fila>
                {!g.activo && (
                  <Fila etiqueta={t("per_cerrado_el", "Cerrado el")}>
                    <span dir="ltr" className="tabular-nums">
                      {fechaCorta(g.fecha_cierre, sinFecha)}
                    </span>
                  </Fila>
                )}
              </dl>

              {g.activo && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Boton
                    variante="suave"
                    icono={Users}
                    onClick={() => setVerGrupo(g)}
                  >
                    {t("per_ver_integrantes", "Ver integrantes")}
                  </Boton>
                  <Boton variante="suave" onClick={() => abrirRenumerar(g)}>
                    {t("per_renumerar", "Renumerar")}
                  </Boton>
                  <Boton variante="peligro" onClick={() => abrirCerrar(g)}>
                    {t("per_cerrar_grupo", "Cerrar")}
                  </Boton>
                </div>
              )}
            </Tarjeta>
          ))}
        </div>
      )}

      {verGrupo && (
        <IntegrantesGrupo
          key={verGrupo.id}
          grupo={verGrupo}
          esSuper={esSuper}
          congregacionId={congregacionId}
          onCerrar={() => setVerGrupo(null)}
        />
      )}

      <Confirmacion
        abierto={!!dialogo.tipo}
        titulo={textosDialogo.titulo}
        mensaje={textosDialogo.mensaje}
        tono={textosDialogo.tono}
        textoAceptar={textosDialogo.aceptar}
        cargando={dialogo.enviando}
        error={dialogo.error}
        onAceptar={aceptar}
        onCancelar={cancelar}
      >
        <div className="space-y-3">
          {dialogo.tipo !== "cerrar" && (
            <CampoTexto
              id="grp-numero"
              label={t("per_grupo_numero", "Número de grupo")}
              obligatorio
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={dialogo.numero}
              error={dialogo.errNumero}
              placeholder={t("per_ph_grupo_numero", "Ej.: 3")}
              ayuda={t("per_ayuda_grupo_numero", "Un número entre 1 y 9999.")}
              onChange={(e) =>
                cambiarDialogo({
                  numero: e.target.value.replace(/\D/g, ""),
                  errNumero: "",
                })
              }
            />
          )}
          {dialogo.tipo !== "renumerar" && (
            <CampoTexto
              id="grp-fecha"
              type="date"
              max={hoyISO()}
              label={
                dialogo.tipo === "cerrar"
                  ? t("per_fecha_cierre", "Fecha de cierre")
                  : t("per_fecha_inicio_grupo", "Fecha de inicio")
              }
              obligatorio={dialogo.tipo === "cerrar"}
              value={dialogo.fecha}
              error={dialogo.errFecha}
              ayuda={
                dialogo.tipo === "cerrar"
                  ? t(
                      "per_ayuda_fecha_cierre",
                      "Día en que el grupo dejó de existir.",
                    )
                  : t(
                      "per_ayuda_fecha_inicio_grupo",
                      "Por defecto es hoy; puede ser una fecha pasada.",
                    )
              }
              onChange={(e) =>
                cambiarDialogo({ fecha: e.target.value, errFecha: "" })
              }
            />
          )}
        </div>
      </Confirmacion>
    </div>
  );
}

export default GruposPage;
