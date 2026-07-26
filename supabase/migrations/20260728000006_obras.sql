-- ============================================================================
-- HaacoPro · Migración 006 · Módulo de obras
--
-- Lo que le faltaba a la OT para ser el corazón operativo: el recibo-contrato
-- de anticipo, la bitácora de eventos, el checklist de detalles de entrega y
-- las operaciones que tienen que ser atómicas (prestar herramienta, cerrar
-- obra, recorrer el cronograma).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- RECIBO-CONTRATO DE ANTICIPO
-- El formato "RECIBO HAACO PRO" extendido: además de acusar el anticipo deja
-- asentado el saldo, el esquema de pagos, las fechas y las dos firmas.
-- ---------------------------------------------------------------------------
create table public.recibos (
  id                     uuid primary key default gen_random_uuid(),
  pago_id                uuid references public.pagos_cobranza(id) on delete set null,
  cotizacion_id          uuid not null references public.cotizaciones(id) on delete cascade,
  obra_id                uuid references public.obras(id) on delete set null,
  folio                  text unique,                    -- "R-###"
  concepto               text not null,
  esquema_pagos          text,
  fecha_inicio           date,
  fecha_estimada_entrega date,
  datos_bancarios        text,
  firma_cliente_at       timestamptz,
  firma_empresa_at       timestamptz,
  notas                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on public.recibos (cotizacion_id);

create or replace function public.tg_folio_recibo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := 'R-' || public.siguiente_consecutivo('recibo', 0)::text;
  end if;
  return new;
end $$;
create trigger folio_recibo before insert on public.recibos
  for each row execute function public.tg_folio_recibo();

create trigger set_updated_at before update on public.recibos
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- DETALLES DE ENTREGA · el checklist que sale del recorrido con el cliente
-- ---------------------------------------------------------------------------
create table public.obra_detalles (
  id             uuid primary key default gen_random_uuid(),
  obra_id        uuid not null references public.obras(id) on delete cascade,
  descripcion    text not null,
  atendido       boolean not null default false,
  fecha_reporte  date not null default current_date,
  fecha_atencion date,
  reportado_por  uuid references public.profiles(id) on delete set null,
  notas          text,
  created_at     timestamptz not null default now()
);
create index on public.obra_detalles (obra_id);

-- ---------------------------------------------------------------------------
-- BITÁCORA · qué pasó y cuándo, sin que nadie tenga que capturarlo
-- ---------------------------------------------------------------------------
create type evento_obra as enum (
  'apertura', 'estatus', 'cronograma', 'avance', 'contrato', 'pagare',
  'material', 'entrega', 'cierre', 'nota'
);

create table public.bitacora_obra (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras(id) on delete cascade,
  tipo        evento_obra not null default 'nota',
  descripcion text not null,
  datos       jsonb,
  autor_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.bitacora_obra (obra_id, created_at desc);

create or replace function public.anotar_bitacora(
  p_obra uuid, p_tipo evento_obra, p_descripcion text, p_datos jsonb default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.bitacora_obra (obra_id, tipo, descripcion, datos, autor_id)
  values (p_obra, p_tipo, p_descripcion, p_datos, auth.uid());
$$;

-- Apertura y cambios de estatus
create or replace function public.tg_bitacora_obra()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.anotar_bitacora(new.id, 'apertura',
      format('Se abrió la OT %s', new.ot_numero));
  elsif new.estatus is distinct from old.estatus then
    perform public.anotar_bitacora(new.id, 'estatus',
      format('Estatus: %s → %s', old.estatus, new.estatus),
      jsonb_build_object('anterior', old.estatus, 'nuevo', new.estatus));
  end if;
  return new;
end $$;
create trigger bitacora_obra after insert or update on public.obras
  for each row execute function public.tg_bitacora_obra();

-- Movimientos del cronograma
create or replace function public.tg_bitacora_tarea()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and (new.fecha_inicio is distinct from old.fecha_inicio
          or new.fecha_fin is distinct from old.fecha_fin) then
    perform public.anotar_bitacora(new.obra_id, 'cronograma',
      format('«%s» se movió del %s al %s', new.nombre,
             to_char(coalesce(old.fecha_inicio, old.fecha_fin), 'DD/MM/YYYY'),
             to_char(coalesce(new.fecha_inicio, new.fecha_fin), 'DD/MM/YYYY')));
  elsif tg_op = 'UPDATE' and new.estatus is distinct from old.estatus then
    perform public.anotar_bitacora(new.obra_id, 'cronograma',
      format('«%s»: %s', new.nombre, new.estatus));
  end if;
  return new;
end $$;
create trigger bitacora_tarea after update on public.cronograma_tareas
  for each row execute function public.tg_bitacora_tarea();

-- Avances de la cuadrilla
create or replace function public.tg_bitacora_avance()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_autor text;
begin
  select nombre into v_autor from public.profiles where id = new.autor_id;
  perform public.anotar_bitacora(new.obra_id, 'avance',
    case when new.porcentaje_avance is not null
         then format('%s reportó %s%% de avance', coalesce(v_autor, 'La cuadrilla'), new.porcentaje_avance)
         else format('%s subió un avance', coalesce(v_autor, 'La cuadrilla')) end);
  return new;
end $$;
create trigger bitacora_avance after insert on public.avances
  for each row execute function public.tg_bitacora_avance();

-- ---------------------------------------------------------------------------
-- CONCENTRADO · corregido para no contar dos veces el material
-- Un gasto de material puede tener su renglón en obra_materiales; si lo tiene,
-- el renglón manda y el gasto ya no se suma aparte.
-- ---------------------------------------------------------------------------
drop view if exists public.v_obra_concentrado;
create view public.v_obra_concentrado with (security_invoker = on) as
with mo as (
  select obra_id,
         sum(total_pagar) as mano_obra,
         count(*)         as contratos
    from public.contratos_oficial group by obra_id
), mat_cot as (
  select obra_id, sum(total) as material
    from public.obra_materiales where origen = 'cotizado' group by obra_id
), mat_real as (
  select obra_id, sum(total) as material
    from public.obra_materiales where origen = 'real' group by obra_id
), gas as (
  select g.obra_id,
         sum(g.monto) filter (where g.categoria = 'viaticos')                  as viaticos,
         sum(g.monto) filter (where g.categoria not in ('viaticos', 'material')) as adicionales,
         sum(g.monto) filter (
           where g.categoria = 'material'
             and not exists (select 1 from public.obra_materiales m where m.gasto_id = g.id)
         )                                                                     as material_suelto
    from public.gastos g where g.obra_id is not null group by g.obra_id
), av as (
  select obra_id, count(*) as avances, max(created_at) as ultimo_avance
    from public.avances group by obra_id
)
select o.id                as obra_id,
       o.ot_numero,
       o.nombre,
       o.domicilio,
       o.estatus,
       o.cotizacion_id,
       c.folio             as cotizacion_folio,
       c.tipo              as cotizacion_tipo,
       cl.id               as cliente_id,
       cl.nombre           as cliente,
       o.fecha_apertura,
       o.fecha_estimada_entrega,
       o.fecha_ultima_actualizacion,
       o.fecha_cierre,
       o.avance_pct,
       case when o.monto_cotizado > 0 then o.monto_cotizado else c.subtotal end as cotizado,
       coalesce(mo.mano_obra, 0)                                          as mano_obra,
       coalesce(mo.contratos, 0)                                          as contratos,
       coalesce(mat_cot.material, 0)                                      as material_cotizado,
       coalesce(mat_real.material, 0) + coalesce(gas.material_suelto, 0)  as material_real,
       coalesce(gas.viaticos, 0)                                          as viaticos,
       coalesce(gas.adicionales, 0)                                       as gastos_adicionales,
       (case when o.monto_cotizado > 0 then o.monto_cotizado else c.subtotal end)
         - coalesce(mo.mano_obra, 0)
         - (coalesce(mat_real.material, 0) + coalesce(gas.material_suelto, 0))
         - coalesce(gas.viaticos, 0)
         - coalesce(gas.adicionales, 0)                                   as utilidad,
       coalesce(av.avances, 0)                                            as avances,
       av.ultimo_avance
  from public.obras o
  join public.cotizaciones c on c.id = o.cotizacion_id
  join public.clientes cl    on cl.id = c.cliente_id
  left join mo       on mo.obra_id       = o.id
  left join mat_cot  on mat_cot.obra_id  = o.id
  left join mat_real on mat_real.obra_id = o.id
  left join gas      on gas.obra_id      = o.id
  left join av       on av.obra_id       = o.id;

-- ===========================================================================
-- OPERACIONES ATÓMICAS
--
-- Todas empiezan exigiendo rol de staff. Sin esta guarda, un usuario de
-- cuadrilla podría llamarlas: RLS bloquearía cada UPDATE por separado, pero la
-- función terminaría devolviendo un resultado que no ocurrió.
-- ===========================================================================
create or replace function public.exigir_staff()
returns void
language plpgsql stable set search_path = public as $$
begin
  if not public.es_staff() then
    raise exception 'Esta operación es exclusiva de Dirección y Administración'
      using errcode = '42501';
  end if;
end $$;

-- Recorrer el cronograma: llovió, faltó el oficial, se atrasó el material.
create or replace function public.recorrer_cronograma(
  p_obra uuid, p_dias integer, p_desde date default current_date
) returns integer
language plpgsql set search_path = public as $$
declare v_movidas integer;
begin
  perform public.exigir_staff();

  update public.cronograma_tareas
     set fecha_inicio = fecha_inicio + p_dias,
         fecha_fin    = fecha_fin + p_dias
   where obra_id = p_obra
     and estatus <> 'terminada'
     and coalesce(fecha_inicio, fecha_fin) >= p_desde;

  get diagnostics v_movidas = row_count;

  if v_movidas > 0 then
    perform public.anotar_bitacora(p_obra, 'cronograma',
      format('Se recorrieron %s tareas %s días', v_movidas, p_dias),
      jsonb_build_object('dias', p_dias, 'desde', p_desde, 'tareas', v_movidas));
  end if;

  return v_movidas;
end $$;

-- Salida del taller a la obra: descuenta el kardex y anota el material real
-- con folio "TALLER".
create or replace function public.salida_taller_a_obra(
  p_obra uuid,
  p_producto uuid,
  p_cantidad numeric,
  p_concepto uuid default null,
  p_notas text default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_producto  record;
  v_existencia numeric;
  v_material  uuid;
begin
  perform public.exigir_staff();

  select * into v_producto from public.productos where id = p_producto;
  if not found then raise exception 'El insumo no existe'; end if;

  select coalesce(sum(case when tipo = 'entrada' then cantidad else -cantidad end), 0)
    into v_existencia from public.insumos_kardex where producto_id = p_producto;

  if v_existencia < p_cantidad then
    raise exception 'Sólo hay % % de % en el taller', v_existencia, v_producto.unidad, v_producto.nombre;
  end if;

  insert into public.insumos_kardex (producto_id, tipo, cantidad, obra_id, notas, registrado_por)
  values (p_producto, 'salida', p_cantidad, p_obra,
          coalesce(p_notas, 'Salida a obra'), auth.uid());

  insert into public.obra_materiales
    (obra_id, concepto_id, origen, material, producto_id, piezas, costo, es_taller)
  values (p_obra, p_concepto, 'real', v_producto.nombre, p_producto,
          p_cantidad, v_producto.costo, true)
  returning id into v_material;

  perform public.anotar_bitacora(p_obra, 'material',
    format('Salió del taller: %s %s de %s', p_cantidad, v_producto.unidad, v_producto.nombre));

  update public.obras set fecha_ultima_actualizacion = now() where id = p_obra;

  return v_material;
end $$;

-- Armar el pagaré con las herramientas que se lleva el oficial.
create or replace function public.crear_pagare(
  p_contrato uuid, p_herramientas uuid[]
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_pagare uuid;
  v_obra   uuid;
  v_id     uuid;
begin
  perform public.exigir_staff();

  if array_length(p_herramientas, 1) is null then
    raise exception 'Hay que seleccionar al menos una herramienta';
  end if;

  select obra_id into v_obra from public.contratos_oficial where id = p_contrato;
  if v_obra is null then
    raise exception 'El contrato no existe o no tienes acceso';
  end if;

  insert into public.pagares (contrato_id) values (p_contrato) returning id into v_pagare;

  foreach v_id in array p_herramientas loop
    insert into public.pagare_items (pagare_id, herramienta_id, valor_unitario)
    select v_pagare, h.id, coalesce(h.valor, 0)
      from public.herramientas h where h.id = v_id;
  end loop;

  perform public.anotar_bitacora(v_obra, 'pagare',
    format('Se firmó pagaré por %s herramientas', array_length(p_herramientas, 1)));

  return v_pagare;
end $$;

-- Cancelar el pagaré: las herramientas regresan al taller.
create or replace function public.cancelar_pagare(p_pagare uuid)
returns integer
language plpgsql set search_path = public as $$
declare
  v_obra uuid;
  v_n    integer;
begin
  perform public.exigir_staff();

  select c.obra_id into v_obra
    from public.pagares p join public.contratos_oficial c on c.id = p.contrato_id
   where p.id = p_pagare;

  if v_obra is null then raise exception 'El pagaré no existe o no tienes acceso'; end if;

  -- El trigger de pagare_items regresa cada herramienta a Disponible / Taller.
  update public.pagare_items
     set devuelta = true, fecha_devolucion = current_date
   where pagare_id = p_pagare and not devuelta;
  get diagnostics v_n = row_count;

  update public.pagares
     set estatus = 'cancelado', fecha_cancelacion = current_date
   where id = p_pagare;

  perform public.anotar_bitacora(v_obra, 'pagare',
    format('Pagaré cancelado, %s herramientas devueltas al taller', v_n));

  return v_n;
end $$;

-- Entrega formal: la obra pasa a revisión de detalles.
create or replace function public.entregar_obra(p_obra uuid, p_fecha date default current_date)
returns void
language plpgsql set search_path = public as $$
begin
  perform public.exigir_staff();

  update public.obras
     set estatus = 'en_entrega', fecha_ultima_actualizacion = now()
   where id = p_obra;

  if not found then raise exception 'La obra no existe o no tienes acceso'; end if;

  perform public.anotar_bitacora(p_obra, 'entrega',
    format('Entrega formal al cliente el %s', to_char(p_fecha, 'DD/MM/YYYY')));
end $$;

/*
 * Cierre de obra. Es el único punto donde se juntan todos los cabos:
 * devolver herramienta, cancelar pagarés, cerrar contratos y, si ya no queda
 * ninguna otra OT abierta de la misma cotización, marcarla como terminada.
 * Devuelve un resumen de lo que hizo y de lo que quedó pendiente.
 */
create or replace function public.cerrar_obra(
  p_obra uuid,
  p_fecha date default current_date,
  p_forzar boolean default false
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_obra        record;
  v_pagare      record;
  v_herramientas integer := 0;
  v_pagares     integer := 0;
  v_contratos   integer := 0;
  v_detalles    integer;
  v_saldo       numeric;
  v_mo_pendiente numeric;
  v_abiertas    integer;
begin
  perform public.exigir_staff();

  select * into v_obra from public.obras where id = p_obra;
  if not found then raise exception 'La obra no existe o no tienes acceso'; end if;
  if v_obra.estatus = 'cerrada' then raise exception 'La OT % ya estaba cerrada', v_obra.ot_numero; end if;

  -- Nada se cierra con detalles abiertos, saldo del cliente o nómina pendiente.
  select count(*) into v_detalles
    from public.obra_detalles where obra_id = p_obra and not atendido;

  select round(c.total - coalesce(sum(pc.monto), 0), 2) into v_saldo
    from public.cotizaciones c
    left join public.pagos_cobranza pc on pc.cotizacion_id = c.id
   where c.id = v_obra.cotizacion_id
   group by c.total;

  select coalesce(sum(ct.total_pagar), 0) - coalesce(sum(pagado.monto), 0) into v_mo_pendiente
    from public.contratos_oficial ct
    left join lateral (
      select coalesce(sum(n.monto), 0) as monto
        from public.nomina_pagos n where n.contrato_id = ct.id
    ) pagado on true
   where ct.obra_id = p_obra;

  if not p_forzar and (v_detalles > 0 or coalesce(v_saldo, 0) > 0 or coalesce(v_mo_pendiente, 0) > 0) then
    return jsonb_build_object(
      'cerrada', false,
      'detalles_pendientes', v_detalles,
      'saldo_cliente', coalesce(v_saldo, 0),
      'mano_obra_pendiente', coalesce(v_mo_pendiente, 0)
    );
  end if;

  -- Devolver herramienta y cancelar los pagarés vivos
  for v_pagare in
    select p.id from public.pagares p
      join public.contratos_oficial c on c.id = p.contrato_id
     where c.obra_id = p_obra and p.estatus = 'activo'
  loop
    v_herramientas := v_herramientas + public.cancelar_pagare(v_pagare.id);
    v_pagares := v_pagares + 1;
  end loop;

  -- Cerrar los contratos de mano de obra
  update public.contratos_oficial
     set estatus = 'cerrado', fecha_cierre = p_fecha
   where obra_id = p_obra and estatus = 'activo';
  get diagnostics v_contratos = row_count;

  update public.obras
     set estatus = 'cerrada', fecha_cierre = p_fecha, fecha_ultima_actualizacion = now()
   where id = p_obra;

  perform public.anotar_bitacora(p_obra, 'cierre',
    format('OT cerrada: %s contratos, %s pagarés y %s herramientas devueltas',
           v_contratos, v_pagares, v_herramientas));

  -- ¿Queda alguna otra OT viva de esta cotización?
  select count(*) into v_abiertas
    from public.obras where cotizacion_id = v_obra.cotizacion_id and estatus <> 'cerrada';

  if v_abiertas = 0 then
    update public.cotizaciones set estatus = 'terminada' where id = v_obra.cotizacion_id;
  end if;

  return jsonb_build_object(
    'cerrada', true,
    'contratos_cerrados', v_contratos,
    'pagares_cancelados', v_pagares,
    'herramientas_devueltas', v_herramientas,
    'cotizacion_terminada', v_abiertas = 0,
    'forzado', p_forzar
  );
end $$;

-- ===========================================================================
-- RLS de las tablas nuevas
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array['recibos', 'obra_detalles', 'bitacora_obra'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy staff_todo on public.%I for all to authenticated
         using (public.es_staff()) with check (public.es_staff())', t);
    execute format(
      'create policy contador_lectura on public.%I for select to authenticated
         using (public.es_contador())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- La cuadrilla puede leer la bitácora de sus obras (es su historial de trabajo)
create policy cuadrilla_ve_bitacora on public.bitacora_obra
  for select to authenticated
  using (public.es_cuadrilla() and public.es_mi_obra(obra_id));

grant execute on function
  public.exigir_staff(),
  public.anotar_bitacora(uuid, evento_obra, text, jsonb),
  public.recorrer_cronograma(uuid, integer, date),
  public.salida_taller_a_obra(uuid, uuid, numeric, uuid, text),
  public.crear_pagare(uuid, uuid[]),
  public.cancelar_pagare(uuid),
  public.entregar_obra(uuid, date),
  public.cerrar_obra(uuid, date, boolean)
  to authenticated;

-- Serie de folios del recibo
insert into public.consecutivos (serie, anio, ultimo) values ('recibo', 0, 0)
on conflict (serie, anio) do nothing;
