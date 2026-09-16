-- ===========================================================================
-- EL SUELDO SE REPARTE ENTRE LAS OBRAS QUE UNO DIGA
--
--   «en este apartado para pago semanal, se puede ajustar para poder
--    seleccionar entre que obras se va a repartir el sueldo, actualmente solo
--    me permite seleccionar entre todas, o solo una»
--
-- Es exacto. `sueldos_semanales.obra_id` es una sola columna, así que el trato
-- nada más sabía decir dos cosas: «esta obra al 100%» o «ninguna en particular,
-- repártelo solo entre todas en las que tenga contrato». Lo de en medio —que es
-- lo normal: anda en dos de las cinco, y no mitad y mitad— no se podía escribir.
--
-- La raya YA sabía repartirse: `raya_obras` guarda porcentajes y la pantalla de
-- «Editar» de cada semana los deja corregir. Lo que faltaba era decirlo una vez
-- en el trato, en lugar de repetirlo cada lunes a mano.
--
-- Así que el trato pasa a tener la misma forma que la semana: `sueldo_obras`,
-- porcentajes, y la misma regla de que lo que no se reparte es gasto general.
-- Una sola obra deja de ser un caso aparte —es un renglón al 100%— y `obra_id`
-- se va, porque dos maneras de decir lo mismo acaban diciendo cosas distintas.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- EL REPARTO DEL TRATO · hermano de `raya_obras`, un piso más arriba
--
-- Sin filas no quiere decir «ninguna obra»: quiere decir «no lo digo yo,
-- averígualo cada semana», que es el reparto automático entre las obras donde
-- tenga contrato vivo. Esa distinción es la que conviene no perder.
-- ---------------------------------------------------------------------------
create table if not exists public.sueldo_obras (
  sueldo_id uuid not null references public.sueldos_semanales(id) on delete cascade,
  obra_id   uuid not null references public.obras(id) on delete cascade,
  pct       numeric(5,2) not null check (pct > 0 and pct <= 100),
  primary key (sueldo_id, obra_id)
);

create index if not exists sueldo_obras_obra on public.sueldo_obras (obra_id);

comment on table public.sueldo_obras is
  'A qué obras se le carga el sueldo de alguien, en porcentaje. Sin filas, la
   raya lo reparte sola entre las obras donde tenga contrato vivo. Lo que no
   llegue a 100 es gasto general de la empresa.';

-- RLS · el patrón de la 003, igual que sus hermanas de la 046.
alter table public.sueldo_obras enable row level security;

drop policy if exists staff_todo on public.sueldo_obras;
create policy staff_todo on public.sueldo_obras
  for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

drop policy if exists contador_lectura on public.sueldo_obras;
create policy contador_lectura on public.sueldo_obras
  for select to authenticated
  using (public.es_contador());

grant select, insert, update, delete on public.sueldo_obras to authenticated;

-- ---------------------------------------------------------------------------
-- Lo que ya había dicho alguien con la columna vieja: una obra al 100%.
-- Va antes de tirar la columna, que es lo único que la sabe.
-- ---------------------------------------------------------------------------
insert into public.sueldo_obras (sueldo_id, obra_id, pct)
select s.id, s.obra_id, 100
  from public.sueldos_semanales s
 where s.obra_id is not null
on conflict (sueldo_id, obra_id) do nothing;

alter table public.sueldos_semanales drop column if exists obra_id;

-- ===========================================================================
-- EL REPARTO DE UNA SEMANA, EN UN SOLO LUGAR
--
-- Estaba escrito dentro de `generar_raya`, y ahora hace falta también al
-- guardar el trato —quien acaba de decir entre qué obras va su gente espera que
-- la semana que está armada en pantalla se entere—. Copiarlo serían dos
-- repartos que se separan en cuanto alguien toque uno.
-- ===========================================================================
create or replace function public.repartir_raya(p_raya uuid, p_sueldo uuid)
returns void
language plpgsql set search_path = public as $$
declare
  v_trabajador uuid;
