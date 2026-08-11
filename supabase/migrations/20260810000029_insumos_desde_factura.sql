-- ===========================================================================
-- LA FACTURA DE INSUMOS ENTRA AL TALLER, Y ES UNA SOLA CUENTA POR PAGAR
--
-- Al capturar una factura de material para el taller pasaba la mitad de lo que
-- debía: se abría la cuenta por pagar y los insumos nunca llegaban al kardex.
-- La entrada al inventario se pedía en una segunda vuelta desde el navegador,
-- que sólo existía para la captura de un artículo suelto; una factura partida
-- en conceptos no la ofrecía siquiera. Ahora la entrada viaja dentro del mismo
-- registro del gasto, así que ocurre o no ocurre junto con él.
--
-- Y de paso se junta lo que el proveedor cobra junto: una factura de cinco
-- renglones abría cinco cuentas por pagar con el mismo folio. La cuenta ahora
-- es de la factura —proveedor y folio—, y los gastos cuelgan de ella.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · El taller es lo que el kardex dice que hay
--
-- La vista sólo miraba los productos marcados como insumo de taller, así que
-- una cubeta de pintura comprada para stock movía el kardex y no se veía en
-- ninguna pantalla. Cambiarle el tipo al producto no era la salida: lo sacaría
-- de la lista de precios. Si tiene movimientos, es existencia.
-- ---------------------------------------------------------------------------
drop view if exists public.v_insumos_existencia;

create view public.v_insumos_existencia with (security_invoker = on) as
select p.id            as producto_id,
       p.nombre,
       p.codigo,
       p.unidad,
       p.costo,
       p.iva,
       p.precio_neto,
       coalesce(sum(case when k.tipo = 'entrada' then k.cantidad else -k.cantidad end), 0) as existencia,
       max(k.fecha) as ultimo_movimiento
  from public.productos p
  left join public.insumos_kardex k on k.producto_id = p.id
 where p.tipo = 'insumo_taller'
    or exists (select 1 from public.insumos_kardex x where x.producto_id = p.id)
 group by p.id;

comment on view public.v_insumos_existencia is
  'Existencia del taller: los insumos del catálogo más cualquier producto con movimientos de kardex.';

-- ---------------------------------------------------------------------------
-- 2 · La cuenta por pagar es de la factura, no del renglón
--
-- La liga vivía del lado equivocado: cuentas_por_pagar.gasto_id amarraba la
-- cuenta a un solo gasto. Se invierte —cada gasto sabe a qué cuenta pertenece—
-- y así varios renglones de la misma factura comparten una. La columna vieja
-- se queda como dato de quién la abrió, ya sin uso.
-- ---------------------------------------------------------------------------
alter table public.gastos
  add column if not exists cxp_id uuid references public.cuentas_por_pagar(id) on delete set null;

create index if not exists gastos_cxp on public.gastos (cxp_id);

-- Quién manda en la cuenta: las que nacen de gastos las cuadra el sistema y se
-- van cuando se queda sin renglones; las capturadas a mano no se tocan nunca.
alter table public.cuentas_por_pagar
  add column if not exists automatica boolean not null default false;

-- Lo ya capturado: cada cuenta vieja apunta a su gasto único.
update public.gastos g
   set cxp_id = c.id
  from public.cuentas_por_pagar c
 where c.gasto_id = g.id
   and g.cxp_id is null;

update public.cuentas_por_pagar
   set automatica = true
 where gasto_id is not null
   and not automatica;

-- Para encontrar la cuenta de una factura al vuelo. Sin unique a propósito: ya
-- hay folios repetidos de lo que se importó del Excel —un índice único ni se
-- podría crear— y el alta manual tiene permitido convivir con la automática.
create index if not exists cxp_por_factura
  on public.cuentas_por_pagar (proveedor_id, upper(trim(folio_factura)))
  where automatica and not cancelada;

comment on column public.gastos.cxp_id is
  'A qué cuenta por pagar pertenece este gasto. Varios renglones de una factura comparten una.';
comment on column public.cuentas_por_pagar.automatica is
  'true = la cuadra el sistema desde los gastos de la factura; false = capturada a mano.';

