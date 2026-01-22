/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jw: {
          navy: '#1a335a',      // Fondo Navbar/Footer (Azul jw)
          blue: '#214382',      // Botones y enlaces
          accent: '#4a6da7',    // Azul claro (detalles e íconos)
          body: '#f5f5f5',      // Fondo de la página (no es blanco puro)
          card: '#ffffff',      // Fondo de tarjetas y menús
          text_main: '#1a1a1a', // Texto principal oscuro
          text_light: '#ffffff',// Texto sobre fondos oscuros
          border: '#d1d1d1',    // Líneas divisorias y bordes
        }
      },
      // Configuración de fuentes aumentada 2 puntos (aprox. 0.125rem)
      fontSize: {
        'xs': '0.875rem',    // 14px (Antes 12px) - Para Copyright y detalles
        'sm': '1rem',        // 16px (Antes 14px) - Para la dirección y contacto
        'base': '1.125rem',  // 18px (Antes 16px) - El nuevo estándar del cuerpo
        'lg': '1.25rem',     // 20px (Antes 18px)
        'xl': '1.5rem',      // 24px (Antes 20px)
        '2xl': '1.875rem',   // 30px (Antes 24px)
        '3xl': '2.25rem',    // 36px
        '4xl': '3rem',       // 48px
        '5xl': '3.75rem',    // 60px
      }
    },
  },
  plugins: [],
}