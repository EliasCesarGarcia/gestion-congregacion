/**
 * ARCHIVO: themeConfig.js
 * UBICACIÓN: /frontend/src/config/themeConfig.js
 * 
 * DESCRIPCIÓN PARA NO PROGRAMADORES:
 * Este es el "Manual de Estilo" del sistema. Aquí guardamos los colores
 * de cada tema (Otoño, Océano, etc.) y qué imágenes debe mostrar el fondo
 * según la hora del día. Si se quiere cambiar un color, se hace aquí.
 */

// MATRIZ MAESTRA DE COLORES
export const themePalettes = {
  oceano: {
    effect: "wave",
    manana: {
      navy: "#1caab8", blue: "#00838f", accent: "#00bcd4", body: "#e0f7fa",
      card: "#ffffff", text_main: "#000512", text_light: "#ffffff", border: "#b2ebf2",
    },
    tarde: {
      navy: "#10597d", blue: "#10597d", accent: "#10597d", body: "#e0f2f1",
      card: "#f0fbfc", text_main: "#1a1a1a", text_light: "#f0f2f5", border: "#b2dfdb",
    },
    noche: {
      navy: "#001a23", blue: "#00acc1", accent: "#26c6da", body: "#000a12",
      card: "#001a23", text_main: "#ffffff", text_light: "#ffffff", border: "#004d66",
    },
  },
  otono: {
    effect: "leaves",
    manana: {
      navy: "#e65100", blue: "#ef6c00", accent: "#ffa726", body: "#fff3e0",
      card: "#ffffff", text_main: "#5d4037", text_light: "#ffffff", border: "#ffe0b2",
    },
    tarde: {
      navy: "#5d4037", blue: "#8d6e63", accent: "#d84315", body: "#efebe9",
      card: "#ffffff", text_main: "#3e2723", text_light: "#ffffff", border: "#d7ccc8",
    },
    noche: {
      navy: "#3e2723", blue: "#ff8a65", accent: "#ff7043", body: "#1a1110",
      card: "#271c19", text_main: "#faede8", text_light: "#ffffff", border: "#5d4037",
    },
  },
  oscuro: {
    effect: "neon",
    manana: {
      navy: "#212121", blue: "#424242", accent: "#00e676", body: "#121212",
      card: "#1e1e1e", text_main: "#e0e0e0", text_light: "#ffffff", border: "#424242",
    },
    tarde: {
      navy: "#121212", blue: "#1f1f1f", accent: "#2d9ffc", body: "#000000",
      card: "#1e1e1e", text_main: "#f5f5f5", text_light: "#ffffff", border: "#333333",
    },
    noche: {
      navy: "#000000", blue: "#111111", accent: "#2256f2", body: "#000000",
      card: "#0a0a0a", text_main: "#ffffff", text_light: "#ffffff", border: "#222222",
    },
  },
  solar: {
    effect: "sun",
    manana: {
      navy: "#f9a825", blue: "#fbc02d", accent: "#ffee58", body: "#fffde7",
      card: "#ffffff", text_main: "#f57f17", text_light: "#ffffff", border: "#fff59d",
    },
    tarde: {
      navy: "#f57f17", blue: "#f9a825", accent: "#ffb300", body: "#fff8e1",
      card: "#ffffff", text_main: "#e65100", text_light: "#ffffff", border: "#ffecb3",
    },
    noche: {
      navy: "#e65100", blue: "#ef6c00", accent: "#ff9800", body: "#3e2723",
      card: "#4e342e", text_main: "#ffe0b2", text_light: "#ffffff", border: "#5d4037",
    },
  },
  retro: {
    effect: "retro",
    manana: {
      navy: "#4a148c", blue: "#7b1fa2", accent: "#ff4081", body: "#f3e5f5",
      card: "#ffffff", text_main: "#4a148c", text_light: "#ffffff", border: "#e1bee7",
    },
    tarde: {
      navy: "#2a0845", blue: "#6441a5", accent: "#00e5ff", body: "#120024",
      card: "#240b36", text_main: "#e0e0e0", text_light: "#ffffff", border: "#4a148c",
    },
    noche: {
      navy: "#120024", blue: "#2a0845", accent: "#d500f9", body: "#000000",
      card: "#120024", text_main: "#ea80fc", text_light: "#ffffff", border: "#311b92",
    },
  },
  primavera: {
    effect: "spring",
    manana: {
      navy: "#2e7d32", blue: "#4caf50", accent: "#81c784", body: "#f1f8e9",
      card: "#ffffff", text_main: "#1b5e20", text_light: "#ffffff", border: "#c8e6c9",
    },
    tarde: {
      navy: "#00695c", blue: "#00897b", accent: "#4db6ac", body: "#e0f2f1",
      card: "#ffffff", text_main: "#004d40", text_light: "#ffffff", border: "#b2dfdb",
    },
    noche: {
      navy: "#1b5e20", blue: "#66bb6a", accent: "#81c784", body: "#0d1a0e",
      card: "#162e18", text_main: "#a5d6a7", text_light: "#ffffff", border: "#2e7d32",
    },
  },
};

// MATRIZ DE IMÁGENES PARA SEO 2026
export const backgroundImagesMap = {
  wave: {
    manana: { pc: "oceano-pc-body-morning.webp", movil: "oceano-movil-body-morning.webp" },
    tarde: { pc: "oceano-pc-body-afternoon.webp", movil: "oceano-movil-body-afternoon.webp" },
    noche: { pc: "oceano-pc-body-night.webp", movil: "oceano-movil-body-night.webp" },
  },
  leaves: {
    manana: { pc: "otono-pc-body-morning.webp", movil: "otono-movil-body-morning.webp" },
    tarde: { pc: "otono-pc-body-afternoon.webp", movil: "otono-movil-body-afternoon.webp" },
    noche: { pc: "otono-pc-body-night.webp", movil: "otono-movil-body-night.webp" },
  },
  neon: {
    manana: { pc: "noche-pc-body-morning.webp", movil: "noche-movil-body-morning.webp" },
    tarde: { pc: "noche-pc-body-afternoon.webp", movil: "noche-movil-body-afternoon.webp" },
    noche: { pc: "noche-pc-body-night.webp", movil: "noche-movil-body-night.webp" },
  },
};