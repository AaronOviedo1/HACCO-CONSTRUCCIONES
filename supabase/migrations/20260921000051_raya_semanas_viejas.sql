-- ===========================================================================
-- LAS SEMANAS QUE QUEDARON PENDIENTES
--
--   «estoy tratando de registrar pagos pendientes de las semanas que ya se
--    pagaron, registro el pago semanal y en qué obras se repartirá esa semana,
--    pero al momento de querer aplicar el pago en armar raya, no me aparece
--    nada.»
--
--   «tambien si se puede ajustar el poder seleccionar fechas de pago, ya que
--    tengo pendiente el registro de las ultimas 2 semanas, que son del 31 de
--    agosto al 5 de septiembre, y la semana del 7 al 12»
--
-- Lo que pasó, tal como quedó en la base: el 17 de septiembre se armó la raya
-- de la semana del 14 con un sueldo de $8,000, se canceló para rehacerla con
-- los $8,500 buenos, y ahí se acabó el camino. La semana quedó invisible —la
-- pantalla esconde las canceladas— y el botón contestaba «Ya estaban armadas»,
-- que era lo único que sabía decir.
--
-- Dos cosas se arreglan aquí, las dos en el mismo lugar donde se rompieron:
--
--   1. Una raya cancelada y sin un solo abono ya no es un callejón sin salida.
--      `unique (trabajador_id, semana)` no mira el estatus, así que la fila
--      cancelada seguía ocupando el lugar y el `on conflict do nothing` se iba
--      de largo sin contarlo. Ahora se rearma, y se rearma con el trato de hoy:
--      revivirla tal cual le devolvería justo la raya que canceló.
--
--   2. `generar_raya` deja de contestar un número que significa tres cosas
--      distintas —ya existían, están canceladas, o no había ningún sueldo
--      vigente esa semana— y devuelve el desglose, para que la pantalla pueda
--      decir cuál de las tres fue.
--
-- Y para poder armar el 31 de agosto con un sueldo dado de alta el 17 de
-- septiembre, el trato gana su fecha de inicio: `guardar_sueldo_semanal`
-- recibe desde cuándo cobra fijo, en lugar de asumir que es de hoy.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- La retención del externo también manda en las correcciones.
--
-- El trigger nació sólo para el `insert`, cuando la única manera de que una
-- raya tuviera `costo_haaco_pct` era naciendo. Desde que se puede rearmar una
-- semana cancelada, el porcentaje se vuelve a copiar del trato en un `update`,
-- y a quien es externo no se le retiene ni ahí. Es la misma regla, escrita en
-- el mismo renglón: para el resto de los `update` —días, ajuste, notas— no
-- cambia nada, porque el valor que deja es el que ya tenían.
-- ---------------------------------------------------------------------------
drop trigger if exists raya_retencion_externo on public.rayas_semanales;
create trigger raya_retencion_externo before insert or update on public.rayas_semanales
  for each row execute function public.tg_raya_retencion_externo();

-- ---------------------------------------------------------------------------
-- `generar_raya` · ahora cuenta qué hizo, y rescata lo cancelado.
--
-- Cambia lo que devuelve, así que la anterior se tira: `create or replace` no
-- puede cambiar el tipo de regreso, y dos versiones no pueden convivir.
-- ---------------------------------------------------------------------------
drop function if exists public.generar_raya(date);

create function public.generar_raya(p_semana date)
returns jsonb
language plpgsql set search_path = public as $$
declare
  v_lunes     date;
  v_sueldo    record;
  v_existente record;
  v_raya      uuid;
  v_armadas   integer := 0;
  v_rearmadas integer := 0;
  v_ya        integer := 0;
  v_sin       integer := 0;
