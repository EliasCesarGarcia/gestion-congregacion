/**
 * ARCHIVO: CargosPage.jsx
 * UBICACIÓN: frontend/src/pages/CargosPage.jsx
 * DESCRIPCIÓN: Cargos de una congregación: coordinador, secretario y servicio.
 * Ruta: /admin/cargos. SOLO la ve el superadmin.
 *
 * Muestra los tres cargos de la congregación elegida (titular, contacto,
 * Desde, Hasta y tiempo en el cargo), avisa si alguno está vacante y permite
 * cambiarlos con el botón "Cambiar cargos" (componente CambiarCargos).
 * Todavía falta el historial de cada cargo con "Corregir" (paso siguiente).
 *
 * CONGREGACIÓN: el selector arranca en `?congregacion=` o, si no viene, en la
 * del superadmin. Muestra todas (habilitadas o no) y NUNCA mezcla
 * congregaciones: todo lo que se ve es de la elegida.
 *
 * Backend: GET /api/admin/cargos?congregacion_id= -> { congregacion_id,
 * completos, cargos: [{ rol, titular, historial }] }. Siempre vienen los tres
 * cargos; `titular` es null si el cargo está vacante. Las fechas llegan como
 * "AAAA-MM-DD HH:MM" (UTC): se muestra solo el día.
 *
 * Diseño: todo el texto a la izquierda (solo los títulos van centrados);
 * "Desde" y "Hasta" en bloques separados y siempre en el mismo lugar; el
 * tiempo en el cargo siempre visible. Las tres tarjetas van en columnas en
 * pantallas grandes y apiladas en celular y tableta.
 *
 * SEGURIDAD: el chequeo de abajo solo oculta la pantalla. El backend
 * devuelve 403 a quien no sea superadmin.
 */

import { useContext, useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, Phone, Plus } from "lucide-react";
import { AppContext } from "../context/AppContext";
import Boton from "../components/ui/Boton";
import Etiqueta from "../components/ui/Etiqueta";
import CambiarCargos from "../components/personas/CambiarCargos";
import Tarjeta from "../components/ui/Tarjeta";
import TituloSeccion from "../components/ui/TituloSeccion";
import { CampoSelect } from "../components/ui/Campo";
import { ROLES } from "../config/personasConfig";
import { fechaCorta, hoyISO, textoDuracion } from "../lib/fechas";
import { textoError } from "../lib/gruposApi";

// Orden fijo de los cargos en pantalla.
const ORDEN_CARGOS = ["coordinador", "secretario", "servicio"];

