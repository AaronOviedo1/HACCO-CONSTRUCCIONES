-- ===========================================================================
-- Correcciones a la raya semanal (revisión del PR)
--
-- La 046 ya corrió en producción, así que lo que había que enderezar va aquí y
-- no editándola. Ninguna firma cambia: el código desplegado sigue llamando lo
-- mismo con los mismos argumentos.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Una raya con abonos ya no cambia de monto
--
-- `guardar_raya` dejaba mover los días o el ajuste de una semana ya pagada. El
-- recibo firmado se quedaba diciendo $4,200 y la raya pasaba a valer $3,500:
-- saldo negativo, y un recibo que ya no cuadra con nada. Para cambiar el monto
-- de una semana pagada hay que cancelar primero el recibo, igual que para
-- cancelar la raya.
--
-- El reparto entre obras sí se deja corregir con abonos: no mueve lo que se le
-- debe al trabajador, sólo a qué obra se le carga, y eso se descubre muchas
-- veces después de pagar («esa semana anduvo en Pomona, no en La Jolla»).
--
-- Y la misma obra dos veces en el reparto se suma en un solo renglón. Antes el
-- tope de 100% contaba las dos, pero el `on conflict` del insert no puede tocar
-- la misma fila dos veces en una sola sentencia y la guardada tronaba con un
-- error que no se entendía.
-- ---------------------------------------------------------------------------
create or replace function public.guardar_raya(
  p_raya            uuid,
  p_dias_trabajados numeric,
  p_ajuste          numeric default 0,
  p_notas           text default null,
  p_obras           jsonb default '[]'::jsonb
) returns void
language plpgsql set search_path = public as $$
declare
  v_raya  public.rayas_semanales%rowtype;
  v_total numeric := 0;
begin
  perform public.exigir_staff();

  select * into v_raya from public.rayas_semanales where id = p_raya;
  if not found then
    raise exception 'Esa raya ya no existe';
  end if;

  if v_raya.estatus = 'cancelada' then
    raise exception 'Esa raya está cancelada: no se puede corregir';
  end if;

  if p_dias_trabajados is null or p_dias_trabajados < 0 then
    raise exception 'Los días trabajados no pueden ser negativos';
  end if;

  if (p_dias_trabajados <> v_raya.dias_trabajados
      or coalesce(p_ajuste, 0) <> v_raya.ajuste)
     and exists (select 1 from public.nomina_pagos where raya_id = p_raya) then
    raise exception 'Esta semana ya tiene abonos. Para cambiar los días o el ajuste, cancela primero el recibo donde se pagó';
  end if;

  if exists (select 1 from jsonb_array_elements(coalesce(p_obras, '[]'::jsonb)) v
              where coalesce((v->>'pct')::numeric, 0) > 0
                and nullif(v->>'obra_id', '') is null) then
    raise exception 'Falta elegir la obra en uno de los renglones del reparto';
  end if;

  select coalesce(sum((v->>'pct')::numeric), 0) into v_total
    from jsonb_array_elements(coalesce(p_obras, '[]'::jsonb)) v
   where coalesce((v->>'pct')::numeric, 0) > 0;

  if v_total > 100 then
    raise exception 'El reparto entre obras suma % por ciento, y no puede pasar de 100', v_total;
  end if;

  update public.rayas_semanales
     set dias_trabajados = p_dias_trabajados,
         ajuste          = coalesce(p_ajuste, 0),
         notas           = p_notas
   where id = p_raya;

  delete from public.raya_obras where raya_id = p_raya;

  insert into public.raya_obras (raya_id, obra_id, pct)
  select p_raya, (v->>'obra_id')::uuid, sum((v->>'pct')::numeric)
    from jsonb_array_elements(coalesce(p_obras, '[]'::jsonb)) v
   where coalesce((v->>'pct')::numeric, 0) > 0
   group by (v->>'obra_id')::uuid;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Cada renglón del recibo tiene que ser del trabajador del recibo
