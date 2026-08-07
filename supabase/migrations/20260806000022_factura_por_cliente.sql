-- ===========================================================================
-- QUIÉN FACTURA SE DECIDE EN EL CLIENTE
--
-- La cobranza estaba cobrando con IVA a todo el mundo, y hay clientes que no
-- facturan: a esos se les estaba pidiendo un 16% que nadie les va a cobrar. La
-- casilla «el cliente pide factura» ya existía en la cotización, pero nace
-- apagada cada vez y hay que acordarse de palomearla.
--
-- El dato de verdad vive en el cliente: éste factura, éste no. La cotización
-- lo hereda al elegirlo y se puede cambiar caso por caso, que también pasa.
--
-- Dos incoherencias de origen que se arreglan de paso:
--
--  1. `iva_pct` tenía default 16 mientras `requiere_factura` tenía default
--     falso. Cualquier renglón insertado sin pasar el IVA salía cobrando
--     impuesto con la casilla apagada. El default baja a 0: el IVA sólo entra
--     cuando alguien dice que sí.
--
--  2. La importación del Excel 2026 metió las ~200 cotizaciones del año con
--     iva_pct = 16 y requiere_factura = falso. El total generado llevaba el
--     16%, la cobranza pedía ese saldo y las etiquetas decían «Factura: No».
--     Aquí se separan las dos poblaciones: a quien ya se le cobró por encima
--     del neto sí se le facturó (se corrige la etiqueta, no el total, para no
--     dejar saldos en negativo); al resto se le quita el impuesto fantasma.
-- ===========================================================================

alter table public.clientes
  add column if not exists requiere_factura boolean not null default false;

comment on column public.clientes.requiere_factura is
  'Este cliente normalmente pide factura. Es el valor con el que nace una cotización suya; ahí se puede cambiar.';

alter table public.cotizaciones alter column iva_pct set default 0;

-- (1) Ya pagaron por encima del neto: la factura sí existió.
update public.cotizaciones c
   set requiere_factura = true
 where c.notas = 'Importado del Excel 2026'
   and c.iva_pct = 16
   and not c.requiere_factura
   and coalesce((select sum(p.monto) from public.pagos_cobranza p
                  where p.cotizacion_id = c.id), 0)
       > round(c.subtotal * (1 - c.descuento_pct / 100), 2);

-- (2) Al resto se le cae el IVA. `total` es columna generada: se recalcula
--     solo y v_cobranza deja de pedir un saldo inflado.
update public.cotizaciones
   set iva_pct = 0
 where notas = 'Importado del Excel 2026'
   and iva_pct = 16
   and not requiere_factura;

-- El cliente hereda lo que quedó dicho en sus cotizaciones: si alguna vez
-- facturó, es de los que facturan. Lo demás lo palomea Dirección a mano.
update public.clientes cl
   set requiere_factura = true
 where exists (select 1 from public.cotizaciones c
                where c.cliente_id = cl.id and c.requiere_factura);

-- ---------------------------------------------------------------------------
-- Los hijos de la cotización, aparte.
--
-- Procesos, partidas, desglose de herrería y materiales se reemplazan enteros
-- en cada guardado: el editor manda siempre el documento completo. Vive en su
-- propia función porque la cabecera y los hijos cambian por motivos distintos,
-- y así tocar uno no obliga a reescribir el otro.
-- ---------------------------------------------------------------------------
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

  -- Partidas sueltas, cada una con su unidad
  for v_bloque in select * from jsonb_array_elements(coalesce(p_datos->'items', '[]'::jsonb)) loop
    insert into public.cotizacion_items
      (cotizacion_id, descripcion, m2, unidad, precio_unitario, producto_id, orden)
    values (v_id,
            v_bloque->>'descripcion',
            nullif(v_bloque->>'m2', '')::numeric,
            nullif(v_bloque->>'unidad', ''),
            coalesce(nullif(v_bloque->>'precio_unitario', '')::numeric, 0),
            nullif(v_bloque->>'producto_id', '')::uuid,
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

-- Guardar una cotización sin decir nada del IVA ya no le inventa un 16%.
create or replace function public.guardar_cotizacion(p_id uuid, p_datos jsonb)
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
  if v_id is null then
    insert into public.cotizaciones (cliente_id, nombre_obra, domicilio_obra, tipo,
                                     requiere_factura, anticipo_pct, iva_pct, descuento_pct,
                                     vigencia_dias, viaticos, linea_calidad, notas, fecha, creado_por)
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
      notas            = nullif(p_datos->>'notas', ''),
      fecha            = coalesce(nullif(p_datos->>'fecha', '')::date, fecha)
    where id = v_id;

    if not found then
      raise exception 'La cotización % no existe o no tienes acceso', v_id;
    end if;
  end if;

  return public.guardar_cotizacion_hijos(v_id, p_datos);
end $$;