// Un dato en su bloque: rótulo arriba, valor abajo. Siempre en el mismo lugar.
function Bloque({ rotulo, children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-jw-border bg-jw-body px-3 py-2 ${className}`}
    >
      <dt className="text-xs text-jw-text-main opacity-60">{rotulo}</dt>
      <dd className="mt-0.5 text-sm font-medium text-jw-text-main break-words">
        {children}
      </dd>
    </div>
  );
}

// Una fecha de izquierda a derecha (también en idiomas RTL). Si no se conoce,
// se ve atenuada y en cursiva.
function Fecha({ valor }) {
  const { t } = useTranslation();
  if (!valor) {
    return (
      <span className="italic opacity-60">{t("per_sin_fecha", "Sin fecha")}</span>
    );
  }
  return (
    <span dir="ltr" className="inline-block tabular-nums whitespace-nowrap">
      {fechaCorta(valor)}
    </span>
  );
}

// Tarjeta de un cargo: titular y contacto, Desde / Hasta y tiempo en el cargo.
function TarjetaCargo({ cargo }) {
  const { t } = useTranslation();
  const rol = ROLES[cargo.rol];
  const nombreRol = rol ? t(rol[0], rol[1]) : cargo.rol;
  const p = cargo.titular;

  return (
    <Tarjeta className="flex flex-col gap-4">
      <TituloSeccion>{nombreRol}</TituloSeccion>

      {!p ? (
        <div className="space-y-2">
          <Etiqueta tono="aviso">{t("car_vacante", "Vacante")}</Etiqueta>
          <p className="text-sm text-jw-text-main opacity-70">
            {t(
              "car_vacante_msg",
              "Este cargo no tiene titular. La congregación no se puede habilitar hasta cubrirlo.",
            )}
          </p>
        </div>
      ) : (
        <TitularCargo titular={p} />
      )}
    </Tarjeta>
  );
}

function TitularCargo({ titular: p }) {
  const { t } = useTranslation();

  // Teléfono: si tiene código de país ("+54 ..."), es un enlace para llamar.
  const telefono = p.contacto || "";
  const hrefTelefono = telefono.startsWith("+")
    ? `tel:+${telefono.replace(/\D/g, "")}`
    : "";

  // Vigente: se cuenta hasta hoy.
  const tiempo = textoDuracion(
    p.fecha_inicio,
    p.vigente === false ? p.fecha_fin : hoyISO(),
    t,
  );

  return (
    <>
      <div className="min-w-0">
        <p className="text-base font-semibold text-jw-text-main break-words">
          {p.apellido} {p.nombre}
        </p>
        <p className="mt-1 text-sm text-jw-text-main">
          {telefono ? (
            hrefTelefono ? (
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
            )
          ) : (
            <span className="opacity-60">
              {t("car_sin_contacto", "Sin contacto cargado")}
            </span>
          )}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <Bloque rotulo={t("per_h_desde", "Desde")}>
          <Fecha valor={p.fecha_inicio} />
        </Bloque>
        <Bloque rotulo={t("per_h_hasta", "Hasta")}>
          {p.fecha_fin ? <Fecha valor={p.fecha_fin} /> : <span aria-hidden="true">—</span>}
        </Bloque>
        <Bloque
          rotulo={t("car_tiempo_cargo", "Tiempo en el cargo")}
          className="col-span-2"
        >
          {tiempo ? (
            <>
              {tiempo}
              <span className="block text-xs font-normal opacity-60">
                {t("per_hasta_hoy", "hasta hoy")}
              </span>
            </>
          ) : (
            <span aria-hidden="true">—</span>
          )}
        </Bloque>
      </dl>

      {(p.motivo_inicio || p.detalles_inicio) && (
        <div className="space-y-0.5">
          {p.motivo_inicio && (
            <p className="text-xs text-jw-text-main opacity-60 break-words">
              {t("per_motivo_alta", "Motivo de alta")}: {p.motivo_inicio}
            </p>
          )}
          {p.detalles_inicio && (
            <p className="text-xs text-jw-text-main opacity-60 break-words">
              {t("per_detalles_alta", "Detalles del alta")}: {p.detalles_inicio}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function CargosPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { permisos, user } = useContext(AppContext);
  const autorizado = permisos.cargado && !!permisos.es_superadmin;

  // --- Congregación (arranca en `?congregacion=` o en la del superadmin) ---
  const [congregaciones, setCongregaciones] = useState([]);
  const [errorCong, setErrorCong] = useState(false);
  const [congregacionId, setCongregacionId] = useState(
    params.get("congregacion") || user?.congregacion_id || "",
  );
  const listo = autorizado && congregacionId !== "";

  // --- Cargos. `clave` dice a qué pedido pertenecen los datos (si no
  // coincide con el actual, se está cargando). Después de un cambio se
  // vuelve a pedir sumando 1 a `recarga`. ---
  const [datos, setDatos] = useState({ clave: "", data: null, error: "" });
  const [recarga, setRecarga] = useState(0);
  const [mensaje, setMensaje] = useState("");
  const clave = `${congregacionId}:${recarga}`;
  const cargando = listo && datos.clave !== clave;

  // Lista de congregaciones para el selector (todas, habilitadas o no). Si la
  // sesión no trae congregación, se elige la primera de la lista.
  useEffect(() => {
    if (!autorizado) return;
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
        setErrorCong(false);
        setCongregacionId((actual) => actual || filas[0]?.id || "");
      })
      .catch((err) => {
        if (!axios.isCancel(err)) setErrorCong(true);
      });
    return () => control.abort();
  }, [autorizado]);

  // Los tres cargos de la congregación elegida; el pedido viejo se cancela.
  useEffect(() => {
    if (!listo) return;
    const control = new AbortController();
    axios
      .get("/api/admin/cargos", {
        params: { congregacion_id: congregacionId },
        signal: control.signal,
      })
      .then(({ data }) => {
        setDatos({ clave, data, error: "" });
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setDatos({
          clave,
          data: null,
          error: textoError(
            err,
            t("car_error", "No se pudieron cargar los cargos."),
          ),
        });
      });
    return () => control.abort();
  }, [listo, congregacionId, clave, t]);

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

  const elegida = congregaciones.find((c) => c.id === congregacionId);
  const nombreCong =
    elegida?.nombre ||
    (congregacionId === user?.congregacion_id ? user?.congregacion_nombre : "") ||
    "";

  const data = !cargando && !datos.error ? datos.data : null;
  const cargos = ORDEN_CARGOS.map(
    (rol) =>
      (data?.cargos || []).find((c) => c.rol === rol) || {
        rol,
        titular: null,
        historial: [],
      },
  );
  const completos = !!data?.completos;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-start">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-jw-text-main">
            {t("car_titulo", "Cargos de la congregación")}
          </h1>
          <p className="text-sm text-jw-text-main opacity-70 mt-1">
            {t(
              "car_subtitulo",
              "Coordinador, secretario y servicio. Una congregación solo se habilita con los tres cubiertos.",
            )}
          </p>
          {elegida && (
            <div className="mt-2">
              <Etiqueta tono={elegida.activa ? "ok" : "neutro"}>
                {elegida.activa
                  ? t("cong_estado_habil", "Habilitada")
                  : t("cong_estado_deshab", "Deshabilitada")}
              </Etiqueta>
            </div>
          )}
        </div>

        <div className="w-full sm:w-72">
          <CampoSelect
            id="car-congregacion"
            label={t("per_congregacion", "Congregación")}
            value={congregacionId}
            onChange={(e) => {
              setCongregacionId(e.target.value);
              setMensaje("");
            }}
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
                {nombreCong || congregacionId}
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

      {!cargando && datos.error && (
        <p
          role="alert"
          className="text-sm text-jw-text-main border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2 break-words"
        >
          {datos.error}
        </p>
      )}

      {data && (
        <>
          {completos ? (
            <p
              role="status"
              className="text-sm text-jw-text-main border border-green-600/40 bg-green-600/10 rounded-xl px-3 py-2"
            >
              {t(
                "car_completos",
                "Los tres cargos están cubiertos.",
              )}
            </p>
          ) : (
            <p
              role="status"
              className="text-sm text-jw-text-main border border-amber-500/40 bg-amber-500/10 rounded-xl px-3 py-2"
            >
              {t(
                "car_incompletos",
                "Falta cubrir uno o más cargos. La congregación no se puede habilitar hasta tener coordinador, secretario y servicio.",
              )}
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {cargos.map((c) => (
              <TarjetaCargo key={c.rol} cargo={c} />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <CambiarCargos
              congregacionId={congregacionId}
              cargos={cargos}
              onListo={(texto) => {
                setMensaje(texto);
                setRecarga((r) => r + 1);
              }}
            />
            <Boton
              variante="suave"
              icono={Plus}
              onClick={() =>
                navigate(
                  `/personas/nueva?congregacion=${encodeURIComponent(congregacionId)}`,
                )
              }
            >
              {t(
                "car_cargar_persona",
                "Cargar una persona nueva en esta congregación",
              )}
            </Boton>
          </div>
        </>
      )}
    </div>
  );
}

export default CargosPage;
