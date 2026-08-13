-- ===========================================================================
-- UN GASTO PAGADO DE CAJA CHICA DESCUENTA SOLO EL SALDO DE LA CAJA
--
-- Caja chica y gastos vivían separados: el método de pago no tenía forma de
-- decir "esto salió de la caja" y había que capturar el movimiento dos veces
-- (la propia pantalla de caja lo confesaba: "sólo es referencia"). La columna
-- caja_chica.gasto_id estaba prevista para la liga desde el primer día y
-- nadie la escribía.
--
-- Ahora 'caja_chica' es un método de pago más. Un trigger sobre gastos
-- mantiene el reflejo: al registrar el gasto nace su salida de caja, al
-- editarlo se actualiza, al cambiarle el método desaparece, y al borrar el
-- gasto la salida se va con él (el cascade de abajo) y el dinero regresa al
-- saldo. Los movimientos capturados a mano —sin gasto_id— no se tocan.
-- ===========================================================================

alter type metodo_pago add value if not exists 'caja_chica';

-- La salida autogenerada es un reflejo del gasto, no un registro propio:
-- si el gasto se borra, dejarla huérfana ('set null') inflaría las salidas.
alter table public.caja_chica
  drop constraint caja_chica_gasto_id_fkey,
  add constraint caja_chica_gasto_id_fkey
    foreign key (gasto_id) references public.gastos(id) on delete cascade;

create or replace function public.tg_gasto_a_caja()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.metodo = 'caja_chica' then
      insert into public.caja_chica (tipo, concepto, monto, fecha, obra_id, gasto_id, registrado_por)
      values ('salida', new.descripcion, new.monto, new.fecha, new.obra_id, new.id, new.registrado_por);
    end if;
    return null;
  end if;

  if new.metodo = 'caja_chica' then
    update public.caja_chica
       set concepto = new.descripcion, monto = new.monto, fecha = new.fecha, obra_id = new.obra_id
     where gasto_id = new.id;
    if not found then
      insert into public.caja_chica (tipo, concepto, monto, fecha, obra_id, gasto_id, registrado_por)
      values ('salida', new.descripcion, new.monto, new.fecha, new.obra_id, new.id, new.registrado_por);
    end if;
  elsif old.metodo = 'caja_chica' then
    delete from public.caja_chica where gasto_id = new.id;
  end if;
  return null;
end $$;

create trigger gasto_a_caja
  after insert or update on public.gastos
  for each row execute function public.tg_gasto_a_caja();
