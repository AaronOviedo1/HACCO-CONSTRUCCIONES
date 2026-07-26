-- ============================================================================
-- HaacoPro · HAACO PRO RECUBRIMIENTOS
-- Migración 001 · Esquema base
--
-- Modelo mental: la COTIZACIÓN (folio F-###) es la raíz. De ella cuelgan
-- una o varias ÓRDENES DE TRABAJO (OT), la cobranza, los contratos de mano
-- de obra, los materiales y los documentos legales.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMERACIONES
-- ---------------------------------------------------------------------------
create type rol_usuario          as enum ('admin', 'administracion', 'cuadrilla', 'contador');
create type oficio_trabajador    as enum ('pintor', 'herrero', 'ayudante', 'otro');
create type tipo_cotizacion      as enum ('pintura', 'herreria', 'mixta');
create type estatus_cotizacion   as enum ('borrador', 'enviada', 'aprobada', 'rechazada', 'terminada');
create type estatus_obra         as enum ('agendada', 'en_obra', 'pausada', 'en_entrega', 'terminada', 'cerrada');
create type tipo_producto        as enum ('pintura', 'herreria', 'insumo_taller', 'otro');
create type tipo_movimiento      as enum ('entrada', 'salida');
create type estado_herramienta   as enum ('disponible', 'en_obra', 'fuera_servicio');
create type origen_material      as enum ('cotizado', 'real');
create type estatus_contrato     as enum ('activo', 'cerrado');
create type estatus_pagare       as enum ('activo', 'cancelado');
create type tipo_avance          as enum ('foto', 'video', 'nota');
create type estatus_solicitud    as enum ('pendiente', 'cotizada', 'comprada');
create type categoria_gasto      as enum ('material', 'herramienta', 'gasolina', 'servicio_auto',
                                          'garrafones', 'marketing', 'oficina', 'viaticos', 'otro');
create type metodo_pago          as enum ('efectivo', 'tarjeta_empresa', 'transferencia', 'cheque', 'deposito');
create type condicion_compra     as enum ('contado', 'credito');
create type tipo_pago_cobranza   as enum ('anticipo', 'abono', 'liquidacion');
create type tipo_deduccion       as enum ('prestamo', 'adelanto', 'reembolso');
create type estado_pago_fijo     as enum ('pagado', 'pendiente', 'vencido', 'programado');
create type tipo_movimiento_caja as enum ('entrada', 'salida');
create type estatus_tarea        as enum ('pendiente', 'en_proceso', 'terminada');

-- ---------------------------------------------------------------------------
-- UTILIDAD · updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ===========================================================================
-- 1. PERSONAS Y CATÁLOGOS
-- ===========================================================================

-- profiles · espejo de auth.users con el rol de la app
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  telefono    text,
  correo      text,
  rol         rol_usuario not null default 'cuadrilla',
  oficio      oficio_trabajador,
  es_externo  boolean not null default false,   -- externos: normalmente sin retención 5%
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.profiles (rol) where activo;

create table public.clientes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  titulo_cortesia  text default 'Sr.',            -- Sr. / Sra. / Lic. / Arq. / Ing.
  telefono         text,
  correo           text,
  domicilio        text,
  notas            text,
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.clientes (lower(nombre));

create table public.proveedores (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null unique,
  dias_credito_default  integer not null default 0 check (dias_credito_default >= 0),
  telefono              text,
  contacto              text,
  notas                 text,
  activo                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- productos · pinturas, materiales de herrería e insumos de taller
create table public.productos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  codigo        text,
  unidad        text not null default 'pza',
  costo         numeric(14,2) not null default 0,     -- costo unitario sin IVA
  iva           numeric(14,2) not null default 0,     -- IVA unitario
  precio_neto   numeric(14,2) not null default 0,     -- costo + IVA
  proveedor_id  uuid references public.proveedores(id) on delete set null,
  tipo          tipo_producto not null default 'otro',
  notas         text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.productos (tipo) where activo;
create unique index productos_codigo_uniq on public.productos (codigo) where codigo is not null;

-- herramientas · alimenta los pagarés
create table public.herramientas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,               -- Graco, LR-1, E7-14.2, EM-3...
  nombre      text not null,
  marca       text,
  valor       numeric(14,2),
  estado      estado_herramienta not null default 'disponible',
  ubicacion   text not null default 'Taller',     -- "Taller" o el nombre del oficial
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.herramientas (estado);

-- biblioteca de bullets reutilizables para el PDF de cotización
create table public.textos_proceso (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  contenido  text not null,
  orden      integer not null default 0,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- 2. COMERCIAL · COTIZACIONES
-- ===========================================================================

create table public.cotizaciones (
  id               uuid primary key default gen_random_uuid(),
  folio            text unique,                         -- "F-###" (lo asigna un trigger)
  cliente_id       uuid not null references public.clientes(id) on delete restrict,
  nombre_obra      text,
  domicilio_obra   text,
  tipo             tipo_cotizacion not null default 'pintura',
  estatus          estatus_cotizacion not null default 'borrador',
  requiere_factura boolean not null default false,
  anticipo_pct     numeric(5,2) check (anticipo_pct between 0 and 100),  -- 50 pintura / 60 herrería
  subtotal         numeric(14,2) not null default 0,    -- lo recalcula un trigger desde los items
  iva_pct          numeric(5,2) not null default 16,
  total            numeric(14,2) generated always as
                     (round(subtotal * (1 + iva_pct / 100), 2)) stored,
  linea_calidad    text,                                -- "Se utilizarán productos de la más alta calidad..."
  notas            text,
  vigencia_dias    integer not null default 30,
  fecha            date not null default current_date,
  fecha_envio      date,
  fecha_resolucion date,
  creado_por       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.cotizaciones (cliente_id);
create index on public.cotizaciones (estatus);
create index on public.cotizaciones (fecha desc);

-- bullets seleccionados para esta cotización (con override de texto)
create table public.cotizacion_procesos (
  id                uuid primary key default gen_random_uuid(),
  cotizacion_id     uuid not null references public.cotizaciones(id) on delete cascade,
  texto_proceso_id  uuid references public.textos_proceso(id) on delete set null,
  contenido_override text,
  orden             integer not null default 0
);
create index on public.cotizacion_procesos (cotizacion_id);

-- partidas: #, Descripción, M2, P.U., Importe
create table public.cotizacion_items (
  id               uuid primary key default gen_random_uuid(),
  cotizacion_id    uuid not null references public.cotizaciones(id) on delete cascade,
  descripcion      text not null,
  m2               numeric(14,2),
  precio_unitario  numeric(14,2) not null default 0,
  importe          numeric(14,2) not null default 0,
  producto_id      uuid references public.productos(id) on delete set null,
  orden            integer not null default 0
);
create index on public.cotizacion_items (cotizacion_id);

-- cotizador de herrería: materiales + pintura + MO + indirectos → precio de venta
create table public.cotizacion_herreria_desglose (
  id                    uuid primary key default gen_random_uuid(),
  cotizacion_id         uuid not null references public.cotizaciones(id) on delete cascade,
  concepto              text not null,
  materiales_herreria   numeric(14,2) not null default 0,
  materiales_pintura    numeric(14,2) not null default 0,
  mano_obra             numeric(14,2) not null default 0,
  gastos_indirectos_pct numeric(5,2) not null default 5,
  utilidad_pct          numeric(5,2) not null default 35,
  costo_total           numeric(14,2) generated always as (
                          round((materiales_herreria + materiales_pintura + mano_obra)
                                * (1 + gastos_indirectos_pct / 100), 2)
                        ) stored,
  precio_venta          numeric(14,2) generated always as (
                          round((materiales_herreria + materiales_pintura + mano_obra)
                                * (1 + gastos_indirectos_pct / 100)
                                * (1 + utilidad_pct / 100), 2)
                        ) stored,
  detalle_materiales    jsonb not null default '[]'::jsonb,
  orden                 integer not null default 0
);
create index on public.cotizacion_herreria_desglose (cotizacion_id);

-- ===========================================================================
-- 3. OPERACIÓN · ÓRDENES DE TRABAJO
-- ===========================================================================

-- Una cotización puede generar VARIAS OTs (ej. exterior + interior).
create table public.obras (
  id                        uuid primary key default gen_random_uuid(),
  ot_numero                 text unique,                 -- "26000001" (trigger)
  cotizacion_id             uuid not null references public.cotizaciones(id) on delete restrict,
  nombre                    text not null,
  domicilio                 text,
  estatus                   estatus_obra not null default 'agendada',
  monto_cotizado            numeric(14,2) not null default 0,  -- porción de la cotización asignada a esta OT
  avance_pct                numeric(5,2) not null default 0 check (avance_pct between 0 and 100),
  fecha_apertura            date not null default current_date,
  fecha_estimada_entrega    date,
  fecha_ultima_actualizacion timestamptz not null default now(),
  fecha_cierre              date,
  notas                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index on public.obras (cotizacion_id);
create index on public.obras (estatus);

-- sub-conceptos con presupuesto propio (ej. "Macetero #2", "Registro #3")
create table public.obra_conceptos (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id) on delete cascade,
  nombre      text not null,
  presupuesto numeric(14,2) not null default 0,
  orden       integer not null default 0,
  created_at  timestamptz not null default now()
);
create index on public.obra_conceptos (obra_id);

create table public.cronograma_tareas (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras(id) on delete cascade,
  nombre         text not null,
  fecha_inicio   date,
  fecha_fin      date,
  estatus        estatus_tarea not null default 'pendiente',
  responsable_id uuid references public.profiles(id) on delete set null,
  orden          integer not null default 0,
  created_at     timestamptz not null default now()
);
create index on public.cronograma_tareas (obra_id);

-- ===========================================================================
-- 4. GASTOS, MATERIALES E INVENTARIO
-- ===========================================================================

create table public.gastos (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid references public.obras(id) on delete set null,   -- null = gasto general
  concepto_id      uuid references public.obra_conceptos(id) on delete set null,
  categoria        categoria_gasto not null default 'material',
  descripcion      text not null,
  piezas           numeric(12,2),
  costo_unitario   numeric(14,2),
  monto            numeric(14,2) not null,
  folio_factura    text,
  proveedor_id     uuid references public.proveedores(id) on delete set null,
  metodo           metodo_pago not null default 'efectivo',
  condicion        condicion_compra not null default 'contado',
  foto_ticket_path text,
  fecha            date not null default current_date,
  ocr_raw          jsonb,                                  -- reservado para OCR con IA
  registrado_por   uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.gastos (obra_id);
create index on public.gastos (fecha desc);
create index on public.gastos (proveedor_id);

-- Dos bloques por OT: lo COTIZADO vs lo REAL (con folio de factura o "TALLER")
create table public.obra_materiales (
  id            uuid primary key default gen_random_uuid(),
  obra_id       uuid not null references public.obras(id) on delete cascade,
  concepto_id   uuid references public.obra_conceptos(id) on delete set null,
  origen        origen_material not null,
  material      text not null,
  producto_id   uuid references public.productos(id) on delete set null,
  piezas        numeric(12,2) not null default 1,
  costo         numeric(14,2) not null default 0,
  total         numeric(14,2) generated always as (round(piezas * costo, 2)) stored,
  folio_factura text,
  es_taller     boolean not null default false,   -- true → el folio se muestra como "TALLER"
  gasto_id      uuid references public.gastos(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.obra_materiales (obra_id, origen);

-- kardex de insumos de taller; la existencia es la suma de movimientos
create table public.insumos_kardex (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  tipo        tipo_movimiento not null,
  cantidad    numeric(12,2) not null check (cantidad > 0),
  fecha       date not null default current_date,
  obra_id     uuid references public.obras(id) on delete set null,
  notas       text,
  registrado_por uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.insumos_kardex (producto_id, fecha);

-- ===========================================================================
-- 5. CONTRATOS DE MANO DE OBRA Y PAGARÉS
-- ===========================================================================

-- CONTRATO POR OBRA DETERMINADA (pintor / herrero)
create table public.contratos_oficial (
  id                  uuid primary key default gen_random_uuid(),
  obra_id             uuid not null references public.obras(id) on delete cascade,
  trabajador_id       uuid not null references public.profiles(id) on delete restrict,
  trabajos            jsonb not null default '{}'::jsonb,   -- checklist por grupos (vinílicas, impermeabilizantes, reparaciones, otros)
  m2                  numeric(12,2) not null default 0,
  tarifa_m2           numeric(14,2) not null default 0,     -- varía por trabajo (ej. $12.50/m²)
  otros_importe       numeric(14,2) not null default 0,
  reparaciones        jsonb not null default '[]'::jsonb,
  reparaciones_importe numeric(14,2) not null default 0,
  costo_haaco_pct     numeric(5,2) not null default 5,      -- retención por herramienta/consumibles
  subtotal            numeric(14,2) generated always as (
                        round(m2 * tarifa_m2 + otros_importe + reparaciones_importe, 2)
                      ) stored,
  retencion_haaco     numeric(14,2) generated always as (
                        round((m2 * tarifa_m2 + otros_importe + reparaciones_importe)
                              * costo_haaco_pct / 100, 2)
                      ) stored,
  total_pagar         numeric(14,2) generated always as (
                        round((m2 * tarifa_m2 + otros_importe + reparaciones_importe)
                              * (1 - costo_haaco_pct / 100), 2)
                      ) stored,
  estatus             estatus_contrato not null default 'activo',
  fecha_inicia        date,
  fecha_finaliza      date,
  fecha_cierre        date,
  firma_oficial_at    timestamptz,
  firma_director_at   timestamptz,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on public.contratos_oficial (obra_id);
create index on public.contratos_oficial (trabajador_id);

-- PAGARÉ DE HERRAMIENTAS (a la orden de Luis Enrique Inda Franco)
create table public.pagares (
  id              uuid primary key default gen_random_uuid(),
  contrato_id     uuid not null references public.contratos_oficial(id) on delete cascade,
  valor_total     numeric(14,2) not null default 0,   -- suma del valor de las herramientas (trigger)
  interes_ordinario_pct numeric(5,2) not null default 10,
  interes_moratorio_pct numeric(5,2) not null default 20,
  texto_generado  text,
  estatus         estatus_pagare not null default 'activo',
  fecha_emision   date not null default current_date,
  fecha_cancelacion date,
  firma_oficial_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.pagares (contrato_id);

create table public.pagare_items (
  id             uuid primary key default gen_random_uuid(),
  pagare_id      uuid not null references public.pagares(id) on delete cascade,
  herramienta_id uuid not null references public.herramientas(id) on delete restrict,
  cantidad       integer not null default 1,
  valor_unitario numeric(14,2) not null default 0,
  devuelta       boolean not null default false,
  fecha_devolucion date,
  unique (pagare_id, herramienta_id)
);

-- ===========================================================================
-- 6. AVANCES DE CUADRILLA (reemplaza el grupo de WhatsApp)
-- ===========================================================================

create table public.avances (
  id                 uuid primary key default gen_random_uuid(),
  obra_id            uuid not null references public.obras(id) on delete cascade,
  autor_id           uuid not null references public.profiles(id) on delete restrict,
  tipo               tipo_avance not null default 'foto',
  storage_path       text,
  comentario         text,
  porcentaje_avance  numeric(5,2) check (porcentaje_avance between 0 and 100),
  created_at         timestamptz not null default now()
);
create index on public.avances (obra_id, created_at desc);

-- lista de materiales que captura el herrero para que Pati cotice
create table public.solicitudes_material (
  id         uuid primary key default gen_random_uuid(),
  obra_id    uuid not null references public.obras(id) on delete cascade,
  autor_id   uuid not null references public.profiles(id) on delete restrict,
  items      jsonb not null default '[]'::jsonb,   -- [{material, cantidad, unidad, notas}]
  estatus    estatus_solicitud not null default 'pendiente',
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.solicitudes_material (obra_id);

-- ===========================================================================
-- 7. DINERO
-- ===========================================================================

-- CUENTAS POR PAGAR (vencimiento y saldo calculados; estado en la vista)
create table public.cuentas_por_pagar (
  id            uuid primary key default gen_random_uuid(),
  gasto_id      uuid references public.gastos(id) on delete set null,
  proveedor_id  uuid not null references public.proveedores(id) on delete restrict,
  folio_factura text not null,
  monto         numeric(14,2) not null default 0,
  fecha_factura date not null,
  dias_credito  integer not null default 0,
  monto_pagado  numeric(14,2) not null default 0,
  fecha_pago    date,
  cancelada     boolean not null default false,
  notas         text,
  vencimiento   date generated always as (fecha_factura + dias_credito) stored,
  saldo         numeric(14,2) generated always as (
                  case when cancelada then 0 else round(monto - monto_pagado, 2) end
                ) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.cuentas_por_pagar (proveedor_id);
create index on public.cuentas_por_pagar (vencimiento);

-- COBRANZA: anticipo, abonos 1..N y liquidación, siempre contra la cotización
create table public.pagos_cobranza (
  id               uuid primary key default gen_random_uuid(),
  cotizacion_id    uuid not null references public.cotizaciones(id) on delete cascade,
  tipo             tipo_pago_cobranza not null default 'abono',
  monto            numeric(14,2) not null check (monto > 0),
  metodo           metodo_pago not null default 'transferencia',
  fecha            date not null default current_date,
  comprobante_path text,
  notas            text,
  registrado_por   uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index on public.pagos_cobranza (cotizacion_id, fecha);

-- NÓMINA por avance: abonos contra el contrato del oficial
create table public.nomina_pagos (
  id                   uuid primary key default gen_random_uuid(),
  contrato_id          uuid not null references public.contratos_oficial(id) on delete cascade,
  fecha                date not null default current_date,
  monto                numeric(14,2) not null check (monto > 0),
  porcentaje_del_pago  numeric(5,2),   -- el % que representa SÓLO este pago
  metodo               metodo_pago not null default 'efectivo',
  recibo_folio         text,
  notas                text,
  registrado_por       uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now()
);
create index on public.nomina_pagos (contrato_id, fecha);

create table public.deducciones (
  id            uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references public.profiles(id) on delete cascade,
  contrato_id   uuid references public.contratos_oficial(id) on delete set null,
  tipo          tipo_deduccion not null default 'prestamo',
  monto         numeric(14,2) not null check (monto > 0),
  fecha         date not null default current_date,
  saldado       boolean not null default false,
  notas         text,
  created_at    timestamptz not null default now()
);
create index on public.deducciones (trabajador_id) where not saldado;

-- PAGOS FIJOS POR QUINCENA (nómina administrativa y servicios)
create table public.pagos_fijos (
  id           uuid primary key default gen_random_uuid(),
  quincena     date not null,                    -- día 15 o fin de mes
  categoria    text not null default 'Nómina',   -- Nómina, Servicio, Mensualidad...
  beneficiario text not null,
  monto        numeric(14,2) not null default 0,
  metodo       metodo_pago not null default 'transferencia',
  estado       estado_pago_fijo not null default 'programado',
  descripcion  text,
  notas        text,
  fecha_pago   date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.pagos_fijos (quincena);

create table public.caja_chica (
  id          uuid primary key default gen_random_uuid(),
  tipo        tipo_movimiento_caja not null,
  concepto    text not null,
  monto       numeric(14,2) not null check (monto > 0),
  fecha       date not null default current_date,
  obra_id     uuid references public.obras(id) on delete set null,
  gasto_id    uuid references public.gastos(id) on delete set null,
  registrado_por uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.caja_chica (fecha desc);

-- ===========================================================================
-- 8. PÓLIZA DE GARANTÍA
-- ===========================================================================

create table public.polizas_garantia (
  id               uuid primary key default gen_random_uuid(),
  obra_id          uuid not null references public.obras(id) on delete cascade,
  folio            text unique,                -- "H###-AA" (trigger)
  items            jsonb not null default '[]'::jsonb,  -- [{area, pintura, color, codigo}]
  fecha_emision    date not null default current_date,
  fecha_conclusion date,                       -- inicio de la vigencia
  vigencia_dias    integer not null default 365,
  condiciones      text,
  deslindes        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.polizas_garantia (obra_id);

-- ===========================================================================
-- 9. CONSECUTIVOS (folios)
-- ===========================================================================

create table public.consecutivos (
  serie  text    not null,
  anio   integer not null default 0,   -- 0 = serie global sin corte anual
  ultimo integer not null default 0,
  primary key (serie, anio)
);
