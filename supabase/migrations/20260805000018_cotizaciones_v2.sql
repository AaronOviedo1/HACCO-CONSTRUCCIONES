-- ===========================================================================
-- COTIZACIONES · UNIDAD DE LA PARTIDA Y DESCUENTO EN PORCENTAJE
--
-- Dos huecos que salieron al usar la app con trabajo de herrería:
--
-- 1. La partida siempre se leía como metros cuadrados. En herrería y en «otros»
--    el cálculo del precio es interno y al cliente se le cobra por pieza, así
--    que la columna m2 se dejaba vacía y el importe salía del precio unitario
--    tal cual. Funcionaba, pero la carta decía «M²» y el número no estaba.
--    Ahora la partida trae su unidad. La columna se sigue llamando m2 por
--    historia: siempre fue la cantidad, sólo le faltaba la etiqueta. Nulo
--    significa metros cuadrados, así que todo lo migrado del Excel 2026 queda
--    exactamente como está.
--
-- 2. No había descuento. Se venía capturando como una partida más con importe
--    negativo, que es lo que hace el importador del Excel. Ahora es un
--    porcentaje sobre el subtotal, antes de IVA, y aparece en el PDF.
--
--    Los descuentos viejos NO se convierten: su subtotal ya es el neto y
--    tocarlos movería el total de cotizaciones aprobadas y de OTs vivas.
--
-- El total es una columna generada, así que para meter el descuento hay que
-- tirarla y volverla a crear, y con ella las tres vistas que la leen.
-- cerrar_obra y aprobar_cotizacion no se tocan: leen cotizaciones.total desde
-- plpgsql y quedan correctas solas en cuanto la columna incluya el descuento.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Unidad de la partida
-- ---------------------------------------------------------------------------
alter table public.cotizacion_items add column if not exists unidad text;

comment on column public.cotizacion_items.m2 is
  'Cantidad de la partida, en la unidad de la columna unidad. Nulo = 1. Se llama m2 por historia: la mayoría de las partidas de pintura se miden en metros cuadrados.';
comment on column public.cotizacion_items.unidad is
  'Unidad de la cantidad. Nulo o «m2» = metros cuadrados; «pza», «ml», «lote», «servicio».';

-- ---------------------------------------------------------------------------
-- 2. Descuento en porcentaje
-- ---------------------------------------------------------------------------
drop view if exists public.v_cobranza;
drop view if exists public.v_cotizaciones;
drop view if exists public.v_obra_concentrado;

alter table public.cotizaciones
  add column if not exists descuento_pct numeric(5,2) not null default 0
    check (descuento_pct between 0 and 100);

comment on column public.cotizaciones.descuento_pct is
  'Descuento comercial sobre el subtotal, antes de IVA. Sale impreso en el PDF.';

alter table public.cotizaciones drop column total;
alter table public.cotizaciones add column total numeric(14,2) generated always as
  (round(subtotal * (1 - descuento_pct / 100) * (1 + iva_pct / 100), 2)) stored;

-- ---------------------------------------------------------------------------
-- guardar_cotizacion · igual que en la 008, ahora con unidad y descuento
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
                                     requiere_factura, anticipo_pct, iva_pct, descuento_pct,
                                     vigencia_dias, viaticos, linea_calidad, notas, fecha, creado_por)
    values (
      (p_datos->>'cliente_id')::uuid,
      nullif(p_datos->>'nombre_obra', ''),
      nullif(p_datos->>'domicilio_obra', ''),
      coalesce((p_datos->>'tipo')::tipo_cotizacion, 'pintura'),
      coalesce((p_datos->>'requiere_factura')::boolean, false),
      nullif(p_datos->>'anticipo_pct', '')::numeric,
      coalesce(nullif(p_datos->>'iva_pct', '')::numeric, 16),
      coalesce(nullif(p_datos->>'descuento_pct', '')::numeric, 0),
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
      descuento_pct    = coalesce(nullif(p_datos->>'descuento_pct', '')::numeric, 0),
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

  -- Partidas sueltas, cada una con su unidad
  for v_bloque in select * from jsonb_array_elements(coalesce(p_datos->'items', '[]'::jsonb)) loop
    insert into public.cotizacion_items
      (cotizacion_id, descripcion, m2, unidad, precio_unitario, producto_id, orden)
    values (v_id,
            v_bloque->>'descripcion',
            nullif(v_bloque->>'m2', '')::numeric,
            nullif(v_bloque->>'unidad', ''),
            coalesce(nullif(v_bloque->>'precio_unitario', '')::numeric, 0),
            nullif(v_bloque->>'producto_id', '')::uuid,
            v_orden);
    v_orden := v_orden + 1;
  end loop;

  -- Conceptos de herrería: cada uno genera su partida con el precio de venta.
  -- Van por pieza: el desglose ya calculó el precio de una.
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
      (cotizacion_id, desglose_id, descripcion, unidad, precio_unitario, orden)
    values (v_id, v_desglose, v_bloque->>'concepto', 'pza', coalesce(v_precio, 0), v_orden);

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
-- duplicar_cotizacion · la copia se lleva el descuento y las unidades
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
     iva_pct, descuento_pct, viaticos, linea_calidad, notas, vigencia_dias, fecha, creado_por, estatus)
  select cliente_id,
         nombre_obra,
         domicilio_obra, tipo, requiere_factura, anticipo_pct,
         iva_pct, descuento_pct, viaticos, linea_calidad, notas, vigencia_dias,
         current_date, auth.uid(), 'borrador'
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
      (cotizacion_id, desglose_id, descripcion, unidad, precio_unitario, orden)
    select v_nueva, v_deng, descripcion, unidad, precio_unitario, orden
      from public.cotizacion_items where desglose_id = v_fila.id;
  end loop;

  -- Partidas sueltas y materiales sueltos
  insert into public.cotizacion_items
    (cotizacion_id, descripcion, m2, unidad, precio_unitario, producto_id, orden)
  select v_nueva, descripcion, m2, unidad, precio_unitario, producto_id, orden
    from public.cotizacion_items where cotizacion_id = p_id and desglose_id is null;

  insert into public.cotizacion_materiales
    (cotizacion_id, rubro, material, producto_id, piezas, costo, orden)
  select v_nueva, rubro, material, producto_id, piezas, costo, orden
    from public.cotizacion_materiales where cotizacion_id = p_id and desglose_id is null;

  return v_nueva;
