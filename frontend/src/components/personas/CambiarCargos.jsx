/**
 * ARCHIVO: CambiarCargos.jsx
 * UBICACIÓN: frontend/src/components/personas/CambiarCargos.jsx
 * DESCRIPCIÓN: Botón "Cambiar cargos" y su ventana: cambia a la vez los tres
 * cargos de una congregación (coordinador, secretario y servicio). Solo lo
 * usa el superadmin (pantalla de cargos).
 *
 * POST /api/admin/cargos/cambiar
 *   { congregacion_id, fecha, coordinador, secretario, servicio }
 * donde cada cargo es { persona_id, motivo_alta_id?, detalles_alta?,
 * motivo_baja_id?, detalles_baja? }.
 *
 * Reglas (el backend vuelve a validarlas):
 *  - Los TRES cargos llevan siempre una persona. Si es el titular actual, ese
 *    cargo no cambia y no pide motivos.
 *  - Un cargo que cambia pide motivo de alta (del nuevo titular) y, si ya
 *    había titular, motivo de baja. Los detalles son opcionales (100 palabras).
 *  - Una sola fecha para todo el cambio (hoy o anterior, nunca futura, ni
 *    anterior al inicio del período que se cierra).
 *  - Solo se ofrecen ancianos en ALTA de la congregación (más el titular
 *    actual, para que "sin cambios" siempre se pueda elegir).
 *  - Una misma persona puede tener dos o los tres cargos: la ventana lo avisa
 *    antes de guardar.
 *  - Si ningún cargo cambia, no se guarda (el backend responde 409).
 *  - Las personas no se crean acá: se cargan en Personas y acá se eligen.
 *
 * Props: congregacionId, cargos ([{ rol, titular }]), onListo(texto).
 * Los errores del backend se muestran dentro de la ventana, sin cerrarla.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2, UserCog } from "lucide-react";
import Boton from "../ui/Boton";
import Confirmacion from "../ui/Confirmacion";
import { CampoArea, CampoSelect, CampoTexto } from "../ui/Campo";
import { ROLES } from "../../config/personasConfig";
import { hoyISO, fechaCorta } from "../../lib/fechas";
import { textoError } from "../../lib/gruposApi";

const ORDEN_CARGOS = ["coordinador", "secretario", "servicio"];
const MAX_PALABRAS = 100;
const LIMITE_PAGINA = 50; // máximo que acepta el backend
const MAX_PAGINAS = 10; // tope de seguridad

const CARGO_VACIO = {
  personaId: "",
  motivoAltaId: "",
  detallesAlta: "",
  motivoBajaId: "",
  detallesBaja: "",
};

const DIALOGO_CERRADO = {
  abierto: false,
  fecha: "",
  cargos: {},
  errores: {},
  enviando: false,
  error: "",
};

const contarPalabras = (texto) =>
  String(texto || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const soloFecha = (texto) => (texto ? String(texto).slice(0, 10) : "");

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

const listaMotivos = (resp) =>
  Array.isArray(resp?.data?.motivos) ? resp.data.motivos : [];

// Un cargo dentro de la ventana: quién lo ocupa y, si cambia, los motivos.
function EditorCargo({
  rol,
  titular,
  valor,
  opciones,
  motivosAlta,
  motivosBaja,
  errores,
  nombreNuevo,
  onCambiar,
}) {
  const { t } = useTranslation();
  const r = ROLES[rol];
  const nombreRol = r ? t(r[0], r[1]) : rol;
  const titularId = titular ? String(titular.persona_id) : "";
  const nombreTitular = titular ? `${titular.apellido} ${titular.nombre}` : "";
  const cambia = valor.personaId !== "" && valor.personaId !== titularId;
  const id = (k) => `car-${rol}-${k}`;

  return (
    <fieldset className="min-w-0 space-y-3 rounded-2xl border border-jw-border p-4 text-start">
      <legend className="px-2 text-sm font-semibold uppercase tracking-wide text-jw-text-main">
        {nombreRol}
      </legend>

      <CampoSelect
        id={id("persona")}
        label={t("car_titular", "Titular")}
        obligatorio
        value={valor.personaId}
        error={errores[`${rol}.persona`]}
        ayuda={
          titular
            ? t("car_titular_actual", {
                defaultValue: "Titular actual: {{nombre}}.",
                nombre: nombreTitular,
              })
            : t("car_cargo_vacante", "Este cargo está vacante.")
        }
        onChange={(e) => onCambiar(rol, { personaId: e.target.value })}
      >
        {valor.personaId === "" && (
          <option value="">{t("per_elegir", "Elegir…")}</option>
        )}
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </CampoSelect>

      {valor.personaId !== "" && !cambia && (
        <p className="text-xs text-jw-text-main opacity-60">
          {t(
            "car_sin_cambios",
            "Sin cambios: este cargo sigue como está y no pide motivos.",
          )}
        </p>
      )}

      {cambia && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {titular && (
            <div className="min-w-0 space-y-3">
              <CampoSelect
                id={id("motivoBaja")}
                label={t("car_motivo_baja_de", {
                  defaultValue: "Motivo de baja de {{nombre}}",
                  nombre: nombreTitular,
                })}
                obligatorio
                value={valor.motivoBajaId}
                error={errores[`${rol}.motivoBaja`]}
                ayuda={t("per_baja_ayuda_motivo", "Obligatorio.")}
                onChange={(e) =>
                  onCambiar(rol, { motivoBajaId: e.target.value })
                }
              >
                <option value="">{t("per_elegir", "Elegir…")}</option>
                {motivosBaja.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </CampoSelect>
              <CampoArea
                id={id("detallesBaja")}
                rows={2}
                maxLength={600}
                label={t("car_detalles_baja", "Detalles de la baja")}
                value={valor.detallesBaja}
                error={errores[`${rol}.detallesBaja`]}
                placeholder={t("car_ph_detalles_baja", "Ej.: Cambio de asignación")}
                ayuda={t(
                  "car_ayuda_detalles",
                  "Opcional, hasta 100 palabras. Queda en el historial.",
                )}
                onChange={(e) =>
                  onCambiar(rol, { detallesBaja: e.target.value })
                }
              />
            </div>
          )}

          <div className={`min-w-0 space-y-3 ${titular ? "" : "sm:col-span-2"}`}>
            <CampoSelect
              id={id("motivoAlta")}
              label={t("car_motivo_alta_de", {
                defaultValue: "Motivo de alta de {{nombre}}",
                nombre: nombreNuevo,
              })}
              obligatorio
              value={valor.motivoAltaId}
              error={errores[`${rol}.motivoAlta`]}
              ayuda={t("per_baja_ayuda_motivo", "Obligatorio.")}
              onChange={(e) => onCambiar(rol, { motivoAltaId: e.target.value })}
            >
              <option value="">{t("per_elegir", "Elegir…")}</option>
              {motivosAlta.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </CampoSelect>
            <CampoArea
              id={id("detallesAlta")}
              rows={2}
              maxLength={600}
              label={t("car_detalles_alta", "Detalles del alta")}
              value={valor.detallesAlta}
              error={errores[`${rol}.detallesAlta`]}
              placeholder={t("car_ph_detalles_alta", "Ej.: Asume por reestructuración")}
              ayuda={t(
                "car_ayuda_detalles",
                "Opcional, hasta 100 palabras. Queda en el historial.",
              )}
              onChange={(e) => onCambiar(rol, { detallesAlta: e.target.value })}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

function CambiarCargos({ congregacionId, cargos, onListo }) {
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

  const titularDe = (rol) =>
    cargos.find((c) => c.rol === rol)?.titular || null;
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

  // La ventana es larga: al abrirla el foco va a la fecha (arriba), no al
  // botón Cancelar (abajo).
  useEffect(() => {
    if (!d.abierto) return;
    const campo = document.getElementById("car-fecha");
    if (!campo) return;
    const cuadro = campo.closest('[role="alertdialog"]');
    if (cuadro) cuadro.scrollTop = 0;
    campo.focus({ preventScroll: true });
  }, [d.abierto]);

  const abrir = () => {
    const iniciales = {};
    ORDEN_CARGOS.forEach((rol) => {
      iniciales[rol] = {
        ...CARGO_VACIO,
        personaId: String(titularDe(rol)?.persona_id ?? ""),
      };
    });
    setAperturas((a) => a + 1);
    setD({
      ...DIALOGO_CERRADO,
      abierto: true,
      fecha: hoyISO(),
      cargos: iniciales,
    });
  };
  const cerrar = () => setD(DIALOGO_CERRADO);

  const cambiarFecha = (fecha) =>
    setD((x) => {
      const errores = { ...x.errores };
      delete errores.fecha;
      return { ...x, fecha, errores, error: "" };
    });

  // Cambia datos de un cargo y borra los errores de ese cargo.
  const cambiarCargo = (rol, parcial) =>
    setD((x) => {
      const errores = {};
      Object.keys(x.errores).forEach((k) => {
        if (!k.startsWith(`${rol}.`)) errores[k] = x.errores[k];
      });
      return {
        ...x,
        cargos: { ...x.cargos, [rol]: { ...x.cargos[rol], ...parcial } },
        errores,
        error: "",
      };
    });

  // --- Personas que se pueden elegir (ancianos + el titular actual) ---
  const opcionesDe = (rol) => {
    const mapa = new Map();
    datos.ancianos.forEach((p) =>
      mapa.set(String(p.id), `${p.apellido} ${p.nombre}`),
    );
    const tit = titularDe(rol);
    if (tit) {
      mapa.set(String(tit.persona_id), `${tit.apellido} ${tit.nombre}`);
    }
    return Array.from(mapa, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  };
  const nombrePersona = (id) => {
    if (!id) return "";
    const ancianos = datos.ancianos.find((p) => String(p.id) === id);
    if (ancianos) return `${ancianos.apellido} ${ancianos.nombre}`;
    const tit = ORDEN_CARGOS.map(titularDe).find(
      (x) => x && String(x.persona_id) === id,
    );
    return tit ? `${tit.apellido} ${tit.nombre}` : "";
  };

  const cambia = (rol) => {
    const c = d.cargos[rol];
    if (!c || c.personaId === "") return false;
    return c.personaId !== String(titularDe(rol)?.persona_id ?? "");
  };
  const roles = d.abierto ? ORDEN_CARGOS : [];
  const huboCambios = roles.some(cambia);

  // Personas con más de un cargo (aviso antes de guardar).
  const porPersona = {};
  roles.forEach((rol) => {
    const id = d.cargos[rol]?.personaId;
    if (!id) return;
    if (!porPersona[id]) porPersona[id] = [];
    porPersona[id].push(rol);
  });
  const repetidas = Object.entries(porPersona).filter(
    ([, lista]) => lista.length > 1,
  );
  const unir = (lista) =>
    lista.length <= 1
      ? lista.join("")
      : `${lista.slice(0, -1).join(", ")} ${t("car_y", "y")} ${lista[lista.length - 1]}`;

  // --- Validación en pantalla (el backend vuelve a validar) ---
  const validar = () => {
    const e = {};
    if (!d.fecha) {
      e.fecha = t("per_err_fecha", "Falta la fecha.");
    } else if (d.fecha > hoyISO()) {
      e.fecha = t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
    }

    ORDEN_CARGOS.forEach((rol) => {
      const c = d.cargos[rol];
      const tit = titularDe(rol);
      if (c.personaId === "") {
        e[`${rol}.persona`] = t(
          "car_err_persona",
          "Elija quién ocupará este cargo.",
        );
        return;
      }
      if (!cambia(rol)) return;
      if (!c.motivoAltaId) {
        e[`${rol}.motivoAlta`] = t(
          "car_err_motivo_alta",
          "Elija el motivo de alta.",
        );
      }
      if (tit && !c.motivoBajaId) {
        e[`${rol}.motivoBaja`] = t(
          "car_err_motivo_baja",
          "Elija el motivo de baja.",
        );
      }
      if (contarPalabras(c.detallesAlta) > MAX_PALABRAS) {
        e[`${rol}.detallesAlta`] = t("per_err_detalles_100", "Máximo 100 palabras.");
      }
      if (contarPalabras(c.detallesBaja) > MAX_PALABRAS) {
        e[`${rol}.detallesBaja`] = t("per_err_detalles_100", "Máximo 100 palabras.");
      }
      // La fecha no puede ser anterior al inicio del período que se cierra.
      const inicio = soloFecha(tit?.fecha_inicio);
      if (tit && inicio && d.fecha && !e.fecha && d.fecha < inicio) {
        e.fecha = t("car_err_fecha_inicio", {
          defaultValue:
            "La fecha no puede ser anterior al inicio del período que se cierra ({{fecha}}).",
          fecha: fechaCorta(inicio),
        });
      }
    });
    return e;
  };

  const aceptar = async () => {
    const e = validar();
    if (Object.keys(e).length > 0) {
      setD((x) => ({ ...x, errores: e, error: "" }));
      // Foco en el primer campo con error, en el orden de la pantalla.
      const orden = ["fecha"];
      ORDEN_CARGOS.forEach((rol) =>
        ["persona", "motivoBaja", "detallesBaja", "motivoAlta", "detallesAlta"].forEach(
          (k) => orden.push(`${rol}.${k}`),
        ),
      );
      const primero = orden.find((k) => e[k]);
      document
        .getElementById(primero === "fecha" ? "car-fecha" : `car-${primero.replace(".", "-")}`)
        ?.focus();
      return;
    }
    if (!huboCambios) {
      setD((x) => ({
        ...x,
        errores: {},
        error: t(
          "car_err_sin_cambios",
          "No hay nada que cambiar: elija al menos un titular distinto del actual.",
        ),
      }));
      return;
    }

    const cuerpo = { congregacion_id: congregacionId, fecha: d.fecha };
    ORDEN_CARGOS.forEach((rol) => {
      const c = d.cargos[rol];
      const item = { persona_id: Number(c.personaId) };
      if (cambia(rol)) {
        item.motivo_alta_id = Number(c.motivoAltaId);
        if (c.detallesAlta.trim()) item.detalles_alta = c.detallesAlta.trim();
        if (titularDe(rol)) {
          item.motivo_baja_id = Number(c.motivoBajaId);
          if (c.detallesBaja.trim()) item.detalles_baja = c.detallesBaja.trim();
        }
      }
      cuerpo[rol] = item;
    });

    setD((x) => ({ ...x, errores: {}, enviando: true, error: "" }));
    try {
      await axios.post("/api/admin/cargos/cambiar", cuerpo);
      setD(DIALOGO_CERRADO);
      onListo(t("car_ok", "Se actualizaron los cargos de la congregación."));
    } catch (err) {
      setD((x) => ({
        ...x,
        enviando: false,
        error: textoError(
          err,
          t("car_error_cambiar", "No se pudieron cambiar los cargos."),
        ),
      }));
    }
  };

  const sinAncianos =
    d.abierto && !cargandoDatos && !datos.error && datos.ancianos.length === 0;

  return (
    <>
      <Boton icono={UserCog} onClick={abrir}>
        {t("car_cambiar", "Cambiar cargos")}
      </Boton>

      <Confirmacion
        abierto={d.abierto}
        ancho="max-w-2xl"
        titulo={t("car_cambiar_titulo", "Cambiar cargos")}
        mensaje={t(
          "car_cambiar_msg",
          "Elija quién ocupará cada cargo. Los tres cargos siempre quedan cubiertos. Los que no cambian no piden motivo.",
        )}
        textoAceptar={t("car_guardar", "Guardar cambios")}
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

          <CampoTexto
            id="car-fecha"
            type="date"
            max={hoyISO()}
            label={t("car_fecha", "Fecha del cambio")}
            obligatorio
            value={d.fecha}
            error={d.errores.fecha}
            ayuda={t(
              "car_ayuda_fecha",
              "Una sola fecha para todo el cambio. Por defecto es hoy; puede ser una fecha pasada.",
            )}
            onChange={(e) => cambiarFecha(e.target.value)}
          />

          {d.abierto &&
            ORDEN_CARGOS.map((rol) => (
              <EditorCargo
                key={rol}
                rol={rol}
                titular={titularDe(rol)}
                valor={d.cargos[rol]}
                opciones={opcionesDe(rol)}
                motivosAlta={datos.motivosAlta}
                motivosBaja={datos.motivosBaja}
                errores={d.errores}
                nombreNuevo={nombrePersona(d.cargos[rol]?.personaId)}
                onCambiar={cambiarCargo}
              />
            ))}

          {/* Una persona con más de un cargo: aviso destacado antes de guardar */}
          {repetidas.length > 0 && (
            <div
              role="status"
              className="space-y-1 rounded-xl border border-amber-500/60 bg-amber-500/15 px-3 py-2 text-sm text-jw-text-main"
            >
              {repetidas.map(([id, lista]) => (
                <p key={id} className="font-medium break-words">
                  {t("car_repetida", {
                    defaultValue: "Atención: {{nombre}} quedará como {{cargos}}.",
                    nombre: nombrePersona(id),
                    cargos: unir(lista.map(nombreRol)),
                  })}
                </p>
              ))}
            </div>
          )}

          {/* Resumen de lo que se va a cambiar */}
          {huboCambios && (
            <div className="rounded-xl border border-jw-border px-3 py-2 text-sm text-jw-text-main">
              <p className="mb-1 text-xs font-medium opacity-60">
                {t("car_resumen", "Resumen del cambio")}
              </p>
              <ul className="space-y-0.5">
                {ORDEN_CARGOS.filter(cambia).map((rol) => {
                  const tit = titularDe(rol);
                  const nuevo = nombrePersona(d.cargos[rol].personaId);
                  return (
                    <li key={rol} className="break-words">
                      {tit
                        ? t("car_resumen_cambia", {
                            defaultValue: "{{cargo}}: de {{antes}} a {{despues}}.",
                            cargo: nombreRol(rol),
                            antes: `${tit.apellido} ${tit.nombre}`,
                            despues: nuevo,
                          })
                        : t("car_resumen_vacante", {
                            defaultValue: "{{cargo}}: {{despues}} (estaba vacante).",
                            cargo: nombreRol(rol),
                            despues: nuevo,
                          })}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </Confirmacion>
    </>
  );
}

export default CambiarCargos;
