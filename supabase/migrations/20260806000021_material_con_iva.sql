-- ===========================================================================
-- EL MATERIAL DE LA OBRA SE CARGA CON IVA
--
-- Todo lo que compra el taller se paga con IVA: no hay proveedor que les
-- facture sin él. Pero al sacar un insumo a una OT se estaba asentando el
-- `costo` del catálogo, que es el precio sin impuesto, así que el material
-- consumido de la obra salía por debajo de lo que de verdad costó y la utilidad
-- se veía mejor de lo que era.
--
-- El catálogo ya guarda las tres cifras (costo, iva, precio_neto). Lo que
-- cambia es cuál se copia: la que se pagó. El `coalesce` es para los productos
-- viejos que se dieron de alta sin desglose.
--
-- Ojo: esto no reescribe el material ya cargado. Lo que quedó abajo se corrige
-- a mano desde la OT si vale la pena; de aquí en adelante entra bien.
-- ===========================================================================

create or replace function public.salida_a_obra(
  p_producto uuid,
  p_obra uuid,
  p_cantidad numeric,
  p_concepto uuid default null,
  p_notas text default null
)
returns uuid
language plpgsql set search_path = public as $$
declare
  v_producto  record;
  v_existencia numeric;
  v_material  uuid;
begin
  perform public.exigir_staff();

  select * into v_producto from public.productos where id = p_producto;
  if not found then raise exception 'El insumo no existe'; end if;

  select coalesce(sum(case when tipo = 'entrada' then cantidad else -cantidad end), 0)
    into v_existencia from public.insumos_kardex where producto_id = p_producto;

  if v_existencia < p_cantidad then
    raise exception 'Sólo hay % % de % en el taller', v_existencia, v_producto.unidad, v_producto.nombre;
  end if;

  insert into public.insumos_kardex (producto_id, tipo, cantidad, obra_id, notas, registrado_por)
  values (p_producto, 'salida', p_cantidad, p_obra,
          coalesce(p_notas, 'Salida a obra'), auth.uid());

  insert into public.obra_materiales
    (obra_id, concepto_id, origen, material, producto_id, piezas, costo, es_taller)
  values (p_obra, p_concepto, 'real', v_producto.nombre, p_producto,
          p_cantidad, coalesce(v_producto.precio_neto, v_producto.costo), true)
  returning id into v_material;

  perform public.anotar_bitacora(p_obra, 'material',
    format('Salió del taller: %s %s de %s', p_cantidad, v_producto.unidad, v_producto.nombre));

  update public.obras set fecha_ultima_actualizacion = now() where id = p_obra;

  return v_material;
end $$;
