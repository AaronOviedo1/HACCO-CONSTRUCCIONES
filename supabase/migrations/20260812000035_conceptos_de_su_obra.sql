-- ===========================================================================
-- UN GASTO NO SE CARGA AL CONCEPTO DE OTRA OBRA
--
-- `obra_id` y `concepto_id` son dos llaves foráneas independientes: cada una
-- apunta a algo que existe, pero nadie comprueba que apunten a lo mismo. Con la
-- pantalla de gastos ofreciendo los conceptos de todas las OT —el bug que se
-- corrige junto con esto— era cuestión de tiempo: en cuanto dos obras tienen un
-- concepto que se llama igual («Interior 2da parte» está en media docena), el
-- gasto se va al de la obra equivocada y ahí se queda, sin que nada chille.
--
-- Va como disparador y no dentro de `registrar_gasto` / `editar_gasto` por dos
-- razones: cubre cualquier camino de captura —los de hoy y los que vengan, la
-- app del teléfono incluida— sin volver a copiar dos funciones de cien líneas, y
-- sólo vigila lo que se escriba de aquí en adelante. Lo ya capturado se queda
-- quieto: si algo quedó cruzado, se compone al corregirlo desde la pantalla.
-- ===========================================================================

create or replace function public.tg_concepto_de_su_obra()
returns trigger language plpgsql set search_path = public as $$
declare
  v_obra_del_concepto uuid;
begin
  if new.concepto_id is null then
    return new;
  end if;

  select obra_id into v_obra_del_concepto
    from public.obra_conceptos where id = new.concepto_id;

  if new.obra_id is null then
    raise exception 'Un gasto general no lleva concepto: el concepto es de una obra';
  end if;

  if v_obra_del_concepto is distinct from new.obra_id then
    raise exception 'Ese concepto es de otra obra';
  end if;

  return new;
end $$;

comment on function public.tg_concepto_de_su_obra is
  'El concepto tiene que ser de la misma obra del renglón. Ver migración 035.';

drop trigger if exists gastos_concepto_de_su_obra on public.gastos;
create trigger gastos_concepto_de_su_obra
  before insert or update of obra_id, concepto_id on public.gastos
  for each row execute function public.tg_concepto_de_su_obra();

drop trigger if exists materiales_concepto_de_su_obra on public.obra_materiales;
create trigger materiales_concepto_de_su_obra
  before insert or update of obra_id, concepto_id on public.obra_materiales
  for each row execute function public.tg_concepto_de_su_obra();
