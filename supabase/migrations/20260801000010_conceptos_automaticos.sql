-- ============================================================================
-- HaacoPro · Migración 010 · Conceptos de la obra desde la cotización
--
-- Al aprobar, la OT nace con sus conceptos: cada concepto del cotizador de
-- herrería entra con su presupuesto de costo (el costo_total del desglose) y
-- cada partida de pintura entra como concepto sin presupuesto, listo para
-- clasificar gastos y materiales sin capturarlos a mano.
-- ============================================================================

create or replace function public.aprobar_cotizacion(
  p_id uuid,
  p_obras jsonb,
  p_anticipo_pct numeric default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_cot      record;
  v_bloque   jsonb;
  v_obra     uuid;
  v_primera  uuid;
  v_creadas  jsonb := '[]'::jsonb;
  v_numero   text;
begin
  select * into v_cot from public.cotizaciones where id = p_id;
  if not found then
    raise exception 'La cotización % no existe o no tienes acceso', p_id;
  end if;
  if v_cot.estatus = 'aprobada' then
    raise exception 'La cotización % ya estaba aprobada', v_cot.folio;
  end if;
  if jsonb_array_length(coalesce(p_obras, '[]'::jsonb)) = 0 then
    raise exception 'Hay que crear al menos una orden de trabajo';
  end if;

  update public.cotizaciones
     set estatus = 'aprobada',
         fecha_resolucion = current_date,
         anticipo_pct = coalesce(p_anticipo_pct, anticipo_pct)
   where id = p_id;

  for v_bloque in select * from jsonb_array_elements(p_obras) loop
    insert into public.obras
      (cotizacion_id, nombre, domicilio, monto_cotizado, fecha_estimada_entrega, estatus)
    values (p_id,
            v_bloque->>'nombre',
            coalesce(nullif(v_bloque->>'domicilio', ''), v_cot.domicilio_obra),
            coalesce(nullif(v_bloque->>'monto', '')::numeric, 0),
            nullif(v_bloque->>'fecha_estimada_entrega', '')::date,
            'agendada')
    returning id, ot_numero into v_obra, v_numero;

    v_primera := coalesce(v_primera, v_obra);
    v_creadas := v_creadas || jsonb_build_object(
      'id', v_obra, 'ot_numero', v_numero, 'nombre', v_bloque->>'nombre');
  end loop;

  -- El presupuesto de materiales entra a la primera OT como origen 'cotizado';
  -- desde la OT se puede repartir entre conceptos más adelante.
  insert into public.obra_materiales (obra_id, origen, material, producto_id, piezas, costo)
  select v_primera, 'cotizado', m.material, m.producto_id, m.piezas, m.costo
    from public.cotizacion_materiales m
   where m.cotizacion_id = p_id;

  -- La OT nace con sus conceptos: los del cotizador de herrería traen su
  -- presupuesto de costo; las partidas de pintura entran sin presupuesto,
  -- sólo para clasificar. Van después de los de herrería.
  insert into public.obra_conceptos (obra_id, nombre, presupuesto, orden)
  select v_primera, d.concepto, d.costo_total, d.orden
    from public.cotizacion_herreria_desglose d
   where d.cotizacion_id = p_id;

  insert into public.obra_conceptos (obra_id, nombre, presupuesto, orden)
  select v_primera, i.descripcion, 0, 100 + i.orden
    from public.cotizacion_items i
   where i.cotizacion_id = p_id
     and i.desglose_id is null;

  return jsonb_build_object(
    'folio', v_cot.folio,
    'anticipo_esperado', round(v_cot.total * coalesce(p_anticipo_pct, v_cot.anticipo_pct, 50) / 100, 2),
    'obras', v_creadas
  );
end $$;