begin
  select trabajador_id into v_trabajador
    from public.sueldos_semanales where id = p_sueldo;
  if not found then return; end if;

  delete from public.raya_obras where raya_id = p_raya;

  /* Lo que diga el trato manda. */
  if exists (select 1 from public.sueldo_obras where sueldo_id = p_sueldo) then
    insert into public.raya_obras (raya_id, obra_id, pct)
    select p_raya, so.obra_id, so.pct
      from public.sueldo_obras so
     where so.sueldo_id = p_sueldo;
    return;
  end if;

  /* Y si no lo dice, sus contratos vivos en obras abiertas, en partes iguales.
     Por obras distintas, no por contratos: en una misma obra un oficial puede
     tener tres —interior, exterior, reparaciones— y repartir entre ellos dejaba
     la obra al 33% y el resto se iba a gasto general sin que nadie lo pidiera. */
  insert into public.raya_obras (raya_id, obra_id, pct)
  select p_raya, x.obra_id, round(100.0 / count(*) over (), 2)
    from (select distinct c.obra_id
            from public.contratos_oficial c
            join public.obras o on o.id = c.obra_id
           where c.trabajador_id = v_trabajador
             and c.estatus = 'activo'
             and o.estatus not in ('cerrada', 'terminada')) x
  on conflict do nothing;
end $$;

comment on function public.repartir_raya(uuid, uuid) is
  'Deja el reparto por obra de una raya como lo dice su trato: el explícito de
   sueldo_obras, o el automático entre sus contratos vivos.';

-- ---------------------------------------------------------------------------
-- `generar_raya` · lo mismo que hacía, pero pidiéndoselo a quien ahora lo sabe.
-- ---------------------------------------------------------------------------
create or replace function public.generar_raya(p_semana date)
returns integer
language plpgsql set search_path = public as $$
declare
  v_lunes  date;
  v_sueldo record;
  v_raya   uuid;
  v_n      integer := 0;
begin
  perform public.exigir_staff();
  if p_semana is null then return 0; end if;
  v_lunes := date_trunc('week', p_semana)::date;

  perform pg_advisory_xact_lock(hashtext('generar_raya'), (v_lunes - date '2000-01-01'));

  for v_sueldo in
    select * from public.sueldos_semanales
     where activo
       and vigencia_desde <= v_lunes + 6
       and (vigencia_hasta is null or vigencia_hasta >= v_lunes)
     order by created_at
  loop
    v_raya := null;

    insert into public.rayas_semanales
      (sueldo_id, trabajador_id, semana, monto_semanal, dias_base,
       dias_trabajados, costo_haaco_pct, registrado_por)
    values
      (v_sueldo.id, v_sueldo.trabajador_id, v_lunes, v_sueldo.monto_semanal,
       v_sueldo.dias_base, v_sueldo.dias_base, v_sueldo.costo_haaco_pct, auth.uid())
    on conflict (trabajador_id, semana) do nothing
    returning id into v_raya;

    if v_raya is null then continue; end if;
    v_n := v_n + 1;

    perform public.repartir_raya(v_raya, v_sueldo.id);
  end loop;

  return v_n;
end $$;

-- ===========================================================================
-- EL TRATO · ahora con el reparto adentro
-- ===========================================================================
-- Cambia la firma: donde iba `p_obra uuid` va `p_obras jsonb`, con la misma
-- forma que `guardar_raya` —[{obra_id, pct}]—, y devuelve qué pasó en vez del
-- id a secas. Las dos versiones no pueden convivir: PostgREST no sabría a cuál
-- de las dos le está hablando. Se tira la vieja a propósito y el código de la
-- app viaja en el mismo despliegue.
drop function if exists public.guardar_sueldo_semanal(uuid, numeric, smallint, numeric, uuid, text);

