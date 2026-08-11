-- ===========================================================================
-- CORREGIR LO CAPTURADO
--
-- «Que todo sea editable» fue la petición transversal de la junta del 10 de
-- agosto. La mayor parte era pantalla: las acciones de servidor de material y
-- de préstamo ya sabían actualizar, sólo faltaba el botón. Aquí va lo que sí
-- necesitaba base de datos.
--
-- Lo importante es el avance. `obras.avance_pct` no se guarda dos veces: sale
-- del cronograma cuando lo hay, y del último porcentaje que reportó la
-- cuadrilla cuando no. Ese segundo camino lo escribía un trigger `after
-- insert` sobre avances y nada más, así que un avance corregido a la baja
-- —o borrado— dejaba el porcentaje de la obra donde estaba, diciendo un avance
-- que ya nadie reportó. Y de ese porcentaje cuelga el devengado de la nómina
-- (v_nomina_contratos), o sea el dinero.
--
-- Se arregla recalculando en vez de arrastrando: al tocar un avance, la obra
-- vuelve a preguntarle a sus avances cuál es el último con porcentaje. Si ya
-- no queda ninguno, el avance reportado es cero, que es la verdad.
--
-- El rastro (updated_at / editado_por) sigue el molde de la corrección de
-- pagos de cobranza, 20260806000026: quien revise el mes que entra tiene que
-- poder ver que algo se tocó, cuándo y quién.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Rastro de correcciones
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['avances', 'bitacora_obra', 'caja_chica', 'obra_materiales'] loop
    execute format(
      'alter table public.%I
         add column if not exists updated_at  timestamptz not null default now(),
         add column if not exists editado_por uuid references public.profiles(id)
                                  on delete set null', t);

    -- Lo que ya existía nunca se ha corregido: su «última edición» es su alta.
    -- Va antes de crear el trigger o el propio respaldo se pisaría.
    execute format(
      'update public.%I set updated_at = created_at where updated_at <> created_at', t);

    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- El avance reportado se recalcula, no se arrastra
-- ---------------------------------------------------------------------------

/**
 * Deja `obras.avance_pct` en el último porcentaje que reportó la cuadrilla.
 *
 * No hace nada si la obra tiene cronograma —ahí manda el cronograma, ver
 * 20260802000011— ni si la obra ya está terminada o cerrada, para no mover
 * devengados de contratos que ya se liquidaron.
 *
 * Y no hace nada si no queda ningún avance con porcentaje. Es tentador poner
 * cero —«nadie ha reportado nada»— pero sería falso: las obras que entraron
 * por la importación del Excel traen su avance escrito directo en la obra, sin
 * un solo avance detrás. Borrar el único avance de una de ellas las mandaría
 * de 60% a 0% y con ellas el devengado de sus contratos. Misma regla que usa
 * `recalcular_avance_obra` cuando la obra no tiene tareas: sin dato nuevo, no
 * se toca lo que había.
 */
create or replace function public.recalcular_avance_reportado(p_obra uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avance numeric(5,2);
begin
  if exists (select 1 from public.cronograma_tareas t where t.obra_id = p_obra) then
    return;
  end if;

  select a.porcentaje_avance into v_avance
    from public.avances a
   where a.obra_id = p_obra and a.porcentaje_avance is not null
   order by a.created_at desc
   limit 1;

  if v_avance is null then return; end if;

  update public.obras
     set avance_pct = v_avance,
         fecha_ultima_actualizacion = now(),
         updated_at = now()
   where id = p_obra
     and estatus not in ('terminada', 'cerrada')
     and avance_pct is distinct from v_avance;
end $$;

create or replace function public.tg_avance_recalcula()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recalcular_avance_reportado(coalesce(new.obra_id, old.obra_id));
  return coalesce(new, old);
end $$;

drop trigger if exists avance_recalcula on public.avances;
create trigger avance_recalcula after update or delete on public.avances
  for each row execute function public.tg_avance_recalcula();

grant execute on function public.recalcular_avance_reportado(uuid) to authenticated;
