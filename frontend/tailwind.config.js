/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        jw: {
          navy: '#1a335a',      // Fondo Navbar/Footer (Azul jw)
          blue: '#214382',      // Botones y enlaces
          accent: '#4a6da7',    // Azul claro
          body: '#f5f5f5',      // Fondo de la página (no es blanco)
          card: '#ffffff',      // Fondo de tarjetas
          text_main: '#1a1a1a', // Texto oscuro
          text_light: '#ffffff',// Texto claro
          border: '#d1d1d1',
        }
      },
      fontSize: {
        'base': '1.125rem',     // 18px (Aumento de 2 puntos)
        'sm': '1rem',           // 16px
        'lg': '1.25rem',        // 20px
        'xl': '1.5rem',         // 24px
      }
    },
  },
  plugins: [],
}