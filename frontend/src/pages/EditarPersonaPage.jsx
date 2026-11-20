/**
 * ARCHIVO: EditarPersonaPage.jsx
 * UBICACIÓN: frontend/src/pages/EditarPersonaPage.jsx
 * DESCRIPCIÓN: Edición de los datos de una persona. Ruta:
 * /personas/:id/editar. La usan coordinador, secretario, servicio (de su
 * congregación) y superadmin.
 *
 * Flujo: se carga la ficha -> se completa el formulario -> "Guardar cambios"
 * -> si falta algo se marca en cada campo sin borrar lo escrito -> si no hay
 * cambios se avisa -> diálogo de confirmación -> POST /api/personas/editar
 * (formulario COMPLETO: lo que queda vacío se guarda como "sin dato") -> se
 * vuelve a la ficha.
 *
 * Situaciones y grupo NO se editan acá: el backend los ignora. Se muestran
 * como lectura (la situación se cambia con fecha en el paso 3.4 y el grupo
 * moviendo a la persona).
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla; el backend decide.
 */

import { useContext, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppContext } from "../context/AppContext";
import Boton from "../components/ui/Boton";
import Confirmacion from "../components/ui/Confirmacion";
import FormularioPersona from "../components/personas/FormularioPersona";
import { FORM_PERSONA_VACIO } from "../config/personasConfig";
import { fechaCorta, hoyISO } from "../lib/fechas";