--
-- `pagar_nomina` confiaba en que el diálogo sólo ofrece lo de esa persona. Un
-- diálogo abierto desde antes —la raya se canceló en otra pestaña, o se le
-- pagó desde otro teléfono— podía abonarle a una semana cancelada, a la raya
-- de otro trabajador, o pagar dos veces la misma semana. El contrato tampoco se
-- revisaba nunca, desde la 007; se aprovecha para cerrarlo también.
--
-- A la raya se le pone tope: no se le abona más de lo que falta. Al contrato
-- no, porque adelantarle a un oficial antes de que reporte avance es costumbre
-- de la empresa y así ha funcionado siempre.
--
-- `p_excluir_recibo` es para la corrección de un recibo: lo que ese mismo
-- recibo ya le había abonado a la semana no cuenta contra el tope, porque se
-- va a reescribir.
-- ---------------------------------------------------------------------------
create or replace function public.validar_bloque_nomina(
  p_trabajador     uuid,
  p_bloque         jsonb,
  p_excluir_recibo uuid default null
) returns void
language plpgsql set search_path = public as $$
declare
  v_contrato uuid := nullif(p_bloque->>'contrato_id', '')::uuid;
  v_raya     uuid := nullif(p_bloque->>'raya_id', '')::uuid;
  v_monto    numeric := coalesce((p_bloque->>'monto')::numeric, 0);
  v_fila     public.rayas_semanales%rowtype;
  v_abonado  numeric;
begin
  if num_nonnulls(v_contrato, v_raya) <> 1 then
    raise exception 'Cada renglón del recibo va a una obra o a una semana, no a las dos ni a ninguna';
  end if;

  if v_contrato is not null then
    if not exists (select 1 from public.contratos_oficial
                    where id = v_contrato and trabajador_id = p_trabajador) then
      raise exception 'Uno de los contratos del recibo no es de este trabajador';
    end if;
    return;
  end if;

  select * into v_fila from public.rayas_semanales where id = v_raya;
  if not found or v_fila.trabajador_id <> p_trabajador then
    raise exception 'Una de las semanas del recibo no es de este trabajador';
  end if;
  if v_fila.estatus = 'cancelada' then
    raise exception 'Una de las semanas del recibo se canceló mientras se capturaba. Cierra el diálogo y vuelve a abrirlo';
  end if;

  select coalesce(sum(monto), 0) into v_abonado
    from public.nomina_pagos
   where raya_id = v_raya
     and (p_excluir_recibo is null or recibo_id is distinct from p_excluir_recibo);

  if v_monto > v_fila.total_pagar - v_abonado + 0.005 then
    raise exception 'A la semana del % sólo le faltan %; no se le puede abonar %',
      to_char(v_fila.semana, 'DD/MM'),
      to_char(greatest(0, v_fila.total_pagar - v_abonado), 'FM$999,999,990.00'),
      to_char(v_monto, 'FM$999,999,990.00');
  end if;
end $$;

