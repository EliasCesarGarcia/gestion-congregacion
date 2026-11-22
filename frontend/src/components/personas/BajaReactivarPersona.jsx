/**
 * ARCHIVO: BajaReactivarPersona.jsx
 * UBICACIÓN: frontend/src/components/personas/BajaReactivarPersona.jsx
 * DESCRIPCIÓN: Botón "Dar de baja" (si la persona está en ALTA) o "Reactivar"
 * (si está en BAJA), con su diálogo de confirmación (paso 3.5).
 *
 * BAJA: POST /api/personas/baja { id, fecha, motivo_id, detalles? }
 *  - Fecha: hoy por defecto; se puede elegir una anterior (por si se olvidó
 *    registrarla a tiempo), nunca futura ni anterior al alta de la persona.
 *  - Motivo OBLIGATORIO (catálogo de bajas). Detalles opcionales (100 palabras).
 *  - La baja la saca de su grupo y deja vacante su cargo de encargado, si lo
 *    tenía. Quien es coordinador, secretario o servicio no se da de baja hasta
 *    reemplazarlo en ese rol (el backend responde con el motivo).
 * REACTIVAR: POST /api/personas/reactivar { id, fecha, motivo_id, detalles? }
 *  - Motivo OBLIGATORIO (catálogo de altas) y detalles opcionales (100
 *    palabras), igual que la baja. Vuelve en ALTA y sin grupo.
 *
 * Los errores del backend se muestran dentro del diálogo, sin cerrarlo, para
 * poder corregir la fecha. Todo el historial se conserva.
 *
 * Props: persona (la ficha), onListo(textoDelResultado)
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { UserMinus, UserPlus } from "lucide-react";
import Boton from "../ui/Boton";
import Confirmacion from "../ui/Confirmacion";
import { CampoArea, CampoSelect, CampoTexto } from "../ui/Campo";
import { fechaCorta, hoyISO } from "../../lib/fechas";
import { textoError } from "../../lib/gruposApi";

const MAX_PALABRAS = 100;

const DIALOGO_CERRADO = {
  tipo: "", // "baja" | "reactivar"
  fecha: "",
  motivoId: "",
  detalles: "",
  errores: {},
  enviando: false,
  error: "",
};

const soloFecha = (texto) => (texto ? String(texto).slice(0, 10) : "");
const contarPalabras = (texto) =>
  texto.trim().split(/\s+/).filter(Boolean).length;

function BajaReactivarPersona({ persona, onListo }) {
  const { t } = useTranslation();
  const [d, setD] = useState(DIALOGO_CERRADO);
  const [motivos, setMotivos] = useState({ uso: "", lista: [] });

  const deBaja = persona.estado === "BAJA";
  const nombre = `${persona.apellido} ${persona.nombre}`;
  const usoMotivos = d.tipo === "baja" ? "baja" : "alta";

  // Motivos del catálogo, según la acción (baja: uso "baja"; reactivar: "alta").
  useEffect(() => {
    if (!d.tipo) return;
    const uso = d.tipo === "baja" ? "baja" : "alta";
    const control = new AbortController();
    axios
      .get("/api/personas/motivos", { params: { uso }, signal: control.signal })
      .then(({ data }) =>
        setMotivos({
          uso,
          lista: Array.isArray(data.motivos) ? data.motivos : [],
        }),
      )
      .catch(() => {}); // sin lista, el desplegable queda vacío
    return () => control.abort();
  }, [d.tipo]);

  // Solo se muestra la lista que corresponde a la acción abierta.
  const listaMotivos = motivos.uso === usoMotivos ? motivos.lista : [];

  const abrir = (tipo) =>
    setD({ ...DIALOGO_CERRADO, tipo, fecha: hoyISO() });
  const cerrar = () => setD(DIALOGO_CERRADO);
  const cambiar = (parcial) => setD((x) => ({ ...x, ...parcial, error: "" }));

  // --- Validación en pantalla (el backend vuelve a validar) ---
  const validar = () => {
    const e = {};
    const alta = soloFecha(persona.fecha_alta);
    const baja = soloFecha(persona.fecha_baja);
    if (!d.fecha) {
      e.fecha = t("per_err_fecha", "Falta la fecha.");
    } else if (d.fecha > hoyISO()) {
      e.fecha = t("per_err_fecha_futura_gen", "La fecha no puede ser futura.");
    } else if (d.tipo === "baja" && alta && d.fecha < alta) {
      e.fecha = t("per_err_baja_antes_alta", {
        defaultValue: "La baja no puede ser anterior al alta ({{fecha}}).",
        fecha: fechaCorta(alta),
      });
    } else if (d.tipo === "reactivar" && baja && d.fecha < baja) {
      e.fecha = t("per_err_reactivar_antes_baja", {
        defaultValue:
          "La reactivación no puede ser anterior a la baja ({{fecha}}).",
        fecha: fechaCorta(baja),
      });
    }
    if (!d.motivoId) {
      e.motivo =
        d.tipo === "baja"
          ? t("per_err_baja_motivo", "Elija el motivo de la baja.")
          : t("per_err_reactivar_motivo", "Elija el motivo de la reactivación.");
    }
    if (contarPalabras(d.detalles) > MAX_PALABRAS) {
      e.detalles = t("per_err_detalles_100", "Máximo 100 palabras.");
    }
    return e;
  };

  const aceptar = async () => {
    const e = validar();
    if (Object.keys(e).length > 0) {
      setD((x) => ({ ...x, errores: e, error: "" }));
      const primero = ["fecha", "motivo", "detalles"].find((k) => e[k]);
      document.getElementById(`est-${primero}`)?.focus();
      return;
    }
    setD((x) => ({ ...x, errores: {}, enviando: true, error: "" }));
    try {
      if (d.tipo === "baja") {
        const cuerpo = {
          id: persona.id,
          fecha: d.fecha,
          motivo_id: Number(d.motivoId),
        };
        if (d.detalles.trim()) cuerpo.detalles = d.detalles.trim();
        await axios.post("/api/personas/baja", cuerpo);
        setD(DIALOGO_CERRADO);
        onListo(
          t("per_baja_ok", {
            defaultValue: "Se dio de baja a {{nombre}}.",
            nombre,
          }),
        );
      } else {
        const cuerpo = {
          id: persona.id,
          fecha: d.fecha,
          motivo_id: Number(d.motivoId),
        };
        if (d.detalles.trim()) cuerpo.detalles = d.detalles.trim();
        await axios.post("/api/personas/reactivar", cuerpo);
        setD(DIALOGO_CERRADO);
        onListo(
          t("per_reactivar_ok", {
            defaultValue:
              "Se reactivó a {{nombre}}. Quedó sin grupo: se asigna desde Grupos.",
            nombre,
          }),
        );
      }
    } catch (err) {
      setD((x) => ({
        ...x,
        enviando: false,
        error: textoError(
          err,
          d.tipo === "baja"
            ? t("per_error_baja", "No se pudo dar de baja a la persona.")
            : t("per_error_reactivar", "No se pudo reactivar a la persona."),
        ),
      }));
    }
  };

  const esBaja = d.tipo === "baja";

  return (
    <>
      {deBaja ? (
        <Boton
          variante="suave"
          icono={UserPlus}
          className="shrink-0"
          onClick={() => abrir("reactivar")}
        >
          {t("per_reactivar", "Reactivar")}
        </Boton>
      ) : (
        <Boton
          variante="peligro"
          icono={UserMinus}
          className="shrink-0"
          onClick={() => abrir("baja")}
        >
          {t("per_dar_baja", "Dar de baja")}
        </Boton>
      )}

      <Confirmacion
        abierto={!!d.tipo}
        titulo={
          esBaja
            ? t("per_baja_titulo", {
                defaultValue: "¿Dar de baja a {{nombre}}?",
                nombre,
              })
            : t("per_reactivar_titulo", {
                defaultValue: "¿Reactivar a {{nombre}}?",
                nombre,
              })
        }
        mensaje={
          esBaja
            ? t(
                "per_baja_msg",
                "Dejará de estar en alta y saldrá de su grupo; si es encargado de grupo, su cargo quedará sin asignar. El historial se conserva.",
              )
            : t(
                "per_reactivar_msg",
                "Volverá a estar en alta, sin grupo. El grupo se asigna después desde Grupos.",
              )
        }
        tono={esBaja ? "peligro" : "normal"}
        textoAceptar={
          esBaja
            ? t("per_dar_baja", "Dar de baja")
            : t("per_reactivar", "Reactivar")
        }
        cargando={d.enviando}
        error={d.error}
        onAceptar={aceptar}
        onCancelar={cerrar}
      >
        <div className="space-y-3">
          <CampoTexto
            id="est-fecha"
            type="date"
            max={hoyISO()}
            label={
              esBaja
                ? t("per_fecha_baja", "Fecha de baja")
                : t("per_fecha_reactivacion", "Fecha de reactivación")
            }
            obligatorio
            value={d.fecha}
            error={d.errores.fecha}
            ayuda={
              esBaja
                ? t(
                    "per_baja_ayuda_fecha",
                    "Por defecto es hoy. Si se olvidó registrarla, elija la fecha en que ocurrió.",
                  )
                : t(
                    "per_mover_ayuda_fecha",
                    "Por defecto es hoy; puede ser una fecha pasada.",
                  )
            }
            onChange={(e) =>
              cambiar({
                fecha: e.target.value,
                errores: { ...d.errores, fecha: "" },
              })
            }
          />

          <CampoSelect
            id="est-motivo"
            label={
              esBaja
                ? t("per_motivo_baja", "Motivo de baja")
                : t("per_motivo_alta", "Motivo de alta")
            }
            obligatorio
            value={d.motivoId}
            error={d.errores.motivo}
            ayuda={t("per_baja_ayuda_motivo", "Obligatorio.")}
            onChange={(e) =>
              cambiar({
                motivoId: e.target.value,
                errores: { ...d.errores, motivo: "" },
              })
            }
          >
            <option value="">{t("per_elegir", "Elegir…")}</option>
            {listaMotivos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </CampoSelect>

          <CampoArea
            id="est-detalles"
            rows={3}
            maxLength={600}
            label={t("per_detalles", "Detalles")}
            value={d.detalles}
            error={d.errores.detalles}
            placeholder={
              esBaja
                ? t("per_baja_ph_detalles", "Ej.: Se mudó a otra ciudad")
                : t(
                    "per_reactivar_ph_detalles",
                    "Ej.: Regresó a la congregación",
                  )
            }
            ayuda={t(
              "per_baja_ayuda_detalles",
              "Opcional, hasta 100 palabras. Queda en el historial de la persona.",
            )}
            onChange={(e) =>
              cambiar({
                detalles: e.target.value,
                errores: { ...d.errores, detalles: "" },
              })
            }
          />
        </div>
      </Confirmacion>
    </>
  );
}

export default BajaReactivarPersona;
