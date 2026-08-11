-- ===========================================================================
-- LA RONDA DE LA MAÑANA
--
-- Guardar el precio de cada factura ya evita repetir llamadas, pero no todo se
-- compra seguido: hay fierro que lleva dos meses sin pasar por una factura y
-- ése sigue habiendo que preguntarlo. La diferencia es que ahora se sabe CUÁL.
--
-- Cada mañana se arma una lista corta —doce, no cuarenta— con lo que de verdad
-- conviene preguntar hoy: lo que se sigue, lo que está vencido y, sobre todo,
-- lo que más se ha cotizado en los últimos dos meses. Ése es el orden del
-- dolor real, no el de una suposición.
--
-- Va en tabla y no se calcula al vuelo por dos razones: la lista tiene que
-- quedarse quieta mientras ella trabaja, y «ya lo pregunté hoy» tiene que
-- poder registrarse.
--
-- Y una regla que no se toca: un precio que el sistema DEDUJO de una factura se
-- propone y se aprueba; un precio que ella TECLEÓ mientras se lo dictaban entra
-- directo. Está viendo el número; pedirle que lo confirme en otra pantalla es
-- fricción sin valor.
-- ===========================================================================

-- Última vez que un humano miró ese precio y dijo que así estaba bien. Cuenta
-- como frescura: si rechazó la propuesta, no puede reaparecer mañana.
alter table public.productos
  add column if not exists precio_revisado_en date;

-- ---------------------------------------------------------------------------
-- Las propuestas de cambio
-- ---------------------------------------------------------------------------
do $$ begin
  create type estatus_propuesta as enum ('pendiente', 'aceptada', 'rechazada');
exception when duplicate_object then null; end $$;

create table if not exists public.precios_propuestos (
  id             uuid primary key default gen_random_uuid(),
  producto_id    uuid not null references public.productos(id) on delete cascade,
  proveedor_id   uuid references public.proveedores(id) on delete set null,
  observacion_id uuid references public.precios_material(id) on delete cascade,
  costo_actual   numeric(14,2),
  neto_actual    numeric(14,2),
  costo_nuevo    numeric(14,2),
  iva_nuevo      numeric(14,2),
  neto_nuevo     numeric(14,2) not null,
  variacion_pct  numeric(8,2) generated always as (
    case when coalesce(neto_actual, 0) > 0
         then round((neto_nuevo - neto_actual) / neto_actual * 100, 2) end
  ) stored,
  estado         estatus_propuesta not null default 'pendiente',
  motivo         text,
  resuelta_por   uuid references public.profiles(id) on delete set null,
  resuelta_en    timestamptz,
  created_at     timestamptz not null default now()
);

comment on table public.precios_propuestos is
  'Precios que el sistema dedujo de una factura y esperan visto bueno.';

-- Una propuesta abierta por producto. Sin esto la bandeja junta doce del mismo
-- PTR y se deja de mirar, que es la única forma de que esto falle de verdad.
create unique index if not exists precios_propuestos_una_abierta
  on public.precios_propuestos (producto_id) where estado = 'pendiente';

-- ---------------------------------------------------------------------------
-- La lista del día
-- ---------------------------------------------------------------------------
do $$ begin
  create type estatus_ronda as enum ('pendiente', 'confirmado', 'pospuesto');
exception when duplicate_object then null; end $$;

