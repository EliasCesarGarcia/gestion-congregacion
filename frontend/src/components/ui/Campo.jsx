/**
 * ARCHIVO: Campo.jsx
 * UBICACIÓN: frontend/src/components/ui/Campo.jsx
 * DESCRIPCIÓN: Campos de formulario compartidos (texto, desplegable y área de
 * texto) con etiqueta, marca de obligatorio, ayuda, error y contador.
 *
 * Reglas de los formularios:
 * - Cada campo lleva placeholder (un ejemplo genérico) y, debajo, una ayuda
 *   que NO desaparece al escribir: dice la regla del campo.
 * - Si el campo está mal, el error se ve en rojo ENCIMA de la ayuda (la regla
 *   sigue a la vista) y sin borrar lo ya escrito.
 * - `contador`: muestra "largo/máximo" a la derecha (necesita `maxLength`).
 *   En el área de texto está activado por defecto.
 */

import { AlertCircle } from "lucide-react";

const CLASE_ENTRADA =
  "w-full bg-jw-body text-jw-text-main border rounded-xl px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50";

function Envoltorio({
  id,
  label,
  obligatorio,
  error,
  ayuda,
  contador,
  largo,
  maximo,
  children,
}) {
  const mostrarContador = contador && maximo > 0;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-jw-text-main opacity-70 mb-1"
      >
        {label}
        {obligatorio && (
          <span className="text-red-500" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p
          id={`${id}-msg`}
          aria-live="polite"
          className="flex items-start gap-1 text-xs text-red-500 mt-1"
        >
          <AlertCircle
            size={14}
            aria-hidden="true"
            className="shrink-0 mt-px"
          />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}
      {(ayuda || mostrarContador) && (
        <div className="flex items-start justify-between gap-2 mt-1">
          {ayuda ? (
            <p
              id={`${id}-ayuda`}
              className="text-xs text-jw-text-main opacity-60 min-w-0 break-words"
            >
              {ayuda}
            </p>
          ) : (
            <span />
          )}
          {mostrarContador && (
            <span
              className={`text-xs shrink-0 tabular-nums ${
                largo >= maximo
                  ? "text-red-500"
                  : "text-jw-text-main opacity-60"
              }`}
              aria-hidden="true"
            >
              {largo}/{maximo}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const claseBorde = (error) =>
  error ? "border-red-500" : "border-jw-border focus:border-jw-accent";

// Ids de los textos que describen al campo (error y ayuda, si existen).
const describedBy = (id, error, ayuda) => {
  const ids = [error && `${id}-msg`, ayuda && `${id}-ayuda`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
};

export function CampoTexto({
  id,
  label,
  obligatorio,
  error,
  ayuda,
  contador = false,
  ...resto
}) {
  return (
    <Envoltorio
      {...{ id, label, obligatorio, error, ayuda, contador }}
      largo={String(resto.value ?? "").length}
      maximo={resto.maxLength}
    >
      <input
        id={id}
        required={obligatorio}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error, ayuda)}
        className={`${CLASE_ENTRADA} ${claseBorde(error)}`}
        {...resto}
      />
    </Envoltorio>
  );
}

export function CampoSelect({
  id,
  label,
  obligatorio,
  error,
  ayuda,
  children,
  ...resto
}) {
  return (
    <Envoltorio {...{ id, label, obligatorio, error, ayuda }}>
      <select
        id={id}
        required={obligatorio}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error, ayuda)}
        className={`${CLASE_ENTRADA} ${claseBorde(error)}`}
        {...resto}
      >
        {children}
      </select>
    </Envoltorio>
  );
}

export function CampoArea({
  id,
  label,
  obligatorio,
  error,
  ayuda,
  contador = true,
  ...resto
}) {
  return (
    <Envoltorio
      {...{ id, label, obligatorio, error, ayuda, contador }}
      largo={String(resto.value ?? "").length}
      maximo={resto.maxLength}
    >
      <textarea
        id={id}
        required={obligatorio}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error, ayuda)}
        className={`${CLASE_ENTRADA} ${claseBorde(error)} resize-y`}
        {...resto}
      />
    </Envoltorio>
  );
}

/**
 * CampoTelefono: país (con su código +NN) y número, en una sola fila.
 * La página guarda `pais` y `numero` por separado y arma "+NN número" al
 * guardar (ver lib/validaciones.js). Solo deja escribir números, espacios,
 * guiones y paréntesis; un "+" inicial lo resuelve la página (pegado de un
 * número internacional).
 */
export function CampoTelefono({
  id,
  label,
  labelPais,
  obligatorio,
  error,
  ayuda,
  pais,
  numero,
  paises = [],
  onPais,
  onNumero,
  ...resto
}) {
  return (
    <Envoltorio {...{ id, label, obligatorio, error, ayuda }}>
      <div className="flex gap-2">
        <div className="w-2/5 shrink-0">
          <select
            aria-label={labelPais}
            value={pais}
            onChange={(e) => onPais(e.target.value)}
            className={`${CLASE_ENTRADA} ${claseBorde(error)}`}
          >
            {paises.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre} +{p.llamada}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            aria-invalid={!!error}
            aria-describedby={describedBy(id, error, ayuda)}
            value={numero}
            onChange={(e) =>
              onNumero(e.target.value.replace(/[^0-9 ()+-]/g, ""))
            }
            className={`${CLASE_ENTRADA} ${claseBorde(error)}`}
            {...resto}
          />
        </div>
      </div>
    </Envoltorio>
  );
}
