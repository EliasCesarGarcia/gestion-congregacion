/**
 * ARCHIVO: FichaPersonaPage.jsx
 * UBICACIÓN: frontend/src/pages/FichaPersonaPage.jsx
 * DESCRIPCIÓN: Ficha de una persona con sus historiales. Ruta: /personas/:id.
 * La ven coordinador, secretario, servicio (de su congregación) y superadmin.
 *
 * Jerarquía de la pantalla (de lo más importante a lo menos):
 *  1. Identidad: foto, apellido y nombre, ID, alta/baja y condición.
 *  2. Contacto: teléfono, email y dirección (solo lo que tiene).
 *  3. Situación, por orden de prioridad: cargo en la aplicación, situación 3,
 *     situación 2 y situación 1; después grupo y condición.
 *  4. Registro: fechas de alta y baja.
 *  5. Detalles (notas), al final.
 *  Debajo, los historiales (HistorialPersona).
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. El backend responde
 * igual a una persona inexistente que a una de otra congregación.
 */

import { useContext, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { ArrowLeft, Loader2, Pencil, Phone } from "lucide-react";
import { AppContext } from "../context/AppContext";
import Tarjeta from "../components/ui/Tarjeta";
import Boton from "../components/ui/Boton";
import Etiqueta from "../components/ui/Etiqueta";
import HistorialPersona from "../components/personas/HistorialPersona";
import { ROLES } from "../config/personasConfig";
import { fechaCorta } from "../lib/fechas";

// Una fila "etiqueta ........ valor" dentro de un bloque.
function Fila({ etiqueta, children }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <dt className="text-sm text-jw-text-main opacity-60 shrink-0">
        {etiqueta}
      </dt>
      <dd className="text-sm font-medium text-jw-text-main text-end min-w-0 break-words">
        {children}
      </dd>
    </div>
  );
}

// Tarjeta con título pequeño y filas separadas por una línea fina.
function Bloque({ titulo, children }) {
  return (
    <Tarjeta>
      <h2 className="text-xs font-medium uppercase tracking-wide text-jw-text-main opacity-60 mb-1">
        {titulo}
      </h2>
      <dl className="divide-y divide-jw-border">{children}</dl>
    </Tarjeta>
  );
}

function FichaPersonaPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
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
          error:
            detalle || t("per_error_ficha", "No se pudo cargar la persona."),
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
  const mostrarCargo = !!rol && p.rol_app !== "publicador";
  const sinFecha = t("per_sin_fecha", "sin fecha");

  const condicionTexto =
    p.condicion === "A"
      ? t("per_activo", "Activo")
      : p.condicion === "I"
        ? t("per_inactivo", "Inactivo")
        : t("per_sin_condicion_dato", "Sin condición");
  const condicionTono =
    p.condicion === "A" ? "ok" : p.condicion === "I" ? "aviso" : "neutro";

  // Teléfono: si tiene código de país ("+54 ..."), es un enlace para llamar.
  const telefono = p.contacto || "";
  const hrefTelefono = telefono.startsWith("+")
    ? `tel:+${telefono.replace(/\D/g, "")}`
    : "";

  const lineasDireccion = [
    p.direccion,
    [p.ciudad, p.partido].filter(Boolean).join(", "),
    [p.provincia_estado, p.pais].filter(Boolean).join(", "),
    p.codigo_postal ? `${t("per_cp_corto", "CP")} ${p.codigo_postal}` : "",
  ].filter(Boolean);

  const hayContacto = !!telefono || !!p.email || lineasDireccion.length > 0;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {volver}

      {/* 1. Identidad */}
      <Tarjeta className="flex flex-wrap items-center gap-5">
        <div className="w-20 h-20 rounded-full overflow-hidden bg-jw-body border border-jw-border flex items-center justify-center text-xl text-jw-text-main shrink-0">
          {p.foto_url ? (
            <img
              src={p.foto_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            `${p.apellido?.[0] || ""}${p.nombre?.[0] || ""}`.toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-jw-text-main opacity-60 tabular-nums">
            {t("per_id", "ID")} {p.id}
          </p>
          <h1 className="text-2xl font-semibold text-jw-text-main break-words">
            {p.apellido} {p.nombre}
          </h1>
          <div className="flex flex-wrap gap-1 mt-2">
            <Etiqueta tono={deBaja ? "aviso" : "ok"}>
              {deBaja ? t("per_baja", "Baja") : t("per_alta", "Alta")}
            </Etiqueta>
            <Etiqueta tono={condicionTono}>{condicionTexto}</Etiqueta>
          </div>
        </div>
        <Boton
          variante="suave"
          icono={Pencil}
          className="shrink-0"
          onClick={() => navigate(`/personas/${id}/editar`)}
        >
          {t("per_editar_boton", "Editar")}
        </Boton>
      </Tarjeta>

      {/* 2. Contacto */}
      <Bloque titulo={t("per_contacto", "Contacto")}>
        {hayContacto ? (
          <>
            {telefono && (
              <Fila etiqueta={t("per_telefono", "Teléfono")}>
                {hrefTelefono ? (
                  <a
                    href={hrefTelefono}
                    dir="ltr"
                    aria-label={`${t("per_llamar", "Llamar")} ${telefono}`}
                    className="inline-flex items-center gap-1.5 underline underline-offset-4 decoration-jw-border hover:decoration-current"
                  >
                    <Phone size={14} aria-hidden="true" />
                    {telefono}
                  </a>
                ) : (
                  <span dir="ltr">{telefono}</span>
                )}
              </Fila>
            )}
            {p.email && (
              <Fila etiqueta={t("per_email", "Email")}>
                <a
                  href={`mailto:${p.email}`}
                  className="underline underline-offset-4 decoration-jw-border hover:decoration-current"
                >
                  {p.email}
                </a>
              </Fila>
            )}
            {lineasDireccion.length > 0 && (
              <Fila etiqueta={t("per_direccion", "Dirección")}>
                {lineasDireccion.map((linea, i) => (
                  <div key={i}>{linea}</div>
                ))}
              </Fila>
            )}
          </>
        ) : (
          <p className="py-2.5 text-sm text-jw-text-main opacity-60">
            {t("per_sin_contacto", "Sin datos de contacto.")}
          </p>
        )}
      </Bloque>

      {/* 3. Situación, por orden de prioridad */}
      <Bloque titulo={t("per_s_situacion_ficha", "Situación")}>
        {mostrarCargo && (
          <Fila etiqueta={t("per_cargo_app", "Cargo en la aplicación")}>
            {t(rol[0], rol[1])}
          </Fila>
        )}
        {p.situacion_3 && (
          <Fila etiqueta={t("per_f_sit3", "Situación 3")}>{p.situacion_3}</Fila>
        )}
        {p.situacion_2 && (
          <Fila etiqueta={t("per_f_sit2", "Situación 2")}>{p.situacion_2}</Fila>
        )}
        <Fila etiqueta={t("per_f_sit1", "Situación 1")}>
          {p.situacion_1 || "—"}
        </Fila>
        <Fila etiqueta={t("per_f_grupo", "Grupo")}>
          {p.grupo != null
            ? `${t("per_grupo", "Grupo")} ${p.grupo}`
            : t("per_sin_grupo", "Sin grupo")}
        </Fila>
        <Fila etiqueta={t("per_f_condicion", "Condición")}>
          {condicionTexto}
        </Fila>
      </Bloque>

      {/* 4. Registro */}
      <Bloque titulo={t("per_s_registro", "Registro")}>
        <Fila etiqueta={t("per_fecha_alta", "Fecha de alta")}>
          {fechaCorta(p.fecha_alta, sinFecha)}
        </Fila>
        {deBaja && (
          <Fila etiqueta={t("per_fecha_baja", "Fecha de baja")}>
            {fechaCorta(p.fecha_baja, sinFecha)}
          </Fila>
        )}
      </Bloque>

      {/* 5. Detalles, al final */}
      {p.detalles && (
        <Tarjeta>
          <h2 className="text-xs font-medium uppercase tracking-wide text-jw-text-main opacity-60 mb-2">
            {t("per_detalles", "Detalles")}
          </h2>
          <p className="text-sm text-jw-text-main whitespace-pre-line break-words">
            {p.detalles}
          </p>
        </Tarjeta>
      )}

      <HistorialPersona historial={datos.historial} />
    </div>
  );
}

export default FichaPersonaPage;
