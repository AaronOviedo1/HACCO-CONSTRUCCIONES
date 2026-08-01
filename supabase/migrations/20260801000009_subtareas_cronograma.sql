-- ============================================================================
-- HaacoPro · Migración 009 · Subtareas del cronograma
--
-- Una tarea puede colgar de otra: la partida es la tarea madre y sus pasos
-- (protección, lijado, aplicación…) son subtareas. Si se borra la madre, se
-- van sus subtareas con ella.
-- ============================================================================

alter table public.cronograma_tareas
  add column padre_id uuid references public.cronograma_tareas(id) on delete cascade;

create index on public.cronograma_tareas (padre_id);
