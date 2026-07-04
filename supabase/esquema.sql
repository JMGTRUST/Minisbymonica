-- ============================================================================
-- Minis by Mónica — Sistema de ventas y reparto en tiempo real
-- Esquema de la base compartida (Supabase / Postgres)
--
-- Cómo usarlo: en el proyecto de Supabase, abrir SQL Editor, pegar este
-- archivo completo y ejecutarlo. Crea las tablas, las llena con los catálogos
-- de ejemplo (28 tiendas, 18 productos, 4 rutas — editables luego desde la
-- app) y habilita el tiempo real.
--
-- La misma base la usan:
--   * La app web (panel, despacho, visitas) vía js/sync.js
--   * El agente de choferes por WhatsApp (agente-choferes/) vía n8n
-- ============================================================================

-- ---------- Catálogos ----------

create table if not exists choferes (
  id      bigint primary key,
  nombre  text not null,
  activo  boolean not null default true
);

create table if not exists tiendas (
  id           bigint primary key,
  nombre       text not null,
  chofer_id    bigint references choferes (id),
  activo       boolean not null default true,
  -- Sobreescrituras de nivel par por producto: {"1": 15, "7": 4}
  par_override jsonb not null default '{}'::jsonb
);

create table if not exists productos (
  id                 bigint primary key,
  codigo             text,
  nombre             text not null,
  precio             numeric not null default 0,
  par                integer not null default 0,
  -- true para los 13 productos del checklist que el chofer cuenta en tienda
  es_producto_tienda boolean not null default false,
  activo             boolean not null default true
);

-- ---------- Movimientos ----------

-- Ventas diarias reportadas por los supermercados
create table if not exists ventas (
  fecha       date not null,
  tienda_id   bigint not null references tiendas (id),
  producto_id bigint not null references productos (id),
  cantidad    numeric not null default 0,
  primary key (fecha, tienda_id, producto_id)
);

-- Visitas de chofer (desde la app o desde el agente de WhatsApp)
-- El id por defecto es unico entre dispositivos (epoch en ms + azar), el mismo
-- esquema que usa la app; asi el agente puede insertar sin coordinar ids.
create table if not exists visitas (
  id        bigint primary key
            default (floor(extract(epoch from clock_timestamp()) * 1000)::bigint * 1000
                     + floor(random() * 1000)::bigint),
  fecha     date not null,
  hora      text,
  tienda_id bigint not null references tiendas (id),
  chofer_id bigint references choferes (id),
  notas     text not null default '',
  cerrada   boolean not null default false,
  origen    text not null default 'app'  -- 'app' | 'whatsapp'
);

-- Conteo por producto dentro de una visita
create table if not exists inventario_visita (
  visita_id           bigint not null references visitas (id) on delete cascade,
  producto_id         bigint not null references productos (id),
  cantidad_encontrada numeric,           -- lo que quedaba en el exhibidor
  cantidad_dejada     numeric,           -- lo repuesto en esa visita (agente WhatsApp)
  primary key (visita_id, producto_id)
);

-- Despachos calculados (Componente A)
create table if not exists despachos (
  id             bigint primary key
                 default (floor(extract(epoch from clock_timestamp()) * 1000)::bigint * 1000
                          + floor(random() * 1000)::bigint),
  fecha_venta    date not null,
  fecha_despacho date not null unique,
  generado_el    text
);

create table if not exists despacho_lineas (
  despacho_id bigint not null references despachos (id) on delete cascade,
  tienda_id   bigint not null references tiendas (id),
  producto_id bigint not null references productos (id),
  cantidad    numeric not null default 0,
  primary key (despacho_id, tienda_id, producto_id)
);

-- Alertas (tienda por debajo del mínimo, incidencias del agente, etc.)
create table if not exists alertas (
  id          bigint generated always as identity primary key,
  creada_en   timestamptz not null default now(),
  tienda_id   bigint references tiendas (id),
  producto_id bigint references productos (id),
  mensaje     text not null,
  atendida    boolean not null default false
);

-- Estado de conversación del agente de WhatsApp (una fila por teléfono)
create table if not exists agente_sesiones (
  telefono       text primary key,
  chofer_id      bigint references choferes (id),
  estado         jsonb not null default '{}'::jsonb,  -- historial + visita en curso
  actualizada_en timestamptz not null default now()
);

-- ---------- Tiempo real ----------
-- Publica los cambios para que el panel de la app se actualice al instante.

alter publication supabase_realtime add table
  choferes, tiendas, productos, ventas, visitas, inventario_visita,
  despachos, despacho_lineas, alertas;

-- ---------- Seguridad (nivel piloto) ----------
-- RLS activado con políticas abiertas para la llave anónima: suficiente para
-- el piloto (la llave solo la tienen la app y n8n). FASE 2: al introducir
-- usuarios con login, sustituir estas políticas por reglas por rol
-- (administradora / oficina / chofer).

do $$
declare t text;
begin
  foreach t in array array['choferes','tiendas','productos','ventas','visitas',
                           'inventario_visita','despachos','despacho_lineas',
                           'alertas','agente_sesiones']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists piloto_todo on %I', t);
    execute format('create policy piloto_todo on %I for all using (true) with check (true)', t);
  end loop;
end $$;

