-- ===========================================================================
-- CORREGIR Y CANCELAR UN RECIBO DE ABONO
--
-- Un abono de nómina se capturaba y ya: no había manera de corregirle el monto
-- ni de echarlo atrás. Y es el único documento del sistema que se entrega en
-- mano y se firma, así que equivocarse ahí cuesta más que en ningún otro lado.
--
-- Aquí no basta el update directo que sí bastó para el pago de cobranza
-- (20260806000026). El recibo de nómina guarda copia de sus totales
-- —subtotal, deducciones, total—, reparte el importe entre varios contratos y
-- marca préstamos como saldados. Tocar un renglón sin rehacer lo demás deja el
-- papel diciendo una cosa y la base otra.
--
-- Dos operaciones, y la diferencia entre ellas importa:
--
--   · Corregir. El recibo sigue siendo el mismo, con su folio y su firma; lo
--     que cambia es cuánto. Los renglones se rehacen completos —el formulario
--     manda el documento entero, como en la cotización— y los totales se
--     recalculan desde ellos.
--
--   · Cancelar. El recibo deja de valer. Sus renglones se borran, así que el
--     saldo de los contratos vuelve solo y ningún reporte lo cuenta; los
--     préstamos que había descontado regresan a pendientes. Pero el recibo NO
--     se borra: el folio se entregó en papel y firmado, y un folio que
--     desaparece de la lista es peor que uno que dice por qué se canceló.
-- ===========================================================================

alter table public.recibos_nomina
  add column if not exists cancelado_en        timestamptz,
  add column if not exists cancelado_por       uuid references public.profiles(id)
                                               on delete set null,
  add column if not exists motivo_cancelacion  text,
  add column if not exists updated_at          timestamptz not null default now(),
  add column if not exists editado_por         uuid references public.profiles(id)
                                               on delete set null;

update public.recibos_nomina set updated_at = created_at where updated_at <> created_at;

drop trigger if exists set_updated_at on public.recibos_nomina;
create trigger set_updated_at before update on public.recibos_nomina
  for each row execute function public.tg_set_updated_at();

alter table public.nomina_pagos
  add column if not exists editado_por uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Corregir
-- ---------------------------------------------------------------------------

/**
 * Rehace los renglones de un recibo y recalcula sus totales.
 *
 * p_pagos: [{contrato_id, monto, porcentaje}] — el documento completo, no un
 * parche. Las deducciones no se tocan: siguen aplicadas al recibo y se vuelven
 * a restar del subtotal nuevo. Si el subtotal corregido ya no las cubre, la
 * corrección se rechaza; para eso está cancelar.
 */
create or replace function public.editar_recibo_nomina(
  p_recibo uuid,
  p_fecha date,
  p_metodo metodo_pago,
  p_pagos jsonb,
  p_notas text default null
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_bloque      jsonb;
  v_subtotal    numeric := 0;
  v_deducciones numeric := 0;
  v_monto       numeric;
begin
  perform public.exigir_staff();

  if not exists (select 1 from public.recibos_nomina where id = p_recibo) then
    raise exception 'Ese recibo ya no existe';
  end if;

  if exists (select 1 from public.recibos_nomina
              where id = p_recibo and cancelado_en is not null) then
    raise exception 'Ese recibo está cancelado: no se puede corregir';
  end if;

  if jsonb_array_length(coalesce(p_pagos, '[]'::jsonb)) = 0 then
    raise exception 'Hay que abonar a por lo menos una obra';
  end if;

  for v_bloque in select * from jsonb_array_elements(p_pagos) loop
    v_subtotal := v_subtotal + coalesce((v_bloque->>'monto')::numeric, 0);
  end loop;

  if v_subtotal <= 0 then raise exception 'El importe del recibo tiene que ser mayor a cero'; end if;

  select coalesce(sum(monto), 0) into v_deducciones
    from public.deducciones where recibo_id = p_recibo;

  if v_deducciones > v_subtotal then
    raise exception 'Las deducciones (%) superan el importe corregido (%). Cancela el recibo y captúralo de nuevo.',
      to_char(v_deducciones, 'FM$999,999,990.00'), to_char(v_subtotal, 'FM$999,999,990.00');
  end if;

  -- Se borran y se reinsertan: el formulario manda el documento completo, y
  -- así un contrato que se quitó del recibo deja de tener su abono.
  delete from public.nomina_pagos where recibo_id = p_recibo;

  for v_bloque in select * from jsonb_array_elements(p_pagos) loop
    v_monto := coalesce((v_bloque->>'monto')::numeric, 0);
    if v_monto <= 0 then continue; end if;

    insert into public.nomina_pagos
      (contrato_id, fecha, monto, porcentaje_del_pago, metodo, recibo_id,
       registrado_por, editado_por)
    values (
      (v_bloque->>'contrato_id')::uuid,
      p_fecha,
      v_monto,
      nullif(v_bloque->>'porcentaje', '')::numeric,
      p_metodo,
      p_recibo,
      auth.uid(),
      auth.uid()
    );
  end loop;

  update public.recibos_nomina
     set fecha       = p_fecha,
         metodo      = p_metodo,
         subtotal    = round(v_subtotal, 2),
         deducciones = round(v_deducciones, 2),
         total       = round(v_subtotal - v_deducciones, 2),
         notas       = p_notas,
         editado_por = auth.uid()
   where id = p_recibo;
end $$;

-- ---------------------------------------------------------------------------
-- Cancelar
-- ---------------------------------------------------------------------------

create or replace function public.cancelar_recibo_nomina(
  p_recibo uuid,
  p_motivo text default null
) returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.exigir_staff();

  if exists (select 1 from public.recibos_nomina
              where id = p_recibo and cancelado_en is not null) then
    raise exception 'Ese recibo ya estaba cancelado';
  end if;

  -- Los abonos se van: el saldo de cada contrato vuelve solo y ningún reporte
  -- que sume nomina_pagos lo sigue contando.
  delete from public.nomina_pagos where recibo_id = p_recibo;

  -- Y los préstamos que había descontado vuelven a estar pendientes.
  update public.deducciones
     set saldado = false, recibo_id = null
   where recibo_id = p_recibo;

  update public.recibos_nomina
     set cancelado_en       = now(),
         cancelado_por      = auth.uid(),
         motivo_cancelacion = nullif(btrim(coalesce(p_motivo, '')), ''),
         subtotal           = 0,
         deducciones        = 0,
         total              = 0
   where id = p_recibo;
end $$;

grant execute on function
  public.editar_recibo_nomina(uuid, date, metodo_pago, jsonb, text),
  public.cancelar_recibo_nomina(uuid, text)
  to authenticated;
