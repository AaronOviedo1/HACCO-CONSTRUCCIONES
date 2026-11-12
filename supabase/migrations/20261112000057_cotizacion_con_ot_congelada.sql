-- ===========================================================================
-- UNA COTIZACIÓN CON OBRA EN MARCHA YA NO SE EDITA ENCIMA
--
-- El 11/nov/2026 se escribió una cotización nueva encima de la F-468, que es la
-- de la OT 26000013 (Pomona, pausada, con anticipo cobrado). Se pudo porque la
-- F-468 llevaba desde agosto en borrador: una cotización aprobada se puede
-- «regresar a borrador» y entonces el editor la deja tocar como cualquier otra.
-- La cobranza lee el total de la cotización (`v_cobranza`), así que el saldo de
-- la obra cambió con lo capturado. Los datos se restauraron a mano ese mismo
-- día; esto es para que no se repita.
--
-- La regla: si alguna OT de la cotización ya tiene movimiento —un cobro, un
-- avance, un gasto, material comprado, un contrato o raya de mano de obra—, la
-- cotización queda congelada. No sale de aprobada/terminada y no cambia nada
-- que mueva dinero. Para una obra nueva se duplica.
--
-- Sin movimiento sí se puede corregir: la F-559 se aprobó y diez minutos
-- después se regresó a borrador para ponerle IVA, y eso tiene que seguir
-- pudiéndose. Al terminar se usa `reaprobar_cotizacion`, que no abre otra OT.
--
-- Una migración de datos que de verdad tenga que tocar una cotización
-- congelada desactiva el trigger dentro de su propia transacción.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- ¿Ya hubo movimiento? Security definer: el residente no lee la cobranza,
-- pero la regla se le aplica igual.
-- ---------------------------------------------------------------------------
create or replace function public.cotizacion_con_movimiento(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from pagos_cobranza p where p.cotizacion_id = p_id)
      or exists (
           select 1
             from obras o
            where o.cotizacion_id = p_id
              and (   exists (select 1 from avances a where a.obra_id = o.id)
                   or exists (select 1 from gastos g where g.obra_id = o.id)
                   or exists (select 1 from obra_materiales m
                               where m.obra_id = o.id and m.origen = 'real')
                   or exists (select 1 from contratos_oficial c where c.obra_id = o.id)
                   or exists (select 1 from raya_obras ro
                                join rayas_semanales r on r.id = ro.raya_id
                               where ro.obra_id = o.id and r.estatus <> 'cancelada')));
$$;

grant execute on function public.cotizacion_con_movimiento(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Poner en orden las que ya están chuecas, antes de que el trigger las vea.
-- ---------------------------------------------------------------------------

-- Con OT viva y movimiento, pero fuera de aprobada: vuelve a aprobada.
update public.cotizaciones c
   set estatus = 'aprobada'
 where c.estatus not in ('aprobada', 'terminada')
   and exists (select 1 from public.obras o
                where o.cotizacion_id = c.id and o.estatus <> 'cerrada')
   and public.cotizacion_con_movimiento(c.id);

-- Con todas sus OT cerradas y fuera de terminada (la F-446): terminada.
update public.cotizaciones c
   set estatus = 'terminada'
 where c.estatus not in ('aprobada', 'terminada')
   and exists (select 1 from public.obras o where o.cotizacion_id = c.id)
   and not exists (select 1 from public.obras o
                    where o.cotizacion_id = c.id and o.estatus <> 'cerrada');

-- ---------------------------------------------------------------------------
-- El candado. Antes de cada cambio a la cabecera: si está congelada, sólo
-- puede ir entre aprobada y terminada (cerrar y reabrir obras) y anotar sus
-- fechas de envío o resolución. Lo demás se rechaza.
--
-- `subtotal` cuenta porque es lo que cambia cuando se tocan las partidas: el
-- trigger de cotizacion_items lo recalcula sobre esta misma fila.
-- ---------------------------------------------------------------------------
create or replace function public.tg_cotizacion_congelada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from obras where cotizacion_id = old.id) then
    return new;
  end if;

  if (new.estatus is distinct from old.estatus
        and new.estatus not in ('aprobada', 'terminada'))
     or (new.cliente_id, new.nombre_obra, new.domicilio_obra, new.tipo, new.requiere_factura,
         new.anticipo_pct, new.iva_pct, new.descuento_pct, new.viaticos, new.subtotal,
         new.linea_calidad, new.terminos, new.notas, new.fecha, new.vigencia_dias)
        is distinct from
        (old.cliente_id, old.nombre_obra, old.domicilio_obra, old.tipo, old.requiere_factura,
         old.anticipo_pct, old.iva_pct, old.descuento_pct, old.viaticos, old.subtotal,
         old.linea_calidad, old.terminos, old.notas, old.fecha, old.vigencia_dias)
  then
    if public.cotizacion_con_movimiento(old.id) then
      raise exception
        'La cotización % ya tiene cobros o trabajo en su orden de trabajo y no se puede modificar. Si es para otra obra, duplícala.',
        coalesce(old.folio, '')
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists cotizacion_congelada on public.cotizaciones;
create trigger cotizacion_congelada
  before update on public.cotizaciones
  for each row execute function public.tg_cotizacion_congelada();

-- ---------------------------------------------------------------------------
-- Volver a aprobar una cotización que ya tiene OT y se regresó a borrador
-- para corregirla. A diferencia de `aprobar_cotizacion`, no abre órdenes de
-- trabajo nuevas: deja la cotización otra vez aprobada (o terminada, si sus
-- OT ya cerraron) y, si tiene una sola OT abierta, le pone el monto corregido
-- con el mismo criterio con el que se abrió: el subtotal.
-- ---------------------------------------------------------------------------
create or replace function public.reaprobar_cotizacion(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_subtotal numeric(14,2);
  v_abiertas integer;
begin
  perform public.exigir_equipo();

  select subtotal into v_subtotal
    from cotizaciones
   where id = p_id and estatus not in ('aprobada', 'terminada');
  if not found then
    raise exception 'La cotización no existe o ya está aprobada';
  end if;

  if not exists (select 1 from obras where cotizacion_id = p_id) then
    raise exception 'Esta cotización no tiene órdenes de trabajo: apruébala para abrirlas';
  end if;

  select count(*) into v_abiertas
    from obras where cotizacion_id = p_id and estatus <> 'cerrada';

  update cotizaciones
     set estatus = case when v_abiertas > 0 then 'aprobada' else 'terminada' end::estatus_cotizacion,
         fecha_resolucion = coalesce(fecha_resolucion, current_date)
   where id = p_id;

  if v_abiertas = 1 then
    update obras
       set monto_cotizado = v_subtotal
     where cotizacion_id = p_id and estatus <> 'cerrada';
  end if;
end $$;

grant execute on function public.reaprobar_cotizacion(uuid) to authenticated;
