-- ============================================================================
-- HaacoPro · Migración 008 · Viáticos presupuestados y cotizado en la OT
--
-- La cotización guarda ahora los viáticos que se calculan para la obra, y el
-- concentrado de la OT enseña en la columna COTIZADO la mano de obra del
-- desglose de herrería y esos viáticos, para compararlos contra lo real.
-- ============================================================================

alter table public.cotizaciones
  add column viaticos numeric(14,2) not null default 0;

comment on column public.cotizaciones.viaticos is
  'Viáticos presupuestados. No salen en el PDF; se comparan en el concentrado de la OT.';

-- ---------------------------------------------------------------------------
-- guardar_cotizacion · igual que en la 005, ahora persiste los viáticos
-- ---------------------------------------------------------------------------
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
                                     viaticos, linea_calidad, notas, fecha, creado_por)
    values (
      (p_datos->>'cliente_id')::uuid,
      nullif(p_datos->>'nombre_obra', ''),
      nullif(p_datos->>'domicilio_obra', ''),
      coalesce((p_datos->>'tipo')::tipo_cotizacion, 'pintura'),
      coalesce((p_datos->>'requiere_factura')::boolean, false),
      nullif(p_datos->>'anticipo_pct', '')::numeric,
      coalesce(nullif(p_datos->>'iva_pct', '')::numeric, 16),
      coalesce(nullif(p_datos->>'vigencia_dias', '')::integer, 30),
      coalesce(nullif(p_datos->>'viaticos', '')::numeric, 0),
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
      viaticos         = coalesce(nullif(p_datos->>'viaticos', '')::numeric, 0),
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

-- ---------------------------------------------------------------------------
-- duplicar_cotizacion · la copia se lleva también los viáticos
-- ---------------------------------------------------------------------------
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
     iva_pct, viaticos, linea_calidad, notas, vigencia_dias, fecha, creado_por, estatus)
  select cliente_id,
         nombre_obra,
         domicilio_obra, tipo, requiere_factura, anticipo_pct,
         iva_pct, viaticos, linea_calidad, notas, vigencia_dias, current_date, auth.uid(), 'borrador'
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

-- ---------------------------------------------------------------------------
-- CONCENTRADO · columna COTIZADO para mano de obra y viáticos
-- La mano de obra cotizada sale del desglose de herrería de la cotización;
-- los viáticos cotizados, del campo nuevo. Igual que el material cotizado,
-- son el punto de comparación contra lo real.
-- ---------------------------------------------------------------------------
drop view if exists public.v_obra_concentrado;
create view public.v_obra_concentrado with (security_invoker = on) as
with mo as (
  select obra_id,
         sum(total_pagar) as mano_obra,
         count(*)         as contratos
    from public.contratos_oficial group by obra_id
), mo_cot as (
  select cotizacion_id, sum(mano_obra) as mano_obra
    from public.cotizacion_herreria_desglose group by cotizacion_id
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
       coalesce(mo_cot.mano_obra, 0)                                      as mano_obra_cotizada,
       coalesce(mo.mano_obra, 0)                                          as mano_obra,
       coalesce(mo.contratos, 0)                                          as contratos,
       coalesce(mat_cot.material, 0)                                      as material_cotizado,
       coalesce(mat_real.material, 0) + coalesce(gas.material_suelto, 0)  as material_real,
       coalesce(c.viaticos, 0)                                            as viaticos_cotizados,
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
  left join mo_cot   on mo_cot.cotizacion_id = o.cotizacion_id
  left join mat_cot  on mat_cot.obra_id  = o.id
  left join mat_real on mat_real.obra_id = o.id
  left join gas      on gas.obra_id      = o.id
  left join av       on av.obra_id       = o.id;