-- ---------------------------------------------------------------------------
-- 3 · Cuadrar una cuenta contra sus gastos
--
-- El total sale siempre de la suma de los renglones, no de sumas y restas
-- sueltas: así no acumula desfases y se corrige sola si algo quedó torcido.
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_cxp(p_cxp uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_cxp    record;
  v_total  numeric;
  v_gastos integer;
begin
  if p_cxp is null then return; end if;

  -- Se aparta la fila: dos conceptos de la misma factura capturados al mismo
  -- tiempo cuadrarían el total cada uno con la mitad de los renglones a la vista.
  select * into v_cxp from public.cuentas_por_pagar where id = p_cxp for update;
  if not found then return; end if;

  -- Una cuenta capturada a mano trae su propio total, tecleado por alguien: no
  -- es de este sistema recalcularlo.
  if not v_cxp.automatica then return; end if;

  select count(*), coalesce(sum(monto), 0)
    into v_gastos, v_total
    from public.gastos where cxp_id = p_cxp;

  if v_gastos = 0 then
    if v_cxp.monto_pagado > 0 then
      raise exception 'La factura % ya tiene % abonados: no se puede quedar sin renglones',
        v_cxp.folio_factura, to_char(v_cxp.monto_pagado, 'FM$999,999,990.00');
    end if;
    delete from public.cuentas_por_pagar where id = p_cxp;
    return;
  end if;

  if v_total < v_cxp.monto_pagado then
    raise exception 'La factura % ya tiene % abonados: su total no puede bajar a %',
      v_cxp.folio_factura,
      to_char(v_cxp.monto_pagado, 'FM$999,999,990.00'),
      to_char(v_total, 'FM$999,999,990.00');
  end if;

  update public.cuentas_por_pagar set
    monto         = v_total,
    -- La fecha de la factura es la del renglón más viejo: de ahí cuenta el plazo.
    fecha_factura = coalesce(
      (select min(g.fecha) from public.gastos g where g.cxp_id = p_cxp),
      fecha_factura
    ),
    -- Si la factura creció y volvió a quedar saldo, deja de estar pagada.
    fecha_pago    = case when v_cxp.monto_pagado >= v_total then fecha_pago else null end
  where id = p_cxp;
end $$;

comment on function public.recalcular_cxp(uuid) is
  'Cuadra el total de una cuenta automática con sus gastos. La borra si se queda sin renglones.';

-- ---------------------------------------------------------------------------
-- 4 · Acomodar un gasto en la cuenta de su factura
--
-- Sirve igual para el gasto que acaba de nacer y para el que se corrigió: puede
-- cambiar de factura, de proveedor o dejar de ser a crédito, y en los tres
-- casos hay que sacarlo de donde estaba y cuadrar las dos cuentas.
-- ---------------------------------------------------------------------------
create or replace function public.ligar_gasto_a_cxp(p_gasto uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_g     record;
  v_folio text;
  v_vieja uuid;
  v_nueva uuid;
  v_dias  integer;
begin
  select * into v_g from public.gastos where id = p_gasto;
  if not found then return null; end if;

  v_vieja := v_g.cxp_id;

  -- De contado, o sin proveedor, no hay a quién pagarle a plazo.
  if v_g.condicion <> 'credito' or v_g.proveedor_id is null then
    if v_vieja is not null then
      update public.gastos set cxp_id = null where id = p_gasto;
      perform public.recalcular_cxp(v_vieja);
    end if;
    return null;
  end if;

  v_folio := nullif(trim(coalesce(v_g.folio_factura, '')), '');

  -- «S/F» es el relleno que esta misma función le pone a lo que llega sin folio:
  -- si alguien lo teclea, no debe pegar su gasto con los que no traen ninguno.
  if v_folio is not null and upper(v_folio) = 'S/F' then
    v_folio := null;
  end if;

  if v_folio is not null then
    -- Con folio, todos los renglones de la misma factura caen en la misma
    -- cuenta. Tres cosas se quedan fuera: las capturadas a mano —ya traen el
    -- total de la factura y sumarles lo duplicaría—, las canceladas y las que
    -- ya se pagaron, porque revivir una cuenta que el contador cerró reescribe
    -- historia; un renglón tardío abre la suya y se ve que algo pasó.
    select c.id into v_nueva
      from public.cuentas_por_pagar c
     where c.proveedor_id = v_g.proveedor_id
       and upper(trim(c.folio_factura)) = upper(v_folio)
       and c.automatica
       and not c.cancelada
       and (c.saldo > 0 or c.id = v_vieja)
     order by c.created_at
     limit 1
       for update;
  elsif v_vieja is not null then
    -- Sin folio no hay identidad de factura, así que cada gasto lleva la suya:
    -- se queda en la que tenía sólo si no la comparte con nadie.
    if (select count(*) from public.gastos where cxp_id = v_vieja) = 1
       and exists (select 1 from public.cuentas_por_pagar
                    where id = v_vieja and automatica and not cancelada) then
      v_nueva := v_vieja;
    end if;
  end if;

  if v_nueva is null then
    select dias_credito_default into v_dias
      from public.proveedores where id = v_g.proveedor_id;

    insert into public.cuentas_por_pagar
      (gasto_id, proveedor_id, folio_factura, monto, fecha_factura, dias_credito, automatica)
    values
      (p_gasto, v_g.proveedor_id, coalesce(v_folio, 'S/F'), 0, v_g.fecha,
       coalesce(v_dias, 0), true)
    returning id into v_nueva;
  end if;

  if v_nueva is distinct from v_vieja then
    update public.gastos set cxp_id = v_nueva where id = p_gasto;
    perform public.recalcular_cxp(v_vieja);
  end if;

  -- Quién es la cuenta —proveedor y folio— se decide al abrirla, y ya no se
  -- toca si varios conceptos la comparten: corregirle el folio a uno le
  -- renombraría la factura a todos sus hermanos, y basta un dedazo de
  -- minúsculas para que A682964 aparezca como a682964. Cuando es el único
  -- renglón sí se ajusta, que es la forma legítima de corregir el dedazo.
  if (select count(*) from public.gastos where cxp_id = v_nueva) = 1 then
    update public.cuentas_por_pagar set
      proveedor_id  = v_g.proveedor_id,
      folio_factura = coalesce(v_folio, 'S/F')
    where id = v_nueva;
  end if;

  perform public.recalcular_cxp(v_nueva);
  return v_nueva;
end $$;

comment on function public.ligar_gasto_a_cxp(uuid) is
  'Mete un gasto a crédito en la cuenta de su factura (proveedor + folio), creándola si hace falta.';

-- ---------------------------------------------------------------------------
-- 5 · El trigger delega: un gasto nuevo se acomoda como cualquier otro
-- ---------------------------------------------------------------------------
create or replace function public.tg_gasto_genera_cxp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.condicion = 'credito' and new.proveedor_id is not null then
    perform public.ligar_gasto_a_cxp(new.id);
  end if;

  -- todo gasto ligado a una OT alimenta su material consumido REAL
  if new.obra_id is not null then
    update public.obras set fecha_ultima_actualizacion = now() where id = new.obra_id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 6 · Registrar el gasto, con su entrada al taller
--
-- La entrada al inventario se hacía en una segunda llamada desde el navegador,
-- y la captura por conceptos nunca la hacía: la factura quedaba guardada y el
-- taller sin su material. Aquí va dentro, junto al material de obra, para que
-- gasto, cuenta por pagar y kardex se muevan en la misma transacción.
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

  -- Compra para el stock del taller: la existencia sube en el mismo movimiento
  -- que el gasto, no en una segunda vuelta que podía no llegar nunca.
  if coalesce((p_datos->>'al_inventario')::boolean, false) then
    perform public.entrada_inventario_desde_gasto(
      v_gasto,
      coalesce(nullif(p_datos->>'inventario_cantidad', '')::numeric, v_piezas),
      nullif(p_datos->>'inventario_producto_id', '')::uuid,
      coalesce(nullif(p_datos->>'inventario_nombre', ''), p_datos->>'descripcion'),
      nullif(p_datos->>'inventario_unidad', '')
    );
  end if;

  -- Lo que se acaba de pagar es, a partir de hoy, el precio que se conoce.
  perform public.observar_precios_de_gasto(v_gasto);

  return v_gasto;
end $$;

-- ---------------------------------------------------------------------------
-- 7 · Corregir un gasto: la cuenta por pagar se reacomoda sola
--
-- Antes esto pisaba el total de la cuenta con el importe de un solo renglón.
-- Con la cuenta compartida, quien decide es ligar_gasto_a_cxp: saca el gasto de
-- donde estaba, lo mete donde va y cuadra las dos.
-- ---------------------------------------------------------------------------
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
  v_obra_antes uuid;
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
    condicion        = coalesce((p_datos->>'condicion')::condicion_compra, 'contado'),
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

  -- Cuenta por pagar. El trigger sólo acomoda al insertar, así que al corregir
  -- hay que volver a acomodarlo: la guarda de abonos vive en recalcular_cxp.
  perform public.ligar_gasto_a_cxp(p_gasto);

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
-- 8 · Borrar un gasto sin dejar rastros torcidos
--
-- Se hacía con tres deletes sueltos desde el servidor, y el kardex no era uno
-- de ellos: la existencia del taller se quedaba inflada con material que ya no
-- se había comprado, y el gasto tampoco podía volver a dar entrada. Aquí va
-- todo junto, y la cuenta de la factura baja a lo que de verdad se debe.
-- ---------------------------------------------------------------------------
create or replace function public.eliminar_gasto(p_gasto uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_g     record;
  v_cxp   uuid;
  v_mov   record;
  v_hay   numeric;
begin
  perform public.exigir_staff();

  select * into v_g from public.gastos where id = p_gasto;
  if not found then raise exception 'Ese gasto ya no existe'; end if;

  v_cxp := v_g.cxp_id;

  -- La entrada al taller se deshace. Si lo que entró ya salió a una obra, la
  -- existencia no alcanza: mejor avisar que dejar el inventario en negativo.
  for v_mov in
    select k.producto_id, sum(k.cantidad) as cantidad, min(p.nombre) as nombre
      from public.insumos_kardex k
      join public.productos p on p.id = k.producto_id
     where k.gasto_id = p_gasto and k.tipo = 'entrada'
     group by k.producto_id
  loop
    select coalesce(sum(case when tipo = 'entrada' then cantidad else -cantidad end), 0)
      into v_hay
      from public.insumos_kardex where producto_id = v_mov.producto_id;

    if v_hay - v_mov.cantidad < 0 then
      -- El rtrim quita el punto que FM deja colgando cuando no hay decimales.
      raise exception 'De «%» ya se usaron %: quita primero esas salidas del taller',
        v_mov.nombre, rtrim(to_char(v_mov.cantidad - v_hay, 'FM999,990.99'), '.');
    end if;
  end loop;

  delete from public.insumos_kardex where gasto_id = p_gasto;
  delete from public.obra_materiales where gasto_id = p_gasto;

  -- Sale de su factura antes de desaparecer, para que la cuenta se quede con lo
  -- que de verdad se le debe al proveedor. Los precios observados se van solos.
  update public.gastos set cxp_id = null where id = p_gasto;
  delete from public.gastos where id = p_gasto;
  perform public.recalcular_cxp(v_cxp);

  if v_g.obra_id is not null then
    update public.obras set fecha_ultima_actualizacion = now() where id = v_g.obra_id;
  end if;
end $$;

comment on function public.eliminar_gasto(uuid) is
  'Borra un gasto y todo lo que dejó: kardex del taller, material de obra y su parte de la factura.';

-- ---------------------------------------------------------------------------
-- 9 · Las vistas de la cuenta se rehacen para que se vea la columna nueva
--
-- v_cuentas_por_pagar se escribió con `c.*` y Postgres congela esa expansión al
-- crearla: sin rehacerla, `automatica` no llegaría a la pantalla y el importe de
-- una factura armada con gastos se dejaría corregir a mano para nada. Y de paso
-- se cuenta de cuántos renglones sale, que es lo que hay que decirle a quien la
-- mire. v_cxp_por_proveedor cuelga de ella, así que se rehacen las dos.
-- ---------------------------------------------------------------------------
drop view if exists public.v_cxp_por_proveedor;
drop view if exists public.v_cuentas_por_pagar;

create view public.v_cuentas_por_pagar with (security_invoker = on) as
select c.*,
       pr.nombre as proveedor,
       (c.vencimiento - current_date) as dias_restantes,
       (select count(*) from public.gastos g where g.cxp_id = c.id)::int as gastos,
       case
         when c.cancelada                                   then 'cancelada'
         when c.saldo <= 0                                  then 'pagada'
         when c.vencimiento <  current_date                 then 'vencida'
         when c.vencimiento <= current_date + 3             then 'urgente'
         when c.vencimiento <= current_date + 15            then 'proxima'
         else 'al_corriente'
       end as estado
  from public.cuentas_por_pagar c
  join public.proveedores pr on pr.id = c.proveedor_id;

create view public.v_cxp_por_proveedor with (security_invoker = on) as
select pr.id as proveedor_id,
       pr.nombre as proveedor,
       pr.dias_credito_default,
       coalesce(sum(v.saldo), 0)                                                   as saldo_total,
       coalesce(sum(v.saldo) filter (where v.estado = 'vencida'), 0)               as vencido,
       coalesce(sum(v.saldo) filter (where v.estado in ('urgente','proxima')), 0)  as por_vencer
  from public.proveedores pr
  left join public.v_cuentas_por_pagar v
         on v.proveedor_id = pr.id and v.estado not in ('pagada','cancelada')
 group by pr.id;

grant select on public.v_insumos_existencia,
               public.v_cuentas_por_pagar,
               public.v_cxp_por_proveedor
  to authenticated;

grant execute on function public.recalcular_cxp(uuid),
                          public.ligar_gasto_a_cxp(uuid),
                          public.eliminar_gasto(uuid),
                          public.entrada_inventario_desde_gasto(uuid, numeric, uuid, text, text),
                          public.eliminar_material_obra(uuid),
                          public.editar_gasto(uuid, jsonb)
  to authenticated;
