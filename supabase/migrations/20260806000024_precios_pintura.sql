-- ===========================================================================
-- LA PINTURA Y SUS TRES PRECIOS
--
-- Cotizar pintura son dos decisiones que hoy se resuelven tecleando: qué
-- pintura se va a aplicar —seis, de dos marcas— y a qué precio de los tres que
-- manejan, según el cliente: público, especial y súper especial. Las cifras
-- que dieron de ejemplo para la premium eran 124, 114 y 104 por metro.
--
-- Las columnas se cuelgan de `productos` en vez de abrir una tabla nueva: el
-- catálogo, su pantalla y la liga desde la partida ya existen, y una tabla
-- aparte obligaría a repetir el nombre, la marca y las políticas.
--
-- Ojo con la disonancia: `costo`/`iva`/`precio_neto` son lo que cuesta comprar
-- la cubeta; estos tres son lo que se le cobra al cliente por metro aplicado.
-- Nulos = esa pintura no se ofrece en el cotizador.
-- ===========================================================================

alter table public.productos
  add column if not exists marca            text,
  add column if not exists precio_publico   numeric(14,2),
  add column if not exists precio_especial  numeric(14,2),
  add column if not exists precio_super     numeric(14,2);

comment on column public.productos.marca is
  'Agrupa las pinturas en el cotizador. Sólo se usa para eso.';
comment on column public.productos.precio_publico is
  'Lo que se cobra por m² aplicado con esta pintura, tarifa de público. Nada que ver con `costo`, que es lo que cuesta comprarla. Nulo = no se ofrece al cotizar.';
comment on column public.productos.precio_especial is
  'La misma tarifa, para el cliente que ya trabaja con ellos.';
comment on column public.productos.precio_super is
  'La misma tarifa, la más baja: obra grande o cliente de siempre.';

-- La partida recuerda con qué pintura y a qué tarifa se armó, para que al
-- reabrir la cotización el botón salga marcado. El precio guardado sigue
-- mandando: si alguien lo teclea a mano, el nivel se limpia y queda el número.
alter table public.cotizacion_items
  add column if not exists nivel_precio text
    check (nivel_precio in ('publico', 'especial', 'super'));

