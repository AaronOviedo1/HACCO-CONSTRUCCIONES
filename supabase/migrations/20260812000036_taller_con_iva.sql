-- ===========================================================================
-- EL MATERIAL QUE SALE DEL TALLER ENTRA POR LO QUE COSTÓ, AHORA SÍ
--
-- Esto ya se había arreglado el 6 de agosto (migración 021)... en la función
-- equivocada: se escribió `salida_a_obra`, que no existe en ningún lado y que
-- nadie llama. La que la aplicación usa de verdad se llama
-- `salida_taller_a_obra` y siguió copiando `productos.costo`, el precio sin
-- impuesto. Por eso el cliente lo sigue viendo mal: nunca se aplicó.
--
-- Aquí se corrige la buena, se borra la huérfana para que no vuelva a confundir
-- a nadie, y se enderezan los renglones que ya habían entrado abajo.
--
-- Un detalle que la 021 traía mal y aquí no se repite: `precio_neto` no admite
-- nulos —es `not null default 0`—, así que un `coalesce` pelón no protege a los
-- insumos sin desglose (los que da de alta sola una factura), los deja en cero.
-- Va con `nullif(..., 0)`.
-- ===========================================================================

create or replace function public.salida_taller_a_obra(
  p_obra uuid,
  p_producto uuid,
  p_cantidad numeric,
  p_concepto uuid default null,
  p_notas text default null
) returns uuid
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

  -- El precio neto: lo que se pagó por la pieza, IVA dentro. Es el mismo que el
  -- diálogo le acaba de enseñar a quien captura («$X c/u con IVA»), y hasta hoy
  -- no era el que quedaba guardado.
  insert into public.obra_materiales
    (obra_id, concepto_id, origen, material, producto_id, piezas, costo, es_taller)
  values (p_obra, p_concepto, 'real', v_producto.nombre, p_producto,
          p_cantidad, coalesce(nullif(v_producto.precio_neto, 0), v_producto.costo), true)
  returning id into v_material;

  perform public.anotar_bitacora(p_obra, 'material',
    format('Salió del taller: %s %s de %s', p_cantidad, v_producto.unidad, v_producto.nombre));

  update public.obras set fecha_ultima_actualizacion = now() where id = p_obra;

  return v_material;
end $$;

-- La huérfana de la migración 021. Nunca se llamó desde ningún lado.
drop function if exists public.salida_a_obra(uuid, uuid, numeric, uuid, text);

-- ---------------------------------------------------------------------------
-- LO QUE YA HABÍA ENTRADO ABAJO
--
-- Cada renglón de taller guarda de qué insumo salió, así que se puede cruzar
-- contra el catálogo y recuperar el impuesto que le faltó. Dos caminos, en
-- orden: si el catálogo sigue en el mismo precio que se copió, su neto es el
-- que va; si el catálogo ya se movió —los precios vivos lo actualizan solos—,
-- se busca en el histórico de precios la observación cuyo costo calce con el
-- renglón, la más cercana hacia atrás en el tiempo. El de su fecha, no el de hoy.
--
-- Lo que no calce con ninguno se queda como está y se lista aquí abajo para
-- revisarlo a mano: entre inventar una cifra y dejar el renglón corto, se deja
-- corto y se avisa.
--
-- Las obras cerradas tampoco se tocan: sus números ya se le entregaron al
-- contador. Salen en la lista por si el cliente decide que también entren.
-- ---------------------------------------------------------------------------
do $$
declare
  v_r         record;
  v_neto      numeric;
  v_ajustados integer := 0;
  v_dudosos   integer := 0;
  v_cerradas  integer := 0;
  v_sueltos   integer := 0;
begin
  create temp table ajuste_taller (
    obra_id   uuid primary key,
    renglones integer not null default 0,
    subio     numeric not null default 0
  ) on commit drop;

  -- Los que salieron del taller sin quedar ligados a un insumo del catálogo:
  -- no hay contra qué cruzarlos.
  select count(*) into v_sueltos
    from public.obra_materiales where es_taller and producto_id is null;

  for v_r in
    select m.id, m.obra_id, m.material, m.piezas, m.costo, m.producto_id,
           m.created_at::date as fecha,
           o.ot_numero, o.estatus,
           p.costo as costo_catalogo, p.precio_neto as neto_catalogo
      from public.obra_materiales m
      join public.obras o     on o.id = m.obra_id
      join public.productos p on p.id = m.producto_id
     where m.es_taller and m.producto_id is not null
     order by o.ot_numero, m.created_at
  loop
    v_neto := null;

    if abs(v_r.costo - v_r.costo_catalogo) <= 0.01 and v_r.neto_catalogo > v_r.costo then
      v_neto := v_r.neto_catalogo;
    else
      select pm.precio_neto into v_neto
        from public.precios_material pm
       where pm.producto_id = v_r.producto_id
         and pm.costo is not null
         and abs(pm.costo - v_r.costo) <= 0.01
         and pm.precio_neto > v_r.costo
       order by (pm.fecha <= v_r.fecha) desc, abs(pm.fecha - v_r.fecha), pm.fecha desc
       limit 1;
    end if;

    -- Ya trae el impuesto dentro: su costo es un precio neto conocido del
    -- insumo, el del catálogo o alguno de su historial. Se salta en silencio —
    -- si no, correr esto dos veces llenaría la lista de renglones sanos.
    if v_neto is null and (
         (v_r.neto_catalogo > 0 and abs(v_r.costo - v_r.neto_catalogo) <= 0.01)
         or exists (
              select 1 from public.precios_material pm
               where pm.producto_id = v_r.producto_id
                 and abs(pm.precio_neto - v_r.costo) <= 0.01)
       ) then
      continue;
    end if;

    if v_neto is null then
      v_dudosos := v_dudosos + 1;
      raise notice 'Sin precio con IVA que calce · OT % · % · % · $% c/u',
        coalesce(v_r.ot_numero, '?'), v_r.fecha, v_r.material, v_r.costo;
      continue;
    end if;

    if v_r.estatus = 'cerrada' then
      v_cerradas := v_cerradas + 1;
      raise notice 'Obra cerrada, no se toca · OT % · % · $% → $%',
        coalesce(v_r.ot_numero, '?'), v_r.material, v_r.costo, v_neto;
      continue;
    end if;

    update public.obra_materiales set costo = v_neto where id = v_r.id;
    v_ajustados := v_ajustados + 1;

    insert into ajuste_taller (obra_id, renglones, subio)
    values (v_r.obra_id, 1, round((v_neto - v_r.costo) * v_r.piezas, 2))
    on conflict (obra_id) do update
      set renglones = ajuste_taller.renglones + 1,
          subio     = ajuste_taller.subio + excluded.subio;
  end loop;

  -- Que el cambio no aparezca de la nada en el material real de la obra.
  insert into public.bitacora_obra (obra_id, tipo, descripcion)
  select obra_id, 'material',
         format('Ajuste de IVA: %s renglones de material de taller quedaron a su precio con impuesto (+%s de material real)',
                renglones, to_char(subio, 'FM$999,999,990.00'))
    from ajuste_taller;

  raise notice '---';
  raise notice 'Renglones corregidos: %  ·  obras tocadas: %',
    v_ajustados, (select count(*) from ajuste_taller);
  raise notice 'Sin precio que calce: %  ·  en obra cerrada: %  ·  sin insumo ligado: %',
    v_dudosos, v_cerradas, v_sueltos;
end $$;
