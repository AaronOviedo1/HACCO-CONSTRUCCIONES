-- ===========================================================================
-- SUSCRIPCIÓN DE LA APP
--
-- La mensualidad de HaacoPro se cobra con Stripe el día 12 de cada mes. La
-- verdad vive allá; esto es la copia que la app necesita para pintar la
-- pantalla, el aviso y el candado sin ir a preguntarle a Stripe en cada
-- render. Una sola fila: la instalación es de una sola empresa.
--
-- Nadie con sesión la escribe. La escribe el webhook de Stripe —que entra sin
-- sesión— por una RPC `security definer` estrecha, igual que las de los crons:
-- `service_role` no lee las tablas de este esquema y así se queda.
-- ===========================================================================

create table if not exists public.suscripcion_app (
  -- Fila única: la llave sólo admite `true`.
  id                       boolean primary key default true check (id),
  stripe_customer_id       text,
  stripe_subscription_id   text,
  -- Los estados son los de Stripe más `sin_tarjeta`, que es como nace la fila.
  -- Es texto con `check` y no un enum: un estado nuevo de Stripe no debe
  -- tumbar el webhook; en el código, lo desconocido se mapea a `incomplete`.
  estado                   text not null default 'sin_tarjeta'
    check (estado in ('sin_tarjeta', 'incomplete', 'incomplete_expired', 'trialing',
                      'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  periodo_actual_fin       timestamptz,
  proximo_cobro            timestamptz,
  cancela_al_fin_periodo   boolean not null default false,
  monto_centavos           integer,
  moneda                   text,
  tarjeta_marca            text,
  tarjeta_ultimos4         text,
  ultimo_pago_en           timestamptz,
  ultimo_fallo_en          timestamptz,
  -- La factura que no se pudo cobrar: desde cuándo se debe y dónde se paga.
  -- De `impago_desde` cuelga el candado de los siete días.
  impago_desde             timestamptz,
  factura_pendiente_url    text,
  updated_at               timestamptz not null default now()
);

comment on table public.suscripcion_app is
  'Estado de la mensualidad de la app según Stripe. Fila única; la escribe sólo el webhook.';

insert into public.suscripcion_app (id) values (true) on conflict do nothing;

alter table public.suscripcion_app enable row level security;

-- Sólo Dirección la lee; con sesión nadie la escribe.
grant select on public.suscripcion_app to authenticated;

drop policy if exists suscripcion_app_leer on public.suscripcion_app;
create policy suscripcion_app_leer on public.suscripcion_app
  for select to authenticated using (public.es_admin());

drop trigger if exists set_updated_at on public.suscripcion_app;
create trigger set_updated_at before update on public.suscripcion_app
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Memoria del webhook: Stripe reintenta y a veces manda el mismo evento dos
-- veces. Con el id apuntado, el segundo no toca nada. Sin políticas: nadie con
-- sesión tiene por qué verla.
-- ---------------------------------------------------------------------------
create table if not exists public.stripe_eventos (
  id        text primary key,
  tipo      text not null,
  creado    timestamptz not null,
  recibido  timestamptz not null default now()
);

alter table public.stripe_eventos enable row level security;

-- ---------------------------------------------------------------------------
-- La única puerta de escritura.
--
-- Recibe el estado completo leído de Stripe como jsonb y aplica sólo las
-- claves que vienen: una clave presente con `null` borra la columna (la
-- tarjeta que ya no está, la factura que ya se pagó); una clave ausente la
-- deja como estaba. Con `p_evento_id` anota el evento primero y, si ya se
-- había procesado, devuelve false sin tocar la fila: evento y parche van en
-- la misma transacción, así que un reintento de Stripe nunca aplica a medias.
-- Sin evento —la confirmación tras el checkout, el botón de actualizar—
-- siempre aplica.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_suscripcion_app(
  p_datos     jsonb,
  p_evento_id text default null,
  p_tipo      text default null,
  p_creado    timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_evento_id is not null then
    insert into public.stripe_eventos (id, tipo, creado)
    values (p_evento_id, coalesce(p_tipo, '?'), coalesce(p_creado, now()))
    on conflict (id) do nothing;
    if not found then
      return false;
    end if;
  end if;

  update public.suscripcion_app set
    stripe_customer_id     = case when p_datos ? 'stripe_customer_id'
                               then p_datos->>'stripe_customer_id' else stripe_customer_id end,
    stripe_subscription_id = case when p_datos ? 'stripe_subscription_id'
                               then p_datos->>'stripe_subscription_id' else stripe_subscription_id end,
    estado                 = coalesce(p_datos->>'estado', estado),
    periodo_actual_fin     = case when p_datos ? 'periodo_actual_fin'
                               then (p_datos->>'periodo_actual_fin')::timestamptz else periodo_actual_fin end,
    proximo_cobro          = case when p_datos ? 'proximo_cobro'
                               then (p_datos->>'proximo_cobro')::timestamptz else proximo_cobro end,
    cancela_al_fin_periodo = coalesce((p_datos->>'cancela_al_fin_periodo')::boolean, cancela_al_fin_periodo),
    monto_centavos         = case when p_datos ? 'monto_centavos'
                               then (p_datos->>'monto_centavos')::integer else monto_centavos end,
    moneda                 = case when p_datos ? 'moneda'
                               then p_datos->>'moneda' else moneda end,
    tarjeta_marca          = case when p_datos ? 'tarjeta_marca'
                               then p_datos->>'tarjeta_marca' else tarjeta_marca end,
    tarjeta_ultimos4       = case when p_datos ? 'tarjeta_ultimos4'
                               then p_datos->>'tarjeta_ultimos4' else tarjeta_ultimos4 end,
    ultimo_pago_en         = case when p_datos ? 'ultimo_pago_en'
                               then (p_datos->>'ultimo_pago_en')::timestamptz else ultimo_pago_en end,
    ultimo_fallo_en        = case when p_datos ? 'ultimo_fallo_en'
                               then (p_datos->>'ultimo_fallo_en')::timestamptz else ultimo_fallo_en end,
    impago_desde           = case when p_datos ? 'impago_desde'
                               then (p_datos->>'impago_desde')::timestamptz else impago_desde end,
    factura_pendiente_url  = case when p_datos ? 'factura_pendiente_url'
                               then p_datos->>'factura_pendiente_url' else factura_pendiente_url end
  where id = true;

  return true;
end $$;

-- Sólo el service_role: es para el webhook, que entra sin sesión.
revoke all on function public.registrar_suscripcion_app(jsonb, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.registrar_suscripcion_app(jsonb, text, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- El candado.
--
-- Si el cobro del 12 falla, Stripe reintenta y avisa por correo durante una
-- semana; si el 19 sigue sin pagarse, la app entera se pone en pausa hasta
-- que se pague. Los siete días viven aquí y sólo aquí: la pantalla pinta la
-- fecha que esta función devuelve, no la calcula por su cuenta.
--
-- `canceled` y `sin_tarjeta` no bloquean a propósito: si el proveedor cancela
-- desde su dashboard, el cliente ve «sin suscripción» y puede volver a
-- registrar la tarjeta, pero no se le cierra la app por un clic.
--
-- La llama el proxy en cada petición con la sesión de quien entra, de
-- cualquier rol; por eso es `security definer` (la tabla sólo la lee
-- Dirección) y devuelve nada más estos dos datos.
-- ---------------------------------------------------------------------------
create or replace function public.bloqueo_app()
returns table (bloqueada boolean, bloquea_el timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(s.estado in ('past_due', 'unpaid')
             and s.impago_desde is not null
             and now() >= s.impago_desde + interval '7 days', false) as bloqueada,
    case when s.estado in ('past_due', 'unpaid') and s.impago_desde is not null
         then s.impago_desde + interval '7 days' end as bloquea_el
  from public.suscripcion_app s
  where s.id = true;
$$;

revoke all on function public.bloqueo_app() from public, anon;
grant execute on function public.bloqueo_app() to authenticated, service_role;
