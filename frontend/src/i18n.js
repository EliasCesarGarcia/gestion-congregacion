// UBICACIÓN: src/i18n.js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpApi from "i18next-http-backend";

// Lista de idiomas que tu aplicación soportará.
// El primer idioma ('es') será considerado el idioma por defecto.
const supportedLngs = ['es', 'en', 'de', 'fr', 'pt', 'it', 'nl', 'ru', 'el', 'ja', 'zh-CN', 'ko', 'id', 'vi', 'sw'];

i18n
  .use(HttpApi) // Carga traducciones desde el servidor/carpeta pública
  .use(LanguageDetector) // Detecta el idioma del usuario
  .use(initReactI18next) // Pasa i18n a react-i18next
  .init({
    // IMPORTANTE: Ya no se pone el objeto 'resources' aquí.
    
    supportedLngs: supportedLngs,
    fallbackLng: "es", // Si el idioma detectado no está en la lista, usa español.

    // Configuración para el backend que carga los archivos JSON
    backend: {
      loadPath: '/locales/{{lng}}/translation.json', // Ruta a los archivos. {{lng}} es una variable para el código de idioma.
    },

    // Configuración para el detector de idioma
    detection: {
      order: ["path", "cookie", "localStorage", "htmlTag", "subdomain"],
      caches: ["cookie"],
    },

    // React specific configuration
    react: {
      // Desactiva React Suspense. Es más sencillo manejar la carga manualmente.
      useSuspense: false, 
    },
    
    // Muestra logs en la consola durante el desarrollo. Poner en 'false' para producción.
    debug: true, 
  });

export default i18n;