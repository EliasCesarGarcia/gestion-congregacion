/**
 * ARCHIVO: NuevaPersonaPage.jsx
 * UBICACIÓN: frontend/src/pages/NuevaPersonaPage.jsx
 * DESCRIPCIÓN: Alta de una persona. Ruta: /personas/nueva. La usan
 * coordinador, secretario, servicio (en su congregación) y superadmin (que
 * elige la congregación; arranca en la que llega por ?congregacion= o en la
 * suya).
 *
 * Flujo: completar -> "Dar de alta" -> si falta algo se marca en cada campo
 * sin borrar lo escrito -> diálogo de confirmación -> POST /api/personas/crear
 * -> se abre la ficha de la persona nueva.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla; el backend decide.
 */

import { useContext, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppContext } from "../context/AppContext";
import Boton from "../components/ui/Boton";
import Confirmacion from "../components/ui/Confirmacion";
import FormularioPersona from "../components/personas/FormularioPersona";
import { FORM_PERSONA_VACIO } from "../config/personasConfig";
import { fechaCorta, hoyISO } from "../lib/fechas";

// Solo letras, espacios, guion, apóstrofo y punto (igual que el backend).
const REGEX_APELLIDO = /^[\p{L}\s.'’-]+$/u;

// Campos de texto opcionales que se mandan solo si tienen algo escrito.
const OPCIONALES = [
  "situacion_2",
  "condicion",
  "contacto",
  "detalles",
  "direccion",
  "ciudad",
  "partido",
  "provincia_estado",
  "pais",
  "codigo_postal",
];

const detalleDe = (err) =>
  typeof err.response?.data === "string" ? err.response.data.trim() : "";

function NuevaPersonaPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { permisos, user } = useContext(AppContext);
  const esSuper = !!permisos.es_superadmin;
  const autorizado =
    permisos.cargado && (esSuper || permisos.es_encargado_general);

  const [valores, setValores] = useState(() => ({
    ...FORM_PERSONA_VACIO,
    fecha_alta: hoyISO(),
  }));
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState("");
  const [confirmar, setConfirmar] = useState({
    abierto: false,
    enviando: false,
    error: "",
  });

  // --- Congregación (solo superadmin) ---
  const [congregacionId, setCongregacionId] = useState(
    params.get("congregacion") || user?.congregacion_id || "",
  );
  const [congregaciones, setCongregaciones] = useState([]);
  const [errorCongregaciones, setErrorCongregaciones] = useState(false);

  useEffect(() => {
    if (!autorizado || !esSuper) return;
    const control = new AbortController();
    axios
      .get("/api/admin/congregaciones", {
        params: { q: "", estado: "todas", page: 1, limit: 100 },
        signal: control.signal,
      })
      .then(({ data }) => {
        setCongregaciones(
          Array.isArray(data.congregaciones) ? data.congregaciones : [],
        );
        setErrorCongregaciones(false);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setErrorCongregaciones(true);
      });
    return () => control.abort();
  }, [autorizado, esSuper]);

  // --- Grupos vigentes de la congregación ---
  // `clave` dice a qué congregación pertenece la lista (si no coincide, carga).
  const claveGrupos = !autorizado ? "" : esSuper ? congregacionId : "propia";
  const [grupos, setGrupos] = useState({ clave: "", lista: [], error: false });
  const cargandoGrupos = claveGrupos !== "" && grupos.clave !== claveGrupos;

  useEffect(() => {
    if (!claveGrupos) return;
    const control = new AbortController();
    axios
      .get("/api/personas/grupos", {
        // El superadmin siempre manda la congregación (vacío = todas).
        params: esSuper ? { congregacion_id: congregacionId } : {},
        signal: control.signal,
      })
      .then(({ data }) => {
        const lista = (Array.isArray(data.grupos) ? data.grupos : [])
          .filter((g) => g.activo !== false)
          .sort((a, b) => a.numero - b.numero);
        setGrupos({ clave: claveGrupos, lista, error: false });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setGrupos({ clave: claveGrupos, lista: [], error: true });
      });
    return () => control.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveGrupos]);

  // --- Motivos de alta ---
  const [motivos, setMotivos] = useState([]);
  useEffect(() => {
    if (!autorizado) return;
    const control = new AbortController();
    axios
      .get("/api/personas/motivos", {
        params: { uso: "alta" },
        signal: control.signal,
      })
      .then(({ data }) =>
        setMotivos(Array.isArray(data.motivos) ? data.motivos : []),
      )
      .catch(() => {}); // sin motivos el campo queda en "Sin motivo"
    return () => control.abort();
  }, [autorizado]);

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

  // --- Cambios en el formulario ---
  const cambiar = (parcial) => {
    setValores((v) => ({ ...v, ...parcial }));
    setErrores((e) => {
      const n = { ...e };
      Object.keys(parcial).forEach((k) => delete n[k]);
      return n;
    });
  };

  const cambiarCongregacion = (id) => {
    setCongregacionId(id);
    // Los grupos son de cada congregación: el elegido ya no vale.
    setValores((v) => ({ ...v, grupo_id: "" }));
    setErrores((e) => {
      const n = { ...e };
      delete n.congregacion;
      return n;
    });
  };

  // --- Validación ---
  const validar = () => {
    const e = {};
    if (esSuper && !congregacionId) {
      e.congregacion = t("per_err_congregacion", "Elija la congregación.");
    }
    const apellido = valores.apellido.trim();
    if (!apellido) {
      e.apellido = t("per_err_apellido", "Falta el apellido.");
    } else if (!REGEX_APELLIDO.test(apellido)) {
      e.apellido = t(
        "per_err_apellido_chars",
        "Solo letras, espacios, guion, apóstrofo y punto.",
      );
    }
    if (!valores.nombre.trim()) {
      e.nombre = t("per_err_nombre", "Falta el nombre.");
    }
    if (!valores.fecha_alta) {
      e.fecha_alta = t("per_err_fecha_alta", "Falta la fecha de alta.");
    } else if (valores.fecha_alta > hoyISO()) {
      e.fecha_alta = t(
        "per_err_fecha_futura",
        "La fecha de alta no puede ser futura.",
      );
    }
    return e;
  };

  const etiquetasFaltantes = {
    congregacion: t("per_congregacion", "Congregación"),
    apellido: t("per_f_apellido", "Apellido"),
    nombre: t("per_f_nombre", "Nombre"),
    fecha_alta: t("per_fecha_alta", "Fecha de alta"),
  };

  const alEnviar = (ev) => {
    ev.preventDefault();
    const errs = validar();
    setErrores(errs);
    const claves = Object.keys(errs);
    if (claves.length > 0) {
      setAviso(
        `${t("per_aviso_revisar", "Revise estos campos")}: ${claves
          .map((k) => etiquetasFaltantes[k])
          .join(", ")}.`,
      );
      // Lleva el foco al primer campo con error.
      document.getElementById(`per-f-${claves[0]}`)?.focus();
      return;
    }
    setAviso("");
    setConfirmar({ abierto: true, enviando: false, error: "" });
  };

  // --- Guardado ---
  const armarCuerpo = () => {
    const v = valores;
    const cuerpo = {
      apellido: v.apellido.trim(),
      nombre: v.nombre.trim(),
      fecha_alta: v.fecha_alta,
      situacion_1: v.situacion_1,
    };
    OPCIONALES.forEach((k) => {
      const x = String(v[k] ?? "").trim();
      if (x) cuerpo[k] = x;
    });
    if (v.grupo_id) cuerpo.grupo_id = Number(v.grupo_id);
    if (v.motivo_alta_id) cuerpo.motivo_alta_id = Number(v.motivo_alta_id);
    if (esSuper) cuerpo.congregacion_id = congregacionId;
    return cuerpo;
  };

  const crear = async () => {
    setConfirmar((c) => ({ ...c, enviando: true, error: "" }));
    try {
      const { data } = await axios.post("/api/personas/crear", armarCuerpo());
      navigate(data?.id ? `/personas/${data.id}` : "/personas");
    } catch (err) {
      setConfirmar({
        abierto: true,
        enviando: false,
        error:
          detalleDe(err) ||
          t("per_error_crear", "No se pudo dar de alta a la persona."),
      });
    }
  };

  const nombreCong =
    congregaciones.find((c) => c.id === congregacionId)?.nombre ||
    (congregacionId === user?.congregacion_id
      ? user?.congregacion_nombre
      : "") ||
    "";

  const mensajeConfirmar = [
    t("per_confirma_alta_msg", {
      defaultValue: "Se dará de alta a {{nombre}} con fecha {{fecha}}.",
      nombre: `${valores.apellido.trim()} ${valores.nombre.trim()}`,
      fecha: fechaCorta(valores.fecha_alta),
    }),
    esSuper && nombreCong
      ? t("per_confirma_alta_cong", {
          defaultValue: "Congregación: {{nombre}}.",
          nombre: nombreCong,
        })
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <Link
        to="/personas"
        className="inline-flex items-center gap-1 text-sm text-jw-text-main opacity-70 hover:opacity-100"
      >
        <ArrowLeft size={16} aria-hidden="true" className="rtl:rotate-180" />
        {t("per_volver", "Personas")}
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-jw-text-main">
          {t("per_nueva", "Nueva persona")}
        </h1>
        <p className="text-sm text-jw-text-main opacity-60 mt-1">
          {t("per_nueva_ayuda", "Los campos con * son obligatorios.")}
        </p>
      </div>

      <form onSubmit={alEnviar} noValidate className="space-y-6">
        {aviso && (
          <p
            role="alert"
            className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2"
          >
            {aviso}
          </p>
        )}

        <FormularioPersona
          modo="alta"
          valores={valores}
          errores={errores}
          onCambiar={cambiar}
          esSuper={esSuper}
          congregaciones={congregaciones}
          congregacionId={congregacionId}
          congregacionNombre={user?.congregacion_nombre || ""}
          errorCongregaciones={errorCongregaciones}
          onCongregacion={cambiarCongregacion}
          grupos={grupos.clave === claveGrupos ? grupos.lista : []}
          cargandoGrupos={cargandoGrupos}
          errorGrupos={grupos.clave === claveGrupos && grupos.error}
          motivos={motivos}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Boton variante="suave" onClick={() => navigate("/personas")}>
            {t("ui_cancelar", "Cancelar")}
          </Boton>
          <Boton type="submit">{t("per_dar_alta", "Dar de alta")}</Boton>
        </div>
      </form>

      <Confirmacion
        abierto={confirmar.abierto}
        titulo={t("per_confirma_alta_titulo", "¿Dar de alta a esta persona?")}
        mensaje={mensajeConfirmar}
        cargando={confirmar.enviando}
        error={confirmar.error}
        onAceptar={crear}
        onCancelar={() =>
          setConfirmar({ abierto: false, enviando: false, error: "" })
        }
      />
    </div>
  );
}

export default NuevaPersonaPage;
