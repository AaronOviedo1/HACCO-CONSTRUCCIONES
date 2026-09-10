-- ===========================================================================
-- LA LISTA DE A QUIÉN SE LE PAGA CADA QUINCENA
--
--   «Porfa se puede ajustar para poder editar pagos fijos, el poder agregar,
--    editar o quitar a personal o servicio programado.»
--
-- Hasta hoy esa lista no existía como cosa: existían copias. «Generar
-- quincena» buscaba la última quincena con renglones marcados `recurrente` y
-- los clonaba uno por uno, así que la lista de gente y servicios fijos vivía
-- repartida por el historial. Dar de alta a alguien era capturarlo, acordarse
-- de marcar la casilla y esperar a la siguiente quincena. Darlo de baja era
-- acordarse de borrarlo cada quince días. Subirle el sueldo sólo corregía esa
-- quincena. Y un mes que nadie generó rompía la cadena entera, porque lo que
-- se copiaba era la quincena anterior y no una lista.
--
-- Aquí la lista pasa a ser una tabla. `pagos_fijos` sigue siendo el libro de
-- lo que se pagó —cada renglón con su monto, su método y su fecha, tal como
-- quedó ese día— y `pagos_programados` es la plantilla de la que salen. La
-- liga es `pagos_fijos.programado_id`.
--
-- OJO con la palabra: el estado 'programado' de `estado_pago_fijo` quiere
-- decir «todavía no se paga». Un «pago programado» es otra cosa: un renglón
-- del catálogo. Son ejes distintos y no se cruzan.
--
-- Lo que este cambio NO hace, a propósito:
--
--   · No obliga a que la fecha sea el día 15 o el fin de mes. Se pensó poner
--     un check y habría sido un error: la nómina de dirección se paga sin
--     fecha fija y queda fuera del ciclo quincenal. El cliente lo confirmó.
--     Esos pagos son válidos, viven fuera del catálogo y ahí se quedan.
--
--   · No adivina la periodicidad de lo que ya existe. Mirando el historial se
--     podría deducir que TELMEX es mensual y la nómina quincenal, pero el
--     historial dice lo que hizo el copiado a ciegas, no lo que la empresa
--     quiere. Todo se siembra como quincenal —que es como se viene
--     comportando— y quien sepa lo corrige en la pantalla.
--
--   · No liga a nadie con el padrón por nombre. Ninguno de los cinco
--     beneficiarios de hoy aparece en `profiles` (la «Patricia Figueroa
--     Arcoamarillo» de los pagos no es la «Pati» del padrón), y empatar
--     personas por parecido en producción es como se acaba pagándole a quien
--     no era. `trabajador_id` queda para ligarlo a mano cuando haga falta.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Qué es cada renglón. Sirve para agrupar la pantalla en «Personal» y
-- «Servicios», que es como lo revisa la empresa, sin depender de la categoría
-- —que es texto libre y se usa para otra cosa: para el resumen del contador.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_pago_programado') then
    create type public.tipo_pago_programado as enum ('personal', 'servicio');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cada cuándo toca. La nómina cae en las dos quincenas; la renta, el internet
-- y el contador caen una vez al mes, y el copiado a ciegas los venía poniendo
-- en las dos.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'periodicidad_pago') then
    create type public.periodicidad_pago as enum ('quincenal', 'primera', 'segunda');
  end if;
end $$;

