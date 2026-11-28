/**
 * ARCHIVO: CargarPeriodoAnterior.jsx
 * UBICACIÓN: frontend/src/components/personas/CargarPeriodoAnterior.jsx
 * DESCRIPCIÓN: Botón "Cargar período anterior" y su ventana: carga un período
 * PASADO y ya cerrado de un cargo (coordinador, secretario o servicio), por
 * ejemplo un interino entre dos titulares que ya están cargados. Es para casos
 * excepcionales. Solo lo usa el superadmin (pantalla de cargos).
 *
 * POST /api/admin/cargos/periodo-anterior
 *   { congregacion_id, rol, persona_id, fecha_inicio, fecha_fin,
 *     motivo_alta_id, detalles_alta?, motivo_baja_id, detalles_baja? }
 *
 * Reglas (el backend vuelve a validarlas):
 *  - Cargo, persona, fecha de inicio, fecha de fin y los dos motivos son
 *    obligatorios. Los detalles son opcionales (100 palabras).
 *  - Las fechas no pueden ser futuras y el fin no puede ser anterior al inicio.
 *  - Solo se ofrecen ancianos en ALTA de la congregación.
 *  - El período debe caer dentro de un período de alta de la persona y no
 *    superponerse con otro período de ese cargo (se ven los ya cargados).
 *  - Los motivos de alta son los que estén activos para "Alta de cargo" en el
 *    panel de motivos (/admin/catalogo-motivos).
 *  - No cambia a los titulares actuales de ningún cargo.
 *
 * Props: congregacionId, cargos ([{ rol, titular, historial }]), onListo(texto).
 * Los errores del backend se muestran dentro de la ventana, sin cerrarla.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { History, Loader2 } from "lucide-react";
import Boton from "../ui/Boton";
import Confirmacion from "../ui/Confirmacion";
import LineaRotulada from "../ui/LineaRotulada";
import { CampoArea, CampoSelect, CampoTexto } from "../ui/Campo";
import { ROLES } from "../../config/personasConfig";
import { fechaCorta, hoyISO, textoDuracion } from "../../lib/fechas";
import { textoError } from "../../lib/gruposApi";

const ORDEN_CARGOS = ["coordinador", "secretario", "servicio"];
const MAX_PALABRAS = 100;
const LIMITE_PAGINA = 50; // máximo que acepta el backend
const MAX_PAGINAS = 10; // tope de seguridad

// Posición de cada campo en la cuadrícula de pantallas anchas (clases
// escritas completas para que Tailwind las detecte). Columna 1 = inicio,
// columna 2 = fin; cada fila une un campo de inicio con su par de fin.
const POS_INI = [
  "sm:col-start-1 sm:row-start-1",
  "sm:col-start-1 sm:row-start-2",
  "sm:col-start-1 sm:row-start-3",
  "sm:col-start-1 sm:row-start-4",
];
const POS_FIN = [
  "sm:col-start-2 sm:row-start-1",
  "sm:col-start-2 sm:row-start-2",
  "sm:col-start-2 sm:row-start-3",
  "sm:col-start-2 sm:row-start-4",
];

const DIALOGO_CERRADO = {
  abierto: false,
  rol: "",
  personaId: "",
  inicio: "",
  fin: "",
  motivoAltaId: "",
  detallesAlta: "",
  motivoBajaId: "",
  detallesBaja: "",
  errores: {},
  enviando: false,
  error: "",
};

const contarPalabras = (texto) =>
  String(texto || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const listaMotivos = (resp) =>
  Array.isArray(resp?.data?.motivos) ? resp.data.motivos : [];

// Todos los ancianos en ALTA de la congregación (pide las páginas que hagan falta).
async function cargarAncianos(congregacionId, signal) {
  let todas = [];
  let total = 0;
  let pagina = 1;
  do {
    const { data } = await axios.get("/api/personas/buscar", {
      params: {
        estado: "ALTA",
        situacion_2: "Anciano",
        congregacion_id: congregacionId,
        page: pagina,
        limit: LIMITE_PAGINA,
      },
      signal,
    });
    todas = todas.concat(Array.isArray(data.personas) ? data.personas : []);
    total = data.total || 0;
    pagina += 1;
  } while (todas.length < total && pagina <= MAX_PAGINAS);
  return todas;
}

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

// Una fecha de izquierda a derecha (también en idiomas RTL). Si no hay, un guion.
function Fecha({ valor }) {
  if (!valor) return <span aria-hidden="true">—</span>;
  return (
    <span dir="ltr" className="inline-block tabular-nums whitespace-nowrap">
      {fechaCorta(valor)}
    </span>
  );
}

// Períodos que ya tiene el cargo elegido, para saber qué fechas están libres.
function PeriodosCargados({ lista }) {
  const { t } = useTranslation();
  if (lista.length === 0) {
    return (
      <p className="text-xs text-jw-text-main opacity-60">
        {t("car_pa_sin_periodos", "Este cargo todavía no tiene períodos cargados.")}
      </p>
    );
  }
  return (
    <details className="rounded-xl border border-jw-border px-3 py-2 text-sm text-jw-text-main">
      <summary className="cursor-pointer text-xs font-medium">
        {t("car_pa_periodos_cargados", {
          defaultValue: "Períodos ya cargados en este cargo ({{cantidad}})",
          cantidad: lista.length,
        })}
      </summary>
      <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
        {lista.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-jw-border px-3 py-2"
          >
            <p className="mb-1 break-words text-xs font-semibold">
              {`${p.apellido} ${p.nombre}`.trim()}
              {p.vigente ? ` (${t("car_pa_vigente", "vigente")})` : ""}
            </p>
            <dl className="grid grid-cols-2 gap-2">
              <Bloque rotulo={t("per_h_desde", "Desde")}>
                {p.fecha_inicio ? (
                  <Fecha valor={p.fecha_inicio} />
                ) : (
                  <span className="italic opacity-60">
                    {t("per_sin_fecha", "Sin fecha")}
                  </span>
                )}
              </Bloque>
              <Bloque rotulo={t("per_h_hasta", "Hasta")}>
                <Fecha valor={p.fecha_fin} />
              </Bloque>
            </dl>
          </li>
        ))}
      </ul>
    </details>
  );
}

function CargarPeriodoAnterior({ congregacionId, cargos, onListo }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [d, setD] = useState(DIALOGO_CERRADO);
  // Cada apertura vuelve a pedir ancianos y motivos (la lista pudo cambiar).
  const [aperturas, setAperturas] = useState(0);
  const [datos, setDatos] = useState({
    clave: "",
    ancianos: [],
    motivosAlta: [],
    motivosBaja: [],
    error: false,
  });
  const clave = `${congregacionId}:${aperturas}`;
  const cargandoDatos = d.abierto && datos.clave !== clave;

  const nombreRol = (rol) => {
    const r = ROLES[rol];
    return r ? t(r[0], r[1]) : rol;
  };

  // Ancianos en ALTA y motivos de alta y baja de cargo (al abrir la ventana).
  useEffect(() => {
    if (!d.abierto) return;
    const control = new AbortController();
    Promise.all([
      cargarAncianos(congregacionId, control.signal),
      axios.get("/api/personas/motivos", {
        params: { uso: "cargo_alta" },
        signal: control.signal,
      }),
      axios.get("/api/personas/motivos", {
        params: { uso: "cargo_baja" },
        signal: control.signal,
      }),
    ])
      .then(([ancianos, alta, baja]) =>
        setDatos({
          clave,
          ancianos,
          motivosAlta: listaMotivos(alta),
          motivosBaja: listaMotivos(baja),
          error: false,
        }),
      )
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setDatos({
          clave,
          ancianos: [],
          motivosAlta: [],
          motivosBaja: [],
          error: true,
        });
      });
    return () => control.abort();
    // `clave` ya resume congregacionId y la apertura actual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.abierto, clave]);

  // La ventana es larga: al abrirla el foco va al cargo (arriba), no al
  // botón Cancelar (abajo).
  useEffect(() => {
    if (!d.abierto) return;
    const campo = document.getElementById("car-pa-rol");
    if (!campo) return;
    const cuadro = campo.closest('[role="alertdialog"]');
    if (cuadro) cuadro.scrollTop = 0;
    campo.focus({ preventScroll: true });
  }, [d.abierto]);

  const abrir = () => {
    setAperturas((a) => a + 1);
    setD({ ...DIALOGO_CERRADO, abierto: true });
  };
  const cerrar = () => setD(DIALOGO_CERRADO);

  // Cambia un campo y borra su error (y el mensaje general).
  const cambiar = (parcial, claveError) =>
    setD((x) => {
      const errores = { ...x.errores };
      delete errores[claveError];
      return { ...x, ...parcial, errores, error: "" };
    });

  // Ancianos en ALTA, ordenados por nombre.
  const opcionesPersona = datos.ancianos
    .map((p) => ({ id: String(p.id), nombre: `${p.apellido} ${p.nombre}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const nombrePersona = (id) =>
    opcionesPersona.find((o) => o.id === id)?.nombre || "";

  // Períodos que el cargo elegido ya tiene cargados.
  const periodosDelCargo =
    (cargos || []).find((c) => c.rol === d.rol)?.historial || [];

  // Tiempo transcurrido, solo si las dos fechas son válidas y en orden.
  const fechasValidas =
    d.inicio !== "" && d.fin !== "" && d.fin >= d.inicio && d.fin <= hoyISO();
  const tiempo = fechasValidas ? textoDuracion(d.inicio, d.fin, t) : "";

  // --- Validación en pantalla (el backend vuelve a validar) ---
  const validar = () => {
    const e = {};
    const hoy = hoyISO();
    if (!d.rol) e.rol = t("car_pa_err_rol", "Elija el cargo.");
    if (!d.personaId) {
      e.persona = t("car_pa_err_persona", "Elija a la persona.");
    }
    if (!d.inicio) {
      e.inicio = t("car_pa_err_inicio", "Falta la fecha de inicio.");
    } else if (d.inicio > hoy) {
      e.inicio = t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
    }
    if (!d.fin) {
      e.fin = t("car_pa_err_fin", "Falta la fecha de fin.");
    } else if (d.fin > hoy) {
      e.fin = t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
    }
    if (!e.inicio && !e.fin && d.fin < d.inicio) {
      e.fin = t("car_corr_err_orden", {
        defaultValue:
          "La fecha de fin no puede ser anterior al inicio ({{fecha}}).",
        fecha: fechaCorta(d.inicio),
      });
    }
    if (!d.motivoAltaId) {
      e.motivoAlta = t("car_err_motivo_alta", "Elija el motivo de alta.");
    }
    if (!d.motivoBajaId) {
      e.motivoBaja = t("car_err_motivo_baja", "Elija el motivo de baja.");
    }
    if (contarPalabras(d.detallesAlta) > MAX_PALABRAS) {
      e.detallesAlta = t("per_err_detalles_100", "Máximo 100 palabras.");
    }
    if (contarPalabras(d.detallesBaja) > MAX_PALABRAS) {
      e.detallesBaja = t("per_err_detalles_100", "Máximo 100 palabras.");
    }
    return e;
  };

  const aceptar = async () => {
    const e = validar();
    if (Object.keys(e).length > 0) {
      setD((x) => ({ ...x, errores: e, error: "" }));
      // Foco en el primer campo con error, en el orden de la pantalla.
      const orden = [
        "rol",
        "persona",
        "inicio",
        "motivoAlta",
        "detallesAlta",
        "fin",
        "motivoBaja",
        "detallesBaja",
      ];
      const primero = orden.find((k) => e[k]);
      document.getElementById(`car-pa-${primero}`)?.focus();
      return;
    }

    const cuerpo = {
      congregacion_id: congregacionId,
      rol: d.rol,
      persona_id: Number(d.personaId),
      fecha_inicio: d.inicio,
      fecha_fin: d.fin,
      motivo_alta_id: Number(d.motivoAltaId),
      motivo_baja_id: Number(d.motivoBajaId),
    };
    if (d.detallesAlta.trim()) cuerpo.detalles_alta = d.detallesAlta.trim();
    if (d.detallesBaja.trim()) cuerpo.detalles_baja = d.detallesBaja.trim();

    setD((x) => ({ ...x, errores: {}, enviando: true, error: "" }));
    try {
      await axios.post("/api/admin/cargos/periodo-anterior", cuerpo);
      setD(DIALOGO_CERRADO);
      onListo(t("car_pa_ok", "Se cargó el período anterior del cargo."));
    } catch (err) {
      setD((x) => ({
        ...x,
        enviando: false,
        error: textoError(
          err,
          t("car_pa_error", "No se pudo cargar el período anterior."),
        ),
      }));
    }
  };

  const sinAncianos =
    d.abierto && !cargandoDatos && !datos.error && datos.ancianos.length === 0;

  return (
    <>
      <Boton variante="suave" icono={History} onClick={abrir}>
        {t("car_pa_boton", "Cargar período anterior")}
      </Boton>

      <Confirmacion
        abierto={d.abierto}
        ancho="max-w-2xl"
        titulo={t("car_pa_titulo", "Cargar período anterior de un cargo")}
        mensaje={t(
          "car_pa_msg",
          "Para casos excepcionales, como un interino entre dos titulares. El período queda cerrado y no cambia a los titulares actuales.",
        )}
        textoAceptar={t("car_pa_guardar", "Cargar período")}
        cargando={d.enviando}
        error={d.error}
        onAceptar={aceptar}
        onCancelar={cerrar}
      >
        <div className="space-y-4">
          {cargandoDatos && (
            <div
              className="flex items-center gap-2 text-sm text-jw-text-main opacity-70"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin text-jw-accent" />
              {t("car_cargando_datos", "Cargando personas y motivos…")}
            </div>
          )}

          {d.abierto && !cargandoDatos && datos.error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-jw-text-main"
            >
              {t(
                "car_error_datos",
                "No se pudo cargar la lista de ancianos o de motivos. Cierre la ventana y vuelva a intentarlo.",
              )}
            </p>
          )}

          {sinAncianos && (
            <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-jw-text-main">
              <p>
                {t(
                  "car_sin_ancianos",
                  "Esta congregación no tiene ancianos en alta para elegir. Cargue primero a la persona en Personas, con situación 2 = Anciano.",
                )}
              </p>
              <Boton
                variante="suave"
                onClick={() => {
                  cerrar();
                  navigate(
                    `/personas/nueva?congregacion=${encodeURIComponent(congregacionId)}`,
                  );
                }}
              >
                {t(
                  "car_cargar_persona",
                  "Cargar una persona nueva en esta congregación",
                )}
              </Boton>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <CampoSelect
                id="car-pa-rol"
                label={t("car_pa_cargo", "Cargo")}
                obligatorio
                value={d.rol}
                error={d.errores.rol}
                ayuda={t("car_pa_ayuda_cargo", "Cargo del período que se carga.")}
                onChange={(e) => cambiar({ rol: e.target.value }, "rol")}
              >
                <option value="">{t("per_elegir", "Elegir…")}</option>
                {ORDEN_CARGOS.map((rol) => (
                  <option key={rol} value={rol}>
                    {nombreRol(rol)}
                  </option>
                ))}
              </CampoSelect>
            </div>
            <div className="min-w-0">
              <CampoSelect
                id="car-pa-persona"
                label={t("car_pa_persona", "Persona")}
                obligatorio
                value={d.personaId}
                error={d.errores.persona}
                ayuda={t(
                  "car_pa_ayuda_persona",
                  "Solo ancianos en alta de esta congregación.",
                )}
                onChange={(e) =>
                  cambiar({ personaId: e.target.value }, "persona")
                }
              >
                <option value="">{t("per_elegir", "Elegir…")}</option>
                {opcionesPersona.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </CampoSelect>
            </div>
          </div>

          {d.rol && <PeriodosCargados lista={periodosDelCargo} />}

          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
            {/* Columna del inicio. En el celular se apila primero el inicio y
                después el fin; en pantallas anchas cada fila une un campo de
                inicio con su par de fin, así quedan alineados. */}
            <p
              className={`min-w-0 text-xs font-medium text-jw-text-main opacity-70 ${POS_INI[0]}`}
            >
              {t("car_corr_inicio", "Inicio del cargo")}
            </p>
            <div className={`min-w-0 ${POS_INI[1]}`}>
              <CampoTexto
                id="car-pa-inicio"
                type="date"
                max={hoyISO()}
                label={t("per_h_desde", "Desde")}
                obligatorio
                value={d.inicio}
                error={d.errores.inicio}
                ayuda={t("car_corr_ayuda_inicio", "Día en que empezó el cargo.")}
                onChange={(e) => cambiar({ inicio: e.target.value }, "inicio")}
              />
            </div>
            <div className={`min-w-0 ${POS_INI[2]}`}>
              <CampoSelect
                id="car-pa-motivoAlta"
                label={t("per_motivo_alta", "Motivo de alta")}
                obligatorio
                value={d.motivoAltaId}
                error={d.errores.motivoAlta}
                ayuda={t("per_baja_ayuda_motivo", "Obligatorio.")}
                onChange={(e) =>
                  cambiar({ motivoAltaId: e.target.value }, "motivoAlta")
                }
              >
                <option value="">{t("per_elegir", "Elegir…")}</option>
                {datos.motivosAlta.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </CampoSelect>
            </div>
            <div className={`min-w-0 ${POS_INI[3]}`}>
              <CampoArea
                id="car-pa-detallesAlta"
                rows={2}
                maxLength={600}
                label={t("car_detalles_alta", "Detalles del alta")}
                value={d.detallesAlta}
                error={d.errores.detallesAlta}
                placeholder={t("car_pa_ph_detalles", "Ej.: Coordinador interino")}
                ayuda={t(
                  "car_ayuda_detalles",
                  "Opcional, hasta 100 palabras. Queda en el historial.",
                )}
                onChange={(e) =>
                  cambiar({ detallesAlta: e.target.value }, "detallesAlta")
                }
              />
            </div>

            {/* Columna del fin */}
            <p
              className={`min-w-0 text-xs font-medium text-jw-text-main opacity-70 ${POS_FIN[0]}`}
            >
              {t("car_corr_fin", "Fin del cargo")}
            </p>
            <div className={`min-w-0 ${POS_FIN[1]}`}>
              <CampoTexto
                id="car-pa-fin"
                type="date"
                max={hoyISO()}
                label={t("per_h_hasta", "Hasta")}
                obligatorio
                value={d.fin}
                error={d.errores.fin}
                ayuda={t("car_corr_ayuda_fin", "Último día en el cargo.")}
                onChange={(e) => cambiar({ fin: e.target.value }, "fin")}
              />
            </div>
            <div className={`min-w-0 ${POS_FIN[2]}`}>
              <CampoSelect
                id="car-pa-motivoBaja"
                label={t("per_motivo_baja", "Motivo de baja")}
                obligatorio
                value={d.motivoBajaId}
                error={d.errores.motivoBaja}
                ayuda={t("per_baja_ayuda_motivo", "Obligatorio.")}
                onChange={(e) =>
                  cambiar({ motivoBajaId: e.target.value }, "motivoBaja")
                }
              >
                <option value="">{t("per_elegir", "Elegir…")}</option>
                {datos.motivosBaja.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </CampoSelect>
            </div>
            <div className={`min-w-0 ${POS_FIN[3]}`}>
              <CampoArea
                id="car-pa-detallesBaja"
                rows={2}
                maxLength={600}
                label={t("car_detalles_baja", "Detalles de la baja")}
                value={d.detallesBaja}
                error={d.errores.detallesBaja}
                placeholder={t("car_pa_ph_detalles", "Ej.: Coordinador interino")}
                ayuda={t(
                  "car_ayuda_detalles",
                  "Opcional, hasta 100 palabras. Queda en el historial.",
                )}
                onChange={(e) =>
                  cambiar({ detallesBaja: e.target.value }, "detallesBaja")
                }
              />
            </div>
          </div>

          {/* Resumen de lo que se va a cargar: Desde y Hasta siempre en bloques
              separados y en el mismo lugar, con el tiempo en el cargo. */}
          {d.rol && d.personaId && fechasValidas && (
            <div className="rounded-xl border border-jw-border px-3 py-2 text-sm text-jw-text-main">
              <p className="mb-1 text-xs font-medium opacity-60">
                {t("car_pa_resumen", "Así quedará cargado")}
              </p>
              <p className="mb-2 break-words">
                <LineaRotulada rotulo={nombreRol(d.rol)}>
                  {nombrePersona(d.personaId)}
                </LineaRotulada>
              </p>
              <dl className="grid grid-cols-2 gap-2">
                <Bloque rotulo={t("per_h_desde", "Desde")}>
                  <Fecha valor={d.inicio} />
                </Bloque>
                <Bloque rotulo={t("per_h_hasta", "Hasta")}>
                  <Fecha valor={d.fin} />
                </Bloque>
                <Bloque
                  rotulo={t("car_tiempo_cargo", "Tiempo en el cargo")}
                  className="col-span-2"
                >
                  {tiempo || <span aria-hidden="true">—</span>}
                </Bloque>
              </dl>
            </div>
          )}
        </div>
      </Confirmacion>
    </>
  );
}

export default CargarPeriodoAnterior;
