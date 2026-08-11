-- ===========================================================================
-- PRECIOS VIVOS DEL MATERIAL
--
-- Para armar una cotización de herrería hay que llamar al proveedor y preguntar
-- precio por precio: el PTR, la lámina, la solera, la soldadura. Son horas de
-- teléfono, y al colgar el dato se pierde: la siguiente cotización vuelve a
-- empezar de cero.
--
-- Conectarse a la tienda no es opción. Proveedor del Herrero no publica precios
-- —ni carrito ni portal—, y es lo normal en acero: el precio se negocia por
-- cliente y se dice por teléfono. Pero la casa YA genera ese dato todos los
-- días y lo tira: cada factura que se captura trae material, cantidad, precio,
-- proveedor y fecha. Hoy eso se guarda como gasto y nadie lo vuelve a mirar.
--
-- Aquí se guarda. Tabla aparte y no columnas sobre `productos` porque se
-- necesitan N observaciones en el tiempo y por proveedor, y porque
-- `costo`/`iva`/`precio_neto` ya tienen dueño —el catálogo vigente—: pisarlos
-- borraría justo lo que se quiere recordar.
--
-- La promesa no es que deje de llamar. Es que no llame dos veces por lo mismo.
-- Por eso el sistema nunca dice «precio actual»: dice «último precio pagado, de
-- tal factura, hace tantos días».
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Qué día es en Hermosillo
--
-- El servidor corre en UTC, y a partir de las cinco de la tarde de acá allá ya
-- es mañana. Sin esto, un precio confirmado a las seis no silenciaría la fila
-- de la ronda —que se guardó con la fecha de la mañana— y volvería a aparecer.
-- Sonora no cambia de horario, así que la cuenta nunca se mueve.
-- ---------------------------------------------------------------------------
create or replace function public.hoy_hermosillo()
returns date
language sql
stable
set search_path = public
as $$ select (now() at time zone 'America/Hermosillo')::date $$;

-- ---------------------------------------------------------------------------
-- Normalizar el texto de un material
--
-- «PTR 1X1 CAL.14», «ptr 1 x 1 c-14» y «PTR 1x1 cal 14» son el mismo fierro.
-- Se usa en una columna generada, así que tiene que ser immutable: por eso
-- translate() y no unaccent(), que no lo es sin envolverlo.
-- ---------------------------------------------------------------------------
create or replace function public.normalizar_material(p_texto text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              translate(lower(coalesce(p_texto, '')),
                        'áéíóúüñàèìòùâêîôûäëïö', 'aeiouunaeiouaeiouaeio'),
              -- «cal.14», «cal 14», «c-14», «c14» → «cal14»
              '\m(?:cal\.?|c[-.]?)\s*([0-9]{1,2})\M', 'cal\1', 'g'),
            -- «1 1/2 x 1» → «1 1/2x1». Sólo entre medidas: si se colapsara
            -- cualquier equis, «Colorex Supreme» acabaría en «colorexsupreme».
            '([0-9/"''])\s*x\s*([0-9])', '\1x\2', 'g'),
          '[^a-z0-9/."'' ]+', ' ', 'g'),
        -- Los espacios de sobra, ya al final: los deja la limpieza de arriba.
        '\s+', ' ', 'g')
    ),
  '');
$$;

comment on function public.normalizar_material(text) is
  'Texto de material comparable: minúsculas, sin acentos, medidas y calibres unificados.';

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- El catálogo aprende a reconocerse
-- ---------------------------------------------------------------------------
alter table public.productos
  add column if not exists clave_busqueda text
    generated always as (public.normalizar_material(nombre)) stored,
  -- Sólo lo que entra en la ronda de la mañana. Que sean cuarenta y no
  -- quinientos es lo único que mantiene corta la lista de llamadas.
  add column if not exists seguir_precio boolean not null default false,
  -- Nulo = el default de su tipo, en ajustes.
  add column if not exists dias_vigencia_precio integer,
  add column if not exists precio_actualizado_en date;

create index if not exists productos_clave_trgm
  on public.productos using gin (clave_busqueda gin_trgm_ops);

