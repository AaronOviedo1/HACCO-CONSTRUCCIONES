-- ===========================================================================
-- LOS TÉRMINOS Y CONDICIONES DE LA COTIZACIÓN
--
-- Dirección los pidió editables. Hoy no hay dónde: el pie del PDF son cuatro
-- renglones que arma el código (precios más IVA, anticipo, garantía, vigencia)
-- y el único texto libre que sale en la hoja es `linea_calidad`, un párrafo de
-- una línea pensado para «se usarán productos de la más alta calidad». Ahí
-- acabaron pegando el bloque legal entero —se ve en cotizaciones de agosto—,
-- así que sale en italica y a media hoja, encima de la tabla, que no es su
-- sitio.
--
-- Se le abre columna propia. Va en la cotización y no sólo en `ajustes` porque
-- lo que se le mandó a un cliente en agosto tiene que seguir diciendo lo que
-- decía en agosto aunque mañana se cambie el texto de la casa: el PDF se
-- regenera desde la fila.
-- ===========================================================================

alter table public.cotizaciones
  add column if not exists terminos text;

comment on column public.cotizaciones.terminos is
  'Términos y condiciones al pie del PDF, tal como se le mandaron a ESTE cliente. Nace del ajuste `terminos_cotizacion` y se puede cambiar en cada cotización; nulo = no se imprime el bloque.';

-- ---------------------------------------------------------------------------
-- El texto de la casa
--
-- El predeterminado se siembra de lo que ellos ya venían escribiendo a mano en
-- la línea de calidad —el más reciente que empiece por «TÉRMINOS Y
-- CONDICIONES»—; si no hubiera ninguno, entra el de fábrica. Así el primero
-- que abra una cotización nueva se encuentra su propio texto y no uno inventado
-- que tendría que volver a teclear.
--
-- Las cotizaciones viejas NO se tocan: su bloque sigue donde está y diciendo
-- lo que decía. Mover ese texto de columna cambiaría documentos ya enviados.
-- ---------------------------------------------------------------------------
insert into public.ajustes (clave, valor)
select 'terminos_cotizacion', to_jsonb(coalesce(
  (select linea_calidad
     from public.cotizaciones
    where linea_calidad ilike 'TÉRMINOS Y CONDICIONES%'
       or linea_calidad ilike 'TERMINOS Y CONDICIONES%'
    order by fecha desc, created_at desc
    limit 1),
  'Esta oferta es válida por los días de vigencia indicados. Los precios no incluyen '
  'reparaciones de base o estructura. No somos responsables por fallas estructurales o '
  'problemas existentes en el área de trabajo. El cliente deberá proporcionar condiciones '
  'adecuadas de seguridad, acceso y superficie para la ejecución de los trabajos.'))
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- Guardar y duplicar, con los términos a cuestas.
--
-- Sólo cambia el renglón de `terminos` en cada una; el resto va tal cual venía
-- de 20260806000022 y 20260806000024.
-- ---------------------------------------------------------------------------
create or replace function public.guardar_cotizacion(p_id uuid, p_datos jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := p_id;
begin
  if v_id is null then
    insert into public.cotizaciones (cliente_id, nombre_obra, domicilio_obra, tipo,
                                     requiere_factura, anticipo_pct, iva_pct, descuento_pct,
                                     vigencia_dias, viaticos, linea_calidad, terminos, notas,
                                     fecha, creado_por)
    values (
      (p_datos->>'cliente_id')::uuid,
      nullif(p_datos->>'nombre_obra', ''),
      nullif(p_datos->>'domicilio_obra', ''),
      coalesce((p_datos->>'tipo')::tipo_cotizacion, 'pintura'),
      coalesce((p_datos->>'requiere_factura')::boolean, false),
      nullif(p_datos->>'anticipo_pct', '')::numeric,
      coalesce(nullif(p_datos->>'iva_pct', '')::numeric, 0),
      coalesce(nullif(p_datos->>'descuento_pct', '')::numeric, 0),
      coalesce(nullif(p_datos->>'vigencia_dias', '')::integer, 30),
      coalesce(nullif(p_datos->>'viaticos', '')::numeric, 0),
      nullif(p_datos->>'linea_calidad', ''),
      nullif(p_datos->>'terminos', ''),
      nullif(p_datos->>'notas', ''),
      coalesce(nullif(p_datos->>'fecha', '')::date, current_date),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.cotizaciones set
      cliente_id       = (p_datos->>'cliente_id')::uuid,
      nombre_obra      = nullif(p_datos->>'nombre_obra', ''),
      domicilio_obra   = nullif(p_datos->>'domicilio_obra', ''),
      tipo             = coalesce((p_datos->>'tipo')::tipo_cotizacion, tipo),
      requiere_factura = coalesce((p_datos->>'requiere_factura')::boolean, false),
      anticipo_pct     = coalesce(nullif(p_datos->>'anticipo_pct', '')::numeric, anticipo_pct),
      iva_pct          = coalesce(nullif(p_datos->>'iva_pct', '')::numeric, iva_pct),
      descuento_pct    = coalesce(nullif(p_datos->>'descuento_pct', '')::numeric, 0),
      vigencia_dias    = coalesce(nullif(p_datos->>'vigencia_dias', '')::integer, vigencia_dias),
      viaticos         = coalesce(nullif(p_datos->>'viaticos', '')::numeric, 0),
      linea_calidad    = nullif(p_datos->>'linea_calidad', ''),
      terminos         = nullif(p_datos->>'terminos', ''),
      notas            = nullif(p_datos->>'notas', ''),
      fecha            = coalesce(nullif(p_datos->>'fecha', '')::date, fecha)
    where id = v_id;

    if not found then
      raise exception 'La cotización % no existe o no tienes acceso', v_id;
    end if;
  end if;

  return public.guardar_cotizacion_hijos(v_id, p_datos);
end $$;

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
     iva_pct, descuento_pct, viaticos, linea_calidad, terminos, notas, vigencia_dias,
     fecha, creado_por, estatus)
  select cliente_id,
         nombre_obra,
         domicilio_obra, tipo, requiere_factura, anticipo_pct,
         iva_pct, descuento_pct, viaticos, linea_calidad, terminos, notas, vigencia_dias,
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
