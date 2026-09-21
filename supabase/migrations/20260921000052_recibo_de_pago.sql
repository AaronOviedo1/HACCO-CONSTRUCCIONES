-- ============================================================================
-- HaacoPro · Migración 052 · El recibo de pago que se le manda al cliente
--
-- La tabla `recibos` nació para una sola cosa: el RECIBO-CONTRATO del anticipo,
-- esa hoja con esquema de pagos, fechas de obra y las dos firmas que hace las
-- veces de contrato. Sirve para abrir la obra y no para lo que se pide todos
-- los días —«ya te deposité, mándame mi comprobante»—, que es un acuse de
-- media cuartilla: cuánto, de qué cotización, cómo lo pagó y cuánto le queda.
--
-- Son el mismo hecho (un pago del cliente con su papel), así que viven en la
-- misma tabla y se distinguen por `tipo`. Lo que sí se separa es la serie del
-- folio: el R-### es el contrato, y meterle en medio los acuses del día le
-- abriría huecos a una numeración que se enseña en trato con el cliente. El
-- acuse lleva la suya, RP-###.
-- ============================================================================

create type tipo_recibo as enum ('contrato', 'pago');

-- Los que ya existen son todos recibos-contrato: es lo único que se podía
-- emitir hasta hoy.
alter table public.recibos
  add column tipo tipo_recibo not null default 'contrato';

comment on column public.recibos.tipo is
  'contrato: el recibo-contrato del anticipo, con firmas. pago: el acuse simple que se le manda al cliente por cada pago.';

-- Serie propia del acuse. Arranca en cero como todas las demás.
insert into public.consecutivos (serie, anio, ultimo) values ('recibo_pago', 0, 0)
on conflict (serie, anio) do nothing;

create or replace function public.tg_folio_recibo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := case new.tipo
      when 'pago' then 'RP-' || public.siguiente_consecutivo('recibo_pago', 0)::text
      else             'R-'  || public.siguiente_consecutivo('recibo', 0)::text
    end;
  end if;
  return new;
end $$;
