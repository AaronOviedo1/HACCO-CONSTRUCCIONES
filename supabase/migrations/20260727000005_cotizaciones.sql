-- ============================================================================
-- HaacoPro · Migración 005 · Cotizaciones
--
-- Añade el presupuesto de materiales por cotización (lo que después se copia
-- a la OT como origen = 'cotizado') y las tres operaciones que tienen que ser
-- atómicas: guardar, duplicar y aprobar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Materiales presupuestados de la cotización
-- ---------------------------------------------------------------------------
create type rubro_material as enum ('herreria', 'pintura', 'otro');

create table public.cotizacion_materiales (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  desglose_id   uuid references public.cotizacion_herreria_desglose(id) on delete cascade,
  rubro         rubro_material not null default 'pintura',
  material      text not null,
  producto_id   uuid references public.productos(id) on delete set null,
  piezas        numeric(12,2) not null default 1,
  costo         numeric(14,2) not null default 0,
  total         numeric(14,2) generated always as (round(piezas * costo, 2)) stored,
  orden         integer not null default 0
);
create index on public.cotizacion_materiales (cotizacion_id);
create index on public.cotizacion_materiales (desglose_id);

-- Las partidas que nacen de un concepto de herrería se marcan para que el
-- editor no las duplique: se muestran como desglose, no como partida suelta.
alter table public.cotizacion_items
  add column desglose_id uuid references public.cotizacion_herreria_desglose(id) on delete cascade;

-- El desglose ya no guarda su detalle en jsonb: vive en cotizacion_materiales.
alter table public.cotizacion_herreria_desglose drop column detalle_materiales;

-- Los importes de materiales del concepto se recalculan desde sus renglones.
create or replace function public.tg_recalcular_desglose()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_desglose uuid := coalesce(new.desglose_id, old.desglose_id);
begin
  if v_desglose is null then return null; end if;
  update public.cotizacion_herreria_desglose d
     set materiales_herreria = coalesce((select sum(m.total) from public.cotizacion_materiales m
                                          where m.desglose_id = v_desglose and m.rubro = 'herreria'), 0),
         materiales_pintura  = coalesce((select sum(m.total) from public.cotizacion_materiales m
                                          where m.desglose_id = v_desglose and m.rubro = 'pintura'), 0)
   where d.id = v_desglose;
  return null;
end $$;

create trigger recalcular_desglose
  after insert or update or delete on public.cotizacion_materiales
  for each row execute function public.tg_recalcular_desglose();

alter table public.cotizacion_materiales enable row level security;
create policy staff_todo on public.cotizacion_materiales for all to authenticated
  using (public.es_staff()) with check (public.es_staff());
create policy contador_lectura on public.cotizacion_materiales for select to authenticated
  using (public.es_contador());
grant select, insert, update, delete on public.cotizacion_materiales to authenticated;