create table if not exists public.pagos_programados (
  id            uuid primary key default gen_random_uuid(),
  tipo          public.tipo_pago_programado not null default 'servicio',
  /**
   * Opcional y a propósito. Ligarlo al padrón evita que «Fernanda» y «Fernanda
   * Colsa» se vuelvan dos renglones, pero hoy nadie de esta lista está dado de
   * alta como trabajador, así que forzarlo dejaría el campo vacío o —peor—
   * empatado a la persona equivocada.
   */
  trabajador_id uuid references public.profiles(id) on delete set null,
  /**
   * Se guarda siempre, también cuando hay `trabajador_id`. Es el texto que se
   * estampa en `pagos_fijos`, y eso es registro histórico: si mañana se
   * corrige un nombre mal escrito, los pagos de hace seis meses no deben
   * cambiar solos.
   */
  beneficiario  text not null,
  categoria     text not null default 'Nómina',
  /** Cero es válido: hay pagos cuyo monto cambia cada quincena y se captura encima. */
  monto         numeric(14,2) not null default 0 check (monto >= 0),
  metodo        metodo_pago not null default 'transferencia',
  periodicidad  public.periodicidad_pago not null default 'quincenal',
  descripcion   text,
  notas         text,
  /** Baja lógica: quien sale de la lista no se borra, se apaga. El historial se queda. */
  activo        boolean not null default true,
  /** El orden en que lo revisan ellos, no el alfabético. */
  orden         integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists pagos_programados_activos
  on public.pagos_programados (tipo, beneficiario) where activo;
create index if not exists pagos_programados_trabajador
  on public.pagos_programados (trabajador_id) where trabajador_id is not null;

drop trigger if exists set_updated_at on public.pagos_programados;
create trigger set_updated_at before update on public.pagos_programados
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS · el patrón de la 003, explícito porque esta tabla no está en su bucle.
-- ---------------------------------------------------------------------------
alter table public.pagos_programados enable row level security;

drop policy if exists staff_todo on public.pagos_programados;
create policy staff_todo on public.pagos_programados
  for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

drop policy if exists contador_lectura on public.pagos_programados;
create policy contador_lectura on public.pagos_programados
  for select to authenticated
  using (public.es_contador());

grant select, insert, update, delete on public.pagos_programados to authenticated;

-- ---------------------------------------------------------------------------
-- La liga desde el libro de pagos. Nulo = renglón suelto capturado a mano,
-- que sigue siendo un caso válido: el aguinaldo, un pago único, la nómina de
-- dirección.
-- ---------------------------------------------------------------------------
alter table public.pagos_fijos
  add column if not exists programado_id uuid
    references public.pagos_programados(id) on delete set null;

create index if not exists pagos_fijos_programado
  on public.pagos_fijos (programado_id) where programado_id is not null;

comment on column public.pagos_fijos.recurrente is
  'DERIVADA: espejo de (programado_id is not null), la pone el trigger. Se
   conserva porque la pantalla y el tipo de TypeScript la leen; la verdad de
   si un pago se repite vive en pagos_programados.';

create or replace function public.tg_pago_fijo_recurrente()
returns trigger language plpgsql set search_path = public as $$
begin
  new.recurrente := new.programado_id is not null;
  return new;
end $$;

drop trigger if exists pago_fijo_recurrente on public.pagos_fijos;
create trigger pago_fijo_recurrente before insert or update on public.pagos_fijos
  for each row execute function public.tg_pago_fijo_recurrente();

-- ===========================================================================
-- SEMBRADO · el catálogo sale de lo que ya se venía repitiendo
-- ===========================================================================
-- El último renglón de cada (beneficiario, categoría) manda: ése trae el monto
-- vigente. `distinct on` con el orden por quincena descendente.
insert into public.pagos_programados
  (tipo, beneficiario, categoria, monto, metodo, descripcion, notas, periodicidad, activo)
select distinct on (lower(btrim(pf.beneficiario)), pf.categoria)
       case when pf.categoria = 'Nómina' then 'personal' else 'servicio' end
         ::public.tipo_pago_programado,
       btrim(pf.beneficiario),
       pf.categoria,
       pf.monto,
       pf.metodo,
       pf.descripcion,
       pf.notas,
       'quincenal'::public.periodicidad_pago,
       true
  from public.pagos_fijos pf
 where pf.recurrente
 order by lower(btrim(pf.beneficiario)), pf.categoria, pf.quincena desc, pf.created_at desc;

-- ---------------------------------------------------------------------------
-- LIGADO DEL HISTÓRICO. Se liga todo lo que empate por (beneficiario,
-- categoría), lleve o no la casilla: si en agosto hubo un renglón a TELMEX
-- capturado a mano, tiene que contar como «ya generado» para que la función no
-- lo duplique.
--
-- Con `row_number` y no con un update ciego: en la base hay dos pagos al mismo
-- beneficiario el mismo día (dos transferencias de $30,000 el 7 de agosto), y
-- el índice único de más abajo no perdona. Se liga el más viejo; el segundo se
-- queda suelto, que es exactamente lo que es.
-- ---------------------------------------------------------------------------
with candidatos as (
  select pf.id,
         pp.id as programado_id,
         row_number() over (
           partition by pf.quincena, pp.id order by pf.created_at, pf.id
         ) as n
    from public.pagos_fijos pf
    join public.pagos_programados pp
      on lower(btrim(pf.beneficiario)) = lower(btrim(pp.beneficiario))
     and pf.categoria = pp.categoria
   where pf.programado_id is null
)
update public.pagos_fijos pf
   set programado_id = c.programado_id
  from candidatos c
 where c.id = pf.id and c.n = 1;

-- Lo que quedó suelto y traía la casilla puesta se apaga: por sí sola ya no
-- significa nada. (El trigger ya normalizó las filas que el update tocó.)
update public.pagos_fijos set recurrente = false
 where programado_id is null and recurrente;

-- ---------------------------------------------------------------------------
-- IDEMPOTENCIA REAL. Va DESPUÉS del sembrado: si hubiera un choque en los
-- datos viejos, la migración se cae aquí con la fila a la vista y no a medio
-- insert. Es lo que impide que dos personas generando la misma quincena al
-- mismo tiempo dejen la lista duplicada.
-- ---------------------------------------------------------------------------
create unique index if not exists pagos_fijos_unico_por_quincena
  on public.pagos_fijos (quincena, programado_id)
  where programado_id is not null;

-- ===========================================================================
-- LA VISTA QUE LEE LA PANTALLA
-- ===========================================================================
create or replace view public.v_pagos_programados with (security_invoker = on) as
select pp.id,
       pp.tipo,
       pp.trabajador_id,
       pp.beneficiario,
       pp.categoria,
       pp.monto,
       pp.metodo,
       pp.periodicidad,
       pp.descripcion,
       pp.notas,
       pp.activo,
       pp.orden,
       pp.created_at,
       pp.updated_at,
       p.nombre                          as trabajador_nombre,
       -- Nulo cuando no hay nadie ligado; falso sólo si lo hay y está de baja.
       p.activo                          as trabajador_activo,
       p.oficio,
       (select max(pf.quincena) from public.pagos_fijos pf
         where pf.programado_id = pp.id) as ultima_quincena,
       (select count(*) from public.pagos_fijos pf
         where pf.programado_id = pp.id) as pagos_generados
  from public.pagos_programados pp
  left join public.profiles p on p.id = pp.trabajador_id;

grant select on public.v_pagos_programados to authenticated;

-- ===========================================================================
-- GENERAR LA QUINCENA · ahora desde el catálogo, no copiando la anterior
-- ===========================================================================
create or replace function public.generar_quincena(p_quincena date)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_n       integer;
  v_primera boolean;
begin
  perform public.exigir_staff();
  if p_quincena is null then return 0; end if;

  v_primera := extract(day from p_quincena) = 15;

  /*
   * Dos personas pueden apretar «Generar» a la vez, o el navegador mandar la
   * acción dos veces. El candado serializa las dos llamadas: la segunda espera,
   * ve las filas de la primera y devuelve 0 en vez de un número inflado. El
   * índice único es el cinturón; esto es el tirante, y es lo que hace que el
   * número que sale en pantalla sea cierto.
   */
  perform pg_advisory_xact_lock(hashtext('generar_quincena'),
                                (p_quincena - date '2000-01-01'));

  insert into public.pagos_fijos
    (quincena, programado_id, categoria, beneficiario, monto, metodo,
     estado, descripcion, notas)
  select p_quincena, pp.id, pp.categoria, pp.beneficiario, pp.monto, pp.metodo,
         'programado', pp.descripcion, pp.notas
    from public.pagos_programados pp
   where pp.activo
     and (pp.periodicidad = 'quincenal'
          or (pp.periodicidad = 'primera' and v_primera)
          or (pp.periodicidad = 'segunda' and not v_primera))
     -- Ya salió desde el catálogo.
     and not exists (
       select 1 from public.pagos_fijos ya
        where ya.quincena = p_quincena and ya.programado_id = pp.id)
     -- O se capturó a mano antes de que existiera la liga: mismo beneficiario,
     -- misma categoría, todavía suelto.
     and not exists (
       select 1 from public.pagos_fijos ya
        where ya.quincena = p_quincena
          and ya.programado_id is null
          and lower(btrim(ya.beneficiario)) = lower(btrim(pp.beneficiario))
          and ya.categoria = pp.categoria)
  on conflict (quincena, programado_id) where programado_id is not null
  do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

notify pgrst, 'reload schema';