begin
  perform public.exigir_staff();
  if p_semana is null then
    return jsonb_build_object('armadas', 0, 'rearmadas', 0, 'ya_estaban', 0, 'sin_sueldo', 0);
  end if;
  v_lunes := date_trunc('week', p_semana)::date;

  perform pg_advisory_xact_lock(hashtext('generar_raya'), (v_lunes - date '2000-01-01'));

  /* Quién está a sueldo hoy pero no lo estaba esa semana. Es el número que le
     faltaba a la pantalla para poder decir «nadie estaba a sueldo entonces» en
     vez de «ya estaban armadas», que era mentira y dejaba sin salida. */
  select count(*) into v_sin
    from public.sueldos_semanales
   where activo
     and not (vigencia_desde <= v_lunes + 6
              and (vigencia_hasta is null or vigencia_hasta >= v_lunes));

  for v_sueldo in
    select * from public.sueldos_semanales
     where activo
       and vigencia_desde <= v_lunes + 6
       and (vigencia_hasta is null or vigencia_hasta >= v_lunes)
     order by created_at
  loop
    /* Se mira primero lo que ya hay, en lugar de chocar contra el índice: un
       `on conflict do nothing` no sabe decir con qué chocó, y aquí la
       diferencia entre «ya estaba» y «estaba cancelada» es justamente lo que
       hay que contestar. El candado de arriba es el que hace que mirar y
       escribir sean un solo paso. */
    select r.id, r.estatus,
           exists (select 1 from public.nomina_pagos n where n.raya_id = r.id) as tiene_abonos
      into v_existente
      from public.rayas_semanales r
     where r.trabajador_id = v_sueldo.trabajador_id
       and r.semana = v_lunes;

    if not found then
      insert into public.rayas_semanales
        (sueldo_id, trabajador_id, semana, monto_semanal, dias_base,
         dias_trabajados, costo_haaco_pct, registrado_por)
      values
        (v_sueldo.id, v_sueldo.trabajador_id, v_lunes, v_sueldo.monto_semanal,
         v_sueldo.dias_base, v_sueldo.dias_base, v_sueldo.costo_haaco_pct, auth.uid())
      returning id into v_raya;

      v_armadas := v_armadas + 1;
      perform public.repartir_raya(v_raya, v_sueldo.id);

    elsif v_existente.estatus = 'cancelada' and not v_existente.tiene_abonos then
      /* Vuelve, y vuelve como si naciera: con el sueldo, los días y la
         retención del trato que está vivo hoy, y sin el ajuste que llevara
         antes. Una semana se cancela porque salió mal, así que devolverla
         idéntica no serviría de nada.

         Una raya con abonos no se toca nunca —`cancelar_raya` ni siquiera deja
         cancelarla— porque ese dinero ya está en un recibo con folio. */
      update public.rayas_semanales
         set estatus          = 'abierta',
             sueldo_id        = v_sueldo.id,
             monto_semanal    = v_sueldo.monto_semanal,
             dias_base        = v_sueldo.dias_base,
             dias_trabajados  = v_sueldo.dias_base,
             ajuste           = 0,
             costo_haaco_pct  = v_sueldo.costo_haaco_pct,
             registrado_por   = auth.uid()
       where id = v_existente.id;

      v_rearmadas := v_rearmadas + 1;
      perform public.repartir_raya(v_existente.id, v_sueldo.id);

    else
      v_ya := v_ya + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'armadas',    v_armadas,
    'rearmadas',  v_rearmadas,
    'ya_estaban', v_ya,
    'sin_sueldo', v_sin
  );
end $$;

comment on function public.generar_raya(date) is
  'Saca la raya de esa semana de los tratos vigentes. Repetirla no duplica a
   nadie; una semana cancelada y sin abonos se rearma con el trato de hoy.
   Devuelve {armadas, rearmadas, ya_estaban, sin_sueldo}.';

grant execute on function public.generar_raya(date) to authenticated;

-- ===========================================================================
-- EL TRATO DICE DESDE CUÁNDO
-- ===========================================================================
-- `vigencia_desde` siempre había sido «hoy», porque un sueldo se daba de alta
-- el día que empezaba. Pero la app lleva cuatro días con la raya y la operación
-- lleva semanas, así que lo primero que hay que hacer es alcanzar el pasado:
-- tres semanas trabajadas que no se han registrado, con un trato que —para la
-- base— nació el 17 de septiembre.
--
-- Cambia la firma, así que la anterior se tira, igual que hizo la 049: PostgREST
-- no sabría a cuál de las dos le está hablando, porque el parámetro nuevo trae
-- valor por omisión y las dos aceptarían la misma llamada.
drop function if exists public.guardar_sueldo_semanal(uuid, numeric, smallint, numeric, jsonb, text);