-- ===========================================================================
-- GUARDAR COTIZACIÓN · reemplaza el documento completo en una transacción
-- ===========================================================================
create or replace function public.guardar_cotizacion(p_id uuid, p_datos jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id        uuid := p_id;
  v_bloque    jsonb;
  v_material  jsonb;
  v_desglose  uuid;
  v_precio    numeric(14,2);
  v_orden     integer := 0;
begin
  if v_id is null then
    insert into public.cotizaciones (cliente_id, nombre_obra, domicilio_obra, tipo,
                                     requiere_factura, anticipo_pct, iva_pct, vigencia_dias,
                                     linea_calidad, notas, fecha, creado_por)
    values (
      (p_datos->>'cliente_id')::uuid,
      nullif(p_datos->>'nombre_obra', ''),
      nullif(p_datos->>'domicilio_obra', ''),
      coalesce((p_datos->>'tipo')::tipo_cotizacion, 'pintura'),
      coalesce((p_datos->>'requiere_factura')::boolean, false),
      nullif(p_datos->>'anticipo_pct', '')::numeric,
      coalesce(nullif(p_datos->>'iva_pct', '')::numeric, 16),
      coalesce(nullif(p_datos->>'vigencia_dias', '')::integer, 30),
      nullif(p_datos->>'linea_calidad', ''),
      nullif(p_datos->>'notas', ''),
      coalesce(nullif(p_datos->>'fecha', '')::date, current_date),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.cotizaciones set
      cliente_id       = (p_datos->>'cliente_id')::uuid,
      nombre_obra      = nullif(p_datos->>'nombre_obra', ''),
      domicilio_obra   = nullif(p_datos->>'domicilio_obra', ''),
      tipo             = coalesce((p_datos->>'tipo')::tipo_cotizacion, tipo),
      requiere_factura = coalesce((p_datos->>'requiere_factura')::boolean, false),
      anticipo_pct     = coalesce(nullif(p_datos->>'anticipo_pct', '')::numeric, anticipo_pct),
      iva_pct          = coalesce(nullif(p_datos->>'iva_pct', '')::numeric, iva_pct),
      vigencia_dias    = coalesce(nullif(p_datos->>'vigencia_dias', '')::integer, vigencia_dias),
      linea_calidad    = nullif(p_datos->>'linea_calidad', ''),
      notas            = nullif(p_datos->>'notas', ''),
      fecha            = coalesce(nullif(p_datos->>'fecha', '')::date, fecha)
    where id = v_id;

    if not found then
      raise exception 'La cotización % no existe o no tienes acceso', v_id;
    end if;
  end if;

  -- Se reemplazan los hijos: el editor manda siempre el documento completo.
  delete from public.cotizacion_materiales where cotizacion_id = v_id;
  delete from public.cotizacion_items       where cotizacion_id = v_id;
  delete from public.cotizacion_herreria_desglose where cotizacion_id = v_id;
  delete from public.cotizacion_procesos    where cotizacion_id = v_id;

  -- Bullets del proceso
  for v_bloque in select * from jsonb_array_elements(coalesce(p_datos->'procesos', '[]'::jsonb)) loop
    insert into public.cotizacion_procesos (cotizacion_id, texto_proceso_id, contenido_override, orden)
    values (v_id,
            nullif(v_bloque->>'texto_proceso_id', '')::uuid,
            v_bloque->>'contenido',
            coalesce((v_bloque->>'orden')::integer, 0));
  end loop;

  -- Partidas de pintura
  for v_bloque in select * from jsonb_array_elements(coalesce(p_datos->'items', '[]'::jsonb)) loop
    insert into public.cotizacion_items (cotizacion_id, descripcion, m2, precio_unitario, producto_id, orden)
    values (v_id,
            v_bloque->>'descripcion',
            nullif(v_bloque->>'m2', '')::numeric,
            coalesce(nullif(v_bloque->>'precio_unitario', '')::numeric, 0),
            nullif(v_bloque->>'producto_id', '')::uuid,
            v_orden);
    v_orden := v_orden + 1;
  end loop;

  -- Conceptos de herrería: cada uno genera su partida con el precio de venta
  for v_bloque in select * from jsonb_array_elements(coalesce(p_datos->'desglose', '[]'::jsonb)) loop
    insert into public.cotizacion_herreria_desglose
      (cotizacion_id, concepto, mano_obra, gastos_indirectos_pct, utilidad_pct, orden)
    values (v_id,
            v_bloque->>'concepto',
            coalesce(nullif(v_bloque->>'mano_obra', '')::numeric, 0),
            coalesce(nullif(v_bloque->>'gastos_indirectos_pct', '')::numeric, 5),
            coalesce(nullif(v_bloque->>'utilidad_pct', '')::numeric, 35),
            v_orden)
    returning id into v_desglose;

    for v_material in select * from jsonb_array_elements(coalesce(v_bloque->'materiales', '[]'::jsonb)) loop
      insert into public.cotizacion_materiales
        (cotizacion_id, desglose_id, rubro, material, producto_id, piezas, costo, orden)
      values (v_id, v_desglose,
              coalesce((v_material->>'rubro')::rubro_material, 'herreria'),
              v_material->>'material',
              nullif(v_material->>'producto_id', '')::uuid,
              coalesce(nullif(v_material->>'piezas', '')::numeric, 1),
              coalesce(nullif(v_material->>'costo', '')::numeric, 0),
              coalesce((v_material->>'orden')::integer, 0));
    end loop;

    -- El trigger ya actualizó los materiales; ahora sí se conoce el precio.
    select precio_venta into v_precio
      from public.cotizacion_herreria_desglose where id = v_desglose;

    insert into public.cotizacion_items
      (cotizacion_id, desglose_id, descripcion, precio_unitario, orden)
    values (v_id, v_desglose, v_bloque->>'concepto', coalesce(v_precio, 0), v_orden);

    v_orden := v_orden + 1;
  end loop;

  -- Materiales presupuestados sueltos (los de pintura)
  for v_material in select * from jsonb_array_elements(coalesce(p_datos->'materiales', '[]'::jsonb)) loop
    insert into public.cotizacion_materiales
      (cotizacion_id, rubro, material, producto_id, piezas, costo, orden)
    values (v_id,
            coalesce((v_material->>'rubro')::rubro_material, 'pintura'),
            v_material->>'material',
            nullif(v_material->>'producto_id', '')::uuid,
            coalesce(nullif(v_material->>'piezas', '')::numeric, 1),
            coalesce(nullif(v_material->>'costo', '')::numeric, 0),
            coalesce((v_material->>'orden')::integer, 0));
  end loop;

  return v_id;
end $$;

-- ===========================================================================
-- DUPLICAR · variantes del mismo cliente
-- ===========================================================================
create or replace function public.duplicar_cotizacion(p_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_nueva  uuid;
  v_fila   record;
  v_deng   uuid;
begin
  insert into public.cotizaciones
    (cliente_id, nombre_obra, domicilio_obra, tipo, requiere_factura, anticipo_pct,
     iva_pct, linea_calidad, notas, vigencia_dias, fecha, creado_por, estatus)
  select cliente_id,
         nombre_obra,
         domicilio_obra, tipo, requiere_factura, anticipo_pct,
         iva_pct, linea_calidad, notas, vigencia_dias, current_date, auth.uid(), 'borrador'
    from public.cotizaciones where id = p_id
  returning id into v_nueva;

  if v_nueva is null then
    raise exception 'La cotización % no existe o no tienes acceso', p_id;
  end if;

  insert into public.cotizacion_procesos (cotizacion_id, texto_proceso_id, contenido_override, orden)
  select v_nueva, texto_proceso_id, contenido_override, orden
    from public.cotizacion_procesos where cotizacion_id = p_id;

  -- Conceptos de herrería con sus materiales y su partida derivada
  for v_fila in
    select * from public.cotizacion_herreria_desglose where cotizacion_id = p_id order by orden
  loop
    insert into public.cotizacion_herreria_desglose
      (cotizacion_id, concepto, mano_obra, gastos_indirectos_pct, utilidad_pct, orden)
    values (v_nueva, v_fila.concepto, v_fila.mano_obra, v_fila.gastos_indirectos_pct,
            v_fila.utilidad_pct, v_fila.orden)
    returning id into v_deng;

    insert into public.cotizacion_materiales
      (cotizacion_id, desglose_id, rubro, material, producto_id, piezas, costo, orden)
    select v_nueva, v_deng, rubro, material, producto_id, piezas, costo, orden
      from public.cotizacion_materiales where desglose_id = v_fila.id;

    insert into public.cotizacion_items
      (cotizacion_id, desglose_id, descripcion, precio_unitario, orden)
    select v_nueva, v_deng, descripcion, precio_unitario, orden
      from public.cotizacion_items where desglose_id = v_fila.id;
  end loop;

  -- Partidas de pintura y materiales sueltos
  insert into public.cotizacion_items
    (cotizacion_id, descripcion, m2, precio_unitario, producto_id, orden)
  select v_nueva, descripcion, m2, precio_unitario, producto_id, orden
    from public.cotizacion_items where cotizacion_id = p_id and desglose_id is null;

  insert into public.cotizacion_materiales
    (cotizacion_id, rubro, material, producto_id, piezas, costo, orden)
  select v_nueva, rubro, material, producto_id, piezas, costo, orden
    from public.cotizacion_materiales where cotizacion_id = p_id and desglose_id is null;

  return v_nueva;
end $$;

-- ===========================================================================
-- APROBAR · genera una o varias OTs y copia el presupuesto de materiales
-- ===========================================================================
create or replace function public.aprobar_cotizacion(
  p_id uuid,
  p_obras jsonb,
  p_anticipo_pct numeric default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_cot      record;
  v_bloque   jsonb;
  v_obra     uuid;
  v_primera  uuid;
  v_creadas  jsonb := '[]'::jsonb;
  v_numero   text;
begin
  select * into v_cot from public.cotizaciones where id = p_id;
  if not found then
    raise exception 'La cotización % no existe o no tienes acceso', p_id;
  end if;
  if v_cot.estatus = 'aprobada' then
    raise exception 'La cotización % ya estaba aprobada', v_cot.folio;
  end if;
  if jsonb_array_length(coalesce(p_obras, '[]'::jsonb)) = 0 then
    raise exception 'Hay que crear al menos una orden de trabajo';
  end if;

  update public.cotizaciones
     set estatus = 'aprobada',
         fecha_resolucion = current_date,
         anticipo_pct = coalesce(p_anticipo_pct, anticipo_pct)
   where id = p_id;

  for v_bloque in select * from jsonb_array_elements(p_obras) loop
    insert into public.obras
      (cotizacion_id, nombre, domicilio, monto_cotizado, fecha_estimada_entrega, estatus)
    values (p_id,
            v_bloque->>'nombre',
            coalesce(nullif(v_bloque->>'domicilio', ''), v_cot.domicilio_obra),
            coalesce(nullif(v_bloque->>'monto', '')::numeric, 0),
            nullif(v_bloque->>'fecha_estimada_entrega', '')::date,
            'agendada')
    returning id, ot_numero into v_obra, v_numero;

    v_primera := coalesce(v_primera, v_obra);
    v_creadas := v_creadas || jsonb_build_object(
      'id', v_obra, 'ot_numero', v_numero, 'nombre', v_bloque->>'nombre');
  end loop;

  -- El presupuesto de materiales entra a la primera OT como origen 'cotizado';
  -- desde la OT se puede repartir entre conceptos más adelante.
  insert into public.obra_materiales (obra_id, origen, material, producto_id, piezas, costo)
  select v_primera, 'cotizado', m.material, m.producto_id, m.piezas, m.costo
    from public.cotizacion_materiales m
   where m.cotizacion_id = p_id;

  return jsonb_build_object(
    'folio', v_cot.folio,
    'anticipo_esperado', round(v_cot.total * coalesce(p_anticipo_pct, v_cot.anticipo_pct, 50) / 100, 2),
    'obras', v_creadas
  );
end $$;

grant execute on function public.guardar_cotizacion(uuid, jsonb),
                          public.duplicar_cotizacion(uuid),
                          public.aprobar_cotizacion(uuid, jsonb, numeric)
  to authenticated;

-- ===========================================================================
-- VISTAS
-- ===========================================================================

-- Lista de cotizaciones lista para pintar en pantalla
create view public.v_cotizaciones with (security_invoker = on) as
select c.id,
       c.folio,
       c.fecha,
       c.tipo,
       c.estatus,
       c.requiere_factura,
       c.nombre_obra,
       c.subtotal,
       c.iva_pct,
       c.total,
       c.anticipo_pct,
       round(c.total * coalesce(c.anticipo_pct, 50) / 100, 2)          as anticipo_esperado,
       c.vigencia_dias,
       (c.fecha + c.vigencia_dias)                                     as vence,
       c.cliente_id,
       cl.nombre                                                       as cliente,
       (select count(*) from public.obras o where o.cotizacion_id = c.id)      as obras,
       coalesce((select sum(p.monto) from public.pagos_cobranza p
                  where p.cotizacion_id = c.id), 0)                    as cobrado,
       c.created_at,
       c.updated_at
  from public.cotizaciones c
  join public.clientes cl on cl.id = c.cliente_id;

-- v_cobranza gana el anticipo esperado
drop view if exists public.v_cobranza;
create view public.v_cobranza with (security_invoker = on) as
select c.id              as cotizacion_id,
       c.folio,
       c.fecha,
       c.estatus,
       c.requiere_factura,
       cl.id             as cliente_id,
       cl.nombre         as cliente,
       c.subtotal,
       c.total           as cotizado,
       c.anticipo_pct,
       round(c.total * coalesce(c.anticipo_pct, 50) / 100, 2)           as anticipo_esperado,
       coalesce(sum(p.monto) filter (where p.tipo = 'anticipo'), 0)     as anticipo,
       coalesce(sum(p.monto) filter (where p.tipo = 'abono'), 0)        as abonos,
       coalesce(sum(p.monto) filter (where p.tipo = 'liquidacion'), 0)  as liquidacion,
       coalesce(sum(p.monto), 0)                                        as cobrado,
       round(c.total - coalesce(sum(p.monto), 0), 2)                    as saldo,
       case when c.total > 0
            then round((c.total - coalesce(sum(p.monto), 0)) / c.total * 100, 2)
            else 0 end                                                  as pct_pendiente
  from public.cotizaciones c
  join public.clientes cl on cl.id = c.cliente_id
  left join public.pagos_cobranza p on p.cotizacion_id = c.id
 group by c.id, cl.id;
