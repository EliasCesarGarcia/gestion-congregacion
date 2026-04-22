-- ==========================================================
-- GESTIÓN CONGREGACIÓN 2026 - ESQUEMA COMPLETO DE BASE DE DATOS
-- Ubicación: Supabase (PostgreSQL)
-- Descripción: Estructura relacional para la gestión de miembros y literatura.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. NÚCLEO (CORE): Congregaciones y Configuración
-- ----------------------------------------------------------

-- Tabla maestra de sedes (Congregaciones)
CREATE TABLE public.core_congregaciones (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre text NOT NULL, -- Nombre de la congregación (ej: 'Central')
  pais text NOT NULL,
  provincia_estado text NOT NULL,
  ciudad text NOT NULL,
  partido text, -- División administrativa local
  direccion text, -- Dirección física del Salón del Reino
  numero_congregacion text, -- Código identificador oficial
  zona_horaria text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires'::text, -- Crítico para UI adaptativa
  region text CHECK (region = ANY (ARRAY['Asia'::text, 'África'::text, 'Europa'::text, 'América del Norte'::text, 'América Central'::text, 'América del Sur'::text, 'Oceanía'::text])),
  creado_at timestamp with time zone DEFAULT now(),
  CONSTRAINT core_congregaciones_pkey PRIMARY KEY (id)
);

-- Configuración administrativa específica de cada congregación
CREATE TABLE public.core_config_congregacion (
  id integer NOT NULL DEFAULT nextval('core_config_congregacion_id_seq'::regclass),
  congregacion_id uuid UNIQUE REFERENCES public.core_congregaciones(id),
  anciano_coordinador text, -- Nombre del hermano coordinador
  secretario text, -- Nombre del secretario
  coordinador_literatura text, -- Encargado de publicaciones
  congregacion_coordinadora_id uuid REFERENCES public.core_congregaciones(id), -- Para grupos que dependen de otra congregación
  notas_adicionales text,
  CONSTRAINT core_config_congregacion_pkey PRIMARY KEY (id)
);

-- ----------------------------------------------------------
-- 2. PERSONAS Y SEGURIDAD
-- ----------------------------------------------------------

-- Censo general de miembros (La entidad central del sistema)
CREATE TABLE public.core_personas (
  id integer NOT NULL DEFAULT nextval('personas_id_seq'::regclass),
  congregacion_id uuid REFERENCES public.core_congregaciones(id),
  apellido_nombre text NOT NULL, -- Formato 'Apellido, Nombre' para ordenamiento
  estado text CHECK (estado = ANY (ARRAY['ALTA'::text, 'BAJA'::text])), -- ALTA: Activo / BAJA: Inactivo o fallecido
  contacto text, -- Teléfono o celular
  email text,
  grupo integer, -- Número de grupo de servicio
  situacion_1 text, -- Etiquetas de cargo (ej: 'Anciano', 'Siervo')
  situacion_2 text, -- Etiquetas de precursorado (ej: 'Regular')
  situacion_3 text, -- Notas adicionales de servicio
  fecha_alta date,
  fecha_baja date,
  condicion character, -- Campo interno de estatus
  url_imagen text, -- Ruta al avatar (Local o Supabase Storage)
  detalles text, -- Historial clínico o notas de ayuda
  username_temp text UNIQUE, -- Alias para primer acceso
  password_hash text, -- Clave encriptada (bcrypt)
  password_changed_at timestamp with time zone DEFAULT now(),
  creado_at timestamp with time zone DEFAULT now(),
  CONSTRAINT core_personas_pkey PRIMARY KEY (id)
);

-- Usuarios con acceso web (Vinculados a Supabase Auth y core_personas)
CREATE TABLE public.core_usuarios (
  id uuid NOT NULL REFERENCES auth.users(id), -- Vínculo con el motor de Auth de Supabase
  persona_id integer REFERENCES public.core_personas(id),
  congregacion_id uuid REFERENCES public.core_congregaciones(id),
  es_admin_local boolean DEFAULT false, -- Si es TRUE, accede al Panel de Difusión Masiva
  username_temp text UNIQUE,
  estado_cuenta text DEFAULT 'activa'::text CHECK (estado_cuenta = ANY (ARRAY['activa'::text, 'suspendida'::text])),
  password_hash text,
  clave_temporal text, -- Clave generada por el admin para el primer ingreso
  security_updated_at timestamp with time zone DEFAULT now(),
  creado_at timestamp with time zone DEFAULT now(),
  CONSTRAINT core_usuarios_pkey PRIMARY KEY (id)
);

-- Gestión de PIN para recuperación y seguridad
CREATE TABLE public.core_verificaciones (
  id integer NOT NULL DEFAULT nextval('core_verificaciones_id_seq'::regclass),
  usuario_id uuid REFERENCES public.core_usuarios(id),
  pin character varying NOT NULL, -- Código de 6 dígitos
  tipo text, -- Ej: 'RECOVERY' o 'SECURITY_CHECK'
  expira_at timestamp with time zone DEFAULT (now() + '00:15:00'::interval), -- Válido por 15 min
  utilizado boolean DEFAULT false,
  intentos integer DEFAULT 0,
  CONSTRAINT core_verificaciones_pkey PRIMARY KEY (id)
);

