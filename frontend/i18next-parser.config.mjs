// UBICACIÓN: /i18next-parser.config.js (en la raíz del proyecto)

// UBICACIÓN: /i18next-parser.config.mjs (nombre nuevo con extensión .mjs)
export default  {
  // Guarda las claves antiguas en caso de que se eliminen del código
  createOldCatalogs: false, 
  
  // Códigos de los idiomas que quieres generar
  locales: ['es', 'en', 'de', 'fr', 'pt', 'it', 'nl', 'ru', 'el', 'ja', 'zh-CN', 'ko', 'id', 'vi', 'sw'],
  
  // Dónde colocar los archivos generados
  output: 'public/locales/$LOCALE/translation.json',
  
  // Dónde buscar los textos a traducir en tu código
  input: ['src/**/*.{js,jsx}'],
  
  // Ordenar las claves alfabéticamente en los archivos JSON
  sort: true,
};