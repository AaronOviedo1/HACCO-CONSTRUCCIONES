-- ===========================================================================
-- PASARLE UNA OBRA A OTRO OFICIAL
--
-- Un pintor se da de baja a media obra y otro termina lo que faltaba. Hasta
-- ahora sólo se podía cambiar el nombre del contrato, y eso movía al pintor
-- nuevo todos los pagos que se le habían hecho al que se fue: su recibo decía
-- una cosa y la nómina otra.
--
-- Lo correcto es cortar: el contrato del que se va se ajusta a lo que de
-- verdad ejecutó y se cierra; se abre uno nuevo, a nombre del que entra, por
-- los metros que faltan. Cada quien conserva su historial de recibos y la suma
-- de los dos contratos sigue siendo el trabajo completo.
--
-- El corte se mide en metros ejecutados y lo captura quien reasigna. La
-- sugerencia por defecto es proporcional a lo ya pagado, pero es sólo eso:
--
--  · No se corta al devengado porque el devengado sale del avance de la OBRA
--    completa, no del pedazo que hizo este oficial. Con dos contratos en la
--    misma OT, ese número regala o roba dinero.
--  · No se corta a lo pagado sin preguntar porque puede haber metros ya
--    ejecutados que todavía no se le abonan; borrarlos sería quitárselos.
--
-- La base sólo impide el corte imposible: dejarlo por debajo de lo que ya se
-- le pagó, o no dejar nada por reasignar. Como subtotal y total_pagar son
-- columnas generadas, la única palanca es m2; por eso se escribe m2 y luego se
-- vuelve a leer el total, que es la autoridad.
-- ===========================================================================
create or replace function public.reasignar_contrato(
  p_contrato         uuid,
  p_nuevo_trabajador uuid,
  p_fecha            date    default current_date,
  p_m2_ejecutados    numeric default null,
  p_motivo           text    default null
) returns jsonb
language plpgsql set search_path = public as $$
declare
  v_c        record;
  v_obra     record;
  v_sale     record;
  v_entra    record;
  v_pagado   numeric;
  v_corte    numeric;   -- metros que se le quedan al que se va
  v_restante numeric;   -- metros que pasan al que entra
  v_total_anterior numeric;
  v_total_cerrado  numeric;
  v_total_nuevo    numeric;
  v_nuevo    uuid;
  v_pagare   record;
  v_pagares  integer := 0;