-- El material de herrería es el que se cotiza contra teléfono: ése se sigue.
-- Por trigger y no sólo con un update, para que el que se dé de alta mañana
-- nazca igual; apagarlo después es una decisión que se respeta.
create or replace function public.tg_seguir_precio_de_herreria()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tipo = 'herreria' then new.seguir_precio := true; end if;
  return new;
end $$;

drop trigger if exists seguir_precio_de_herreria on public.productos;
create trigger seguir_precio_de_herreria before insert on public.productos
  for each row execute function public.tg_seguir_precio_de_herreria();

update public.productos set seguir_precio = true where tipo = 'herreria';

-- El gasto ya sabía a qué proveedor se le compró; ahora también qué se compró.
alter table public.gastos
  add column if not exists producto_id uuid references public.productos(id) on delete set null;

create index if not exists gastos_producto on public.gastos (producto_id);

-- v_gastos se escribió con `g.*`, y Postgres congela esa expansión al crearla:
-- si no se rehace, la columna nueva no llega a la pantalla y al corregir un
-- gasto se perdería el material que ya se había reconocido.
drop view if exists public.v_gastos;
create view public.v_gastos with (security_invoker = on) as
select g.*,
       pr.nombre as proveedor,
       o.nombre  as obra,
       o.ot_numero,
       c.nombre  as concepto
  from public.gastos g
  left join public.proveedores    pr on pr.id = g.proveedor_id
  left join public.obras          o  on o.id  = g.obra_id
  left join public.obra_conceptos c  on c.id  = g.concepto_id;

-- ---------------------------------------------------------------------------
-- Las observaciones de precio
-- ---------------------------------------------------------------------------
do $$ begin
  create type origen_precio as enum ('factura', 'llamada', 'captura', 'lista');
exception when duplicate_object then null; end $$;

