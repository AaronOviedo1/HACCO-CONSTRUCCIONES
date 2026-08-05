-- ===========================================================================
-- PAGAR VARIAS FACTURAS DE UN PROVEEDOR DE UNA SOLA VEZ
--
-- Se va con el proveedor a liquidar lo que se le debe y trae cinco facturas
-- vencidas. Hasta ahora había que abrir el diálogo de pago cinco veces, con el
-- riesgo de que la cuarta fallara y quedaran tres pagadas y dos no.
--
-- El lote es de un solo proveedor a propósito: así corresponde a un pago real
-- —una transferencia, un cheque— y el mensaje de confirmación puede decir a
-- quién y cuánto. Se valida aquí, no sólo en la pantalla.
--
-- Cada factura pasa por abonar_cxp, que ya sabe negarse si está cancelada, si
-- el monto no es positivo o si excede el saldo, y que sólo fija la fecha de
-- pago cuando la factura queda liquidada. Como todo corre en una transacción,
-- si una falla no se mueve ninguna.
-- ===========================================================================
create or replace function public.abonar_cxp_lote(
  p_pagos jsonb,                    -- [{ "id": uuid, "monto": numeric }, …]
  p_fecha date default current_date
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_pago       jsonb;
  v_proveedor  uuid;
  v_nombre     text;
  v_provs      integer;
  v_encontradas integer;
  v_cuantas    integer := jsonb_array_length(coalesce(p_pagos, '[]'::jsonb));
  v_pagado     numeric := 0;
  v_liquidadas integer := 0;
  v_resultado  jsonb;
  v_saldo      numeric;
begin
  perform public.exigir_staff();

  if v_cuantas = 0 then
    raise exception 'No hay facturas seleccionadas';
  end if;

  -- `min()` no sabe de uuid, así que el proveedor se toma de la primera fila.
  select count(distinct c.proveedor_id), count(*),
         (array_agg(c.proveedor_id))[1]
    into v_provs, v_encontradas, v_proveedor
    from public.cuentas_por_pagar c
   where c.id in (select (x->>'id')::uuid from jsonb_array_elements(p_pagos) x);

  if v_encontradas <> v_cuantas then
    raise exception 'Alguna de las facturas ya no existe o no tienes acceso';
  end if;

  if v_provs <> 1 then
    raise exception 'Un pago en lote es de un solo proveedor';
  end if;

  select nombre into v_nombre from public.proveedores where id = v_proveedor;

  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    v_resultado := public.abonar_cxp(
      (v_pago->>'id')::uuid,
      (v_pago->>'monto')::numeric,
      p_fecha
    );
    v_pagado := v_pagado + (v_pago->>'monto')::numeric;
    if (v_resultado->>'liquidada')::boolean then
      v_liquidadas := v_liquidadas + 1;
    end if;
  end loop;

  -- Lo que le sigue quedando a deber a ese proveedor después del pago.
  select coalesce(sum(c.saldo), 0) into v_saldo
    from public.cuentas_por_pagar c
   where c.proveedor_id = v_proveedor and not c.cancelada;

  return jsonb_build_object(
    'proveedor', coalesce(v_nombre, 'Proveedor'),
    'facturas', v_cuantas,
    'pagado', round(v_pagado, 2),
    'liquidadas', v_liquidadas,
    'saldo_restante', v_saldo
  );
end $$;

comment on function public.abonar_cxp_lote(jsonb, date) is
  'Abona varias facturas del mismo proveedor en una sola transacción, reusando abonar_cxp para cada una. Si alguna falla, no se abona ninguna.';

grant execute on function public.abonar_cxp_lote(jsonb, date) to authenticated;