create or replace function public.guardar_sueldo_semanal(
  p_trabajador uuid,
  p_monto      numeric,
  p_dias_base  smallint default 6,
  p_pct        numeric default 0,
  p_obras      jsonb default '[]'::jsonb,
  p_notas      text default null,
  p_desde      date default null
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_id    uuid;
  v_desde date := coalesce(p_desde, public.hoy_hermosillo());
  v_total numeric := 0;
  v_raya  record;
  v_n     integer := 0;
begin
  perform public.exigir_staff();
  if p_monto is null or p_monto <= 0 then
    raise exception 'El sueldo semanal tiene que ser mayor a cero';
  end if;

  -- Las mismas dos revisiones que `guardar_raya`, y con las mismas palabras:
  -- el reparto se captura igual en las dos pantallas.
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

  /* El índice único no deja dos tratos vivos para la misma persona, así que
     primero se cierra el que había. La raya ya generada no se mueve: guarda su
     propia copia del monto.

     El trato viejo termina el día antes de que empiece el nuevo, no hoy: si se
     está fechando hacia atrás —«en realidad está a sueldo desde el 31 de
     agosto»—, dejarlo terminar hoy los encimaría un mes entero y el historial
     diría que cobró dos sueldos a la vez. Nunca antes de su propio comienzo,
     que sería peor. */
  update public.sueldos_semanales
     set activo = false,
         vigencia_hasta = coalesce(
           vigencia_hasta,
           greatest(vigencia_desde, least(public.hoy_hermosillo(), v_desde - 1))
         )
   where trabajador_id = p_trabajador and activo;

  insert into public.sueldos_semanales
    (trabajador_id, monto_semanal, dias_base, costo_haaco_pct, vigencia_desde, notas)
  values (p_trabajador, p_monto, coalesce(p_dias_base, 6), coalesce(p_pct, 0), v_desde, p_notas)
  returning id into v_id;

  -- La misma obra dos veces se suma en un solo renglón, como en `guardar_raya`:
  -- el `on conflict` no puede tocar la misma fila dos veces en una sentencia.
  insert into public.sueldo_obras (sueldo_id, obra_id, pct)
  select v_id, (v->>'obra_id')::uuid, sum((v->>'pct')::numeric)
    from jsonb_array_elements(coalesce(p_obras, '[]'::jsonb)) v
   where coalesce((v->>'pct')::numeric, 0) > 0
   group by (v->>'obra_id')::uuid;

  /*
   * Y las semanas que siguen abiertas se enteran.
   *
   * Sin esto, quien acaba de decir entre qué obras va su gente vuelve a la
   * pantalla y ve la semana repartida como antes: parece que el cambio no
   * sirvió, y lo siguiente es corregirla a mano cada lunes, que es justamente
   * lo que este cambio venía a quitar.
   *
   * Sólo lo que todavía no es historia: de la semana en que empieza el trato en
   * adelante —o de la semana en curso, si el trato empieza más tarde—, abiertas
   * y sin un solo abono. Una semana pagada ya está en un recibo firmado y su
   * reparto se corrige —si hace falta— desde su propia pantalla.
   */
  for v_raya in
    select r.id from public.rayas_semanales r
     where r.trabajador_id = p_trabajador
       and r.estatus = 'abierta'
       and r.semana >= least(
             date_trunc('week', public.hoy_hermosillo())::date,
             date_trunc('week', v_desde)::date
           )
       and not exists (select 1 from public.nomina_pagos n where n.raya_id = r.id)
  loop
    perform public.repartir_raya(v_raya.id, v_id);
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('sueldo_id', v_id, 'rayas_ajustadas', v_n);
end $$;

comment on function public.guardar_sueldo_semanal(uuid, numeric, smallint, numeric, jsonb, text, date) is
  'Abre el trato de sueldo fijo y cierra el anterior. `p_desde` dice desde
   cuándo cobra fijo —hoy si no se dice—, y es lo que decide qué semanas se le
   pueden armar.';

grant execute on function public.guardar_sueldo_semanal(uuid, numeric, smallint, numeric, jsonb, text, date)
  to authenticated;

notify pgrst, 'reload schema';
