/**
 * ARCHIVO: CorregirCargo.jsx
 * UBICACIÓN: frontend/src/components/personas/CorregirCargo.jsx
 * DESCRIPCIÓN: Ventana "Corregir" de un período del historial de un cargo
 * (coordinador, secretario o servicio). Solo la usa el superadmin.
 *
 * Qué se puede corregir:
 *  - Período CERRADO: fecha de inicio, fecha de fin, motivo y detalles de
 *    inicio, motivo y detalles de fin.
 *  - Período VIGENTE: solo fecha de inicio, motivo y detalles de inicio. El
 *    backend no admite fecha ni datos de fin en un cargo vigente (400).
 *
 * Dos pedidos, en este orden y solo si hay algo que guardar en cada uno:
 *  1) POST /api/personas/roles/fechas  { id, fecha_inicio?, fecha_fin? }
 *  2) POST /api/admin/cargos/corregir  { id, motivo_inicio_id?,
 *     detalles_inicio?, motivo_fin_id?, detalles_fin? }
 * `id` es el de la FILA del historial (no el de la persona). Solo se manda
 * lo que cambió. Los detalles vacíos borran el texto. Una fecha o un motivo
 * ya cargados no se pueden dejar vacíos.
 *
 * Si el 1) se guarda y el 2) falla, la ventana lo avisa (las fechas ya
 * quedaron guardadas) y deja reintentar sin volver a mandar las fechas. Al
 * cancelar después de un guardado parcial, se avisa en la pantalla y se
 * recargan los datos.
 *
 * La pantalla la dibuja solo mientras hay un período elegido y con
 * `key={fila.id}`: así cada apertura arranca con los datos de esa fila.
 *
 * Props: fila (período del historial), rol, onCerrar(), onListo(texto).
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { Loader2 } from "lucide-react";
import Confirmacion from "../ui/Confirmacion";
import LineaRotulada from "../ui/LineaRotulada";
import { CampoArea, CampoSelect, CampoTexto } from "../ui/Campo";
import { ROLES, motivosAltaCargo } from "../../config/personasConfig";
import { fechaCorta, hoyISO } from "../../lib/fechas";
import { textoError } from "../../lib/gruposApi";

const MAX_PALABRAS = 100;

// Valor del desplegable cuando el motivo guardado no está en la lista
// (por ejemplo, un motivo que se desactivó): se muestra su texto tal cual.
const MISMO = "__actual";

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

const contarPalabras = (texto) =>
  String(texto || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const soloFecha = (texto) => (texto ? String(texto).slice(0, 10) : "");

const listaMotivos = (resp) =>
  Array.isArray(resp?.data?.motivos) ? resp.data.motivos : [];

// Valor inicial de un desplegable de motivo: el id del motivo cuyo nombre
// coincide con el guardado, MISMO si hay texto sin coincidencia, o "".
function motivoInicial(texto, motivos) {
  if (!texto) return "";
  const m = motivos.find((x) => x.nombre === texto);
  return m ? String(m.id) : MISMO;
}

function CorregirCargo({ fila, rol, onCerrar, onListo }) {
  const { t } = useTranslation();
  const r = ROLES[rol];
  const nombreRol = r ? t(r[0], r[1]) : rol;
  const vigente = !!fila.vigente;

  // Fechas con las que se compara (cambian si ya se guardaron las fechas).
  const [base, setBase] = useState({
    inicio: soloFecha(fila.fecha_inicio),
    fin: soloFecha(fila.fecha_fin),
  });
  // `motivoIni` / `motivoFin` son undefined mientras no se toquen.
  const [f, setF] = useState({
    inicio: soloFecha(fila.fecha_inicio),
    fin: soloFecha(fila.fecha_fin),
    motivoIni: undefined,
    motivoFin: undefined,
    detIni: fila.detalles_inicio || "",
    detFin: fila.detalles_fin || "",
  });
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [parcial, setParcial] = useState(false);
  const [datos, setDatos] = useState(null); // { alta, baja, error }

  // Motivos de alta y de baja de cargo (al abrir la ventana).
  useEffect(() => {
    const control = new AbortController();
    Promise.all([
      axios.get("/api/personas/motivos", {
        params: { uso: "cargo_alta" },
        signal: control.signal,
      }),
      axios.get("/api/personas/motivos", {
        params: { uso: "cargo_baja" },
        signal: control.signal,
      }),
    ])
      .then(([alta, baja]) =>
        setDatos({
          alta: listaMotivos(alta),
          baja: listaMotivos(baja),
          error: false,
        }),
      )
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setDatos({ alta: [], baja: [], error: true });
      });
    return () => control.abort();
  }, []);

  // La ventana es larga: el foco arranca en la fecha de inicio (arriba), no
  // en el botón Cancelar (abajo).
  useEffect(() => {
    const campo = document.getElementById("car-corr-inicio");
    if (!campo) return;
    const cuadro = campo.closest('[role="alertdialog"]');
    if (cuadro) cuadro.scrollTop = 0;
    campo.focus({ preventScroll: true });
  }, []);

  const cargandoDatos = datos === null;
  const alta = motivosAltaCargo(datos?.alta || []);
  const baja = datos?.baja || [];
  const inicialIni = motivoInicial(fila.motivo_inicio, alta);
  const inicialFin = motivoInicial(fila.motivo_fin, baja);
  const valIni = f.motivoIni ?? inicialIni;
  const valFin = f.motivoFin ?? inicialFin;

  // --- Qué cambió ---
  const cambioIni = f.inicio !== base.inicio;
  const cambioFin = !vigente && f.fin !== base.fin;
  const cambioMotIni =
    f.motivoIni !== undefined &&
    f.motivoIni !== "" &&
    f.motivoIni !== MISMO &&
    f.motivoIni !== inicialIni;
  const cambioMotFin =
    !vigente &&
    f.motivoFin !== undefined &&
    f.motivoFin !== "" &&
    f.motivoFin !== MISMO &&
    f.motivoFin !== inicialFin;
  const cambioDetIni =
    f.detIni.trim() !== String(fila.detalles_inicio || "").trim();
  const cambioDetFin =
    !vigente && f.detFin.trim() !== String(fila.detalles_fin || "").trim();
  const hayFechas = cambioIni || cambioFin;
  const hayDatos =
    cambioMotIni || cambioMotFin || cambioDetIni || cambioDetFin;

  // Cambia un campo y borra su error (y el mensaje general).
  const cambiar = (parcialF, claveError) => {
    setF((x) => ({ ...x, ...parcialF }));
    setErrores((x) => {
      const n = { ...x };
      delete n[claveError];
      return n;
    });
    setError("");
  };

  // --- Validación en pantalla (el backend vuelve a validar) ---
  const validar = () => {
    const e = {};
    const hoy = hoyISO();
    if (base.inicio && !f.inicio) {
      e.inicio = t(
        "car_corr_err_borrar",
        "Una fecha ya cargada no se puede dejar vacía.",
      );
    } else if (f.inicio > hoy) {
      e.inicio = t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
    }
    if (!vigente) {
      if (base.fin && !f.fin) {
        e.fin = t(
          "car_corr_err_borrar",
          "Una fecha ya cargada no se puede dejar vacía.",
        );
      } else if (f.fin > hoy) {
        e.fin = t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
      }
    }
    if (!e.inicio && !e.fin && f.inicio && f.fin && !vigente && f.fin < f.inicio) {
      e.fin = t("car_corr_err_orden", {
        defaultValue:
          "La fecha de fin no puede ser anterior al inicio ({{fecha}}).",
        fecha: fechaCorta(f.inicio),
      });
    }
    if (contarPalabras(f.detIni) > MAX_PALABRAS) {
      e.detIni = t("per_err_detalles_100", "Máximo 100 palabras.");
    }
    if (!vigente && contarPalabras(f.detFin) > MAX_PALABRAS) {
      e.detFin = t("per_err_detalles_100", "Máximo 100 palabras.");
    }
    return e;
  };

  const aceptar = async () => {
    const e = validar();
    if (Object.keys(e).length > 0) {
      setErrores(e);
      setError("");
      const primero = ["inicio", "fin", "detIni", "detFin"].find((k) => e[k]);
      document.getElementById(`car-corr-${primero}`)?.focus();
      return;
    }
    if (!hayFechas && !hayDatos) {
      setError(
        t(
          "car_corr_sin_cambios",
          "No cambió nada: modifique al menos un dato para guardar.",
        ),
      );
      return;
    }

    setErrores({});
    setError("");
    setEnviando(true);
    let guardoFechas = false;
    try {
      if (hayFechas) {
        const cuerpo = { id: fila.id };
        if (cambioIni) cuerpo.fecha_inicio = f.inicio;
        if (cambioFin) cuerpo.fecha_fin = f.fin;
        await axios.post("/api/personas/roles/fechas", cuerpo);
        guardoFechas = true;
      }
      if (hayDatos) {
        const cuerpo = { id: fila.id };
        if (cambioMotIni) cuerpo.motivo_inicio_id = Number(f.motivoIni);
        if (cambioDetIni) cuerpo.detalles_inicio = f.detIni.trim();
        if (cambioMotFin) cuerpo.motivo_fin_id = Number(f.motivoFin);
        if (cambioDetFin) cuerpo.detalles_fin = f.detFin.trim();
        await axios.post("/api/admin/cargos/corregir", cuerpo);
      }
      onListo(t("car_corr_ok", "Se corrigió el período del cargo."));
    } catch (err) {
      const texto = textoError(
        err,
        t("car_corr_error", "No se pudo corregir el período."),
      );
      if (guardoFechas) {
        // Las fechas ya están guardadas: no se vuelven a mandar al reintentar.
        setBase({ inicio: f.inicio, fin: f.fin });
        setParcial(true);
        setError(
          t("car_corr_error_parcial", {
            defaultValue:
              "Las fechas ya se guardaron, pero los motivos o detalles no: {{error}}",
            error: texto,
          }),
        );
      } else {
        setError(texto);
      }
      setEnviando(false);
    }
  };

  const cancelar = () => {
    if (parcial) {
      onListo(
        t(
          "car_corr_parcial",
          "Se guardaron las fechas del período; los motivos o detalles no.",
        ),
      );
    } else {
      onCerrar();
    }
  };

  const opcionesMotivo = (lista, valorInicial, textoGuardado) => (
    <>
      {valorInicial === "" && (
        <option value="">
          {t("car_corr_sin_motivo", "Sin motivo cargado")}
        </option>
      )}
      {valorInicial === MISMO && <option value={MISMO}>{textoGuardado}</option>}
      {lista.map((m) => (
        <option key={m.id} value={m.id}>
          {m.nombre}
        </option>
      ))}
    </>
  );

  return (
    <Confirmacion
      abierto
      ancho="max-w-2xl"
      titulo={t("car_corr_titulo", "Corregir período del cargo")}
      mensaje={
        <LineaRotulada rotulo={nombreRol}>
          {`${fila.apellido || ""} ${fila.nombre || ""}`.trim()}
        </LineaRotulada>
      }
      textoAceptar={t("car_corr_guardar", "Guardar corrección")}
      cargando={enviando}
      error={error}
      onAceptar={aceptar}
      onCancelar={cancelar}
    >
      <div className="space-y-4">
        {vigente && (
          <p className="rounded-xl border border-jw-border px-3 py-2 text-xs text-jw-text-main opacity-70">
            {t(
              "car_corr_vigente",
              "Este período está vigente: solo se corrige el inicio. La fecha y los datos de fin se cargan cuando el cargo se cierra.",
            )}
          </p>
        )}

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
              id="car-corr-inicio"
              type="date"
              max={hoyISO()}
              label={t("per_h_desde", "Desde")}
              value={f.inicio}
              error={errores.inicio}
              ayuda={
                base.inicio
                  ? t("car_corr_ayuda_inicio", "Día en que empezó el cargo.")
                  : t(
                      "car_corr_ayuda_inicio_vacio",
                      "Sin fecha cargada. Complétela si la conoce.",
                    )
              }
              onChange={(e) => cambiar({ inicio: e.target.value }, "inicio")}
            />
          </div>
          <div className={`min-w-0 ${POS_INI[2]}`}>
            <CampoSelect
              id="car-corr-motivoIni"
              label={t("per_motivo_alta", "Motivo de alta")}
              value={cargandoDatos ? "" : valIni}
              disabled={cargandoDatos || datos?.error}
              ayuda={t(
                "car_corr_ayuda_motivo",
                "Se puede cambiar por otro, no dejar vacío.",
              )}
              onChange={(e) => cambiar({ motivoIni: e.target.value }, "motivoIni")}
            >
              {cargandoDatos ? (
                <option value="">{t("car_corr_cargando", "Cargando…")}</option>
              ) : (
                opcionesMotivo(alta, inicialIni, fila.motivo_inicio)
              )}
            </CampoSelect>
          </div>
          <div className={`min-w-0 ${POS_INI[3]}`}>
            <CampoArea
              id="car-corr-detIni"
              rows={2}
              maxLength={600}
              label={t("car_detalles_alta", "Detalles del alta")}
              value={f.detIni}
              error={errores.detIni}
              placeholder={t("car_ph_detalles_alta", "Ej.: Asume por reestructuración")}
              ayuda={t(
                "car_corr_ayuda_detalles",
                "Opcional, hasta 100 palabras. Vacío borra el texto.",
              )}
              onChange={(e) => cambiar({ detIni: e.target.value }, "detIni")}
            />
          </div>

          {/* Columna del fin (en un cargo vigente no hay nada que corregir) */}
          <p
            className={`min-w-0 text-xs font-medium text-jw-text-main opacity-70 ${POS_FIN[0]}`}
          >
            {t("car_corr_fin", "Fin del cargo")}
          </p>
          {vigente ? (
            <div className={`min-w-0 ${POS_FIN[1]}`}>
              <p className="mb-1 text-xs font-medium text-jw-text-main opacity-70">
                {t("per_h_hasta", "Hasta")}
              </p>
              <div
                className="rounded-xl border border-jw-border bg-jw-body px-3 py-2 text-sm text-jw-text-main opacity-70"
                aria-hidden="true"
              >
                —
              </div>
            </div>
          ) : (
            <>
              <div className={`min-w-0 ${POS_FIN[1]}`}>
                <CampoTexto
                  id="car-corr-fin"
                  type="date"
                  max={hoyISO()}
                  label={t("per_h_hasta", "Hasta")}
                  value={f.fin}
                  error={errores.fin}
                  ayuda={
                    base.fin
                      ? t("car_corr_ayuda_fin", "Último día en el cargo.")
                      : t(
                          "car_corr_ayuda_fin_vacio",
                          "Sin fecha cargada. Complétela si la conoce.",
                        )
                  }
                  onChange={(e) => cambiar({ fin: e.target.value }, "fin")}
                />
              </div>
              <div className={`min-w-0 ${POS_FIN[2]}`}>
                <CampoSelect
                  id="car-corr-motivoFin"
                  label={t("per_motivo_baja", "Motivo de baja")}
                  value={cargandoDatos ? "" : valFin}
                  disabled={cargandoDatos || datos?.error}
                  ayuda={t(
                    "car_corr_ayuda_motivo",
                    "Se puede cambiar por otro, no dejar vacío.",
                  )}
                  onChange={(e) =>
                    cambiar({ motivoFin: e.target.value }, "motivoFin")
                  }
                >
                  {cargandoDatos ? (
                    <option value="">
                      {t("car_corr_cargando", "Cargando…")}
                    </option>
                  ) : (
                    opcionesMotivo(baja, inicialFin, fila.motivo_fin)
                  )}
                </CampoSelect>
              </div>
              <div className={`min-w-0 ${POS_FIN[3]}`}>
                <CampoArea
                  id="car-corr-detFin"
                  rows={2}
                  maxLength={600}
                  label={t("car_detalles_baja", "Detalles de la baja")}
                  value={f.detFin}
                  error={errores.detFin}
                  placeholder={t("car_ph_detalles_baja", "Ej.: Cambio de asignación")}
                  ayuda={t(
                    "car_corr_ayuda_detalles",
                    "Opcional, hasta 100 palabras. Vacío borra el texto.",
                  )}
                  onChange={(e) => cambiar({ detFin: e.target.value }, "detFin")}
                />
              </div>
            </>
          )}
        </div>

        {cargandoDatos && (
          <div
            className="flex items-center gap-2 text-sm text-jw-text-main opacity-70"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin text-jw-accent" />
            {t("car_corr_cargando_motivos", "Cargando motivos…")}
          </div>
        )}

        {!cargandoDatos && datos?.error && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-jw-text-main"
          >
            {t(
              "car_corr_error_motivos",
              "No se pudo cargar la lista de motivos. Puede corregir fechas y detalles; para cambiar un motivo cierre la ventana y vuelva a intentarlo.",
            )}
          </p>
        )}
      </div>
    </Confirmacion>
  );
}

export default CorregirCargo;
