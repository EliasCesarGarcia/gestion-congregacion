/**
 * ARCHIVO: Confirmacion.jsx
 * UBICACIÓN: frontend/src/components/ui/Confirmacion.jsx
 * DESCRIPCIÓN: Diálogo de confirmación con "Aceptar" y "Cancelar" para
 * cualquier acción que escriba datos (alta, edición, baja...).
 *
 * - Se dibuja en un portal (fuera del resto de la pantalla).
 * - Solo usa variables de tema (jw-*), así que sigue los temas y horarios.
 * - Esc y clic en el fondo cancelan, salvo mientras se está guardando.
 * - El foco arranca en "Cancelar" (la opción segura), no se escapa del
 *   diálogo con Tab y vuelve al botón de origen al cerrar.
 * - `error` muestra el mensaje del backend dentro del diálogo, sin cerrarlo.
 *
 * Uso:
 *   <Confirmacion
 *     abierto={abierto}
 *     titulo="¿Guardar los cambios?"
 *     mensaje="Se actualizarán los datos de GARCÍA Juan."
 *     tono="normal" // o "peligro" para bajas
 *     cargando={enviando}
 *     error={error}
 *     onAceptar={guardar}
 *     onCancelar={() => setAbierto(false)}
 *   />
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import Boton from "./Boton";

const ENFOCABLES =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])";

function Confirmacion({
  abierto,
  titulo,
  mensaje,
  tono = "normal",
  textoAceptar,
  textoCancelar,
  cargando = false,
  error = "",
  onAceptar,
  onCancelar,
  children,
}) {
  const { t } = useTranslation();
  const cuadro = useRef(null);

  // La función de cancelar se guarda en una referencia para que el efecto del
  // teclado no se reinicie en cada dibujo de la pantalla.
  const cancelarRef = useRef(onCancelar);
  useEffect(() => {
    cancelarRef.current = onCancelar;
  });

  // Bloquea el desplazamiento de fondo y devuelve el foco al cerrar.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement;
    const desborde = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = desborde;
      if (previo instanceof HTMLElement) previo.focus();
    };
  }, [abierto]);

  // Esc cancela; Tab y Shift+Tab se quedan dentro del diálogo.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e) => {
      if (e.key === "Escape") {
        if (!cargando) {
          e.preventDefault();
          cancelarRef.current?.();
        }
        return;
      }
      if (e.key !== "Tab" || !cuadro.current) return;
      const lista = cuadro.current.querySelectorAll(ENFOCABLES);
      if (lista.length === 0) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto, cargando]);

  if (!abierto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => {
          if (!cargando) onCancelar?.();
        }}
      />
      <div
        ref={cuadro}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmacion-titulo"
        aria-describedby={mensaje ? "confirmacion-mensaje" : undefined}
        className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto text-start bg-jw-card text-jw-text-main border border-jw-border rounded-2xl p-6 shadow-xl"
      >
        <h2 id="confirmacion-titulo" className="text-base font-semibold">
          {titulo}
        </h2>
        {mensaje && (
          <p
            id="confirmacion-mensaje"
            className="mt-2 text-sm opacity-70 break-words"
          >
            {mensaje}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
        {error && (
          <p
            role="alert"
            className="mt-4 text-sm border border-red-500/50 bg-red-500/10 rounded-xl px-3 py-2 break-words"
          >
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Boton
            variante="suave"
            onClick={onCancelar}
            disabled={cargando}
            autoFocus
          >
            {textoCancelar || t("ui_cancelar", "Cancelar")}
          </Boton>
          <Boton
            variante={tono === "peligro" ? "peligro" : "primario"}
            onClick={onAceptar}
            disabled={cargando}
          >
            {cargando
              ? t("ui_procesando", "Procesando…")
              : textoAceptar || t("ui_aceptar", "Aceptar")}
          </Boton>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default Confirmacion;
