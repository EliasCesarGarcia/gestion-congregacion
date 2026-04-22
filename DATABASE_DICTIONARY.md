# Diccionario de Base de Datos - Gestión Local Premium 2026

## Módulo 1: Core (Identidad y Geografía)

### Tabla: `core_congregaciones`
*   **Propósito:** Define cada unidad administrativa (Sede).
*   **Campos Clave:**
    *   `zona_horaria`: Determina el cambio de tema visual (Mañana/Tarde/Noche) en el frontend.
    *   `numero_congregacion`: Identificador único para el proceso de Login y recuperación.

### Tabla: `core_personas`
*   **Propósito:** Es el censo maestro de miembros. Todos los registros de pedidos o entregas deben colgar de aquí.
*   **Campos Clave:**
    *   `situacion_1, 2, 3`: Campos polivalentes para marcar responsabilidades. Cline debe usarlos para filtrar "Ancianos" o "Precursores".
    *   `username_temp`: Usado para identificar al usuario antes de que cree su cuenta real.
    *   `url_imagen`: Si el valor no empieza con `http`, Cline debe asumir que está en `/frontend/public/avatars/`.

### Tabla: `core_usuarios`
*   **Propósito:** Controla quién puede loguearse en el sistema.
*   **Campos Clave:**
    *   `es_admin_local`: Habilita o deshabilita rutas protegidas de administración en el frontend.

---

## Módulo 2: Publicaciones (Literatura)

### Tabla: `pub_catalogo`
*   **Propósito:** Listado global de libros y folletos disponibles.
*   **Campos Clave:**
    *   `siglas`: Muy importante para el SEO interno y búsquedas rápidas (ej: 'lff', 'nwt').

### Tabla: `pub_pedidos` vs `pub_entregas`
*   **Lógica de Negocio:** Un pedido nace en estado `pendiente`. Cuando se entrega físicamente la publicación, el registro de pedido cambia a `entregado` y se crea automáticamente una entrada en `pub_entregas`.

### Tabla: `pub_stock_local`
*   **Propósito:** Inventario en tiempo real.
*   **Lógica de Negocio:** Cada vez que se registra una entrega, Cline debe proponer una función que descuente la cantidad de esta tabla.

---

## Módulo 3: Seguridad Digital

### Tabla: `core_seguridad_info`
*   **Propósito:** Repositorio de consejos de blindaje.
*   **Campos Clave:**
    *   `descripcion_larga`: Contiene los detalles que se ven en la página `SecurityTipsPage`. Soporta marcado de texto.

### Tabla: `core_verificaciones`
*   **Propósito:** Almacén temporal de tokens PIN.
*   **Lógica:** Cline debe validar `utilizado = false` y que `now()` sea menor a `expira_at`.