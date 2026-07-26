-- ============================================================================
-- HaacoPro · Migración 002 · Folios, triggers de negocio y vistas de reporte
-- ============================================================================

-- ---------------------------------------------------------------------------
-- FOLIOS CONSECUTIVOS
-- ---------------------------------------------------------------------------
create or replace function public.siguiente_consecutivo(p_serie text, p_anio integer default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  insert into public.consecutivos (serie, anio, ultimo)
  values (p_serie, p_anio, 1)
  on conflict (serie, anio) do update set ultimo = public.consecutivos.ultimo + 1
  returning ultimo into v_n;
  return v_n;
end $$;

-- Cotización: "F-###" (serie global, no se reinicia por año)
create or replace function public.tg_folio_cotizacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := 'F-' || public.siguiente_consecutivo('cotizacion', 0)::text;
  end if;
  -- anticipo por defecto según el tipo de trabajo
  if new.anticipo_pct is null then
    new.anticipo_pct := case when new.tipo = 'herreria' then 60 else 50 end;
  end if;
  return new;
end $$;
create trigger folio_cotizacion before insert on public.cotizaciones
  for each row execute function public.tg_folio_cotizacion();

-- OT: "AA######" · prefijo de año + 6 dígitos (2026 → 26000001)
create or replace function public.tg_ot_numero()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_anio integer := extract(year from coalesce(new.fecha_apertura, current_date))::int;
begin
  if new.ot_numero is null or new.ot_numero = '' then
    new.ot_numero := to_char(v_anio % 100, 'FM00')
                     || lpad(public.siguiente_consecutivo('ot', v_anio)::text, 6, '0');
  end if;
  return new;
end $$;
create trigger ot_numero before insert on public.obras
  for each row execute function public.tg_ot_numero();

-- Póliza: "H###-AA"
create or replace function public.tg_folio_poliza()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_anio integer := extract(year from coalesce(new.fecha_emision, current_date))::int;
begin
  if new.folio is null or new.folio = '' then
    new.folio := 'H' || public.siguiente_consecutivo('poliza', v_anio)::text
                 || '-' || to_char(v_anio % 100, 'FM00');
  end if;
  return new;
end $$;
create trigger folio_poliza before insert on public.polizas_garantia
  for each row execute function public.tg_folio_poliza();

-- ---------------------------------------------------------------------------
-- TRIGGERS DE NEGOCIO
-- ---------------------------------------------------------------------------

-- El importe de la partida y el subtotal de la cotización se recalculan solos
create or replace function public.tg_cotizacion_item_importe()
returns trigger language plpgsql as $$
begin
  new.importe := round(coalesce(new.m2, 1) * coalesce(new.precio_unitario, 0), 2);
  return new;
end $$;
create trigger cotizacion_item_importe before insert or update on public.cotizacion_items
  for each row execute function public.tg_cotizacion_item_importe();

create or replace function public.tg_recalcular_subtotal_cotizacion()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cot uuid := coalesce(new.cotizacion_id, old.cotizacion_id);
begin
  update public.cotizaciones c
     set subtotal = coalesce((select sum(i.importe) from public.cotizacion_items i
                               where i.cotizacion_id = v_cot), 0),
         updated_at = now()
   where c.id = v_cot;
  return null;
end $$;
create trigger recalcular_subtotal_cotizacion
  after insert or update or delete on public.cotizacion_items
  for each row execute function public.tg_recalcular_subtotal_cotizacion();

-- La retención "Costo Haaco 5%" no aplica a trabajadores externos
create or replace function public.tg_contrato_retencion_externo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     and exists (select 1 from public.profiles p
                  where p.id = new.trabajador_id and p.es_externo) then
    new.costo_haaco_pct := 0;
  end if;
  return new;
end $$;
create trigger contrato_retencion_externo before insert on public.contratos_oficial
  for each row execute function public.tg_contrato_retencion_externo();

-- El valor del pagaré = suma del valor de las herramientas prestadas
create or replace function public.tg_recalcular_pagare()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pag uuid := coalesce(new.pagare_id, old.pagare_id);
begin
  update public.pagares p
     set valor_total = coalesce((select sum(i.cantidad * i.valor_unitario)
                                   from public.pagare_items i where i.pagare_id = v_pag), 0),
         updated_at = now()
   where p.id = v_pag;
  return null;
end $$;
create trigger recalcular_pagare after insert or update or delete on public.pagare_items
  for each row execute function public.tg_recalcular_pagare();

-- Al agregar una herramienta a un pagaré pasa a "En obra" con el oficial;
-- al marcarla devuelta regresa a "Disponible / Taller".
create or replace function public.tg_herramienta_prestamo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_oficial text;
begin
  if tg_op = 'INSERT' then
    select p.nombre into v_oficial
      from public.pagares pg
      join public.contratos_oficial c on c.id = pg.contrato_id
      join public.profiles p on p.id = c.trabajador_id
     where pg.id = new.pagare_id;
    update public.herramientas
       set estado = 'en_obra', ubicacion = coalesce(v_oficial, ubicacion), updated_at = now()
     where id = new.herramienta_id and estado <> 'fuera_servicio';
  elsif tg_op = 'UPDATE' and new.devuelta and not old.devuelta then
    update public.herramientas
       set estado = 'disponible', ubicacion = 'Taller', updated_at = now()
     where id = new.herramienta_id and estado <> 'fuera_servicio';
  end if;
  return new;
end $$;
create trigger herramienta_prestamo after insert or update on public.pagare_items
  for each row execute function public.tg_herramienta_prestamo();

-- La OT marca su última actualización y su % de avance con cada avance capturado
create or replace function public.tg_obra_toca_avance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.obras
     set fecha_ultima_actualizacion = now(),
         avance_pct = coalesce(new.porcentaje_avance, avance_pct),
         updated_at = now()
   where id = new.obra_id;
  return new;
end $$;
create trigger obra_toca_avance after insert on public.avances
  for each row execute function public.tg_obra_toca_avance();

-- Un gasto a crédito abre automáticamente su cuenta por pagar
create or replace function public.tg_gasto_genera_cxp()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dias integer;
begin
  if new.condicion = 'credito' and new.proveedor_id is not null
     and not exists (select 1 from public.cuentas_por_pagar x where x.gasto_id = new.id) then
    select dias_credito_default into v_dias from public.proveedores where id = new.proveedor_id;
    insert into public.cuentas_por_pagar
      (gasto_id, proveedor_id, folio_factura, monto, fecha_factura, dias_credito)
    values
      (new.id, new.proveedor_id, coalesce(new.folio_factura, 'S/F'), new.monto,
       new.fecha, coalesce(v_dias, 0));
  end if;
  -- todo gasto ligado a una OT alimenta su material consumido REAL
  if new.obra_id is not null then
    update public.obras set fecha_ultima_actualizacion = now() where id = new.obra_id;
  end if;
  return new;
end $$;
create trigger gasto_genera_cxp after insert on public.gastos
  for each row execute function public.tg_gasto_genera_cxp();

-- updated_at en todas las tablas que lo tienen
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','clientes','proveedores','productos','herramientas','textos_proceso',
    'cotizaciones','obras','gastos','contratos_oficial','pagares','solicitudes_material',
    'cuentas_por_pagar','pagos_fijos','polizas_garantia'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- Alta automática del perfil cuando el admin crea el usuario en Auth
create or replace function public.tg_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.profiles (id, nombre, correo, telefono, rol, oficio, es_externo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'telefono',
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'cuadrilla'),
    (new.raw_user_meta_data->>'oficio')::oficio_trabajador,
    coalesce((new.raw_user_meta_data->>'es_externo')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger nuevo_usuario after insert on auth.users
  for each row execute function public.tg_nuevo_usuario();

-- ===========================================================================
-- VISTAS DE REPORTE
-- Todas con security_invoker: respetan las políticas RLS del que consulta.
-- ===========================================================================

-- Existencia actual de insumos de taller
create view public.v_insumos_existencia with (security_invoker = on) as
select p.id            as producto_id,
       p.nombre,
       p.codigo,
       p.unidad,
       p.costo,
       p.iva,
       p.precio_neto,
       coalesce(sum(case when k.tipo = 'entrada' then k.cantidad else -k.cantidad end), 0) as existencia,
       max(k.fecha) as ultimo_movimiento
  from public.productos p
  left join public.insumos_kardex k on k.producto_id = p.id
 where p.tipo = 'insumo_taller'
 group by p.id;

-- Cuentas por pagar con vencimiento, días restantes y estado calculados
create view public.v_cuentas_por_pagar with (security_invoker = on) as
select c.*,
       pr.nombre as proveedor,
       (c.vencimiento - current_date) as dias_restantes,
       case
         when c.cancelada                                   then 'cancelada'
         when c.saldo <= 0                                  then 'pagada'
         when c.vencimiento <  current_date                 then 'vencida'
         when c.vencimiento <= current_date + 3             then 'urgente'
         when c.vencimiento <= current_date + 15            then 'proxima'
         else 'al_corriente'
       end as estado
  from public.cuentas_por_pagar c
  join public.proveedores pr on pr.id = c.proveedor_id;

-- Dashboard por proveedor
create view public.v_cxp_por_proveedor with (security_invoker = on) as
select pr.id as proveedor_id,
       pr.nombre as proveedor,
       pr.dias_credito_default,
       coalesce(sum(v.saldo), 0)                                                   as saldo_total,
       coalesce(sum(v.saldo) filter (where v.estado = 'vencida'), 0)               as vencido,
       coalesce(sum(v.saldo) filter (where v.estado in ('urgente','proxima')), 0)  as por_vencer
  from public.proveedores pr
  left join public.v_cuentas_por_pagar v
         on v.proveedor_id = pr.id and v.estado not in ('pagada','cancelada')
 group by pr.id;

-- COBRANZA por cotización
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

-- CONCENTRADO financiero de la OT: COTIZADO vs REAL
create view public.v_obra_concentrado with (security_invoker = on) as
with mo as (
  select obra_id, sum(total_pagar) as mano_obra
    from public.contratos_oficial group by obra_id
), mat_cot as (
  select obra_id, sum(total) as material
    from public.obra_materiales where origen = 'cotizado' group by obra_id
), mat_real as (
  select obra_id, sum(total) as material
    from public.obra_materiales where origen = 'real' group by obra_id
), gas as (
  select obra_id,
         sum(monto) filter (where categoria = 'viaticos')                 as viaticos,
         sum(monto) filter (where categoria not in ('viaticos','material')) as adicionales,
         sum(monto) filter (where categoria = 'material')                  as material_gasto
    from public.gastos where obra_id is not null group by obra_id
)
select o.id                as obra_id,
       o.ot_numero,
       o.nombre,
       o.estatus,
       o.cotizacion_id,
       c.folio             as cotizacion_folio,
       o.fecha_apertura,
       o.fecha_ultima_actualizacion,
       o.fecha_cierre,
       o.avance_pct,
       case when o.monto_cotizado > 0 then o.monto_cotizado else c.subtotal end as cotizado,
       coalesce(mo.mano_obra, 0)                                     as mano_obra,
       coalesce(mat_cot.material, 0)                                 as material_cotizado,
       coalesce(mat_real.material, 0) + coalesce(gas.material_gasto, 0) as material_real,
       coalesce(gas.viaticos, 0)                                     as viaticos,
       coalesce(gas.adicionales, 0)                                  as gastos_adicionales,
       (case when o.monto_cotizado > 0 then o.monto_cotizado else c.subtotal end)
         - coalesce(mo.mano_obra, 0)
         - (coalesce(mat_real.material, 0) + coalesce(gas.material_gasto, 0))
         - coalesce(gas.viaticos, 0)
         - coalesce(gas.adicionales, 0)                              as utilidad
  from public.obras o
  join public.cotizaciones c on c.id = o.cotizacion_id
  left join mo       on mo.obra_id       = o.id
  left join mat_cot  on mat_cot.obra_id  = o.id
  left join mat_real on mat_real.obra_id = o.id
  left join gas      on gas.obra_id      = o.id;

-- NÓMINA: estado de cada contrato de mano de obra
create view public.v_nomina_contratos with (security_invoker = on) as
select ct.id            as contrato_id,
       ct.trabajador_id,
       p.nombre         as trabajador,
       p.es_externo,
       ct.obra_id,
       o.ot_numero,
       o.nombre         as obra,
       o.estatus        as estatus_obra,
       ct.fecha_inicia,
       ct.subtotal      as mano_obra,
       ct.retencion_haaco,
       ct.total_pagar   as total,
       coalesce(sum(n.monto), 0)                          as pagado,
       round(ct.total_pagar - coalesce(sum(n.monto), 0), 2) as por_pagar,
       case when ct.total_pagar > 0
            then round(coalesce(sum(n.monto), 0) / ct.total_pagar * 100, 2)
            else 0 end                                    as pct_pagado,
       ct.estatus
  from public.contratos_oficial ct
  join public.profiles p on p.id = ct.trabajador_id
  join public.obras   o  on o.id = ct.obra_id
  left join public.nomina_pagos n on n.contrato_id = ct.id
 group by ct.id, p.id, o.id;

-- PRENÓMINA concentrada por trabajador
create view public.v_prenomina with (security_invoker = on) as
select v.trabajador_id,
       v.trabajador,
       v.es_externo,
       count(*)                as contratos_activos,
       sum(v.mano_obra)        as total_mano_obra,
       sum(v.pagado)           as pagado,
       sum(v.por_pagar)        as pendiente,
       case when sum(v.total) > 0
            then round(sum(v.pagado) / sum(v.total) * 100, 2) else 0 end as pct_pagado,
       coalesce((select sum(d.monto) from public.deducciones d
                  where d.trabajador_id = v.trabajador_id and not d.saldado), 0) as deducciones
  from public.v_nomina_contratos v
 where v.estatus = 'activo'
 group by v.trabajador_id, v.trabajador, v.es_externo;
