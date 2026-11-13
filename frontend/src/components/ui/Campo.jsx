/**
 * ARCHIVO: Campo.jsx
 * UBICACIÓN: frontend/src/components/ui/Campo.jsx
 * DESCRIPCIÓN: Campos de formulario compartidos (texto y desplegable) con
 * etiqueta, marca de obligatorio, ayuda y mensaje de error debajo del campo.
 * Regla de los formularios: cada campo lleva placeholder y, si falta o está
 * mal, el error se ve en ese campo sin borrar lo ya escrito.
 */

const CLASE_ENTRADA =
  "w-full bg-jw-body text-jw-text-main border rounded-xl px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50";

function Envoltorio({ id, label, obligatorio, error, ayuda, children }) {
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
      {error ? (
        <p id={`${id}-msg`} className="text-xs text-red-500 mt-1">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-msg`} className="text-xs text-jw-text-main opacity-60 mt-1">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

const claseBorde = (error) =>
  error ? "border-red-500" : "border-jw-border focus:border-jw-accent";

export function CampoTexto({ id, label, obligatorio, error, ayuda, ...resto }) {
  return (
    <Envoltorio {...{ id, label, obligatorio, error, ayuda }}>
      <input
        id={id}
        required={obligatorio}
        aria-invalid={!!error}
        aria-describedby={error || ayuda ? `${id}-msg` : undefined}
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
        aria-describedby={error || ayuda ? `${id}-msg` : undefined}
        className={`${CLASE_ENTRADA} ${claseBorde(error)}`}
        {...resto}
      >
        {children}
      </select>
    </Envoltorio>
  );
}