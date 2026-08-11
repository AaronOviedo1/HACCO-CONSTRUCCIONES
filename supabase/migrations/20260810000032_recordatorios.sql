-- ===========================================================================
-- RECORDATORIOS
--
-- «¿Se le puede poner a las cotizaciones un comentario?» acabó en otra cosa:
-- las notas internas ya existían, lo que faltaba era la fecha. Una cotización
-- en seguimiento no necesita que se escriba más sobre ella, necesita que
-- alguien se acuerde de hablarle al cliente el jueves.
--
-- La tabla es genérica a propósito. Hoy sólo cuelgan de una cotización, pero
-- la fecha de entrega de una obra y el vencimiento de una factura piden lo
-- mismo, y ya existen en el sistema sin nada que avise. Las dos ligas son
-- nulables y un recordatorio suelto también vale: no hace falta migración
-- nueva para colgarlo de otra cosa.
--
-- `atendido_en` en vez de un booleano: sirve de bandera y deja el rastro de
-- cuándo se atendió, que es lo que se pregunta después.
-- ===========================================================================

create table if not exists public.recordatorios (
  id            uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones(id) on delete cascade,
  obra_id       uuid references public.obras(id)        on delete cascade,
  titulo        text not null,
  nota          text,
  fecha         date not null,
  /** Sin hora es un pendiente del día; con hora es una cita. */
  hora          time,
  /** A quién le toca. Sin nadie, le toca a quien lo vea. */
  para          uuid references public.profiles(id) on delete set null,
  atendido_en   timestamptz,
  atendido_por  uuid references public.profiles(id) on delete set null,
  creado_por    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- La consulta de siempre es «qué me toca hoy»: por fecha, y sólo lo abierto.
create index if not exists recordatorios_pendientes
  on public.recordatorios (fecha) where atendido_en is null;
create index if not exists recordatorios_por_cotizacion
  on public.recordatorios (cotizacion_id) where cotizacion_id is not null;

drop trigger if exists set_updated_at on public.recordatorios;
create trigger set_updated_at before update on public.recordatorios
  for each row execute function public.tg_set_updated_at();

alter table public.recordatorios enable row level security;

create policy staff_todo on public.recordatorios
  for all to authenticated using (public.es_staff()) with check (public.es_staff());

grant select, insert, update, delete on public.recordatorios to authenticated;
