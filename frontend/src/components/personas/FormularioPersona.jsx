/**
 * ARCHIVO: FormularioPersona.jsx
 * UBICACIÓN: frontend/src/components/personas/FormularioPersona.jsx
 * DESCRIPCIÓN: Campos del formulario de una persona, compartidos por el alta
 * (modo "alta") y la edición (modo "edicion", paso 3.3b). No guarda nada: la
 * página que lo usa maneja los valores, la validación y el pedido al backend.
 *
 * Orden de las secciones (de lo más importante a lo menos):
 * datos personales, alta, situación y grupo, dirección y detalles.
 *
 * En modo "edicion" no se muestran congregación, motivo de alta ni grupo: el
 * grupo solo cambia con "mover", para que siempre quede en el historial.
 * La situación 3 (superintendente / auxiliar) tampoco está: se pone sola
 * desde el grupo.
 */

import { useTranslation } from "react-i18next";
import Tarjeta from "../ui/Tarjeta";
import { CampoTexto, CampoSelect, CampoArea } from "../ui/Campo";
import { SITUACIONES_1, SITUACIONES_2 } from "../../config/personasConfig";
import { hoyISO } from "../../lib/fechas";

function Seccion({ titulo, children }) {
  return (
    <Tarjeta>
      <h2 className="text-sm font-semibold text-jw-text-main mb-4">{titulo}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </Tarjeta>
  );
}

const ANCHO_COMPLETO = "sm:col-span-2";