// Solo letras, espacios, guion, apóstrofo y punto (igual que el backend,
// que lo exige tanto en el apellido como en el nombre).
const REGEX_NOMBRE = /^[\p{L}\s.'’-]+$/u;

const detalleDe = (err) =>
  typeof err.response?.data === "string" ? err.response.data.trim() : "";

// Fecha del backend ("AAAA-MM-DD" o null) -> valor de un input date.
const soloFecha = (texto) => (texto ? String(texto).slice(0, 10) : "");

// Ficha del backend -> valores del formulario (los null pasan a "").
const desdeFicha = (p) => ({
  ...FORM_PERSONA_VACIO,
  apellido: p.apellido ?? "",
  nombre: p.nombre ?? "",
  contacto: p.contacto ?? "",
  fecha_alta: soloFecha(p.fecha_alta),
  condicion: p.condicion ?? "",
  direccion: p.direccion ?? "",
  ciudad: p.ciudad ?? "",
  partido: p.partido ?? "",
  provincia_estado: p.provincia_estado ?? "",
  pais: p.pais ?? "",
  codigo_postal: p.codigo_postal ?? "",
  detalles: p.detalles ?? "",
});

// Campos que se mandan al guardar (siempre todos: la edición es completa).
const CAMPOS = [
  "apellido",
  "nombre",
  "contacto",
  "fecha_alta",
  "condicion",
  "direccion",
  "ciudad",
  "partido",
  "provincia_estado",
  "pais",
  "codigo_postal",
  "detalles",
];

function EditarPersonaPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { permisos } = useContext(AppContext);
  const autorizado =
    permisos.cargado &&
    (permisos.es_superadmin || permisos.es_encargado_general);

  // `id` dice a qué persona pertenecen los datos (si no coincide, carga).
  const [carga, setCarga] = useState({
    id: "",
    ficha: null,
    inicial: null,
    error: "",
  });
  const cargando = carga.id !== id;

  const [valores, setValores] = useState(FORM_PERSONA_VACIO);
  const [errores, setErrores] = useState({});
  const [aviso, setAviso] = useState("");
  const [confirmar, setConfirmar] = useState({
    abierto: false,
    enviando: false,
    error: "",
  });

  useEffect(() => {
    if (!autorizado) return;
    const control = new AbortController();
    axios
      .get("/api/personas/ficha", { params: { id }, signal: control.signal })
      .then(({ data }) => {
        const inicial = desdeFicha(data);
        setCarga({ id, ficha: data, inicial, error: "" });
        setValores(inicial);
        setErrores({});
        setAviso("");
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setCarga({
          id,
          ficha: null,
          inicial: null,
          error:
            detalleDe(err) ||
            t("per_error_ficha", "No se pudo cargar la persona."),
        });
      });
    return () => control.abort();
  }, [autorizado, id, t]);

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

  const volver = (
    <Link
      to={`/personas/${id}`}
      className="inline-flex items-center gap-1 text-sm text-jw-text-main opacity-70 hover:opacity-100"
    >
      <ArrowLeft size={16} aria-hidden="true" className="rtl:rotate-180" />
      {t("per_volver_ficha", "Ficha")}
    </Link>
  );

  if (cargando) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {volver}
        <div className="flex justify-center py-10" role="status">
          <Loader2 className="w-5 h-5 animate-spin text-jw-accent" />
        </div>
      </div>
    );
  }

  if (carga.error) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {volver}
        <p className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2">
          {carga.error}
        </p>
      </div>
    );
  }

  const ficha = carga.ficha;
  const tieneFechaAlta = !!ficha.fecha_alta;
  const fechaBaja = ficha.estado === "BAJA" ? soloFecha(ficha.fecha_baja) : "";

  // --- Cambios en el formulario ---
  const cambiar = (parcial) => {
    setValores((v) => ({ ...v, ...parcial }));
    setErrores((e) => {
      const n = { ...e };
      Object.keys(parcial).forEach((k) => delete n[k]);
      return n;
    });
  };

  // --- Validación ---
  const validar = () => {
    const e = {};
    const apellido = valores.apellido.trim();
    if (!apellido) {
      e.apellido = t("per_err_apellido", "Falta el apellido.");
    } else if (!REGEX_NOMBRE.test(apellido)) {
      e.apellido = t(
        "per_err_apellido_chars",
        "Solo letras, espacios, guion, apóstrofo y punto.",
      );
    }
    const nombre = valores.nombre.trim();
    if (!nombre) {
      e.nombre = t("per_err_nombre", "Falta el nombre.");
    } else if (!REGEX_NOMBRE.test(nombre)) {
      e.nombre = t(
        "per_err_nombre_chars",
        "Solo letras, espacios, guion, apóstrofo y punto.",
      );
    }
    if (!valores.fecha_alta) {
      // Una persona antigua sin fecha puede seguir sin ella; si ya la tiene,
      // no se puede vaciar.
      if (tieneFechaAlta) {
        e.fecha_alta = t("per_err_fecha_alta", "Falta la fecha de alta.");
      }
    } else if (valores.fecha_alta > hoyISO()) {
      e.fecha_alta = t(
        "per_err_fecha_futura",
        "La fecha de alta no puede ser futura.",
      );
    } else if (fechaBaja && valores.fecha_alta > fechaBaja) {
      e.fecha_alta = t(
        "per_err_alta_despues_baja",
        "La fecha de alta no puede ser posterior a la fecha de baja.",
      );
    }
    return e;
  };

  const etiquetasFaltantes = {
    apellido: t("per_f_apellido", "Apellido"),
    nombre: t("per_f_nombre", "Nombre"),
    fecha_alta: t("per_fecha_alta", "Fecha de alta"),
  };

  const hayCambios =
    JSON.stringify(valores) !== JSON.stringify(carga.inicial);

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
      document.getElementById(`per-f-${claves[0]}`)?.focus();
      return;
    }
    if (!hayCambios) {
      setAviso(t("per_aviso_sin_cambios", "No hay cambios para guardar."));
      return;
    }
    setAviso("");
    setConfirmar({ abierto: true, enviando: false, error: "" });
  };

  // --- Guardado ---
  const armarCuerpo = () => {
    const cuerpo = { id: Number(id) };
    CAMPOS.forEach((k) => {
      cuerpo[k] = String(valores[k] ?? "").trim();
    });
    return cuerpo;
  };

  const guardar = async () => {
    setConfirmar((c) => ({ ...c, enviando: true, error: "" }));
    try {
      await axios.post("/api/personas/editar", armarCuerpo());
      navigate(`/personas/${id}`);
    } catch (err) {
      setConfirmar({
        abierto: true,
        enviando: false,
        error:
          detalleDe(err) ||
          t("per_error_editar", "No se pudieron guardar los cambios."),
      });
    }
  };

  const fechaCambio = valores.fecha_alta !== carga.inicial.fecha_alta;
  const mensajeConfirmar = [
    t("per_confirma_editar_msg", {
      defaultValue: "Se guardarán los cambios de {{nombre}}.",
      nombre: `${valores.apellido.trim()} ${valores.nombre.trim()}`,
    }),
    fechaCambio
      ? t("per_confirma_editar_fecha", {
          defaultValue:
            "La fecha de alta pasará a {{fecha}} y se ajustará el historial.",
          fecha: fechaCorta(
            valores.fecha_alta,
            t("per_sin_fecha", "sin fecha"),
          ),
        })
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {volver}

      <div>
        <h1 className="text-xl font-semibold text-jw-text-main break-words">
          {t("per_editar", "Editar persona")}
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
          modo="edicion"
          valores={valores}
          errores={errores}
          onCambiar={cambiar}
          fechaAltaObligatoria={tieneFechaAlta}
          actuales={{
            situacion_1: ficha.situacion_1,
            situacion_2: ficha.situacion_2,
            situacion_3: ficha.situacion_3,
            grupo: ficha.grupo,
          }}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Boton variante="suave" onClick={() => navigate(`/personas/${id}`)}>
            {t("ui_cancelar", "Cancelar")}
          </Boton>
          <Boton type="submit">
            {t("per_guardar_cambios", "Guardar cambios")}
          </Boton>
        </div>
      </form>

      <Confirmacion
        abierto={confirmar.abierto}
        titulo={t("per_confirma_editar_titulo", "¿Guardar los cambios?")}
        mensaje={mensajeConfirmar}
        cargando={confirmar.enviando}
        error={confirmar.error}
        onAceptar={guardar}
        onCancelar={() =>
          setConfirmar({ abierto: false, enviando: false, error: "" })
        }
      />
    </div>
  );
}

export default EditarPersonaPage;
