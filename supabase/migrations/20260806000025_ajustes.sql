-- ===========================================================================
-- AJUSTES DE LA CASA
--
-- La meta de venta del mes la pone Dirección y va a cambiar: no puede vivir en
-- una constante del código. Es el primero de una familia —el día que pidan
-- cambiar el porcentaje de utilidad o el anticipo por defecto, van aquí—, así
-- que la tabla se abre por clave en vez de por columna.
-- ===========================================================================

create table if not exists public.ajustes (
  clave      text primary key,
  valor      jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.ajustes is
  'Números que Dirección cambia sin tocar el código. Una fila por clave.';

alter table public.ajustes enable row level security;

grant select on public.ajustes to authenticated;
grant insert, update, delete on public.ajustes to authenticated;

-- Todo el que entra puede leerlos (el tablero los pinta); escribir, sólo
-- Dirección y Administración.
drop policy if exists ajustes_leer  on public.ajustes;
drop policy if exists ajustes_staff on public.ajustes;

create policy ajustes_leer on public.ajustes
  for select to authenticated using (true);

create policy ajustes_staff on public.ajustes
  for all to authenticated using (public.es_staff()) with check (public.es_staff());

create trigger set_updated_at before update on public.ajustes
  for each row execute function public.tg_set_updated_at();

-- La cifra que dieron en la junta, a confirmar. Se cambia desde el tablero.
insert into public.ajustes (clave, valor)
values ('meta_venta_mensual', '530000'::jsonb)
on conflict (clave) do nothing;