-- Los hijos de la cotización, con la pintura y la tarifa de cada partida.
create or replace function public.guardar_cotizacion_hijos(p_id uuid, p_datos jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id        uuid := p_id;
  v_bloque    jsonb;
  v_material  jsonb;
  v_desglose  uuid;
  v_precio    numeric(14,2);
  v_orden     integer := 0;
begin
  -- Se reemplazan los hijos: el editor manda siempre el documento completo.
  delete from public.cotizacion_materiales where cotizacion_id = v_id;
  delete from public.cotizacion_items       where cotizacion_id = v_id;
  delete from public.cotizacion_herreria_desglose where cotizacion_id = v_id;
  delete from public.cotizacion_procesos    where cotizacion_id = v_id;

  -- Bullets del proceso
  for v_bloque in select * from jsonb_array_elements(coalesce(p_datos->'procesos', '[]'::jsonb)) loop
    insert into public.cotizacion_procesos (cotizacion_id, texto_proceso_id, contenido_override, orden)
    values (v_id,
            nullif(v_bloque->>'texto_proceso_id', '')::uuid,
            v_bloque->>'contenido',
            coalesce((v_bloque->>'orden')::integer, 0));
  end loop;

  -- Partidas sueltas, cada una con su unidad, su pintura y su tarifa
  for v_bloque in select * from jsonb_array_elements(coalesce(p_datos->'items', '[]'::jsonb)) loop
    insert into public.cotizacion_items
      (cotizacion_id, descripcion, m2, unidad, precio_unitario, producto_id, nivel_precio, orden)
    values (v_id,
            v_bloque->>'descripcion',
            nullif(v_bloque->>'m2', '')::numeric,
            nullif(v_bloque->>'unidad', ''),
            coalesce(nullif(v_bloque->>'precio_unitario', '')::numeric, 0),
            nullif(v_bloque->>'producto_id', '')::uuid,
            nullif(v_bloque->>'nivel_precio', ''),
            v_orden);
    v_orden := v_orden + 1;
  end loop;

  -- Conceptos de herrería: cada uno genera su partida con el precio de venta.
  -- Van por pieza: el desglose ya calculó el precio de una.
  for v_bloque in select * from jsonb_array_elements(coalesce(p_datos->'desglose', '[]'::jsonb)) loop
    insert into public.cotizacion_herreria_desglose
      (cotizacion_id, concepto, mano_obra, gastos_indirectos_pct, utilidad_pct, orden)
    values (v_id,
            v_bloque->>'concepto',
            coalesce(nullif(v_bloque->>'mano_obra', '')::numeric, 0),
            coalesce(nullif(v_bloque->>'gastos_indirectos_pct', '')::numeric, 5),
            coalesce(nullif(v_bloque->>'utilidad_pct', '')::numeric, 35),
            v_orden)
    returning id into v_desglose;

    for v_material in select * from jsonb_array_elements(coalesce(v_bloque->'materiales', '[]'::jsonb)) loop
      insert into public.cotizacion_materiales
        (cotizacion_id, desglose_id, rubro, material, producto_id, piezas, costo, orden)
      values (v_id, v_desglose,
              coalesce((v_material->>'rubro')::rubro_material, 'herreria'),
              v_material->>'material',
              nullif(v_material->>'producto_id', '')::uuid,
              coalesce(nullif(v_material->>'piezas', '')::numeric, 1),
              coalesce(nullif(v_material->>'costo', '')::numeric, 0),
              coalesce((v_material->>'orden')::integer, 0));
    end loop;

    -- El trigger ya actualizó los materiales; ahora sí se conoce el precio.
    select precio_venta into v_precio
      from public.cotizacion_herreria_desglose where id = v_desglose;

    insert into public.cotizacion_items
      (cotizacion_id, desglose_id, descripcion, unidad, precio_unitario, orden)
    values (v_id, v_desglose, v_bloque->>'concepto', 'pza', coalesce(v_precio, 0), v_orden);

    v_orden := v_orden + 1;
  end loop;

  -- Materiales presupuestados sueltos (los de pintura)
  for v_material in select * from jsonb_array_elements(coalesce(p_datos->'materiales', '[]'::jsonb)) loop
    insert into public.cotizacion_materiales
      (cotizacion_id, rubro, material, producto_id, piezas, costo, orden)
    values (v_id,
            coalesce((v_material->>'rubro')::rubro_material, 'pintura'),
            v_material->>'material',
            nullif(v_material->>'producto_id', '')::uuid,
            coalesce(nullif(v_material->>'piezas', '')::numeric, 1),
            coalesce(nullif(v_material->>'costo', '')::numeric, 0),
            coalesce((v_material->>'orden')::integer, 0));
  end loop;

  return v_id;
end $$;

-- La copia se lleva también con qué pintura y a qué tarifa se armó cada partida.
create or replace function public.duplicar_cotizacion(p_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_nueva  uuid;
  v_fila   record;
  v_deng   uuid;
begin
  insert into public.cotizaciones
    (cliente_id, nombre_obra, domicilio_obra, tipo, requiere_factura, anticipo_pct,
     iva_pct, descuento_pct, viaticos, linea_calidad, notas, vigencia_dias, fecha, creado_por, estatus)
  select cliente_id,
         nombre_obra,
         domicilio_obra, tipo, requiere_factura, anticipo_pct,
         iva_pct, descuento_pct, viaticos, linea_calidad, notas, vigencia_dias,
         current_date, auth.uid(), 'borrador'
    from public.cotizaciones where id = p_id
  returning id into v_nueva;

  if v_nueva is null then
    raise exception 'La cotización % no existe o no tienes acceso', p_id;
  end if;

  insert into public.cotizacion_procesos (cotizacion_id, texto_proceso_id, contenido_override, orden)
  select v_nueva, texto_proceso_id, contenido_override, orden
    from public.cotizacion_procesos where cotizacion_id = p_id;

  -- Conceptos de herrería con sus materiales y su partida derivada
  for v_fila in
    select * from public.cotizacion_herreria_desglose where cotizacion_id = p_id order by orden
  loop
    insert into public.cotizacion_herreria_desglose
      (cotizacion_id, concepto, mano_obra, gastos_indirectos_pct, utilidad_pct, orden)
    values (v_nueva, v_fila.concepto, v_fila.mano_obra,
            v_fila.gastos_indirectos_pct, v_fila.utilidad_pct, v_fila.orden)
    returning id into v_deng;

    insert into public.cotizacion_materiales
      (cotizacion_id, desglose_id, rubro, material, producto_id, piezas, costo, orden)
    select v_nueva, v_deng, rubro, material, producto_id, piezas, costo, orden
      from public.cotizacion_materiales
     where cotizacion_id = p_id and desglose_id = v_fila.id;

    insert into public.cotizacion_items
      (cotizacion_id, desglose_id, descripcion, m2, unidad, precio_unitario, producto_id,
       nivel_precio, orden)
    select v_nueva, v_deng, descripcion, m2, unidad, precio_unitario, producto_id,
           nivel_precio, orden
      from public.cotizacion_items
     where cotizacion_id = p_id and desglose_id = v_fila.id;
  end loop;

  -- Partidas sueltas y materiales que no cuelgan de ningún concepto
  insert into public.cotizacion_items
    (cotizacion_id, descripcion, m2, unidad, precio_unitario, producto_id, nivel_precio, orden)
  select v_nueva, descripcion, m2, unidad, precio_unitario, producto_id, nivel_precio, orden
    from public.cotizacion_items
   where cotizacion_id = p_id and desglose_id is null;

  insert into public.cotizacion_materiales
    (cotizacion_id, rubro, material, producto_id, piezas, costo, orden)
  select v_nueva, rubro, material, producto_id, piezas, costo, orden
    from public.cotizacion_materiales
   where cotizacion_id = p_id and desglose_id is null;

  return v_nueva;
end $$;
