-- ===========================================================================
-- REABRIR UNA ORDEN DE TRABAJO CERRADA
--
-- Cerrar una OT era un camino de una sola dirección. Basta cerrarla creyendo
-- que el avance todavía se puede corregir —o que llegue trabajo adicional una
-- semana después de entregar— para que la obra quede congelada: no se captura
-- avance, no se agregan conceptos y los contratos, ya cerrados, desaparecen de
-- la nómina con lo que se le siga debiendo al oficial.
--
-- Reabrir deshace lo que cerrar_obra hizo, con dos excepciones deliberadas:
--
--  · Los pagarés NO reviven. Al cerrar se cancelaron y la herramienta volvió
--    al taller; puede que ya haya salido a otra obra. Si el trabajo adicional
--    necesita herramienta, se emite un pagaré nuevo.
--  · Sólo se reactivan los contratos que cerró ese mismo cierre. Un contrato
--    que se cerró antes, al reasignarle la obra a otro oficial, ya está
--    saldado y no tiene por qué volver a la nómina.
--
--    Para saber cuáles fueron, cerrar_obra apunta sus identificadores en la
--    bitácora. Distinguirlos por la fecha de cierre no alcanzaba: si se
--    reasigna y se cierra el mismo día, las fechas coinciden y revivirían
--    contratos ya saldados.
--
-- Es exclusiva de Dirección: reabrir mueve saldos de cliente y de nómina.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- cerrar_obra · igual que en la 006, pero deja constancia de qué contratos
-- cerró, para que la reapertura sepa exactamente cuáles revivir.
-- ---------------------------------------------------------------------------
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
  v_ids         uuid[];
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

  -- Cerrar los contratos de mano de obra, anotando cuáles fueron
  with cerrados as (
    update public.contratos_oficial
       set estatus = 'cerrado', fecha_cierre = p_fecha
     where obra_id = p_obra and estatus = 'activo'
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from cerrados;
  v_contratos := coalesce(array_length(v_ids, 1), 0);

  update public.obras
     set estatus = 'cerrada', fecha_cierre = p_fecha, fecha_ultima_actualizacion = now()
   where id = p_obra;

  perform public.anotar_bitacora(p_obra, 'cierre',
    format('OT cerrada: %s contratos, %s pagarés y %s herramientas devueltas',
           v_contratos, v_pagares, v_herramientas),
    jsonb_build_object('contratos', to_jsonb(v_ids), 'fecha', p_fecha, 'forzado', p_forzar));

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
create or replace function public.reabrir_obra(p_obra uuid, p_motivo text)
returns jsonb
language plpgsql set search_path = public as $$
declare
  v_obra      record;
  v_contratos integer := 0;
  v_cotizacion integer := 0;
  v_pagares   integer;
  v_ids       uuid[];
begin
  perform public.exigir_staff();

  if not public.es_admin() then
    raise exception 'Reabrir una OT es exclusivo de Dirección'
      using errcode = '42501';
  end if;

  if coalesce(btrim(p_motivo), '') = '' then
    raise exception 'Hay que anotar por qué se reabre la OT';
  end if;

  select * into v_obra from public.obras where id = p_obra;
  if not found then raise exception 'La obra no existe o no tienes acceso'; end if;

  if v_obra.estatus <> 'cerrada' then
    raise exception 'La OT % no está cerrada', v_obra.ot_numero;
  end if;

  -- Qué contratos cerró el último cierre, según su propia anotación.
  select array(select (jsonb_array_elements_text(b.datos->'contratos'))::uuid)
    into v_ids
    from public.bitacora_obra b
   where b.obra_id = p_obra
     and b.tipo = 'cierre'
     and b.datos ? 'contratos'
   order by b.created_at desc
   limit 1;

  -- Los contratos que cerró este cierre vuelven a la nómina. Las OTs cerradas
  -- antes de que el cierre dejara constancia caen al criterio de la fecha.
  if v_ids is not null and array_length(v_ids, 1) > 0 then
    update public.contratos_oficial
       set estatus = 'activo', fecha_cierre = null
     where obra_id = p_obra and estatus = 'cerrado' and id = any(v_ids);
  else
    update public.contratos_oficial
       set estatus = 'activo', fecha_cierre = null
     where obra_id = p_obra
       and estatus = 'cerrado'
       and fecha_cierre is not distinct from v_obra.fecha_cierre;
  end if;
  get diagnostics v_contratos = row_count;

  -- El trigger de bitácora anota solo el «cerrada → en_obra».
  update public.obras
     set estatus = 'en_obra',
         fecha_cierre = null,
         fecha_ultima_actualizacion = now()
   where id = p_obra;

  -- Si la cotización se dio por terminada al cerrar la última OT, vuelve a
  -- estar aprobada: otra vez tiene obra viva.
  update public.cotizaciones
     set estatus = 'aprobada'
   where id = v_obra.cotizacion_id and estatus = 'terminada';
  get diagnostics v_cotizacion = row_count;

  -- Informativo: la herramienta ya se devolvió y no se recupera sola.
  select count(*) into v_pagares
    from public.pagares p
    join public.contratos_oficial c on c.id = p.contrato_id
   where c.obra_id = p_obra and p.estatus = 'cancelado';

  perform public.anotar_bitacora(p_obra, 'reapertura',
    format('OT reabierta: %s. %s contratos de mano de obra vuelven a estar activos',
           btrim(p_motivo), v_contratos),
    jsonb_build_object(
      'motivo', btrim(p_motivo),
      'contratos_reactivados', v_contratos,
      'fecha_cierre_anterior', v_obra.fecha_cierre
    ));

  return jsonb_build_object(
    'reabierta', true,
    'contratos_reactivados', v_contratos,
    'cotizacion_reabierta', v_cotizacion > 0,
    'pagares_cancelados', v_pagares
  );
end $$;

comment on function public.reabrir_obra(uuid, text) is
  'Devuelve a «en obra» una OT cerrada, reactiva los contratos que cerró ese cierre y regresa la cotización a aprobada. Los pagarés cancelados no reviven. Sólo Dirección.';

grant execute on function public.reabrir_obra(uuid, text) to authenticated;
