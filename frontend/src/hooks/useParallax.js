/**
 * ARCHIVO: useParallax.js
 * UBICACIÓN: /frontend/src/hooks/useParallax.js
 * 
 * DESCRIPCIÓN TÉCNICA (SENIOR):
 * Este hook encapsula la lógica de animación de alto rendimiento para el fondo.
 * Utiliza 'requestAnimationFrame' para asegurar que el movimiento sea fluido
 * a 60 FPS sin causar re-renders en React.
 */

import { useEffect, useRef } from "react";

export function useParallax() {
  const bgRef = useRef(null);

  useEffect(() => {
    let animationFrameId;
    let targetY = 0;
    let currentY = 0;
    let initialized = false;

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;

      if (docHeight <= winHeight) {
        targetY = 0;
        return;
      }

      const rawPercent = scrollTop / (docHeight - winHeight);
      const scrollPercent = Math.max(0, Math.min(1, rawPercent));
      targetY = -(scrollPercent * (winHeight * 0.25));
    };

    const loop = () => {
      if (!initialized) {
        currentY = targetY;
        initialized = true;
      } else {
        currentY += (targetY - currentY) * 0.1; // Amortiguación suave
      }

      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(0, ${currentY}px, 0)`;
      }
      animationFrameId = window.requestAnimationFrame(loop);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    loop();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return bgRef;
}