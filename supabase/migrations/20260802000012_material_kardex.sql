-- ===========================================================================
-- MATERIALES Y KARDEX DE LA MANO
-- 1) Quitar un renglón de material que salió del taller regresa la existencia
--    con un movimiento de reversa (el kardex nunca borra historia).
-- 2) Un gasto de material/herramienta puede dar entrada al inventario del
--    taller, creando el insumo si hace falta.
-- ===========================================================================

-- Liga del movimiento con el gasto que lo originó (auditoría e idempotencia)
alter table public.insumos_kardex
  add column gasto_id uuid references public.gastos(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Eliminar un renglón de material de la obra. Si el renglón salió del taller,
-- la cantidad regresa al kardex como entrada de reversa.
-- ---------------------------------------------------------------------------
create or replace function public.eliminar_material_obra(p_material uuid)
returns void
language plpgsql set search_path = public as $$
declare v_mat record;
begin
  perform public.exigir_staff();

  select * into v_mat from public.obra_materiales where id = p_material;
  if not found then raise exception 'El renglón de material no existe'; end if;

  if v_mat.es_taller and v_mat.producto_id is not null then
    insert into public.insumos_kardex (producto_id, tipo, cantidad, obra_id, notas, registrado_por)
    values (v_mat.producto_id, 'entrada', v_mat.piezas, v_mat.obra_id,
            format('Reversa: se quitó «%s» de la OT', v_mat.material), auth.uid());

    perform public.anotar_bitacora(v_mat.obra_id, 'material',
      format('Regresó al taller: %s de %s', v_mat.piezas, v_mat.material));
  end if;

  delete from public.obra_materiales where id = p_material;

  update public.obras set fecha_ultima_actualizacion = now() where id = v_mat.obra_id;
end $$;

-- ---------------------------------------------------------------------------
-- Entrada al inventario del taller desde un gasto. Si el insumo no existe,
-- se da de alta con el costo y proveedor del gasto. Sólo una entrada por gasto.
-- ---------------------------------------------------------------------------
create or replace function public.entrada_inventario_desde_gasto(
  p_gasto uuid,
  p_cantidad numeric,
  p_producto uuid default null,
  p_nombre text default null,
  p_unidad text default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_gasto    record;
  v_producto uuid := p_producto;
begin
  perform public.exigir_staff();

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad de entrada debe ser mayor a cero';
  end if;

  select * into v_gasto from public.gastos where id = p_gasto;
  if not found then raise exception 'El gasto no existe'; end if;

  if exists (select 1 from public.insumos_kardex k where k.gasto_id = p_gasto) then
    raise exception 'Este gasto ya dio entrada al inventario';
  end if;

  if v_producto is null then
    if coalesce(trim(p_nombre), '') = '' then
      raise exception 'Falta el nombre del insumo nuevo';
    end if;
    -- si ya hay un insumo con ese nombre, se reutiliza en vez de duplicarlo
    select id into v_producto from public.productos
     where tipo = 'insumo_taller' and lower(nombre) = lower(trim(p_nombre))
     limit 1;
    if v_producto is null then
      insert into public.productos (nombre, unidad, costo, proveedor_id, tipo)
      values (trim(p_nombre), coalesce(nullif(trim(p_unidad), ''), 'pza'),
              coalesce(v_gasto.costo_unitario, 0), v_gasto.proveedor_id, 'insumo_taller')
      returning id into v_producto;
    end if;
  elsif not exists (select 1 from public.productos where id = v_producto) then
    raise exception 'El insumo no existe';
  end if;

  insert into public.insumos_kardex
    (producto_id, tipo, cantidad, fecha, obra_id, gasto_id, notas, registrado_por)
  values
    (v_producto, 'entrada', p_cantidad, v_gasto.fecha, null, p_gasto,
     format('Entrada por gasto: %s%s', v_gasto.descripcion,
            case when v_gasto.folio_factura is not null
                 then ' · folio ' || v_gasto.folio_factura else '' end),
     auth.uid());

  return v_producto;
end $$;
