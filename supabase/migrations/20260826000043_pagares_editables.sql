-- ===========================================================================
-- EL PAGARÉ SE CORRIGE Y SE PUEDEN FIRMAR VARIOS
--
--   «Porfa se puede configurar para que se puedan editar los pagarés o
--    agregar más de 1 pagaré a una obra, es que no me lo permite.»
--
-- La base de datos nunca lo impidió: pagares.contrato_id no es único y todas
-- las funciones que recorren pagarés (cerrar_obra, reabrir_obra,
-- reasignar_contrato, eliminar_obra) ya lo hacen con un bucle. Quien lo
-- impedía era la pantalla, que buscaba UN pagaré por contrato y escondía el
-- botón en cuanto encontraba cualquiera, cancelado incluso. De ahí el reporte:
-- el pagaré de la obra se canceló, las herramientas volvieron al taller, y ya
-- no había manera de firmar el siguiente.
--
-- Lo que sí faltaba en la base es poder corregir un pagaré vivo. Hasta hoy la
-- única salida era «Cancelar y devolver todo» y volver a capturarlo entero,
-- que es tanto como romper el documento porque sobraba una escalera.
--
-- Corregir no es devolver. Son dos cosas distintas y por eso se comportan
-- distinto:
--
--   Devolver  → el oficial trajo la herramienta de vuelta. El renglón se queda
--               tachado en el pagaré y el valor total no se mueve: el papel
--               firmado dice lo que dice.
--   Corregir  → esa herramienta nunca debió estar ahí. El renglón se va y el
--               valor total baja, porque el pagaré que se va a imprimir tiene
--               que decir la verdad.
--
-- Como el trigger que regresa la herramienta al taller sólo escucha INSERT y
-- UPDATE, quitar un renglón se hace en dos tiempos —marcar devuelta y luego
-- borrar—, igual que hace eliminar_obra. Y para el camino de regreso (una
-- herramienta devuelta que se vuelve a elegir en el mismo pagaré) el trigger
-- aprende una rama nueva: devuelta que pasa de sí a no vuelve a prestarla.
-- ===========================================================================

-- El préstamo también camina hacia atrás: si un renglón deja de estar devuelto
-- es porque la herramienta salió otra vez con el oficial.
create or replace function public.tg_herramienta_prestamo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_oficial text;
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.devuelta and not new.devuelta) then
    select p.nombre into v_oficial
      from public.pagares pg
      join public.contratos_oficial c on c.id = pg.contrato_id
      join public.profiles p on p.id = c.trabajador_id
     where pg.id = new.pagare_id;
    update public.herramientas
       set estado = 'en_obra', ubicacion = coalesce(v_oficial, ubicacion), updated_at = now()
     where id = new.herramienta_id and estado <> 'fuera_servicio';
  elsif tg_op = 'UPDATE' and new.devuelta and not old.devuelta then
    update public.herramientas
       set estado = 'disponible', ubicacion = 'Taller', updated_at = now()
     where id = new.herramienta_id and estado <> 'fuera_servicio';
  end if;
  return new;
end $$;

-- Corregir la lista de herramientas de un pagaré vivo.
create or replace function public.editar_pagare(
  p_pagare uuid, p_herramientas uuid[]
) returns integer
language plpgsql set search_path = public as $$
declare
  v_obra    uuid;
  v_estatus estatus_pagare;
  v_id      uuid;
  v_quitar  integer := 0;
  v_poner   integer := 0;
  v_n       integer := 0;
  v_ocupada text;
begin
  perform public.exigir_staff();

  if array_length(p_herramientas, 1) is null then
    raise exception 'El pagaré tiene que quedar con al menos una herramienta';
  end if;

  select c.obra_id, p.estatus into v_obra, v_estatus
    from public.pagares p join public.contratos_oficial c on c.id = p.contrato_id
   where p.id = p_pagare;

  if v_obra is null then raise exception 'El pagaré no existe o no tienes acceso'; end if;
  if v_estatus <> 'activo' then
    raise exception 'El pagaré está cancelado: ya no se puede corregir';
  end if;

  -- Ninguna herramienta puede estar prestada en dos pagarés a la vez.
  select h.codigo || ' ' || h.nombre into v_ocupada
    from public.pagare_items i
    join public.pagares pg on pg.id = i.pagare_id
    join public.herramientas h on h.id = i.herramienta_id
   where i.herramienta_id = any (p_herramientas)
     and i.pagare_id <> p_pagare
     and pg.estatus = 'activo'
     and not i.devuelta
   limit 1;

  if v_ocupada is not null then
    raise exception 'La herramienta % ya está prestada en otro pagaré', v_ocupada;
  end if;

  -- Fuera las que sobran: primero devueltas (para que el trigger las regrese
  -- al taller) y luego borradas, para que el pagaré deje de cobrarlas.
  update public.pagare_items
     set devuelta = true, fecha_devolucion = current_date
   where pagare_id = p_pagare
     and not devuelta
     and not (herramienta_id = any (p_herramientas));

  delete from public.pagare_items
   where pagare_id = p_pagare
     and not (herramienta_id = any (p_herramientas));
  get diagnostics v_quitar = row_count;

  -- Dentro las que faltan. Si el renglón ya existía devuelto, revive.
  foreach v_id in array p_herramientas loop
    update public.pagare_items
       set devuelta = false, fecha_devolucion = null
     where pagare_id = p_pagare and herramienta_id = v_id and devuelta;
    get diagnostics v_n = row_count;
    v_poner := v_poner + v_n;

    insert into public.pagare_items (pagare_id, herramienta_id, valor_unitario)
    select p_pagare, h.id, coalesce(h.valor, 0)
      from public.herramientas h where h.id = v_id
    on conflict (pagare_id, herramienta_id) do nothing;
    get diagnostics v_n = row_count;
    v_poner := v_poner + v_n;
  end loop;

  if v_quitar > 0 or v_poner > 0 then
    perform public.anotar_bitacora(v_obra, 'pagare',
      format('Pagaré corregido: %s herramientas fuera, %s adentro', v_quitar, v_poner));
  end if;

  return v_quitar + v_poner;
end $$;

grant execute on function public.editar_pagare(uuid, uuid[]) to authenticated;
