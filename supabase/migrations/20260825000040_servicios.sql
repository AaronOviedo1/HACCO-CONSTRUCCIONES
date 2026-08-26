-- ===========================================================================
-- SERVICIOS Y REPARACIONES
--
-- HAACO PRO también repara portones eléctricos, y ese trabajo se llevaba en su
-- propia hoja de Excel: fecha, cliente, servicio, estatus, costo y fecha de
-- pago. Seis columnas que esconden un flujo completo —se agenda el día y la
-- hora que puede ir el técnico, el técnico diagnostica, se le pasa el
-- presupuesto al cliente, y si dice que sí se repara y se cobra—, y un dinero
-- que hoy no aparece por ningún lado: ni en lo vendido del mes, ni en el por
-- cobrar, ni en el cierre del contador.
--
-- Esto es un módulo hermano de las cotizaciones, no un caso raro de ellas. Una
-- reparación no abre orden de trabajo, no lleva anticipo, no tiene cronograma
-- ni contrato de oficial, y su presupuesto cabe en media hoja. Forzarla dentro
-- de `cotizaciones` habría llenado esa tabla de columnas que no aplican y la
-- pantalla de cotizaciones de renglones que no son obras. Por eso tiene tabla
-- propia, serie de folios propia (`S-###`) y tabla de pagos propia; lo único
-- que se comparte —porque es lo único que de verdad es lo mismo— es la cuenta
-- del dinero, que se suma en `lib/cobranza`.
--
-- `cobrado` NO es un estatus, a propósito. El estatus cuenta el trabajo; el
-- dinero lo cuentan los pagos. Si fuera estatus habría dos verdades el día en
-- que alguien marque «cobrado» un servicio que todavía debe $900, y esas dos
-- verdades ya no se vuelven a juntar. La palabra que usa el cliente en su
-- Excel —«Finalizado»— se deriva al leer: reparado y sin saldo.
--
-- Los pagos van aparte de `pagos_cobranza` y no colgados de ella con una liga
-- nulable: esa tabla se lee siempre desde la cotización —`v_cobranza` se arma
-- con un left join desde `cotizaciones`—, así que un pago sin cotización no
-- aparecería en ninguna parte, y de paso arrastraría a los recibos, que exigen
-- cotización para existir.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EL FLUJO, EN SIETE PALABRAS
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'estatus_servicio') then
    create type public.estatus_servicio as enum (
      'agendado',       -- hay cita: día, hora y técnico
      'diagnostico',    -- el técnico ya fue y anotó qué tiene
      'presupuestado',  -- se le pasó el presupuesto al cliente
      'aprobado',       -- dijo que sí; aquí nace la venta y el por cobrar
      'rechazado',      -- dijo que no
      'reparado',       -- el trabajo quedó
      'cancelado'       -- no se hizo la visita
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- EL SERVICIO
-- ---------------------------------------------------------------------------
create table if not exists public.servicios (
  id                uuid primary key default gen_random_uuid(),
  /** 'S-###', lo pone el trigger. Serie propia: no se revuelve con las F-###. */
  folio             text unique,
  /**
   * `restrict` y no `cascade`: un cliente con reparaciones cobradas no se
   * borra de un clic llevándose el dinero por delante.
   */
  cliente_id        uuid not null references public.clientes(id) on delete restrict,
  /** La columna «Servicio» del Excel: «Reparación portón eléctrico». */
  descripcion       text not null,
  /** Dónde está el portón. Puede no ser el domicilio del cliente: casa vs local. */
  domicilio         text,
  estatus           public.estatus_servicio not null default 'agendado',
  /**
   * Quién va. Es un usuario de la app para que quede el registro de a quién le
   * tocó cada visita; `set null` porque una baja no debe borrar el servicio.
   */
  tecnico_id        uuid references public.profiles(id) on delete set null,
  /** La cita. La «Fecha» del Excel es ésta: el día que va el técnico. */
  fecha_visita      date not null,
  hora_visita       time,
  /** Lo que encontró el técnico. Va impreso: es lo que justifica el precio. */
  diagnostico       text,
  /** Se hereda del cliente al elegirlo y se puede cambiar caso por caso. */
  requiere_factura  boolean not null default false,
  iva_pct           numeric(5,2) not null default 0,
  /** Lo mantiene el trigger de partidas, igual que en las cotizaciones. */
  subtotal          numeric(14,2) not null default 0,
  total             numeric(14,2) generated always as
                      (round(subtotal * (1 + iva_pct / 100), 2)) stored,
  vigencia_dias     integer not null default 15,
  garantia_dias     integer not null default 30,
  fecha_presupuesto date,
  /**
   * El sí o el no del cliente, en una sola columna —como
   * `cotizaciones.fecha_resolucion`—. De aquí sale la fecha de venta: lo
   * vendido se cuenta en el mes en que el cliente aceptó, no en el que se
   * levantó el presupuesto.
   */
  fecha_resolucion  date,
  fecha_reparacion  date,
  notas             text,
  creado_por        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- La consulta de siempre es la agenda: qué visitas hay y cuáles siguen abiertas.
create index if not exists servicios_agenda on public.servicios (fecha_visita)
  where estatus in ('agendado', 'diagnostico');
create index if not exists servicios_por_cliente on public.servicios (cliente_id);

-- ---------------------------------------------------------------------------
-- LAS PARTIDAS DEL PRESUPUESTO
--
-- Partidas y no un monto único: un presupuesto de portón es «Motor Merik 511
-- $2,400 / Mano de obra $800», y así es como se le enseña al cliente en el
-- papel. El formulario abre con un renglón, así que capturar un monto suelto
-- cuesta exactamente lo mismo que capturar un número.
-- ---------------------------------------------------------------------------
create table if not exists public.servicio_items (
  id              uuid primary key default gen_random_uuid(),
  servicio_id     uuid not null references public.servicios(id) on delete cascade,
  descripcion     text not null,
  cantidad        numeric(12,2) not null default 1,
  /** Nulo se lee «pza», que es lo que casi siempre es. */
  unidad          text,
  precio_unitario numeric(14,2) not null default 0,
  /** Lo pone el trigger: cantidad × precio. */
  importe         numeric(14,2) not null default 0,
  orden           integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists servicio_items_por_servicio
  on public.servicio_items (servicio_id, orden);

-- ---------------------------------------------------------------------------
-- EL COBRO
--
-- Sin `tipo`: una reparación no lleva anticipo, abono ni liquidación, se cobra
-- al terminar. Varios renglones siguen valiendo para el pago partido, que es
-- el único caso que se da.
-- ---------------------------------------------------------------------------
create table if not exists public.servicio_pagos (
  id               uuid primary key default gen_random_uuid(),
  servicio_id      uuid not null references public.servicios(id) on delete cascade,
  monto            numeric(14,2) not null check (monto > 0),
  metodo           public.metodo_pago not null default 'transferencia',
  fecha            date not null default current_date,
  comprobante_path text,
  notas            text,
  registrado_por   uuid references public.profiles(id) on delete set null,
  editado_por      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists servicio_pagos_por_servicio
  on public.servicio_pagos (servicio_id, fecha);

-- ---------------------------------------------------------------------------
-- FOLIO 'S-###'
-- ---------------------------------------------------------------------------
create or replace function public.tg_folio_servicio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := 'S-' || public.siguiente_consecutivo('servicio', 0)::text;
  end if;
  return new;
end $$;

drop trigger if exists folio_servicio on public.servicios;
create trigger folio_servicio before insert on public.servicios
  for each row execute function public.tg_folio_servicio();

-- Serie global, sin corte anual: como la de cotizaciones y la de recibos.
insert into public.consecutivos (serie, anio, ultimo) values ('servicio', 0, 0)
on conflict (serie, anio) do nothing;

-- ---------------------------------------------------------------------------
-- IMPORTE Y SUBTOTAL, SOLOS
-- ---------------------------------------------------------------------------
create or replace function public.tg_servicio_item_importe()
returns trigger language plpgsql as $$
begin
  new.importe := round(coalesce(new.cantidad, 1) * coalesce(new.precio_unitario, 0), 2);
  return new;
end $$;

drop trigger if exists servicio_item_importe on public.servicio_items;
create trigger servicio_item_importe before insert or update on public.servicio_items
  for each row execute function public.tg_servicio_item_importe();

create or replace function public.tg_recalcular_subtotal_servicio()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_srv uuid := coalesce(new.servicio_id, old.servicio_id);
begin
  update public.servicios s
     set subtotal = coalesce((select sum(i.importe) from public.servicio_items i
                               where i.servicio_id = v_srv), 0),
         updated_at = now()
   where s.id = v_srv;
  return null;
end $$;

drop trigger if exists recalcular_subtotal_servicio on public.servicio_items;
create trigger recalcular_subtotal_servicio
  after insert or update or delete on public.servicio_items
  for each row execute function public.tg_recalcular_subtotal_servicio();

drop trigger if exists set_updated_at on public.servicios;
create trigger set_updated_at before update on public.servicios
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at on public.servicio_pagos;
create trigger set_updated_at before update on public.servicio_pagos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS · staff escribe, contador lee
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['servicios', 'servicio_items', 'servicio_pagos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_todo on public.%I', t);
    execute format(
      'create policy staff_todo on public.%I for all to authenticated
         using (public.es_staff()) with check (public.es_staff())', t);
    execute format('drop policy if exists contador_lectura on public.%I', t);
    execute format(
      'create policy contador_lectura on public.%I for select to authenticated
         using (public.es_contador())', t);
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- LA CITA
--
-- La migración de recordatorios dejó dicho que la tabla era genérica a
-- propósito y que colgarla de otra cosa no pediría migración nueva. Casi:
-- pide la columna, que es lo único que faltaba. La cita del técnico es además
-- el primer recordatorio del sistema que sí trae hora.
-- ---------------------------------------------------------------------------
alter table public.recordatorios
  add column if not exists servicio_id uuid references public.servicios(id) on delete cascade;

create index if not exists recordatorios_por_servicio
  on public.recordatorios (servicio_id) where servicio_id is not null;

-- ---------------------------------------------------------------------------
-- LA VISTA
--
-- El mismo vocabulario que `v_cobranza` —cotizado, cobrado, saldo,
-- ultimo_pago, pct_pendiente— para que los totales del panel se saquen con la
-- misma función y no con una cuenta parecida escrita aparte.
-- ---------------------------------------------------------------------------
drop view if exists public.v_servicios;
create view public.v_servicios with (security_invoker = on) as
select s.id                                         as servicio_id,
       s.folio,
       s.descripcion,
       s.domicilio,
       s.estatus,
       s.fecha_visita,
       s.hora_visita,
       s.diagnostico,
       s.tecnico_id,
       t.nombre                                     as tecnico,
       cl.id                                        as cliente_id,
       cl.nombre                                    as cliente,
       cl.telefono                                  as cliente_telefono,
       s.requiere_factura,
       s.subtotal,
       s.iva_pct,
       s.total                                      as cotizado,
       coalesce(sum(p.monto), 0)                    as cobrado,
       round(s.total - coalesce(sum(p.monto), 0), 2) as saldo,
       max(p.fecha)                                 as ultimo_pago,
       case when s.total > 0
            then round((s.total - coalesce(sum(p.monto), 0)) / s.total * 100, 2)
            else 0 end                              as pct_pendiente,
       -- La venta es del mes en que el cliente dijo que sí. Mismo criterio que
       -- `v_cotizaciones.fecha_venta`: antes de resolverse, la fecha de la
       -- visita hace de referencia para no dejar el renglón sin mes.
       coalesce(s.fecha_resolucion, s.fecha_visita) as fecha_venta,
       s.fecha_presupuesto,
       s.fecha_reparacion,
       s.vigencia_dias,
       s.garantia_dias,
       s.notas,
       s.created_at,
       s.updated_at
  from public.servicios s
  join public.clientes cl on cl.id = s.cliente_id
  left join public.profiles t on t.id = s.tecnico_id
  left join public.servicio_pagos p on p.servicio_id = s.id
 group by s.id, cl.id, t.nombre;

grant select on public.v_servicios to authenticated;
