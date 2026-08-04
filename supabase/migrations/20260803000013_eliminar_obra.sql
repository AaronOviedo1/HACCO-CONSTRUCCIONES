-- ===========================================================================
-- ELIMINAR UNA ORDEN DE TRABAJO
-- Se abre una OT de más, se prueba el sistema, se captura la obra equivocada:
-- hasta ahora la única salida era pausarla y dejarla estorbando para siempre,
-- porque obras.cotizacion_id es «on delete restrict» y tampoco había manera de
-- borrar la OT desde la aplicación.
--
-- Borrar es en cascada y sin vuelta: se van los conceptos, el cronograma, el
-- material, los avances, la bitácora, los contratos de mano de obra con sus
-- pagarés y la póliza de garantía. Por eso la función se planta cuando ya hubo
-- dinero de por medio: nómina pagada, gastos, caja chica o salidas de almacén.
-- Esos se desligan solos (on delete set null) y quedarían huérfanos en la
-- contabilidad sin que nadie se entere.
--
-- La herramienta se devuelve ANTES de borrar: el trigger que la regresa al
-- taller sólo escucha INSERT y UPDATE sobre pagare_items, así que un DELETE en
-- seco dejaría las escaleras marcadas «en obra» de por vida.
-- ===========================================================================
create or replace function public.eliminar_obra(p_obra uuid)
returns jsonb
language plpgsql set search_path = public as $$
declare
  v_obra         record;
  v_pagare       record;
  v_herramientas integer := 0;
  v_nomina       numeric;
  v_gastos       integer;
  v_caja         integer;
  v_kardex       integer;
  v_borrado      jsonb;
begin
  perform public.exigir_staff();

  select * into v_obra from public.obras where id = p_obra;
  if not found then raise exception 'La obra no existe o no tienes acceso'; end if;

  if v_obra.estatus = 'cerrada' then
    raise exception 'La OT % ya está cerrada: es histórico y no se borra', v_obra.ot_numero;
  end if;

  select coalesce(sum(n.monto), 0) into v_nomina
    from public.nomina_pagos n
    join public.contratos_oficial c on c.id = n.contrato_id
   where c.obra_id = p_obra;

  if v_nomina > 0 then
    raise exception 'La OT % ya tiene % pagados de mano de obra: cancela los pagos antes de borrarla',
      v_obra.ot_numero, to_char(v_nomina, 'FM$999,999,990.00');
  end if;

  select count(*) into v_gastos from public.gastos          where obra_id = p_obra;
  select count(*) into v_caja   from public.caja_chica      where obra_id = p_obra;
  select count(*) into v_kardex from public.insumos_kardex  where obra_id = p_obra;

  if v_gastos > 0 or v_caja > 0 or v_kardex > 0 then
    raise exception 'La OT % tiene movimientos de dinero ligados (% gastos, % de caja chica, % de almacén): desligalos antes de borrarla',
      v_obra.ot_numero, v_gastos, v_caja, v_kardex;
  end if;

  -- Lo que se va, para poder decírselo a quien apretó el botón.
  select jsonb_build_object(
    'ot_numero',  v_obra.ot_numero,
    'nombre',     v_obra.nombre,
    'conceptos',  (select count(*) from public.obra_conceptos       where obra_id = p_obra),
    'tareas',     (select count(*) from public.cronograma_tareas    where obra_id = p_obra),
    'materiales', (select count(*) from public.obra_materiales      where obra_id = p_obra),
    'avances',    (select count(*) from public.avances              where obra_id = p_obra),
    'contratos',  (select count(*) from public.contratos_oficial    where obra_id = p_obra),
    'polizas',    (select count(*) from public.polizas_garantia     where obra_id = p_obra),
    'solicitudes',(select count(*) from public.solicitudes_material where obra_id = p_obra)
  ) into v_borrado;

  -- Primero la herramienta de regreso al taller, luego el borrado.
  for v_pagare in
    select p.id from public.pagares p
      join public.contratos_oficial c on c.id = p.contrato_id
     where c.obra_id = p_obra and p.estatus = 'activo'
  loop
    v_herramientas := v_herramientas + public.cancelar_pagare(v_pagare.id);
  end loop;

  -- Los recibos de anticipo se quedan con el cliente: son de la cotización y
  -- sólo pierden la referencia a la OT (on delete set null).
  delete from public.obras where id = p_obra;

  return v_borrado
      || jsonb_build_object('herramientas_devueltas', v_herramientas)
      || jsonb_build_object('cotizacion_id', v_obra.cotizacion_id);
end $$;

comment on function public.eliminar_obra(uuid) is
  'Borra una OT abierta con todo lo que cuelga de ella, tras devolver la herramienta al taller. Se niega si ya hubo nómina pagada, gastos, caja chica o kardex.';