create table if not exists public.ronda_precios (
  fecha       date not null default public.hoy_hermosillo(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  motivo      text,
  orden       integer not null default 0,
  estado      estatus_ronda not null default 'pendiente',
  created_at  timestamptz not null default now(),
  primary key (fecha, producto_id)
);

comment on table public.ronda_precios is
  'Qué precios conviene preguntar hoy. Se arma sola cada mañana.';

-- ---------------------------------------------------------------------------
-- Qué tan viejo está el precio de cada producto
--
-- Cuenta lo último que pasó: una factura, una llamada, o que alguien lo miró y
-- lo dio por bueno.
-- ---------------------------------------------------------------------------
create or replace view public.v_precios_frescura with (security_invoker = on) as
select
  p.id as producto_id,
  p.nombre,
  p.tipo,
  p.unidad,
  p.seguir_precio,
  p.precio_neto as neto_catalogo,
  u.fecha as ultima_observacion,
  greatest(u.fecha, p.precio_revisado_en) as visto_en,
  coalesce(
    p.dias_vigencia_precio,
    (select (a.valor->>p.tipo::text)::integer from public.ajustes a where a.clave = 'vigencia_precios'),
    30
  ) as vigencia,
  public.hoy_hermosillo() - greatest(u.fecha, p.precio_revisado_en) as dias,
  -- Cuántas cotizaciones de los últimos dos meses lo usaron: el que más se
  -- cotiza es el que más cuesta no saber.
  (select count(*)
     from public.cotizacion_materiales cm
     join public.cotizaciones c on c.id = cm.cotizacion_id
    where cm.producto_id = p.id and c.fecha >= public.hoy_hermosillo() - 60) as usos
from public.productos p
left join lateral (
  select pm.fecha from public.precios_material pm
   where pm.producto_id = p.id
   order by pm.fecha desc, pm.created_at desc limit 1
) u on true
where p.activo;

-- ---------------------------------------------------------------------------
-- Armar la ronda
--
-- Idempotente por fecha: correrla dos veces el mismo día no mueve nada ni pisa
-- lo que ya se confirmó.
-- ---------------------------------------------------------------------------
-- p_fecha va con default null y no con la fecha de hoy: PostgREST resuelve la
-- sobrecarga por los argumentos que le mandan, y llamarla sin ninguno le hace
-- buscar una firma sin parámetros que no existe. Así siempre se le puede pasar
-- p_fecha: null y adentro se resuelve.
create or replace function public.ronda_precios_del_dia(p_fecha date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha   date := coalesce(p_fecha, public.hoy_hermosillo());
  v_maximo  integer;
  v_puestos integer;
begin
  select coalesce((valor->>'maximo')::integer, 12) into v_maximo
    from public.ajustes where clave = 'ronda_precios';
  v_maximo := coalesce(v_maximo, 12);

  with candidatos as (
    select
      f.producto_id,
      case
        when f.visto_en is null then 'Nunca se ha registrado su precio'
        else 'Su precio tiene ' || f.dias || ' días'
      end as motivo,
      row_number() over (
        order by coalesce(f.usos, 0) desc,
                 f.visto_en asc nulls first,
                 f.nombre
      ) as orden
    from public.v_precios_frescura f
    where f.seguir_precio
      and (f.visto_en is null or f.dias > f.vigencia)
  )
  insert into public.ronda_precios (fecha, producto_id, motivo, orden)
  select v_fecha, producto_id, motivo, orden
    from candidatos where orden <= v_maximo
  on conflict (fecha, producto_id) do nothing;

  select count(*) into v_puestos from public.ronda_precios where fecha = v_fecha;
  return v_puestos;
end $$;

comment on function public.ronda_precios_del_dia(date) is
  'Arma la lista de precios a preguntar. La corre el cron cada mañana.';

-- El botón «preguntar hoy» del cotizador: se topó con un precio viejo mientras
-- cotizaba, así que ese material entra a la ronda aunque no le tocara.
create or replace function public.agregar_a_ronda(p_producto uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.exigir_staff();

  insert into public.ronda_precios (fecha, producto_id, motivo, orden)
  values (public.hoy_hermosillo(), p_producto, 'Se pidió desde una cotización', -1)
  on conflict (fecha, producto_id) do update set
    estado = 'pendiente',
    motivo = 'Se pidió desde una cotización',
    orden  = -1;

  -- Y se sigue de aquí en adelante: si hizo falta una vez, hará falta otra.
  update public.productos set seguir_precio = true where id = p_producto;
end $$;

-- ---------------------------------------------------------------------------
-- Registrar un precio
--
-- p_aprobar viene en true desde la pantalla de la llamada —ella está viendo el
-- número— y en false cuando lo dedujo el sistema de una factura o de una lista.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_precio(
  p_producto  uuid,
  p_proveedor uuid,
  p_neto      numeric,
  p_origen    origen_precio default 'llamada',
  p_unidad    text default null,
  p_nota      text default null,
  p_aprobar   boolean default false
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_p          record;
  v_tasa       numeric;
  v_costo      numeric(14,2);
  v_iva        numeric(14,2);
  v_observacion uuid;
  v_umbral     numeric;
begin
  perform public.exigir_staff();

  if p_neto is null or p_neto <= 0 then
    raise exception 'El precio tiene que ser mayor a cero';
  end if;

  select * into v_p from public.productos where id = p_producto;
  if not found then raise exception 'Ese producto no existe'; end if;

  -- El IVA se desglosa con la tasa que ya traía el producto: si a ése le
  -- facturan con impuesto, el neto lo trae dentro. Si no se sabe, no se inventa.
  if coalesce(v_p.costo, 0) > 0 and coalesce(v_p.iva, 0) > 0 then
    v_tasa  := round(v_p.iva / v_p.costo, 4);
    v_costo := round(p_neto / (1 + v_tasa), 2);
    v_iva   := round(p_neto - v_costo, 2);
  end if;

  insert into public.precios_material
    (producto_id, proveedor_id, fecha, costo, iva, precio_neto, unidad, origen,
     nota, registrado_por)
  values
    (p_producto, coalesce(p_proveedor, v_p.proveedor_id), public.hoy_hermosillo(),
     v_costo, v_iva, p_neto, nullif(btrim(coalesce(p_unidad, '')), ''), p_origen,
     nullif(btrim(coalesce(p_nota, '')), ''), auth.uid())
  returning id into v_observacion;

  -- Ya se preguntó hoy: deja de aparecer en la lista.
  update public.ronda_precios
     set estado = 'confirmado'
   where fecha = public.hoy_hermosillo() and producto_id = p_producto;

  if p_aprobar then
    update public.productos set
      costo                = coalesce(v_costo, p_neto),
      iva                  = coalesce(v_iva, 0),
      precio_neto          = p_neto,
      precio_actualizado_en = public.hoy_hermosillo(),
      precio_revisado_en   = public.hoy_hermosillo()
    where id = p_producto;

    -- Si había una propuesta abierta para este producto, el número que acaban
    -- de dictar la deja sin objeto.
    update public.precios_propuestos
       set estado = 'aceptada', resuelta_por = auth.uid(), resuelta_en = now(),
           motivo = coalesce(motivo, 'Se confirmó por teléfono')
     where producto_id = p_producto and estado = 'pendiente';

    return v_observacion;
  end if;

  -- Deducido: se propone sólo si mueve la aguja. Un peso de diferencia no vale
  -- una decisión.
  select coalesce((valor->>'umbral_propuesta_pct')::numeric, 3) into v_umbral
    from public.ajustes where clave = 'ronda_precios';
  v_umbral := coalesce(v_umbral, 3);

  if v_p.precio_neto is null or v_p.precio_neto <= 0
     or abs(p_neto - v_p.precio_neto) / v_p.precio_neto * 100 >= v_umbral then
    insert into public.precios_propuestos
      (producto_id, proveedor_id, observacion_id, costo_actual, neto_actual,
       costo_nuevo, iva_nuevo, neto_nuevo)
    values
      (p_producto, coalesce(p_proveedor, v_p.proveedor_id), v_observacion,
       v_p.costo, v_p.precio_neto, v_costo, v_iva, p_neto)
    on conflict (producto_id) where estado = 'pendiente' do update set
      proveedor_id   = excluded.proveedor_id,
      observacion_id = excluded.observacion_id,
      costo_actual   = excluded.costo_actual,
      neto_actual    = excluded.neto_actual,
      costo_nuevo    = excluded.costo_nuevo,
      iva_nuevo      = excluded.iva_nuevo,
      neto_nuevo     = excluded.neto_nuevo,
      created_at     = now();
  end if;

  return v_observacion;
end $$;

-- ---------------------------------------------------------------------------
-- La bandeja
-- ---------------------------------------------------------------------------
create or replace function public.aceptar_propuesta_precio(p_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare v_p record;
begin
  perform public.exigir_staff();

  select * into v_p from public.precios_propuestos where id = p_id;
  if not found then raise exception 'Esa propuesta ya no existe'; end if;
  if v_p.estado <> 'pendiente' then raise exception 'Esa propuesta ya se resolvió'; end if;

  update public.productos set
    costo                 = coalesce(v_p.costo_nuevo, v_p.neto_nuevo),
    iva                   = coalesce(v_p.iva_nuevo, 0),
    precio_neto           = v_p.neto_nuevo,
    precio_actualizado_en = public.hoy_hermosillo(),
    precio_revisado_en    = public.hoy_hermosillo()
  where id = v_p.producto_id;

  update public.precios_propuestos
     set estado = 'aceptada', resuelta_por = auth.uid(), resuelta_en = now()
   where id = p_id;

  return v_p.producto_id;
end $$;

create or replace function public.rechazar_propuesta_precio(p_id uuid, p_motivo text default null)
returns uuid
language plpgsql
set search_path = public
as $$
declare v_p record;
begin
  perform public.exigir_staff();

  select * into v_p from public.precios_propuestos where id = p_id;
  if not found then raise exception 'Esa propuesta ya no existe'; end if;
  if v_p.estado <> 'pendiente' then raise exception 'Esa propuesta ya se resolvió'; end if;

  update public.precios_propuestos
     set estado = 'rechazada', motivo = nullif(btrim(coalesce(p_motivo, '')), ''),
         resuelta_por = auth.uid(), resuelta_en = now()
   where id = p_id;

  -- Miró y decidió que el catálogo manda: el precio queda revisado y no vuelve
  -- a salir vencido mañana. Si reaparece cada día, aprende a ignorar la bandeja.
  update public.productos set precio_revisado_en = public.hoy_hermosillo()
   where id = v_p.producto_id;

  return v_p.producto_id;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['precios_propuestos','ronda_precios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_todo on public.%I', t);
    execute format('drop policy if exists contador_lectura on public.%I', t);
    execute format(
      'create policy staff_todo on public.%I for all to authenticated
         using (public.es_staff()) with check (public.es_staff())', t);
    execute format(
      'create policy contador_lectura on public.%I for select to authenticated
         using (public.es_contador())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant execute on function public.ronda_precios_del_dia(date),
                          public.agregar_a_ronda(uuid),
                          public.registrar_precio(uuid, uuid, numeric, origen_precio, text, text, boolean),
                          public.aceptar_propuesta_precio(uuid),
                          public.rechazar_propuesta_precio(uuid, text)
  to authenticated;
