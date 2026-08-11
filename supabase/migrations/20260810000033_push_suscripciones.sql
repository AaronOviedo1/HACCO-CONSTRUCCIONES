-- ===========================================================================
-- NOTIFICACIONES EN EL TELÉFONO
--
-- El Google Calendar cubre la mitad: avisa si el recordatorio se pasó ahí a
-- mano. Esto cubre la otra —que la app avise sola, sin abrirla— y es la que se
-- pidió en la junta.
--
-- Web Push necesita guardar por cada teléfono el endpoint que le da su
-- navegador y dos llaves. No es una sesión: un mismo usuario puede tener el
-- iPhone y el iPad, y cada uno es una suscripción distinta. El endpoint es
-- único porque el navegador lo reemite igual al reinstalar.
--
-- En iPhone sólo funciona con la app agregada a la pantalla de inicio; eso lo
-- explica la pantalla, aquí no cambia nada.
-- ===========================================================================

create table if not exists public.push_suscripciones (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  /** Con qué navegador se dio de alta: sirve para saber qué aparato es. */
  agente       text,
  ultimo_envio timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists push_por_persona on public.push_suscripciones (profile_id);

alter table public.push_suscripciones enable row level security;

-- Cada quien administra las suyas. El cron entra con service role y no pasa
-- por RLS: es el único que necesita leer las de todos.
create policy propias on public.push_suscripciones
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select, insert, update, delete on public.push_suscripciones to authenticated;