end $$;

-- ===========================================================================
-- VISTAS · las tres que leen cotizaciones.total, recreadas con el descuento
-- ===========================================================================

create view public.v_cotizaciones with (security_invoker = on) as
select c.id,
       c.folio,
       c.fecha,
       c.tipo,
       c.estatus,
       c.requiere_factura,
       c.nombre_obra,
       c.subtotal,
       c.descuento_pct,
       round(c.subtotal * c.descuento_pct / 100, 2)                    as descuento,
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

create view public.v_cobranza with (security_invoker = on) as
select c.id              as cotizacion_id,
       c.folio,
       c.fecha,
       c.estatus,
       c.requiere_factura,
       cl.id             as cliente_id,
       cl.nombre         as cliente,
       c.subtotal,
       c.descuento_pct,
       round(c.subtotal * c.descuento_pct / 100, 2)                     as descuento,
       c.total           as cotizado,
       c.anticipo_pct,
       round(c.total * coalesce(c.anticipo_pct, 50) / 100, 2)           as anticipo_esperado,
       coalesce(sum(p.monto) filter (where p.tipo = 'anticipo'), 0)     as anticipo,
       coalesce(sum(p.monto) filter (where p.tipo = 'abono'), 0)        as abonos,
       coalesce(sum(p.monto) filter (where p.tipo = 'liquidacion'), 0)  as liquidacion,
       coalesce(sum(p.monto), 0)                                        as cobrado,
       round(c.total - coalesce(sum(p.monto), 0), 2)                    as saldo,
       max(p.fecha)                                                     as ultimo_pago,
       case when c.total > 0
            then round((c.total - coalesce(sum(p.monto), 0)) / c.total * 100, 2)
            else 0 end                                                  as pct_pendiente
  from public.cotizaciones c
  join public.clientes cl on cl.id = c.cliente_id
  left join public.pagos_cobranza p on p.cotizacion_id = c.id
 group by c.id, cl.id;

-- Igual que en la 008, con una sola diferencia: el respaldo que se usa cuando
-- la OT no trae monto_cotizado ahora descuenta, o la utilidad saldría inflada.
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
       case when o.monto_cotizado > 0 then o.monto_cotizado
            else round(c.subtotal * (1 - c.descuento_pct / 100), 2) end        as cotizado,
       coalesce(mo_cot.mano_obra, 0)                                      as mano_obra_cotizada,
       coalesce(mo.mano_obra, 0)                                          as mano_obra,
       coalesce(mo.contratos, 0)                                          as contratos,
       coalesce(mat_cot.material, 0)                                      as material_cotizado,
       coalesce(mat_real.material, 0) + coalesce(gas.material_suelto, 0)  as material_real,
       coalesce(c.viaticos, 0)                                            as viaticos_cotizados,
       coalesce(gas.viaticos, 0)                                          as viaticos,
       coalesce(gas.adicionales, 0)                                       as gastos_adicionales,
       (case when o.monto_cotizado > 0 then o.monto_cotizado
             else round(c.subtotal * (1 - c.descuento_pct / 100), 2) end)
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
