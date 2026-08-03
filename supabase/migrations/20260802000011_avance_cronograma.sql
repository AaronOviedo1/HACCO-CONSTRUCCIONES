-- ===========================================================================
-- AVANCE POR CRONOGRAMA
-- Cada tarea lleva su propio % de avance y un peso (qué tanto pesa en la obra).
-- El avance global de la obra sale del cronograma cuando lo hay; si la obra
-- no tiene tareas, sigue mandando el % que reporta la cuadrilla.
-- OJO: la nómina paga en proporción a obras.avance_pct (v_nomina_contratos),
-- por eso esta migración NO recalcula obras existentes: el nuevo cálculo
-- aplica a partir del primer cambio en una tarea.
-- ===========================================================================

alter table public.cronograma_tareas
  add column peso       numeric(8,2) not null default 1 check (peso > 0),
  add column avance_pct numeric(5,2) not null default 0 check (avance_pct between 0 and 100);

-- Lo ya capturado arranca con un avance razonable según su estatus
update public.cronograma_tareas set avance_pct = 100 where estatus = 'terminada';
update public.cronograma_tareas set avance_pct = 50  where estatus = 'en_proceso';

-- ---------------------------------------------------------------------------
-- Estatus y % siempre cuentan la misma historia:
-- marcar terminada = 100 %, llegar a 100 % = terminada, avanzar = en proceso.
-- ---------------------------------------------------------------------------
create or replace function public.tg_tarea_sincroniza_avance()
returns trigger language plpgsql as $$
declare
  v_cambio_estatus boolean := tg_op = 'INSERT' or new.estatus is distinct from old.estatus;
  v_cambio_avance  boolean := tg_op = 'INSERT' or new.avance_pct is distinct from old.avance_pct;
begin
  if v_cambio_estatus and not v_cambio_avance then
    if new.estatus = 'terminada' then
      new.avance_pct := 100;
    elsif new.estatus = 'pendiente' then
      new.avance_pct := 0;
    end if;
  elsif v_cambio_avance then
    if new.avance_pct >= 100 then
      new.estatus := 'terminada';
    elsif new.avance_pct > 0 and new.estatus <> 'en_proceso' then
      new.estatus := 'en_proceso';
    elsif new.avance_pct = 0 and new.estatus = 'terminada' then
      new.estatus := 'pendiente';
    end if;
  end if;
  return new;
end $$;
create trigger tarea_sincroniza_avance before insert or update on public.cronograma_tareas
  for each row execute function public.tg_tarea_sincroniza_avance();

-- ---------------------------------------------------------------------------
-- El avance de la obra = promedio ponderado de las tareas de primer nivel.
-- No toca obras terminadas o cerradas (protege los devengados de nómina)
-- ni obras sin cronograma.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_avance_obra(p_obra uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avance numeric(5,2);
begin
  select round(sum(t.peso * t.avance_pct) / nullif(sum(t.peso), 0), 2)
    into v_avance
    from public.cronograma_tareas t
   where t.obra_id = p_obra and t.padre_id is null;

  if v_avance is null then return; end if;

  update public.obras
     set avance_pct = v_avance,
         fecha_ultima_actualizacion = now(),
         updated_at = now()
   where id = p_obra
     and estatus not in ('terminada', 'cerrada')
     and avance_pct is distinct from v_avance;
end $$;

-- ---------------------------------------------------------------------------
-- Una tarea con subtareas no captura avance propio: lo hereda de sus hijas
-- (promedio ponderado). Después de cualquier movimiento se recalcula la obra.
-- pg_trigger_depth evita que la propagación al padre se vuelva un ciclo.
-- ---------------------------------------------------------------------------
create or replace function public.tg_tarea_propaga_avance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_obra  uuid := coalesce(new.obra_id, old.obra_id);
  v_padre uuid;
begin
  if tg_op = 'UPDATE'
     and new.avance_pct is not distinct from old.avance_pct
     and new.peso is not distinct from old.peso
     and new.padre_id is not distinct from old.padre_id then
    return null;
  end if;

  if pg_trigger_depth() <= 1 then
    for v_padre in
      select distinct p from unnest(array[
        case when tg_op <> 'INSERT' then old.padre_id end,
        case when tg_op <> 'DELETE' then new.padre_id end
      ]) as p where p is not null
    loop
      update public.cronograma_tareas t
         set avance_pct = coalesce((
               select round(sum(h.peso * h.avance_pct) / nullif(sum(h.peso), 0), 2)
                 from public.cronograma_tareas h where h.padre_id = v_padre), 0)
       where t.id = v_padre;
    end loop;
  end if;

  perform public.recalcular_avance_obra(v_obra);
  return null;
end $$;
create trigger tarea_propaga_avance after insert or update or delete on public.cronograma_tareas
  for each row execute function public.tg_tarea_propaga_avance();

-- ---------------------------------------------------------------------------
-- El % que reporta la cuadrilla sólo mueve el avance global cuando la obra
-- no tiene cronograma; con cronograma, el cronograma manda.
-- ---------------------------------------------------------------------------
create or replace function public.tg_obra_toca_avance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.obras
     set fecha_ultima_actualizacion = now(),
         avance_pct = case
           when new.porcentaje_avance is not null
                and not exists (select 1 from public.cronograma_tareas t
                                 where t.obra_id = new.obra_id)
           then new.porcentaje_avance
           else avance_pct end,
         updated_at = now()
   where id = new.obra_id;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Bitácora de tareas: antes, si un mismo cambio movía fechas Y estatus,
-- sólo quedaba registrado el movimiento de fechas y se perdía la terminada.
-- Ahora cada cosa deja su renglón, incluido el avance capturado a mano.
-- ---------------------------------------------------------------------------
create or replace function public.tg_bitacora_tarea()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fecha_inicio is distinct from old.fecha_inicio
     or new.fecha_fin is distinct from old.fecha_fin then
    perform public.anotar_bitacora(new.obra_id, 'cronograma',
      format('«%s» se movió del %s al %s', new.nombre,
             to_char(coalesce(old.fecha_inicio, old.fecha_fin), 'DD/MM/YYYY'),
             to_char(coalesce(new.fecha_inicio, new.fecha_fin), 'DD/MM/YYYY')));
  end if;
  if new.estatus is distinct from old.estatus then
    perform public.anotar_bitacora(new.obra_id, 'cronograma',
      format('«%s»: %s', new.nombre, new.estatus));
  elsif new.avance_pct is distinct from old.avance_pct then
    perform public.anotar_bitacora(new.obra_id, 'cronograma',
      format('«%s» va al %s%%', new.nombre, round(new.avance_pct)));
  end if;
  return new;
end $$;
