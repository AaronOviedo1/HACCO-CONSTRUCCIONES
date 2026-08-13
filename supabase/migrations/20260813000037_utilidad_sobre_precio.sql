-- ===========================================================================
-- LA UTILIDAD DEL COTIZADOR DE HERRERÍA ES UN % DEL PRECIO, NO DEL COSTO
--
-- El cotizador venía calculando el precio de venta como costo × (1 + 35%),
-- un recargo sobre el costo. El cliente cotiza como se acostumbra en obra:
-- la utilidad es el 35% del precio de venta, así que el precio sale de
-- dividir, costo ÷ (1 − 35%). Con su ejemplo: costo $16,499.18 daba
-- $22,273.89 y debe dar $25,383.35.
--
-- De paso se corrige un hueco que salió al revisarlo: los materiales con
-- rubro 'otro' sí se guardaban en cotizacion_materiales, pero ni el trigger
-- ni las columnas generadas los sumaban. El editor los enseñaba dentro del
-- costo y al guardar la partida entraba más barata de lo que decía la
-- pantalla. Ahora tienen su columna y entran al cálculo como los demás.
--
-- Recrear las columnas generadas recalcula todas las filas del desglose con
-- la fórmula nueva; las partidas ya guardadas (cotizacion_items) no se tocan:
-- cada cotización enviada conserva el precio al que se cotizó.
--
-- El round va anidado a propósito: lib/cotizaciones.ts redondea el costo
-- antes de dividir, y las dos implementaciones deben cuadrar al centavo.
-- ===========================================================================

alter table public.cotizacion_herreria_desglose
  add column materiales_otro numeric(14,2) not null default 0;

-- Lo que ya estaba guardado como rubro 'otro' entra a su columna nueva.
update public.cotizacion_herreria_desglose d
   set materiales_otro = coalesce((select sum(m.total) from public.cotizacion_materiales m
                                    where m.desglose_id = d.id and m.rubro = 'otro'), 0);

create or replace function public.tg_recalcular_desglose()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_desglose uuid := coalesce(new.desglose_id, old.desglose_id);
begin
  if v_desglose is null then return null; end if;
  update public.cotizacion_herreria_desglose d
     set materiales_herreria = coalesce((select sum(m.total) from public.cotizacion_materiales m
                                          where m.desglose_id = v_desglose and m.rubro = 'herreria'), 0),
         materiales_pintura  = coalesce((select sum(m.total) from public.cotizacion_materiales m
                                          where m.desglose_id = v_desglose and m.rubro = 'pintura'), 0),
         materiales_otro     = coalesce((select sum(m.total) from public.cotizacion_materiales m
                                          where m.desglose_id = v_desglose and m.rubro = 'otro'), 0)
   where d.id = v_desglose;
  return null;
end $$;

-- Una columna generada no puede leer otra, por eso el costo se repite adentro.
alter table public.cotizacion_herreria_desglose
  drop column costo_total,
  drop column precio_venta;

alter table public.cotizacion_herreria_desglose
  add column costo_total numeric(14,2) generated always as (
    round((materiales_herreria + materiales_pintura + materiales_otro + mano_obra)
          * (1 + gastos_indirectos_pct / 100), 2)
  ) stored,
  add column precio_venta numeric(14,2) generated always as (
    round(round((materiales_herreria + materiales_pintura + materiales_otro + mano_obra)
                * (1 + gastos_indirectos_pct / 100), 2)
          / nullif(1 - utilidad_pct / 100, 0), 2)
  ) stored;

-- Con división, una utilidad del 100% reventaría la columna generada; el
-- nullif evita el «division by zero» para que el rechazo salga del constraint.
alter table public.cotizacion_herreria_desglose
  add constraint utilidad_pct_valida check (utilidad_pct >= 0 and utilidad_pct < 100);