begin
  perform public.exigir_staff();

  select * into v_c from public.contratos_oficial where id = p_contrato;
  if not found then raise exception 'El contrato no existe o no tienes acceso'; end if;
  if v_c.estatus <> 'activo' then raise exception 'Ese contrato ya está cerrado'; end if;

  select * into v_obra from public.obras where id = v_c.obra_id;
  if v_obra.estatus = 'cerrada' then
    raise exception 'La OT % está cerrada: reábrela antes de reasignar', v_obra.ot_numero;
  end if;

  if p_nuevo_trabajador = v_c.trabajador_id then
    raise exception 'Es el mismo oficial que ya tiene el contrato';
  end if;

  select * into v_entra from public.profiles where id = p_nuevo_trabajador;
  if not found then raise exception 'El oficial que entra no existe'; end if;
  if not v_entra.activo then raise exception '% está dado de baja', v_entra.nombre; end if;
  if v_entra.rol <> 'cuadrilla' then
    raise exception '% no es de cuadrilla: no puede tomar un contrato de mano de obra', v_entra.nombre;
  end if;

  select * into v_sale from public.profiles where id = v_c.trabajador_id;

  select coalesce(sum(monto), 0) into v_pagado
    from public.nomina_pagos where contrato_id = p_contrato;

  v_total_anterior := v_c.total_pagar;

  -- Metros que se le quedan al que se va.
  v_corte := coalesce(
    p_m2_ejecutados,
    case when v_c.total_pagar > 0 then round(v_c.m2 * v_pagado / v_c.total_pagar, 2) else 0 end
  );

  if v_corte < 0 or v_corte > v_c.m2 then
    raise exception 'Los metros ejecutados tienen que estar entre 0 y % m²', v_c.m2;
  end if;

  v_restante := round(v_c.m2 - v_corte, 2);
  if v_restante <= 0 then
    raise exception 'No queda trabajo por reasignar: el corte se lleva los % m² completos', v_c.m2;
  end if;

  -- Se cierra el del que se va, ajustado a lo ejecutado. Los importes de otros
  -- trabajos y reparaciones se quedan con él: ya se hicieron. Si hay que
  -- moverlos, se edita el contrato antes de reasignar.
  update public.contratos_oficial
     set m2 = v_corte,
         estatus = 'cerrado',
         fecha_cierre = p_fecha,
         fecha_finaliza = coalesce(fecha_finaliza, p_fecha),
         notas = trim(both E'\n' from coalesce(notas, '') || E'\n' ||
                 format('Reasignado a %s el %s. %s',
                        v_entra.nombre, to_char(p_fecha, 'DD/MM/YYYY'), coalesce(p_motivo, '')))
   where id = p_contrato;

  -- La columna generada es la autoridad: se relee después del update.
  select total_pagar into v_total_cerrado from public.contratos_oficial where id = p_contrato;

  if v_total_cerrado < v_pagado then
    raise exception 'El corte deja el contrato en %, por debajo de los % que ya se le pagaron a %',
      to_char(v_total_cerrado, 'FM$999,999,990.00'),
      to_char(v_pagado, 'FM$999,999,990.00'),
      v_sale.nombre;
  end if;

  -- El contrato nuevo, por lo que falta. El trigger de externos le pone la
  -- retención que corresponda según el perfil de quien entra.
  insert into public.contratos_oficial
    (obra_id, trabajador_id, trabajos, m2, tarifa_m2, costo_haaco_pct, fecha_inicia, notas)
  values (
    v_c.obra_id,
    p_nuevo_trabajador,
    v_c.trabajos,
    v_restante,
    v_c.tarifa_m2,
    case when v_entra.es_externo then 0 else v_c.costo_haaco_pct end,
    p_fecha,
    format('Continúa el trabajo de %s desde el %s. %s',
           v_sale.nombre, to_char(p_fecha, 'DD/MM/YYYY'), coalesce(p_motivo, ''))
  )
  returning id, total_pagar into v_nuevo, v_total_nuevo;

  -- La herramienta del que se va regresa al taller: ya no está en la obra.
  for v_pagare in
    select id from public.pagares where contrato_id = p_contrato and estatus = 'activo'
  loop
    perform public.cancelar_pagare(v_pagare.id);
    v_pagares := v_pagares + 1;
  end loop;

  perform public.anotar_bitacora(v_c.obra_id, 'contrato',
    format('Contrato reasignado de %s a %s: se le cierran %s m² (%s pagados) y %s m² pasan al contrato nuevo. %s',
           v_sale.nombre, v_entra.nombre, v_corte,
           to_char(v_pagado, 'FM$999,999,990.00'),
           v_restante, coalesce(p_motivo, '')),
    jsonb_build_object(
      'contrato_anterior', p_contrato,
      'contrato_nuevo', v_nuevo,
      'sale', v_sale.nombre,
      'entra', v_entra.nombre,
      'm2_corte', v_corte,
      'pagado', v_pagado,
      'motivo', p_motivo
    ));

  return jsonb_build_object(
    'contrato_anterior', p_contrato,
    'contrato_nuevo', v_nuevo,
    'sale', v_sale.nombre,
    'entra', v_entra.nombre,
    'm2_corte', v_corte,
    'm2_nuevo', v_restante,
    'total_anterior', v_total_anterior,
    'total_cerrado', v_total_cerrado,
    'total_nuevo', v_total_nuevo,
    'pagado', v_pagado,
    'pagares_cancelados', v_pagares
  );
end $$;

comment on function public.reasignar_contrato(uuid, uuid, date, numeric, text) is
  'Corta el contrato de un oficial a los metros que ejecutó, lo cierra, y abre uno nuevo al oficial que entra por lo que falta. La herramienta del que se va regresa al taller.';

grant execute on function public.reasignar_contrato(uuid, uuid, date, numeric, text) to authenticated;
