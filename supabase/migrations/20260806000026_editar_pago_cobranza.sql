-- ===========================================================================
-- CORREGIR UN PAGO DE COBRANZA
--
-- Un pago se capturó por el saldo completo cuando en realidad fue un abono, y
-- la cotización desapareció de «Por cobrar»: el saldo sale de restarle al total
-- la suma de los pagos, así que un monto de más la da por liquidada. Hasta hoy
-- ese pago sólo se podía borrar, y sólo desde «Por cobrar» —donde la cotización
-- ya no aparecía—.
--
-- La corrección en sí no necesita función como la del gasto: el pago no se
-- ramifica en nada guardado —el saldo lo calcula la vista al leer, y el recibo
-- arma su PDF con el importe del propio pago, no con una copia—, así que el
-- update de la tabla basta. Lo que sí hacía falta es el rastro: quien revise el
-- mes que entra tiene que poder ver que un pago se tocó, cuándo y quién.
-- ===========================================================================

alter table public.pagos_cobranza
  add column if not exists updated_at   timestamptz not null default now(),
  add column if not exists editado_por  uuid references public.profiles(id) on delete set null;

-- Los pagos que ya existían no se han corregido nunca: su «última edición» es
-- su alta. Va antes de crear el trigger o el propio respaldo se pisaría.
update public.pagos_cobranza set updated_at = created_at where updated_at <> created_at;

drop trigger if exists set_updated_at on public.pagos_cobranza;
create trigger set_updated_at before update on public.pagos_cobranza
  for each row execute function public.tg_set_updated_at();