function FormularioPersona({
  modo = "alta",
  valores,
  errores = {},
  onCambiar,
  // Solo superadmin en el alta:
  esSuper = false,
  congregaciones = [],
  congregacionId = "",
  congregacionNombre = "",
  errorCongregaciones = false,
  onCongregacion,
  // Solo en el alta:
  grupos = [],
  cargandoGrupos = false,
  errorGrupos = false,
  motivos = [],
  // Solo en la edición:
  fechaAltaObligatoria = true,
  actuales = {},
}) {
  const { t } = useTranslation();
  const esAlta = modo === "alta";

  // Props comunes de cada campo (id, valor, error y cambio).
  const campo = (nombre) => ({
    id: `per-f-${nombre}`,
    value: valores[nombre],
    error: errores[nombre],
    onChange: (e) => onCambiar({ [nombre]: e.target.value }),
  });

  return (
    <div className="space-y-4">
      {esAlta && esSuper && (
        <Seccion titulo={t("per_s_congregacion", "Congregación")}>
          <div className={ANCHO_COMPLETO}>
            <CampoSelect
              id="per-f-congregacion"
              label={t("per_congregacion", "Congregación")}
              obligatorio
              value={congregacionId}
              onChange={(e) => onCongregacion(e.target.value)}
              error={
                errores.congregacion ||
                (errorCongregaciones
                  ? t(
                      "per_error_congregaciones",
                      "No se pudo cargar la lista de congregaciones.",
                    )
                  : undefined)
              }
              ayuda={t(
                "per_ayuda_congregacion",
                "La persona se carga en la congregación elegida.",
              )}
            >
              {!congregacionId && (
                <option value="">{t("per_elegir", "Elegir…")}</option>
              )}
              {congregaciones.length === 0 && congregacionId && (
                <option value={congregacionId}>
                  {congregacionNombre || congregacionId}
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
        </Seccion>
      )}

      <Seccion titulo={t("per_s_datos", "Datos personales")}>
        <CampoTexto
          {...campo("apellido")}
          label={t("per_f_apellido", "Apellido")}
          obligatorio
          autoComplete="off"
          placeholder={t("per_ph_apellido", "Ej.: García López")}
        />
        <CampoTexto
          {...campo("nombre")}
          label={t("per_f_nombre", "Nombre")}
          obligatorio
          autoComplete="off"
          placeholder={t("per_ph_nombre", "Ej.: Juan Carlos")}
        />
        <div className={ANCHO_COMPLETO}>
          <CampoTexto
            {...campo("contacto")}
            label={t("per_contacto", "Contacto")}
            autoComplete="off"
            placeholder={t("per_ph_contacto", "Teléfono o celular")}
          />
        </div>
      </Seccion>

      <Seccion titulo={t("per_s_alta", "Alta")}>
        <CampoTexto
          {...campo("fecha_alta")}
          type="date"
          max={hoyISO()}
          label={t("per_fecha_alta", "Fecha de alta")}
          obligatorio={esAlta || fechaAltaObligatoria}
          ayuda={
            esAlta
              ? t(
                  "per_ayuda_fecha_alta",
                  "Por defecto es hoy; puede ser una fecha pasada.",
                )
              : t(
                  "per_ayuda_fecha_alta_ed",
                  "Cambiarla ajusta el historial de altas y bajas.",
                )
          }
        />
        <CampoSelect
          {...campo("condicion")}
          label={t("per_f_condicion", "Condición")}
          ayuda={t(
            "per_ayuda_condicion",
            "Si no se conoce, puede quedar sin definir.",
          )}
        >
          <option value="">{t("per_sin_definir", "Sin definir")}</option>
          <option value="A">{t("per_activo", "Activo")}</option>
          <option value="I">{t("per_inactivo", "Inactivo")}</option>
        </CampoSelect>
        {esAlta && (
          <div className={ANCHO_COMPLETO}>
            <CampoSelect
              {...campo("motivo_alta_id")}
              label={t("per_motivo_alta", "Motivo de alta")}
              ayuda={t("per_ayuda_motivo", "Opcional.")}
            >
              <option value="">{t("per_sin_motivo", "Sin motivo")}</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </CampoSelect>
          </div>
        )}
      </Seccion>

      {esAlta && (
        <Seccion titulo={t("per_s_situacion", "Situación y grupo")}>
          <CampoSelect
            {...campo("situacion_1")}
            label={t("per_f_sit1", "Situación 1")}
          >
            {SITUACIONES_1.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect
            {...campo("situacion_2")}
            label={t("per_f_sit2", "Situación 2")}
          >
            <option value="">{t("per_sin_situacion", "Sin situación")}</option>
            {SITUACIONES_2.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </CampoSelect>
          {esAlta && (
            <div className={ANCHO_COMPLETO}>
              <CampoSelect
                {...campo("grupo_id")}
                label={t("per_f_grupo", "Grupo")}
                disabled={cargandoGrupos}
                error={
                  errorGrupos
                    ? t(
                        "per_error_grupos",
                        "No se pudo cargar la lista de grupos.",
                      )
                    : undefined
                }
                ayuda={
                  !cargandoGrupos && !errorGrupos && grupos.length === 0
                    ? t(
                        "per_sin_grupos_cong",
                        "Esta congregación todavía no tiene grupos.",
                      )
                    : t(
                        "per_ayuda_grupo",
                        "Opcional. Solo se ofrecen los grupos vigentes.",
                      )
                }
              >
                <option value="">
                  {cargandoGrupos
                    ? t("per_cargando", "Cargando…")
                    : t("per_sin_grupo", "Sin grupo")}
                </option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {t("per_grupo", "Grupo")} {g.numero}
                  </option>
                ))}
              </CampoSelect>
            </div>
          )}
        </Seccion>
      )}

            {!esAlta && (
        <Seccion titulo={t("per_s_situacion_actual", "Situación y grupo")}>
          <div className={ANCHO_COMPLETO}>
            <p className="text-sm text-jw-text-main">
              {[actuales.situacion_1, actuales.situacion_2, actuales.situacion_3]
                .filter(Boolean)
                .join(" · ") || t("per_sin_situacion", "Sin situación")}
            </p>
            <p className="text-sm text-jw-text-main mt-1">
              {actuales.grupo != null
                ? `${t("per_grupo", "Grupo")} ${actuales.grupo}`
                : t("per_sin_grupo", "Sin grupo")}
            </p>
            <p className="text-xs text-jw-text-main opacity-60 mt-2">
              {t(
                "per_ayuda_sit_lectura",
                "La situación y el grupo no se editan acá: cambian con fecha y quedan en el historial.",
              )}
            </p>
          </div>
        </Seccion>
      )}

      <Seccion titulo={t("per_s_direccion", "Dirección (opcional)")}>
        <div className={ANCHO_COMPLETO}>
          <CampoTexto
            {...campo("direccion")}
            label={t("per_direccion", "Dirección")}
            autoComplete="off"
            placeholder={t("per_ph_direccion", "Calle y número")}
          />
        </div>
        <CampoTexto
          {...campo("ciudad")}
          label={t("per_ciudad", "Ciudad")}
          autoComplete="off"
          placeholder={t("per_ph_ciudad", "Ej.: El Talar")}
        />
        <CampoTexto
          {...campo("partido")}
          label={t("per_partido", "Partido")}
          autoComplete="off"
          placeholder={t("per_ph_partido", "Ej.: Tigre")}
        />
        <CampoTexto
          {...campo("provincia_estado")}
          label={t("per_provincia", "Provincia o estado")}
          autoComplete="off"
          placeholder={t("per_ph_provincia", "Ej.: Buenos Aires")}
        />
        <CampoTexto
          {...campo("pais")}
          label={t("per_pais", "País")}
          autoComplete="off"
          placeholder={t("per_ph_pais", "Ej.: Argentina")}
        />
        <CampoTexto
          {...campo("codigo_postal")}
          label={t("per_codigo_postal", "Código postal")}
          autoComplete="off"
          placeholder={t("per_ph_cp", "Ej.: B1618")}
        />
      </Seccion>

      <Seccion titulo={t("per_s_detalles", "Detalles")}>
        <div className={ANCHO_COMPLETO}>
          <CampoArea
            {...campo("detalles")}
            rows={4}
            label={t("per_detalles", "Detalles")}
            placeholder={t(
              "per_ph_detalles",
              "Notas sobre la persona (opcional)",
            )}
          />
        </div>
      </Seccion>
    </div>
  );
}

export default FormularioPersona;