create or replace function public.pagar_nomina(
  p_trabajador uuid, p_fecha date, p_metodo metodo_pago, p_pagos jsonb,
  p_deducciones uuid[] default '{}'::uuid[], p_notas text default null
) returns uuid
language plpgsql set search_path = public as $$
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
    v_monto := coalesce((v_bloque->>'monto')::numeric, 0);
    if v_monto <= 0 then continue; end if;
    perform public.validar_bloque_nomina(p_trabajador, v_bloque);
    v_subtotal := v_subtotal + v_monto;
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
      (contrato_id, raya_id, fecha, monto, porcentaje_del_pago, metodo, recibo_id, registrado_por)
    values (
      nullif(v_bloque->>'contrato_id', '')::uuid,
      nullif(v_bloque->>'raya_id', '')::uuid,
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

  -- El estatus de la semana ya no se toca aquí: lo lleva el disparador de
  -- `nomina_pagos` (punto 3), que también se entera de correcciones y cancelaciones.
  return v_recibo;
end $$;

create or replace function public.editar_recibo_nomina(
  p_recibo uuid, p_fecha date, p_metodo metodo_pago, p_pagos jsonb, p_notas text default null
) returns void
language plpgsql set search_path = public as $$
declare
  v_trabajador  uuid;
  v_bloque      jsonb;
  v_subtotal    numeric := 0;
  v_deducciones numeric := 0;
  v_monto       numeric;
begin
  perform public.exigir_staff();

  select trabajador_id into v_trabajador from public.recibos_nomina where id = p_recibo;
  if not found then
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
    v_monto := coalesce((v_bloque->>'monto')::numeric, 0);
    if v_monto <= 0 then continue; end if;
    perform public.validar_bloque_nomina(v_trabajador, v_bloque, p_recibo);
    v_subtotal := v_subtotal + v_monto;
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
      (contrato_id, raya_id, fecha, monto, porcentaje_del_pago, metodo, recibo_id,
       registrado_por, editado_por)
    values (
      nullif(v_bloque->>'contrato_id', '')::uuid,
      nullif(v_bloque->>'raya_id', '')::uuid,
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
-- 3. «Cerrada» sigue al dinero, venga de donde venga el cambio
--
-- La 046 cerraba la semana dentro de `pagar_nomina`, y ahí nada más. Si
-- después se cancelaba el recibo (`cancelar_recibo_nomina` borra los abonos) o
-- se corregía a la baja, la semana se quedaba diciendo «cerrada» con saldo por
-- pagar. Un disparador sobre `nomina_pagos` se entera de los tres caminos —y
-- de cualquiera que venga después— sin tener que acordarse en cada función.
-- ---------------------------------------------------------------------------
create or replace function public.tg_nomina_pagos_estatus_raya()
returns trigger
language plpgsql set search_path = public as $$
declare
  v_rayas uuid[];
begin
  if tg_op in ('INSERT', 'UPDATE') and new.raya_id is not null then
    v_rayas := array_append(v_rayas, new.raya_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.raya_id is not null then
    v_rayas := array_append(v_rayas, old.raya_id);
  end if;
  if v_rayas is null then return null; end if;

  update public.rayas_semanales r
     set estatus = case
           when r.total_pagar <= (select coalesce(sum(n.monto), 0)
                                    from public.nomina_pagos n where n.raya_id = r.id) + 0.005
           then 'cerrada'::estatus_raya
           else 'abierta'::estatus_raya
         end
   where r.id = any(v_rayas)
     and r.estatus <> 'cancelada';

  return null;
end $$;

drop trigger if exists nomina_pagos_estatus_raya on public.nomina_pagos;
create trigger nomina_pagos_estatus_raya
  after insert or update or delete on public.nomina_pagos
  for each row execute function public.tg_nomina_pagos_estatus_raya();

-- Las que ya existan quedan como dice su saldo.
update public.rayas_semanales r
   set estatus = case
         when r.total_pagar <= (select coalesce(sum(n.monto), 0)
                                  from public.nomina_pagos n where n.raya_id = r.id) + 0.005
         then 'cerrada'::estatus_raya
         else 'abierta'::estatus_raya
       end
 where r.estatus <> 'cancelada';

-- ---------------------------------------------------------------------------
-- 4. `contratos_activos` vuelve a contar contratos
--
-- La 046 le sumaba las semanas por pagar, y las pantallas lo pintan como
-- «obras»: a quien tiene ocho contratos y una semana le salían nueve obras, y a
-- quien está a puro sueldo le salía una obra que no tiene. Las semanas ya van
-- aparte en `semanas_por_pagar`. Mismas columnas, mismo orden, mismos tipos:
-- `create or replace` basta y nada de lo que lee la vista se entera.
-- ---------------------------------------------------------------------------
create or replace view public.v_prenomina with (security_invoker = on) as
with destajo as (
  select v.trabajador_id,
         count(*)                  as contratos_activos,
         sum(v.mano_obra)          as total_mano_obra,
         sum(v.retencion_haaco)    as retencion,
         sum(v.total)              as total_contratos,
         sum(v.devengado)          as devengado,
         sum(v.pagado)             as pagado,
         sum(v.por_pagar)          as pendiente,
         sum(v.disponible)         as disponible,
         max(v.ultimo_pago)        as ultimo_pago
    from public.v_nomina_contratos v
   where v.estatus = 'activo'
   group by v.trabajador_id
), sueldo as (
  select r.trabajador_id,
         count(*) filter (where r.por_pagar > 0) as semanas_por_pagar,
         sum(r.mano_obra)          as total_mano_obra,
         sum(r.retencion_haaco)    as retencion,
         sum(r.total)              as total_contratos,
         sum(r.devengado)          as devengado,
         sum(r.pagado)             as pagado,
         sum(r.por_pagar)          as pendiente,
         sum(r.disponible)         as disponible,
         max(r.ultimo_pago)        as ultimo_pago
    from public.v_rayas_semanales r
   where r.estatus <> 'cancelada'
   group by r.trabajador_id
)
select p.id                                                        as trabajador_id,
       p.nombre                                                    as trabajador,
       p.es_externo,
       p.oficio,
       coalesce(d.contratos_activos, 0)                            as contratos_activos,
       coalesce(d.total_mano_obra, 0) + coalesce(s.total_mano_obra, 0)     as total_mano_obra,
       coalesce(d.retencion, 0)       + coalesce(s.retencion, 0)           as retencion,
       coalesce(d.total_contratos, 0) + coalesce(s.total_contratos, 0)     as total_contratos,
       coalesce(d.devengado, 0)       + coalesce(s.devengado, 0)           as devengado,
       coalesce(d.pagado, 0)          + coalesce(s.pagado, 0)              as pagado,
       coalesce(d.pendiente, 0)       + coalesce(s.pendiente, 0)           as pendiente,
       coalesce(d.disponible, 0)      + coalesce(s.disponible, 0)          as disponible,
       case when coalesce(d.total_contratos, 0) + coalesce(s.total_contratos, 0) > 0
            then round((coalesce(d.pagado, 0) + coalesce(s.pagado, 0))
                     / (coalesce(d.total_contratos, 0) + coalesce(s.total_contratos, 0)) * 100, 2)
            else 0 end                                              as pct_pagado,
       coalesce((select sum(x.monto) from public.deducciones x
                  where x.trabajador_id = p.id and not x.saldado), 0) as deducciones,
       greatest(d.ultimo_pago, s.ultimo_pago)                       as ultimo_pago,
       coalesce(d.disponible, 0)                                    as disponible_destajo,
       coalesce(s.disponible, 0)                                    as disponible_sueldo,
       coalesce(s.semanas_por_pagar, 0)                             as semanas_por_pagar
  from public.profiles p
  left join destajo d on d.trabajador_id = p.id
  left join sueldo  s on s.trabajador_id = p.id
 where d.trabajador_id is not null or s.trabajador_id is not null;

-- ---------------------------------------------------------------------------
-- 5. La vigencia del sueldo en día de Hermosillo
--
-- `current_date` es el día en UTC: un sueldo dado de alta el domingo a las seis
-- de la tarde quedaba vigente desde el lunes y ya no entraba en la raya de la
-- semana que se acababa de trabajar.
-- ---------------------------------------------------------------------------
alter table public.sueldos_semanales
  alter column vigencia_desde set default public.hoy_hermosillo();

create or replace function public.guardar_sueldo_semanal(
  p_trabajador uuid,
  p_monto      numeric,
  p_dias_base  smallint default 6,
  p_pct        numeric default 0,
  p_obra       uuid default null,
  p_notas      text default null
) returns uuid
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  perform public.exigir_staff();
  if p_monto is null or p_monto <= 0 then
    raise exception 'El sueldo semanal tiene que ser mayor a cero';
  end if;

  /* El índice único no deja dos tratos vivos para la misma persona, así que
     primero se cierra el que había. La raya ya generada no se mueve: guarda su
     propia copia del monto. */
  update public.sueldos_semanales
     set activo = false,
         vigencia_hasta = coalesce(vigencia_hasta, public.hoy_hermosillo())
   where trabajador_id = p_trabajador and activo;

  insert into public.sueldos_semanales
    (trabajador_id, monto_semanal, dias_base, costo_haaco_pct, obra_id, notas)
  values (p_trabajador, p_monto, coalesce(p_dias_base, 6), coalesce(p_pct, 0), p_obra, p_notas)
  returning id into v_id;

  return v_id;
end $$;

/* `validar_bloque_nomina` se queda con el permiso de ejecución de siempre: las
   funciones del recibo no son `security definer`, corren como quien las llama,
   y quitárselo tumbaría `pagar_nomina`. Llamada suelta no hace nada más que
   leer lo que las políticas ya le dejan ver y decir si el renglón cuadra. */

notify pgrst, 'reload schema';
