-- ===========================================================================
-- EDITAR UN GASTO YA REGISTRADO
--
-- Hasta hoy un gasto sólo se podía borrar y volver a capturar, y eso obligaba a
-- perder la foto del ticket y a rehacer la cuenta por pagar. Lo que más pasa es
-- lo de siempre: se cargó como general y era de una OT, o se cargó a la OT
-- equivocada.
--
-- Editar no es sólo un update: el gasto se ramifica al guardarse —material REAL
-- de la obra y cuenta por pagar si va a crédito—, así que al cambiarlo hay que
-- rehacer las dos ramas. El material se borra y se vuelve a poner donde toca;
-- la cuenta por pagar se ajusta, y no se deja tocar si ya tiene abonos por
-- encima del monto nuevo.
-- ===========================================================================

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
      (obra_id, concepto_id, origen, material, piezas, costo, folio_factura, es_taller, gasto_id)
    values (
      v_obra,
      nullif(p_datos->>'concepto_id', '')::uuid,
      'real',
      p_datos->>'descripcion',
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
        coalesce(nullif(p_datos->>'fecha', '')::date, current_date),
        coalesce(v_dias, 0)
      );
    end if;
  else
    if v_pagado > 0 then
      raise exception 'Este gasto ya tiene % abonados en cuentas por pagar: no se puede pasar a contado', v_pagado;
    end if;
    delete from public.cuentas_por_pagar where gasto_id = p_gasto;
  end if;

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
