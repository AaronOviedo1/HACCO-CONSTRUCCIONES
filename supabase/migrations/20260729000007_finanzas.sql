-- ============================================================================
-- HaacoPro · Migración 007 · Módulos financieros
--
-- Gastos que se ramifican solos (cuenta por pagar + material real), cuentas
-- por pagar con abonos parciales, nómina por avance con su recibo, pagos fijos
-- recurrentes y el devengado que hoy calculan a mano en el Excel.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- RECIBO DE ABONO A MANO DE OBRA
-- Un recibo cubre a un trabajador y puede abarcar varias obras a la vez.
-- ---------------------------------------------------------------------------
create table public.recibos_nomina (
  id            uuid primary key default gen_random_uuid(),
  folio         text unique,                      -- "N-###"
  trabajador_id uuid not null references public.profiles(id) on delete restrict,
  fecha         date not null default current_date,
  metodo        metodo_pago not null default 'efectivo',
  subtotal      numeric(14,2) not null default 0,
  deducciones   numeric(14,2) not null default 0,
  total         numeric(14,2) not null default 0,
  notas         text,
  registrado_por uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.recibos_nomina (trabajador_id, fecha);

alter table public.nomina_pagos
  add column recibo_id uuid references public.recibos_nomina(id) on delete set null;
alter table public.deducciones
  add column recibo_id uuid references public.recibos_nomina(id) on delete set null;

create or replace function public.tg_folio_recibo_nomina()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := 'N-' || public.siguiente_consecutivo('recibo_nomina', 0)::text;
  end if;
  return new;
end $$;
create trigger folio_recibo_nomina before insert on public.recibos_nomina
  for each row execute function public.tg_folio_recibo_nomina();

-- ---------------------------------------------------------------------------
-- PAGOS FIJOS · recurrencia
-- ---------------------------------------------------------------------------
alter table public.pagos_fijos add column recurrente boolean not null default false;

-- ===========================================================================
-- GASTOS
-- ===========================================================================

/*
 * Un gasto se ramifica: a crédito abre su cuenta por pagar (eso ya lo hace un
 * trigger) y si es material de una obra, entra también como material REAL para
 * que el concentrado cuadre. Las dos cosas en una transacción.
 */
create or replace function public.registrar_gasto(p_datos jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_gasto  uuid;
  v_obra   uuid := nullif(p_datos->>'obra_id', '')::uuid;
  v_piezas numeric := coalesce(nullif(p_datos->>'piezas', '')::numeric, 1);
  v_monto  numeric := coalesce(nullif(p_datos->>'monto', '')::numeric, 0);
begin
  perform public.exigir_staff();

  if v_monto <= 0 then
    raise exception 'El monto del gasto tiene que ser mayor a cero';
  end if;

  insert into public.gastos (
    obra_id, concepto_id, categoria, descripcion, piezas, costo_unitario, monto,
    folio_factura, proveedor_id, metodo, condicion, foto_ticket_path, fecha, registrado_por
  ) values (
    v_obra,
    nullif(p_datos->>'concepto_id', '')::uuid,
    coalesce((p_datos->>'categoria')::categoria_gasto, 'material'),
    p_datos->>'descripcion',
    v_piezas,
    nullif(p_datos->>'costo_unitario', '')::numeric,
    v_monto,
    nullif(p_datos->>'folio_factura', ''),
    nullif(p_datos->>'proveedor_id', '')::uuid,
    coalesce((p_datos->>'metodo')::metodo_pago, 'efectivo'),
    coalesce((p_datos->>'condicion')::condicion_compra, 'contado'),
    nullif(p_datos->>'foto_ticket_path', ''),
    coalesce(nullif(p_datos->>'fecha', '')::date, current_date),
    auth.uid()
  )
  returning id into v_gasto;

  -- Material de obra: se refleja en el bloque REAL con su folio de factura.
  if v_obra is not null
     and coalesce((p_datos->>'categoria')::categoria_gasto, 'material') = 'material'
     and coalesce((p_datos->>'crear_material')::boolean, true) then
    insert into public.obra_materiales
      (obra_id, concepto_id, origen, material, piezas, costo, folio_factura, es_taller, gasto_id)
    values (
      v_obra,
      nullif(p_datos->>'concepto_id', '')::uuid,
      'real',
      p_datos->>'descripcion',
      v_piezas,
      round(v_monto / nullif(v_piezas, 0), 2),
      nullif(p_datos->>'folio_factura', ''),
      false,
      v_gasto
    );

    perform public.anotar_bitacora(v_obra, 'material',
      format('Material comprado: %s por %s', p_datos->>'descripcion', to_char(v_monto, 'FM$999,999,990.00')));
  end if;

  return v_gasto;
end $$;

-- ===========================================================================
-- CUENTAS POR PAGAR · abonos parciales
-- ===========================================================================
create or replace function public.abonar_cxp(
  p_id uuid, p_monto numeric, p_fecha date default current_date
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_cxp     record;
  v_pagado  numeric;
  v_saldo   numeric;
begin
  perform public.exigir_staff();

  select * into v_cxp from public.cuentas_por_pagar where id = p_id;
  if not found then raise exception 'La cuenta por pagar no existe o no tienes acceso'; end if;
  if v_cxp.cancelada then raise exception 'Esa factura está cancelada'; end if;
  if p_monto <= 0 then raise exception 'El abono tiene que ser mayor a cero'; end if;

  v_pagado := round(v_cxp.monto_pagado + p_monto, 2);
  if v_pagado > v_cxp.monto then
    raise exception 'El abono excede el saldo: quedan % por pagar',
      to_char(v_cxp.monto - v_cxp.monto_pagado, 'FM$999,999,990.00');
  end if;

  v_saldo := round(v_cxp.monto - v_pagado, 2);

  update public.cuentas_por_pagar
     set monto_pagado = v_pagado,
         -- La fecha de pago sólo se fija cuando se liquida por completo.
         fecha_pago = case when v_saldo <= 0 then p_fecha else null end
   where id = p_id;

  return jsonb_build_object('pagado', v_pagado, 'saldo', v_saldo, 'liquidada', v_saldo <= 0);
end $$;

-- ===========================================================================
-- NÓMINA · pago con recibo
-- ===========================================================================

/*
 * Paga a un trabajador en una sola operación: abona a uno o varios contratos,
 * descuenta los préstamos que se elijan y emite el recibo con su folio.
 * p_pagos: [{contrato_id, monto, porcentaje}]
 */
create or replace function public.pagar_nomina(
  p_trabajador uuid,
  p_fecha date,
  p_metodo metodo_pago,
  p_pagos jsonb,
  p_deducciones uuid[] default '{}',
  p_notas text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_recibo      uuid;
  v_bloque      jsonb;
  v_subtotal    numeric := 0;
  v_deducciones numeric := 0;
  v_monto       numeric;
begin
  perform public.exigir_staff();

  if jsonb_array_length(coalesce(p_pagos, '[]'::jsonb)) = 0 then
    raise exception 'Hay que abonar a por lo menos una obra';
  end if;

  select coalesce(sum(monto), 0) into v_deducciones
    from public.deducciones
   where id = any(p_deducciones) and trabajador_id = p_trabajador and not saldado;

  for v_bloque in select * from jsonb_array_elements(p_pagos) loop
    v_subtotal := v_subtotal + coalesce((v_bloque->>'monto')::numeric, 0);
  end loop;

  if v_subtotal <= 0 then raise exception 'El importe del recibo tiene que ser mayor a cero'; end if;
  if v_deducciones > v_subtotal then
    raise exception 'Las deducciones (%) superan el importe del recibo (%)',
      to_char(v_deducciones, 'FM$999,999,990.00'), to_char(v_subtotal, 'FM$999,999,990.00');
  end if;

  insert into public.recibos_nomina
    (trabajador_id, fecha, metodo, subtotal, deducciones, total, notas, registrado_por)
  values (p_trabajador, p_fecha, p_metodo, round(v_subtotal, 2), round(v_deducciones, 2),
          round(v_subtotal - v_deducciones, 2), p_notas, auth.uid())
  returning id into v_recibo;

  for v_bloque in select * from jsonb_array_elements(p_pagos) loop
    v_monto := coalesce((v_bloque->>'monto')::numeric, 0);
    if v_monto <= 0 then continue; end if;

    insert into public.nomina_pagos
      (contrato_id, fecha, monto, porcentaje_del_pago, metodo, recibo_id, registrado_por)
    values (
      (v_bloque->>'contrato_id')::uuid,
      p_fecha,
      v_monto,
      nullif(v_bloque->>'porcentaje', '')::numeric,
      p_metodo,
      v_recibo,
      auth.uid()
    );
  end loop;

  update public.deducciones
     set saldado = true, recibo_id = v_recibo
   where id = any(p_deducciones) and trabajador_id = p_trabajador and not saldado;

  return v_recibo;
end $$;

-- ===========================================================================
-- PAGOS FIJOS · generar la quincena a partir de los recurrentes
-- ===========================================================================
create or replace function public.generar_quincena(p_quincena date)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_origen date;
  v_n      integer;
begin
  perform public.exigir_staff();

  -- Se copia de la última quincena anterior que tenga recurrentes.
  select max(quincena) into v_origen
    from public.pagos_fijos where recurrente and quincena < p_quincena;

  if v_origen is null then return 0; end if;

  insert into public.pagos_fijos
    (quincena, categoria, beneficiario, monto, metodo, estado, descripcion, notas, recurrente)
  select p_quincena, categoria, beneficiario, monto, metodo, 'programado', descripcion, notas, true
    from public.pagos_fijos origen
   where origen.quincena = v_origen
     and origen.recurrente
     -- Sin duplicar lo que ya se haya capturado a mano para esa quincena.
     and not exists (
       select 1 from public.pagos_fijos ya
        where ya.quincena = p_quincena
          and ya.beneficiario = origen.beneficiario
          and ya.categoria = origen.categoria
     );

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ===========================================================================
-- VISTAS
-- ===========================================================================

/*
 * NÓMINA por contrato. El devengado es la clave del modelo: se paga por avance
 * de obra, así que lo ganado hasta hoy es el total del contrato por el avance
 * que reporta la cuadrilla, y lo que se le puede pagar es eso menos lo abonado.
 */
drop view if exists public.v_prenomina;
drop view if exists public.v_nomina_contratos;

create view public.v_nomina_contratos with (security_invoker = on) as
select ct.id              as contrato_id,
       ct.trabajador_id,
       p.nombre           as trabajador,
       p.es_externo,
       p.oficio,
       ct.obra_id,
       o.ot_numero,
       o.nombre           as obra,
       o.estatus          as estatus_obra,
       o.avance_pct,
       ct.fecha_inicia,
       ct.subtotal        as mano_obra,
       ct.costo_haaco_pct,
       ct.retencion_haaco,
       ct.total_pagar     as total,
       round(ct.total_pagar * o.avance_pct / 100, 2)                       as devengado,
       coalesce(sum(n.monto), 0)                                           as pagado,
       round(ct.total_pagar - coalesce(sum(n.monto), 0), 2)                as por_pagar,
       greatest(0, round(ct.total_pagar * o.avance_pct / 100
                         - coalesce(sum(n.monto), 0), 2))                  as disponible,
       case when ct.total_pagar > 0
            then round(coalesce(sum(n.monto), 0) / ct.total_pagar * 100, 2)
            else 0 end                                                     as pct_pagado,
       max(n.fecha)                                                        as ultimo_pago,
       ct.estatus
  from public.contratos_oficial ct
  join public.profiles p on p.id = ct.trabajador_id
  join public.obras   o  on o.id = ct.obra_id
  left join public.nomina_pagos n on n.contrato_id = ct.id
 group by ct.id, p.id, o.id;

/* PRENÓMINA: un renglón por trabajador con todo lo que trae abierto. */
create view public.v_prenomina with (security_invoker = on) as
select v.trabajador_id,
       v.trabajador,
       v.es_externo,
       v.oficio,
       count(*)                                       as contratos_activos,
       sum(v.mano_obra)                               as total_mano_obra,
       sum(v.retencion_haaco)                         as retencion,
       sum(v.total)                                   as total_contratos,
       sum(v.devengado)                               as devengado,
       sum(v.pagado)                                  as pagado,
       sum(v.por_pagar)                               as pendiente,
       sum(v.disponible)                              as disponible,
       case when sum(v.total) > 0
            then round(sum(v.pagado) / sum(v.total) * 100, 2) else 0 end as pct_pagado,
       coalesce((select sum(d.monto) from public.deducciones d
                  where d.trabajador_id = v.trabajador_id and not d.saldado), 0) as deducciones,
       max(v.ultimo_pago)                             as ultimo_pago
  from public.v_nomina_contratos v
 where v.estatus = 'activo'
 group by v.trabajador_id, v.trabajador, v.es_externo, v.oficio;

/* GASTOS con el nombre del proveedor y de la obra ya resueltos. */
create view public.v_gastos with (security_invoker = on) as
select g.*,
       pr.nombre as proveedor,
       o.nombre  as obra,
       o.ot_numero,
       c.nombre  as concepto
  from public.gastos g
  left join public.proveedores    pr on pr.id = g.proveedor_id
  left join public.obras          o  on o.id  = g.obra_id
  left join public.obra_conceptos c  on c.id  = g.concepto_id;

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.recibos_nomina enable row level security;
create policy staff_todo on public.recibos_nomina for all to authenticated
  using (public.es_staff()) with check (public.es_staff());
create policy contador_lectura on public.recibos_nomina for select to authenticated
  using (public.es_contador());
-- El oficial puede consultar sus propios recibos de pago.
create policy cuadrilla_ve_sus_recibos on public.recibos_nomina for select to authenticated
  using (public.es_cuadrilla() and trabajador_id = auth.uid());

grant select, insert, update, delete on public.recibos_nomina to authenticated;

grant execute on function
  public.registrar_gasto(jsonb),
  public.abonar_cxp(uuid, numeric, date),
  public.pagar_nomina(uuid, date, metodo_pago, jsonb, uuid[], text),
  public.generar_quincena(date)
  to authenticated;

insert into public.consecutivos (serie, anio, ultimo) values ('recibo_nomina', 0, 0)
on conflict (serie, anio) do nothing;