-- ----------------------------------------------------------
-- 3. MÓDULOS Y ANUNCIOS
-- ----------------------------------------------------------

CREATE TABLE public.core_modulos (
  id text PRIMARY KEY, -- Identificador único (ej: 'pubs', 'reuniones')
  nombre text NOT NULL,
  descripcion text
);

CREATE TABLE public.core_permisos_modulos (
  id integer NOT NULL DEFAULT nextval('core_permisos_modulos_id_seq'::regclass),
  usuario_id uuid REFERENCES public.core_usuarios(id),
  modulo_id text REFERENCES public.core_modulos(id),
  congregacion_id uuid REFERENCES public.core_congregaciones(id),
  nivel_acceso integer DEFAULT 1, -- 1: Ver, 2: Editar, 3: Borrar
  CONSTRAINT core_permisos_modulos_pkey PRIMARY KEY (id)
);

CREATE TABLE public.core_anuncios (
  id integer NOT NULL DEFAULT nextval('core_anuncios_id_seq'::regclass),
  congregacion_id uuid REFERENCES public.core_congregaciones(id),
  titulo text NOT NULL,
  contenido text NOT NULL,
  modulo_relacionado text REFERENCES public.core_modulos(id),
  fecha_expiracion date,
  creado_por uuid REFERENCES public.core_usuarios(id),
  creado_at timestamp with time zone DEFAULT now(),
  CONSTRAINT core_anuncios_pkey PRIMARY KEY (id)
);

-- Boletines de seguridad digital
CREATE TABLE public.core_seguridad_info (
  id integer NOT NULL DEFAULT nextval('core_seguridad_info_id_seq'::regclass),
  contenido text, -- Título o resumen breve
  descripcion_larga text, -- Contenido extendido en formato HTML o texto plano
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT core_seguridad_info_pkey PRIMARY KEY (id)
);

-- ----------------------------------------------------------
-- 4. PUBLICACIONES (LITERATURA)
-- ----------------------------------------------------------

-- Catálogo Maestro de Publicaciones
CREATE TABLE public.pub_catalogo (
  id text PRIMARY KEY, -- Siglas o ID único (ej: 'nwt-S')
  nombre_publicacion text NOT NULL,
  tipo text, -- Ej: 'Libro', 'Revista', 'Folleto'
  siglas text, -- Código corto oficial (ej: 'lff')
  anio_publicacion integer,
  url_portada text, -- URL de la imagen en formato .webp
  orden integer, -- Para mostrar en listas
  creado_at timestamp with time zone DEFAULT now()
);

-- Inventario de la congregación local
CREATE TABLE public.pub_stock_local (
  id integer NOT NULL DEFAULT nextval('pub_stock_local_id_seq'::regclass),
  congregacion_id uuid REFERENCES public.core_congregaciones(id),
  publicacion_id text REFERENCES public.pub_catalogo(id),
  cantidad_disponible integer DEFAULT 0,
  estante_ubicacion text, -- Lugar físico en el mostrador
  CONSTRAINT pub_stock_local_pkey PRIMARY KEY (id)
);

-- Registro de pedidos realizados por hermanos
CREATE TABLE public.pub_pedidos (
  id integer NOT NULL DEFAULT nextval('pub_pedidos_id_seq'::regclass),
  congregacion_id uuid REFERENCES public.core_congregaciones(id),
  persona_id integer REFERENCES public.core_personas(id),
  publicacion_id text REFERENCES public.pub_catalogo(id),
  cantidad integer,
  estado text CHECK (estado = ANY (ARRAY['pendiente'::text, 'sin stock'::text, 'cancelado'::text, 'entregado'::text])),
  fecha_pedido date,
  notas character varying,
  CONSTRAINT pub_pedidos_pkey PRIMARY KEY (id)
);

-- Registro final de entregas realizadas
CREATE TABLE public.pub_entregas (
  id integer NOT NULL DEFAULT nextval('pub_entregas_id_seq'::regclass),
  congregacion_id uuid REFERENCES public.core_congregaciones(id),
  persona_id integer REFERENCES public.core_personas(id),
  publicacion_id text REFERENCES public.pub_catalogo(id),
  cantidad integer DEFAULT 1,
  fecha_entrega timestamp with time zone DEFAULT now(),
  entregado_por uuid REFERENCES public.core_usuarios(id),
  CONSTRAINT pub_entregas_pkey PRIMARY KEY (id)
);

-- Gestión de suscripciones periódicas (Atalaya, Despertad)
CREATE TABLE public.pub_suscripciones (
  id integer NOT NULL DEFAULT nextval('pub_suscripciones_id_seq'::regclass),
  congregacion_id uuid REFERENCES public.core_congregaciones(id),
  persona_id integer REFERENCES public.core_personas(id),
  tipo_codigo text CHECK (tipo_codigo = ANY (ARRAY['mwb-S'::text, 'w-S'::text, 'wlp-S'::text])), -- Siglas de suscripción
  cantidad integer DEFAULT 1,
  fecha_inicio date NOT NULL,
  activa boolean DEFAULT true,
  CONSTRAINT pub_suscripciones_pkey PRIMARY KEY (id)
);