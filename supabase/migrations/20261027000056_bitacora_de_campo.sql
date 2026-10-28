-- ===========================================================================
-- BITÁCORA DE CAMPO
--
-- Hasta hoy la bitácora la llenaban los triggers (estatus, fechas, avances,
-- pagarés) y a mano sólo cabía una línea de texto. Ahora quien va a la obra
-- registra lo que pasó como en COS: qué clase de evento fue, el día, hasta
-- diez fotos y la tarea del cronograma a la que afecta. Un retraso con días
-- recorre esa tarea solo.
--
-- Lo escrito a mano sigue siendo `tipo = 'nota'` —así lo reconoce todo el
-- código que ya distingue lo editable de lo automático—, y la clase vive en
-- su propia columna para no mezclar «llovió» con los eventos del sistema.
-- ===========================================================================

alter table public.bitacora_obra
  add column clase text not null default 'nota'
    check (clase in ('nota', 'avance', 'entrega_material', 'incidencia', 'clima',
                     'asistencia', 'retraso', 'visita')),
  -- El día que pasó, que no siempre es el día que se anota: el residente
  -- llena la de ayer por la mañana. Vacío en lo que anotan los triggers.
  add column fecha date,
  -- Rutas en el bucket «avances», bajo la carpeta de la obra.
  add column fotos text[] not null default '{}'
    check (cardinality(fotos) <= 10),
  add column tarea_id uuid references public.cronograma_tareas(id) on delete set null,
  add column dias_impacto integer check (dias_impacto between 1 and 365);

-- ---------------------------------------------------------------------------
-- Registrar un evento. Va en función y no en un insert desde la app porque el
-- retraso mueve el cronograma, y las dos cosas pasan juntas o ninguna.
--
-- El retraso empuja el plan como en COS: si la tarea no ha empezado se
-- recorre completa; si ya va en curso sólo se recorre el fin. Sus subtareas
-- pendientes van con ella, o el padre se movería dejando a sus hijas atrás.
-- Se aplica una sola vez, al registrar: corregir la nota después no vuelve a
-- mover nada.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_en_bitacora(
  p_obra        uuid,
  p_clase       text,
  p_descripcion text,
  p_fecha       date default null,
  p_fotos       text[] default '{}',
  p_tarea       uuid default null,
  p_dias        integer default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid;
begin
  perform public.exigir_equipo();

  if coalesce(trim(p_descripcion), '') = '' and cardinality(coalesce(p_fotos, '{}')) = 0 then
    raise exception 'Escribe qué pasó o sube una foto.';
  end if;

  if exists (select 1 from unnest(coalesce(p_fotos, '{}')) r where r not like p_obra::text || '/%') then
    raise exception 'Las fotos tienen que estar en la carpeta de la obra.';
  end if;

  if p_tarea is not null and not exists (
    select 1 from public.cronograma_tareas where id = p_tarea and obra_id = p_obra
  ) then
    raise exception 'Esa tarea no es de esta obra.';
  end if;

  insert into public.bitacora_obra
    (obra_id, tipo, clase, descripcion, fecha, fotos, tarea_id, dias_impacto, autor_id)
  values (
    p_obra, 'nota', p_clase, coalesce(trim(p_descripcion), ''),
    coalesce(p_fecha, public.hoy_hermosillo()), coalesce(p_fotos, '{}'), p_tarea,
    case when p_clase = 'retraso' and p_dias > 0 then p_dias end,
    auth.uid()
  )
  returning id into v_id;

  if p_clase = 'retraso' and p_tarea is not null and p_dias > 0 then
    update public.cronograma_tareas t
       set fecha_inicio = case
             when t.estatus = 'pendiente' and t.avance_pct = 0 then t.fecha_inicio + p_dias
             else t.fecha_inicio
           end,
           fecha_fin = coalesce(t.fecha_fin, t.fecha_inicio) + p_dias
     where t.obra_id = p_obra
       and (t.id = p_tarea or t.padre_id = p_tarea)
       and t.estatus <> 'terminada'
       and coalesce(t.fecha_fin, t.fecha_inicio) is not null;
  end if;

  update public.obras set fecha_ultima_actualizacion = now() where id = p_obra;

  return v_id;
end $$;

grant execute on function public.registrar_en_bitacora(uuid, text, text, date, text[], uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- El aviso automático de una tarea movida decía «se movió del 03/11 al
-- 03/11» cuando sólo cambiaba el fin, porque comparaba los inicios. Con el
-- retraso eso pasa a diario (la tarea en curso sólo estira su fin), así que
-- ahora dice cuál de las dos fechas cambió.
-- ---------------------------------------------------------------------------
create or replace function public.tg_bitacora_tarea()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.fecha_inicio is distinct from old.fecha_inicio then
    perform public.anotar_bitacora(new.obra_id, 'cronograma',
      format('«%s» se movió del %s al %s', new.nombre,
             to_char(coalesce(old.fecha_inicio, old.fecha_fin), 'DD/MM/YYYY'),
             to_char(coalesce(new.fecha_inicio, new.fecha_fin), 'DD/MM/YYYY')));
  elsif new.fecha_fin is distinct from old.fecha_fin then
    perform public.anotar_bitacora(new.obra_id, 'cronograma',
      format('«%s» ahora termina el %s (antes el %s)', new.nombre,
             coalesce(to_char(new.fecha_fin, 'DD/MM/YYYY'), 'sin fecha'),
             coalesce(to_char(old.fecha_fin, 'DD/MM/YYYY'), 'sin fecha')));
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