create or replace function public.guardar_sueldo_semanal(
  p_trabajador uuid,
  p_monto      numeric,
  p_dias_base  smallint default 6,
  p_pct        numeric default 0,
  p_obras      jsonb default '[]'::jsonb,
  p_notas      text default null
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_id    uuid;
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
     propia copia del monto. */
  update public.sueldos_semanales
     set activo = false,
         vigencia_hasta = coalesce(vigencia_hasta, public.hoy_hermosillo())
   where trabajador_id = p_trabajador and activo;

  insert into public.sueldos_semanales
    (trabajador_id, monto_semanal, dias_base, costo_haaco_pct, notas)
  values (p_trabajador, p_monto, coalesce(p_dias_base, 6), coalesce(p_pct, 0), p_notas)
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
   * Sólo lo que todavía no es historia: la semana en curso y las que vengan,
   * abiertas y sin un solo abono. Una semana pagada ya está en un recibo
   * firmado y su reparto se corrige —si hace falta— desde su propia pantalla.
   */
  for v_raya in
    select r.id from public.rayas_semanales r
     where r.trabajador_id = p_trabajador
       and r.estatus = 'abierta'
       and r.semana >= date_trunc('week', public.hoy_hermosillo())::date
       and not exists (select 1 from public.nomina_pagos n where n.raya_id = r.id)
  loop
    perform public.repartir_raya(v_raya.id, v_id);
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('sueldo_id', v_id, 'rayas_ajustadas', v_n);
end $$;

grant execute on function public.repartir_raya(uuid, uuid) to authenticated;
grant execute on function public.guardar_sueldo_semanal(uuid, numeric, smallint, numeric, jsonb, text)
  to authenticated;

-- ===========================================================================
-- LO QUE LEE LA PANTALLA
-- ===========================================================================
-- El reparto en JSON, además del texto de siempre.
--
-- La pantalla de «Editar» de una semana venía deshaciendo con una expresión
-- regular el texto «COLOSSUS (50.00%) · Pomona (50.00%)» para volver a
-- encontrar las obras por su nombre. Funcionaba mientras ningún nombre llevara
-- « · » ni terminara en paréntesis, y mientras no hubiera dos obras que se
-- llamaran igual —cosa que pasa: «Casa Hernández» dos veces, años distintos—.
-- Con el id de por medio ya no hay nada que adivinar.
create or replace view public.v_rayas_semanales with (security_invoker = on) as
select r.id                                   as raya_id,
       r.trabajador_id,
       p.nombre                               as trabajador,
       p.es_externo,
       p.oficio,
       r.semana,
       (r.semana + 5)                         as semana_termina,
       r.monto_semanal,
       r.dias_base,
       r.dias_trabajados,
       r.ajuste,
       r.bruto                                as mano_obra,
       r.costo_haaco_pct,
       r.retencion                            as retencion_haaco,
       r.total_pagar                          as total,
       -- Una raya vale lo que dice desde que existe: el tiempo ya se trabajó.
       -- Sólo cancelarla la pone en cero.
       case when r.estatus = 'cancelada' then 0 else r.total_pagar end as devengado,
       coalesce(sum(n.monto), 0)              as pagado,
       round(r.total_pagar - coalesce(sum(n.monto), 0), 2) as por_pagar,
       greatest(0, round(
         case when r.estatus = 'cancelada' then 0 else r.total_pagar end
         - coalesce(sum(n.monto), 0), 2))     as disponible,
       max(n.fecha)                           as ultimo_pago,
       r.estatus,
       r.notas,
       (select string_agg(o.nombre || ' (' || ro.pct || '%)', ' · ' order by ro.pct desc)
          from public.raya_obras ro join public.obras o on o.id = ro.obra_id
         where ro.raya_id = r.id)             as obras,
       (select coalesce(sum(ro.pct), 0) from public.raya_obras ro
         where ro.raya_id = r.id)             as pct_asignado,
       (select jsonb_agg(jsonb_build_object('obra_id', ro.obra_id, 'nombre', o.nombre, 'pct', ro.pct)
                         order by ro.pct desc, o.nombre)
          from public.raya_obras ro join public.obras o on o.id = ro.obra_id
         where ro.raya_id = r.id)             as obras_json
  from public.rayas_semanales r
  join public.profiles p on p.id = r.trabajador_id
  left join public.nomina_pagos n on n.raya_id = r.id
 group by r.id, p.id;

-- ---------------------------------------------------------------------------
-- El trato con su gente y su reparto ya resueltos, para no armarlo en la app
-- con tres consultas y un `Map` por nombre.
-- ---------------------------------------------------------------------------
create or replace view public.v_sueldos_semanales with (security_invoker = on) as
select s.id,
       s.trabajador_id,
       p.nombre                               as trabajador,
       p.es_externo,
       p.oficio,
       s.monto_semanal,
       s.dias_base,
       s.costo_haaco_pct,
       s.vigencia_desde,
       s.vigencia_hasta,
       s.activo,
       s.notas,
       s.created_at,
       s.updated_at,
       (select string_agg(o.nombre || ' (' || so.pct || '%)', ' · ' order by so.pct desc)
          from public.sueldo_obras so join public.obras o on o.id = so.obra_id
         where so.sueldo_id = s.id)           as obras,
       (select coalesce(sum(so.pct), 0) from public.sueldo_obras so
         where so.sueldo_id = s.id)           as pct_asignado,
       (select jsonb_agg(jsonb_build_object('obra_id', so.obra_id, 'nombre', o.nombre, 'pct', so.pct)
                         order by so.pct desc, o.nombre)
          from public.sueldo_obras so join public.obras o on o.id = so.obra_id
         where so.sueldo_id = s.id)           as obras_json
  from public.sueldos_semanales s
  join public.profiles p on p.id = s.trabajador_id;

grant select on public.v_sueldos_semanales to authenticated;

notify pgrst, 'reload schema';
