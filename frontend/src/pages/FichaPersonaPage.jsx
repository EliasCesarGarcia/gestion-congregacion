/**
 * ARCHIVO: FichaPersonaPage.jsx
 * UBICACIÓN: frontend/src/pages/FichaPersonaPage.jsx
 * DESCRIPCIÓN: Ficha de una persona (solo lectura) con sus historiales.
 * Ruta: /personas/:id. La ven coordinador, secretario, servicio (de su
 * congregación) y superadmin.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. El backend responde
 * igual a una persona inexistente que a una de otra congregación.
 */

import { useContext, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppContext } from "../context/AppContext";
import Tarjeta from "../components/ui/Tarjeta";
import Etiqueta from "../components/ui/Etiqueta";
import HistorialPersona from "../components/personas/HistorialPersona";
import { ROLES } from "../config/personasConfig";
import { fechaCorta } from "../lib/fechas";

function Dato({ etiqueta, children }) {
  return (
    <div>
      <dt className="text-xs text-jw-text-main opacity-60">{etiqueta}</dt>
      <dd className="text-sm text-jw-text-main break-words">{children || "—"}</dd>
    </div>
  );
}

function FichaPersonaPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { permisos } = useContext(AppContext);
  const autorizado =
    permisos.cargado &&
    (permisos.es_superadmin || permisos.es_encargado_general);

  // `id` dice a qué persona pertenecen los datos (si no coincide, está cargando).
  const [datos, setDatos] = useState({
    id: "",
    ficha: null,
    historial: null,
    error: "",
  });
  const cargando = datos.id !== id;

  useEffect(() => {
    if (!autorizado) return;
    const control = new AbortController();
    const opciones = { params: { id }, signal: control.signal };

    Promise.all([
      axios.get("/api/personas/ficha", opciones),
      axios.get("/api/personas/historial", opciones),
    ])
      .then(([f, h]) => {
        setDatos({ id, ficha: f.data, historial: h.data, error: "" });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        const detalle =
          typeof err.response?.data === "string" ? err.response.data : "";
        setDatos({
          id,
          ficha: null,
          historial: null,
          error: detalle || t("per_error_ficha", "No se pudo cargar la persona."),
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
      to="/personas"
      className="inline-flex items-center gap-1 text-sm text-jw-text-main opacity-70 hover:opacity-100"
    >
      <ArrowLeft size={16} aria-hidden="true" className="rtl:rotate-180" />
      {t("per_volver", "Personas")}
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

  if (datos.error) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {volver}
        <p className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2">
          {datos.error}
        </p>
      </div>
    );
  }

  const p = datos.ficha;
  const deBaja = p.estado === "BAJA";
  const rol = ROLES[p.rol_app];
  const sinFecha = t("per_sin_fecha", "sin fecha");
  const condicion =
    p.condicion === "A"
      ? t("per_activo", "Activo")
      : p.condicion === "I"
        ? t("per_inactivo", "Inactivo")
        : t("per_sin_condicion_dato", "Sin condición");
  const direccion = [p.direccion, p.ciudad, p.partido, p.provincia_estado, p.pais]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {volver}

      {/* Encabezado */}
      <Tarjeta className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-jw-body border border-jw-border flex items-center justify-center text-lg text-jw-text-main shrink-0">
          {p.foto_url ? (
            <img src={p.foto_url} alt="" className="w-full h-full object-cover" />
          ) : (
            `${p.apellido?.[0] || ""}${p.nombre?.[0] || ""}`.toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-jw-text-main break-words">
            {p.apellido} {p.nombre}
          </h1>
          <div className="flex flex-wrap gap-1 mt-2">
            <Etiqueta tono={deBaja ? "aviso" : "ok"}>
              {deBaja ? t("per_baja", "Baja") : t("per_alta", "Alta")}
            </Etiqueta>
            {p.situacion_1 && <Etiqueta>{p.situacion_1}</Etiqueta>}
            {p.situacion_2 && <Etiqueta>{p.situacion_2}</Etiqueta>}
            {p.situacion_3 && <Etiqueta>{p.situacion_3}</Etiqueta>}
            {rol && p.rol_app !== "publicador" && (
              <Etiqueta tono="ok">{t(rol[0], rol[1])}</Etiqueta>
            )}
          </div>
        </div>
      </Tarjeta>

      {/* Datos */}
      <Tarjeta>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Dato etiqueta={t("per_f_grupo", "Grupo")}>
            {p.grupo != null ? `${t("per_grupo", "Grupo")} ${p.grupo}` : t("per_sin_grupo", "Sin grupo")}
          </Dato>
          <Dato etiqueta={t("per_f_condicion", "Condición")}>{condicion}</Dato>
          <Dato etiqueta={t("per_fecha_alta", "Fecha de alta")}>
            {fechaCorta(p.fecha_alta, sinFecha)}
          </Dato>
          {deBaja && (
            <Dato etiqueta={t("per_fecha_baja", "Fecha de baja")}>
              {fechaCorta(p.fecha_baja, sinFecha)}
            </Dato>
          )}
          <Dato etiqueta={t("per_contacto", "Contacto")}>{p.contacto}</Dato>
          <Dato etiqueta={t("per_email", "Email")}>{p.email}</Dato>
          <Dato etiqueta={t("per_direccion", "Dirección")}>{direccion}</Dato>
          <Dato etiqueta={t("per_codigo_postal", "Código postal")}>{p.codigo_postal}</Dato>
        </dl>
        {p.detalles && (
          <div className="mt-4 pt-4 border-t border-jw-border">
            <Dato etiqueta={t("per_detalles", "Detalles")}>{p.detalles}</Dato>
          </div>
        )}
      </Tarjeta>

      <HistorialPersona historial={datos.historial} />
    </div>
  );
}

export default FichaPersonaPage;