-- ---------- Funcion para el agente de WhatsApp ----------
-- Registra en una sola llamada (atomica) la visita cerrada, sus conteos y las
-- alertas que el agente haya detectado. La invoca n8n via POST
-- /rest/v1/rpc/registrar_visita_agente con {"payload": {...}}.

create or replace function registrar_visita_agente(payload jsonb)
returns bigint
language plpgsql
as $$
declare
  v_id bigint;
  ahora_rd timestamptz := now() at time zone 'America/Santo_Domingo';
  c jsonb;
  a jsonb;
begin
  insert into visitas (fecha, hora, tienda_id, chofer_id, notas, cerrada, origen)
  values (
    coalesce((payload->>'fecha')::date, ahora_rd::date),
    to_char(ahora_rd, 'HH24:MI'),
    (payload->>'tienda_id')::bigint,
    nullif(payload->>'chofer_id', '')::bigint,
    coalesce(payload->>'notas', ''),
    true,
    'whatsapp'
  ) returning id into v_id;

  for c in select * from jsonb_array_elements(coalesce(payload->'conteos', '[]'::jsonb)) loop
    insert into inventario_visita (visita_id, producto_id, cantidad_encontrada, cantidad_dejada)
    values (
      v_id,
      (c->>'producto_id')::bigint,
      (c->>'cantidad_encontrada')::numeric,
      nullif(c->>'cantidad_dejada', '')::numeric
    )
    on conflict (visita_id, producto_id) do update
      set cantidad_encontrada = excluded.cantidad_encontrada,
          cantidad_dejada     = excluded.cantidad_dejada;
  end loop;

  for a in select * from jsonb_array_elements(coalesce(payload->'alertas', '[]'::jsonb)) loop
    insert into alertas (tienda_id, producto_id, mensaje)
    values (
      nullif(a->>'tienda_id', '')::bigint,
      nullif(a->>'producto_id', '')::bigint,
      coalesce(a->>'mensaje', '')
    );
  end loop;

  return v_id;
end $$;

-- ============================================================================
-- Datos semilla (los mismos de ejemplo de la app; se editan desde la app)
-- ============================================================================

insert into choferes (id, nombre) values
  (1, 'Ruta 1 — Distrito Nacional'),
  (2, 'Ruta 2 — Santo Domingo Este/Norte'),
  (3, 'Ruta 3 — Santiago y Cibao'),
  (4, 'Ruta 4 — Este y Sur')
on conflict (id) do nothing;

insert into productos (id, codigo, nombre, precio, par, es_producto_tienda) values
  (1,  'P01', 'Dulce de leche en corte',    145, 12, true),
  (2,  'P02', 'Dulce de coco con leche',    135, 12, true),
  (3,  'P03', 'Dulce de naranja',           130, 10, true),
  (4,  'P04', 'Jalea de batata',            140, 10, true),
  (5,  'P05', 'Dulce de guayaba',           130, 10, true),
  (6,  'P06', 'Dulce de lechosa',           130, 8,  true),
  (7,  'P07', 'Majarete',                   120, 8,  true),
  (8,  'P08', 'Flan de coco',               150, 8,  true),
  (9,  'P09', 'Arroz con leche',            120, 8,  true),
  (10, 'P10', 'Mini cheesecake de fresa',   195, 6,  true),
  (11, 'P11', 'Mini cheesecake de chinola', 195, 6,  true),
  (12, 'P12', 'Palitos de coco',            95,  15, true),
  (13, 'P13', 'Besitos de coco',            95,  15, true),
  (14, 'P14', 'Suspiritos',                 85,  15, false),
  (15, 'P15', 'Turron de mani',             90,  12, false),
  (16, 'P16', 'Canquina',                   75,  12, false),
  (17, 'P17', 'Dulce de platano',           110, 8,  false),
  (18, 'P18', 'Gofio artesanal',            70,  10, false)
on conflict (id) do nothing;

insert into tiendas (id, nombre, chofer_id) values
  (1,  'Bravo Núñez de Cáceres', 1),
  (2,  'Bravo 27 de Febrero', 1),
  (3,  'Nacional Bella Vista', 1),
  (4,  'Nacional Arroyo Hondo', 1),
  (5,  'Jumbo Luperón', 1),
  (6,  'La Sirena Churchill', 1),
  (7,  'Plaza Lama Duarte', 1),
  (8,  'Bravo Charles de Gaulle', 2),
  (9,  'Jumbo San Isidro', 2),
  (10, 'La Sirena Megacentro', 2),
  (11, 'Olé Las Américas', 2),
  (12, 'Bravo Villa Mella', 2),
  (13, 'Aprezio Sabana Perdida', 2),
  (14, 'La Sirena Carretera Mella', 2),
  (15, 'Nacional Santiago', 3),
  (16, 'La Sirena Estrella Sadhalá', 3),
  (17, 'Bravo Santiago', 3),
  (18, 'Jumbo Las Colinas', 3),
  (19, 'Plaza Lama Santiago', 3),
  (20, 'La Sirena Moca', 3),
  (21, 'Nacional La Vega', 3),
  (22, 'Jumbo La Romana', 4),
  (23, 'La Sirena Higüey', 4),
  (24, 'Bravo San Pedro', 4),
  (25, 'Olé San Cristóbal', 4),
  (26, 'La Sirena Baní', 4),
  (27, 'Jumbo Azua', 4),
  (28, 'Nacional Punta Cana', 4)
on conflict (id) do nothing;