create table if not exists public.precios_material (
  id            uuid primary key default gen_random_uuid(),
  producto_id   uuid not null references public.productos(id) on delete cascade,
  proveedor_id  uuid references public.proveedores(id) on delete set null,
  fecha         date not null default public.hoy_hermosillo(),
  -- Lo que cuesta una unidad. El neto es el que manda: es lo que se paga.
  costo         numeric(14,2),
  iva           numeric(14,2),
  precio_neto   numeric(14,2) not null,
  -- La unidad EN QUE se observó, que no siempre es la del catálogo: el PTR se
  -- compra por tramo de 6.10 y se cotiza por metro. Ver la nota de abajo.
  unidad        text,
  origen        origen_precio not null,
  -- Sin factura no hay observación: si el gasto se borra, esto se va con él.
  gasto_id      uuid references public.gastos(id) on delete cascade,
  folio_factura text,
  nota          text,
  registrado_por uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table public.precios_material is
  'Qué se pagó por un material, cuándo y a quién. Nunca se pisa: se acumula.';

-- Reeditar un gasto no puede duplicar su observación.
create unique index if not exists precios_material_por_gasto
  on public.precios_material (gasto_id, producto_id) where gasto_id is not null;

create index if not exists precios_material_reciente
  on public.precios_material (producto_id, fecha desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Los alias: lo que hace converger todo sin un parser perfecto
--
-- «PTR 1X1 CAL.14 6.10M» de la factura de FERRECASA aprende una sola vez, y
-- para siempre, que es el PTR del catálogo.
-- ---------------------------------------------------------------------------
create table if not exists public.producto_alias (
  id          uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  texto_norm  text not null unique,
  veces       integer not null default 1,
  origen      text,
  created_at  timestamptz not null default now()
);

comment on table public.producto_alias is
  'Cómo escribe cada proveedor un producto del catálogo. Sólo se aprende por confirmación.';

-- ---------------------------------------------------------------------------
-- Lo que no se pudo ligar
--
-- Nunca se adivina por parecido: un ligado mal hecho mete un precio equivocado
-- en una cotización real, y eso se paga más caro que preguntar.
-- ---------------------------------------------------------------------------
create table if not exists public.renglones_sin_ligar (
  id           uuid primary key default gen_random_uuid(),
  gasto_id     uuid references public.gastos(id) on delete cascade,
  texto        text not null,
  texto_norm   text not null,
  precio_neto  numeric(14,2),
  unidad       text,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  -- Copiado del gasto: al resolverlo hace falta saber de qué factura salió, y
  -- pedirlo con un join encarece la pantalla sin ganar nada.
  folio_factura text,
  fecha        date not null default public.hoy_hermosillo(),
  -- Resuelto = se le asignó producto, o se marcó que no es material.
  resuelto     boolean not null default false,
  producto_id  uuid references public.productos(id) on delete set null,
  created_at   timestamptz not null default now()
);

create unique index if not exists renglones_sin_ligar_por_gasto
  on public.renglones_sin_ligar (gasto_id) where gasto_id is not null;

create index if not exists renglones_sin_ligar_pendientes
  on public.renglones_sin_ligar (resuelto, texto_norm);

-- ---------------------------------------------------------------------------
-- Cuánto aguanta un precio antes de estar viejo
-- ---------------------------------------------------------------------------
insert into public.ajustes (clave, valor) values
  ('vigencia_precios', '{"herreria":15,"otro":30,"insumo_taller":30,"pintura":45}'::jsonb),
  ('ronda_precios',    '{"maximo":12,"umbral_propuesta_pct":3}'::jsonb)
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- El último precio conocido de cada material
--
-- Una fila por producto. Es lo que lee el cotizador y lo que ordena la ronda.
-- ---------------------------------------------------------------------------
create or replace view public.v_precios_vigentes with (security_invoker = on) as
select distinct on (pm.producto_id)
  pm.producto_id,
  pm.id                as observacion_id,
  pr.nombre            as producto,
  pr.tipo,
  pr.unidad            as unidad_catalogo,
  pr.costo             as costo_catalogo,
  pr.precio_neto       as neto_catalogo,
  pr.seguir_precio,
  pm.unidad            as unidad_observada,
  pm.proveedor_id,
  prov.nombre          as proveedor,
  prov.telefono        as proveedor_telefono,
  pm.costo,
  pm.iva,
  pm.precio_neto,
  pm.fecha,
  pm.origen,
  pm.folio_factura,
  pm.gasto_id,
  pm.nota,
  (public.hoy_hermosillo() - pm.fecha) as dias,
  v.vigencia,
  case
    when (public.hoy_hermosillo() - pm.fecha) <= v.vigencia     then 'verde'
    when (public.hoy_hermosillo() - pm.fecha) <= v.vigencia * 2 then 'ambar'
    else 'rojo'
  end as semaforo,
  -- Se observó en una unidad distinta a la del catálogo: se muestra, pero no
  -- se propone ni se autorrellena. Nunca se convierte solo.
  (pm.unidad is not null and pr.unidad is not null
     and public.normalizar_material(pm.unidad) is distinct from public.normalizar_material(pr.unidad))
    as unidad_distinta
from public.precios_material pm
join public.productos pr on pr.id = pm.producto_id
left join public.proveedores prov on prov.id = pm.proveedor_id
cross join lateral (
  select coalesce(
    pr.dias_vigencia_precio,
    (select (a.valor->>pr.tipo::text)::integer from public.ajustes a where a.clave = 'vigencia_precios'),
    30
  ) as vigencia
) v
order by pm.producto_id, pm.fecha desc, pm.created_at desc;

comment on view public.v_precios_vigentes is
  'Último precio pagado por producto, con su origen y qué tan viejo está.';

-- ---------------------------------------------------------------------------
-- Qué producto es un texto
--
-- En este orden y sin adivinar: lo que un alias confirmado enseñó, o el nombre
-- exacto del catálogo. Nunca por similitud: un ligado mal hecho mete el precio
-- de un fierro en otro, y eso sale más caro que preguntar.
-- ---------------------------------------------------------------------------
create or replace function public.producto_de_texto(p_texto text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  v_norm     text := public.normalizar_material(p_texto);
  v_producto uuid;
begin
  if v_norm is null then return null; end if;

  select producto_id into v_producto from public.producto_alias where texto_norm = v_norm;
  if v_producto is not null then return v_producto; end if;

  select id into v_producto
    from public.productos where clave_busqueda = v_norm and activo limit 1;
  return v_producto;
end $$;

-- ---------------------------------------------------------------------------
-- Un precio suelto que viene del historial
--
-- El material de las obras ya capturadas no pasó por la pantalla de gastos: se
-- migró del Excel a `obra_materiales`, con su costo y su folio pero sin gasto
-- detrás. Ese precio vale igual, así que entra por aquí.
--
-- Devuelve el producto si se pudo ligar; si no, deja el renglón para que
-- alguien le ponga nombre una sola vez.
-- ---------------------------------------------------------------------------
create or replace function public.observar_precio_historico(
  p_texto     text,
  p_neto      numeric,
  p_proveedor uuid default null,
  p_folio     text default null,
  p_fecha     date default null,
  p_unidad    text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_producto uuid;
  v_fecha    date := coalesce(p_fecha, public.hoy_hermosillo());
begin
  if p_neto is null or p_neto <= 0 then return null; end if;

  v_producto := public.producto_de_texto(p_texto);

  if v_producto is null then
    -- Uno por texto: el mismo masking aparece en veinte obras y la lista de
    -- pendientes tiene que ser corta para que alguien la mire.
    insert into public.renglones_sin_ligar
      (texto, texto_norm, precio_neto, unidad, proveedor_id, folio_factura, fecha)
    select p_texto, public.normalizar_material(p_texto), p_neto, p_unidad,
           p_proveedor, p_folio, v_fecha
     where not exists (
       select 1 from public.renglones_sin_ligar r
        where r.texto_norm = public.normalizar_material(p_texto) and not r.resuelto
     );
    return null;
  end if;

  insert into public.precios_material
    (producto_id, proveedor_id, fecha, precio_neto, unidad, origen, folio_factura, nota)
  values (v_producto, p_proveedor, v_fecha, p_neto, p_unidad, 'factura', p_folio,
          'Del historial de material de obra');

  return v_producto;
end $$;

-- ---------------------------------------------------------------------------
-- De un gasto salen observaciones de precio
--
-- Va dentro de la transacción del gasto, no en un trigger ni en la acción del
-- servidor: el gasto ya se ramifica ahí (material real y cuenta por pagar), y
-- así queda cubierto cualquier llamador, los scripts de importación incluidos.
-- ---------------------------------------------------------------------------
create or replace function public.observar_precios_de_gasto(p_gasto uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_g        record;
  v_texto    text;
  v_producto uuid;
  v_neto     numeric(14,2);
  v_tasa     numeric;
  v_costo    numeric(14,2);
  v_iva      numeric(14,2);
begin
  select * into v_g from public.gastos where id = p_gasto;
  if not found then return null; end if;

  -- Un gasto sin proveedor no es una observación de precio: no se sabe de quién
  -- es ese número. Y sólo el material tiene precio de lista.
  if v_g.categoria <> 'material' or v_g.proveedor_id is null then return null; end if;

  v_neto := coalesce(v_g.costo_unitario, round(v_g.monto / nullif(coalesce(v_g.piezas, 1), 0), 2));
  if v_neto is null or v_neto <= 0 then return null; end if;

  v_texto := public.normalizar_material(v_g.descripcion);
  if v_texto is null then return null; end if;

  -- Lo que la captura ya resolvió manda; si no, se busca por alias o nombre.
  v_producto := coalesce(v_g.producto_id, public.producto_de_texto(v_g.descripcion));

  if v_producto is null then
    insert into public.renglones_sin_ligar
      (gasto_id, texto, texto_norm, precio_neto, proveedor_id, folio_factura, fecha)
    values (p_gasto, v_g.descripcion, v_texto, v_neto, v_g.proveedor_id,
            v_g.folio_factura, v_g.fecha)
    -- El where repite el del índice: sin él Postgres no infiere un único parcial.
    on conflict (gasto_id) where gasto_id is not null do update set
      texto = excluded.texto, texto_norm = excluded.texto_norm,
      precio_neto = excluded.precio_neto, proveedor_id = excluded.proveedor_id,
      folio_factura = excluded.folio_factura, fecha = excluded.fecha;
    return null;
  end if;

  -- Ya ligado: el renglón huérfano de una captura anterior deja de estarlo.
  delete from public.renglones_sin_ligar where gasto_id = p_gasto;

  -- Se aprende cómo lo escribe ese proveedor.
  insert into public.producto_alias (producto_id, texto_norm, veces, origen)
  values (v_producto, v_texto, 1, 'factura')
  on conflict (texto_norm) do update set veces = public.producto_alias.veces + 1;

  -- El desglose del IVA se hereda del catálogo: si a ese producto le facturan
  -- con impuesto, el neto observado lo trae dentro. Si no se sabe, no se
  -- inventa: sólo se guarda el neto.
  select case when coalesce(costo, 0) > 0 and coalesce(iva, 0) > 0
              then round(iva / costo, 4) end
    into v_tasa
    from public.productos where id = v_producto;

  if v_tasa is not null then
    v_costo := round(v_neto / (1 + v_tasa), 2);
    v_iva   := round(v_neto - v_costo, 2);
  end if;

  insert into public.precios_material
    (producto_id, proveedor_id, fecha, costo, iva, precio_neto, origen,
     gasto_id, folio_factura, registrado_por)
  values
    (v_producto, v_g.proveedor_id, v_g.fecha, v_costo, v_iva, v_neto, 'factura',
     p_gasto, v_g.folio_factura, v_g.registrado_por)
  on conflict (gasto_id, producto_id) where gasto_id is not null do update set
    proveedor_id  = excluded.proveedor_id,
    fecha         = excluded.fecha,
    costo         = excluded.costo,
    iva           = excluded.iva,
    precio_neto   = excluded.precio_neto,
    folio_factura = excluded.folio_factura;

  return v_producto;
end $$;

comment on function public.observar_precios_de_gasto(uuid) is
  'Convierte un gasto de material en una observación de precio. Idempotente por gasto.';

-- ---------------------------------------------------------------------------
-- Las dos puertas del gasto ahora recuerdan el precio
--
-- Se reescriben enteras para dejar el flujo en un solo lugar: además de la
-- observación, ahora arrastran el producto que la captura haya resuelto, tanto
-- al gasto como al material real de la obra.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_gasto(p_datos jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_gasto    uuid;
  v_obra     uuid := nullif(p_datos->>'obra_id', '')::uuid;
  v_piezas   numeric := coalesce(nullif(p_datos->>'piezas', '')::numeric, 1);
  v_monto    numeric := coalesce(nullif(p_datos->>'monto', '')::numeric, 0);
  v_producto uuid := nullif(p_datos->>'producto_id', '')::uuid;
begin
  perform public.exigir_staff();

  if v_monto <= 0 then
    raise exception 'El monto del gasto tiene que ser mayor a cero';
  end if;

  insert into public.gastos (
    obra_id, concepto_id, categoria, descripcion, piezas, costo_unitario, monto,
    folio_factura, proveedor_id, producto_id, metodo, condicion, foto_ticket_path,
    fecha, registrado_por
  ) values (
    v_obra,
    nullif(p_datos->>'concepto_id', '')::uuid,
    coalesce((p_datos->>'categoria')::categoria_gasto, 'material'),
    p_datos->>'descripcion',
    v_piezas,
    nullif(p_datos->>'costo_unitario', '')::numeric,
    v_monto,
    nullif(p_datos->>'folio_factura', ''),
    nullif(p_datos->>'proveedor_id', '')::uuid,
    v_producto,
    coalesce((p_datos->>'metodo')::metodo_pago, 'efectivo'),
    coalesce((p_datos->>'condicion')::condicion_compra, 'contado'),
    nullif(p_datos->>'foto_ticket_path', ''),
    coalesce(nullif(p_datos->>'fecha', '')::date, public.hoy_hermosillo()),
    auth.uid()
  )
  returning id into v_gasto;

  -- Material de obra: se refleja en el bloque REAL con su folio de factura.
  if v_obra is not null
     and coalesce((p_datos->>'categoria')::categoria_gasto, 'material') = 'material'
     and coalesce((p_datos->>'crear_material')::boolean, true) then
    insert into public.obra_materiales
      (obra_id, concepto_id, origen, material, producto_id, piezas, costo,
       folio_factura, es_taller, gasto_id)
    values (
      v_obra,
      nullif(p_datos->>'concepto_id', '')::uuid,
      'real',
      p_datos->>'descripcion',
      v_producto,
      v_piezas,
      round(v_monto / nullif(v_piezas, 0), 2),
      nullif(p_datos->>'folio_factura', ''),
      false,
      v_gasto
    );

    perform public.anotar_bitacora(v_obra, 'material',
      format('Material comprado: %s por %s', p_datos->>'descripcion', to_char(v_monto, 'FM$999,999,990.00')));
  end if;

  -- Lo que se acaba de pagar es, a partir de hoy, el precio que se conoce.
  perform public.observar_precios_de_gasto(v_gasto);

  return v_gasto;
end $$;

create or replace function public.editar_gasto(p_gasto uuid, p_datos jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_obra       uuid    := nullif(p_datos->>'obra_id', '')::uuid;
  v_piezas     numeric := coalesce(nullif(p_datos->>'piezas', '')::numeric, 1);
  v_monto      numeric := coalesce(nullif(p_datos->>'monto', '')::numeric, 0);
  v_proveedor  uuid    := nullif(p_datos->>'proveedor_id', '')::uuid;
  v_producto   uuid    := nullif(p_datos->>'producto_id', '')::uuid;
  v_condicion  condicion_compra := coalesce((p_datos->>'condicion')::condicion_compra, 'contado');
  v_obra_antes uuid;
  v_pagado     numeric;
  v_tenia_cxp  boolean;
  v_dias       integer;
begin
  perform public.exigir_staff();

  if v_monto <= 0 then
    raise exception 'El monto del gasto tiene que ser mayor a cero';
  end if;

  select obra_id into v_obra_antes from public.gastos where id = p_gasto;
  if not found then
    raise exception 'Ese gasto ya no existe';
  end if;

  update public.gastos set
    obra_id          = v_obra,
    concepto_id      = nullif(p_datos->>'concepto_id', '')::uuid,
    categoria        = coalesce((p_datos->>'categoria')::categoria_gasto, 'material'),
    descripcion      = p_datos->>'descripcion',
    piezas           = v_piezas,
    costo_unitario   = nullif(p_datos->>'costo_unitario', '')::numeric,
    monto            = v_monto,
    folio_factura    = nullif(p_datos->>'folio_factura', ''),
    proveedor_id     = v_proveedor,
    producto_id      = v_producto,
    metodo           = coalesce((p_datos->>'metodo')::metodo_pago, 'efectivo'),
    condicion        = v_condicion,
    foto_ticket_path = coalesce(nullif(p_datos->>'foto_ticket_path', ''), foto_ticket_path),
    fecha            = coalesce(nullif(p_datos->>'fecha', '')::date, fecha)
  where id = p_gasto;

  -- El material REAL de la obra se rehace: es un reflejo del gasto, no un dato
  -- propio. Sólo se tocan los renglones que nacieron de este gasto.
  delete from public.obra_materiales where gasto_id = p_gasto;

  if v_obra is not null
     and coalesce((p_datos->>'categoria')::categoria_gasto, 'material') = 'material'
     and coalesce((p_datos->>'crear_material')::boolean, true) then
    insert into public.obra_materiales
      (obra_id, concepto_id, origen, material, producto_id, piezas, costo,
       folio_factura, es_taller, gasto_id)
    values (
      v_obra,
      nullif(p_datos->>'concepto_id', '')::uuid,
      'real',
      p_datos->>'descripcion',
      v_producto,
      v_piezas,
      round(v_monto / nullif(v_piezas, 0), 2),
      nullif(p_datos->>'folio_factura', ''),
      false,
      p_gasto
    );
  end if;

  -- Cuenta por pagar. El trigger sólo la abre al insertar el gasto, así que al
  -- editar hay que abrirla, ajustarla o cerrarla a mano.
  select coalesce(monto_pagado, 0) into v_pagado
    from public.cuentas_por_pagar where gasto_id = p_gasto;
  v_tenia_cxp := found;
  v_pagado := coalesce(v_pagado, 0);

  if v_condicion = 'credito' and v_proveedor is not null then
    if v_pagado > v_monto then
      raise exception 'La cuenta por pagar de este gasto ya tiene % abonados: el monto nuevo no puede quedar por debajo', v_pagado;
    end if;

    if v_tenia_cxp then
      update public.cuentas_por_pagar set
        proveedor_id  = v_proveedor,
        folio_factura = coalesce(nullif(p_datos->>'folio_factura', ''), 'S/F'),
        monto         = v_monto,
        fecha_factura = coalesce(nullif(p_datos->>'fecha', '')::date, fecha_factura)
      where gasto_id = p_gasto;
    else
      select dias_credito_default into v_dias from public.proveedores where id = v_proveedor;
      insert into public.cuentas_por_pagar
        (gasto_id, proveedor_id, folio_factura, monto, fecha_factura, dias_credito)
      values (
        p_gasto, v_proveedor,
        coalesce(nullif(p_datos->>'folio_factura', ''), 'S/F'),
        v_monto,
        coalesce(nullif(p_datos->>'fecha', '')::date, public.hoy_hermosillo()),
        coalesce(v_dias, 0)
      );
    end if;
  else
    if v_pagado > 0 then
      raise exception 'Este gasto ya tiene % abonados en cuentas por pagar: no se puede pasar a contado', v_pagado;
    end if;
    delete from public.cuentas_por_pagar where gasto_id = p_gasto;
  end if;

  -- La observación se rehace igual que el material: el gasto cambió de monto,
  -- de proveedor o de producto, y el precio que enseñaba ya no es el bueno.
  delete from public.precios_material where gasto_id = p_gasto;
  perform public.observar_precios_de_gasto(p_gasto);

  -- Las dos obras se enteran: de la que salió y a la que llegó.
  update public.obras
     set fecha_ultima_actualizacion = now()
   where id in (v_obra_antes, v_obra);

  if v_obra is distinct from v_obra_antes and v_obra is not null then
    perform public.anotar_bitacora(v_obra, 'material',
      format('Gasto reasignado a esta OT: %s por %s',
             p_datos->>'descripcion', to_char(v_monto, 'FM$999,999,990.00')));
  end if;

  return p_gasto;
end $$;

-- ---------------------------------------------------------------------------
-- Ligar a mano un renglón huérfano
--
-- Es el único trabajo manual del sistema, y encoge cada semana: cada vez que se
-- resuelve uno, el alias queda aprendido y ese texto no vuelve a preguntar.
-- ---------------------------------------------------------------------------
create or replace function public.ligar_renglon(p_renglon uuid, p_producto uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_r record;
begin
  perform public.exigir_staff();

  select * into v_r from public.renglones_sin_ligar where id = p_renglon;
  if not found then raise exception 'Ese renglón ya no existe'; end if;

  -- Sin producto es «no es material»: se calla para siempre y no vuelve.
  if p_producto is null then
    update public.renglones_sin_ligar set resuelto = true where id = p_renglon;
    return null;
  end if;

  insert into public.producto_alias (producto_id, texto_norm, veces, origen)
  values (p_producto, v_r.texto_norm, 1, 'manual')
  on conflict (texto_norm) do update set
    producto_id = excluded.producto_id,
    origen      = 'manual';

  update public.renglones_sin_ligar
     set resuelto = true, producto_id = p_producto
   where id = p_renglon;

  -- La observación se rescata retroactivamente. Con gasto detrás se rehace por
  -- su misma puerta; sin él —los renglones que vienen del historial de obra— se
  -- arma con lo que el propio renglón guardó.
  if v_r.gasto_id is not null then
    update public.gastos set producto_id = p_producto
     where id = v_r.gasto_id and producto_id is null;
    perform public.observar_precios_de_gasto(v_r.gasto_id);
  elsif v_r.precio_neto is not null then
    insert into public.precios_material
      (producto_id, proveedor_id, fecha, precio_neto, unidad, origen, folio_factura, nota)
    values (p_producto, v_r.proveedor_id, v_r.fecha, v_r.precio_neto, v_r.unidad,
            'factura', v_r.folio_factura, 'Del historial de material de obra');
  end if;

  return p_producto;
end $$;

-- ---------------------------------------------------------------------------
-- RLS · el mismo patrón que las demás: staff escribe, contador lee
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'precios_material','producto_alias','renglones_sin_ligar'
  ] loop
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

grant execute on function public.normalizar_material(text),
                          public.hoy_hermosillo(),
                          public.producto_de_texto(text),
                          public.observar_precios_de_gasto(uuid),
                          public.observar_precio_historico(text, numeric, uuid, text, date, text),
                          public.ligar_renglon(uuid, uuid)
  to authenticated;
