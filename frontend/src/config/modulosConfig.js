import { BookOpen } from "lucide-react";

// Tabla "id del módulo (core_modulos.id) -> pantalla".
// Un módulo que no esté acá NO aparece en el menú, aunque el usuario lo tenga.
// Para sumar una pantalla nueva: agregar una línea con su id, su ruta,
// su ícono y la clave de traducción del nombre.
export const MODULOS_UI = {
  publicaciones: {
    to: "/publicaciones",
    icon: BookOpen,
    labelKey: "nav_publications",
  },
};
