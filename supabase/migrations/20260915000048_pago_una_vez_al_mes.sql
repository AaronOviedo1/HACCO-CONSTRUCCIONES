-- ===========================================================================
-- QUITAR UN PAGO DE UNA QUINCENA Y QUE SE QUEDE QUITADO
--
--   «se generaron las 2 quincenas de septiembre, pero me aparecen duplicados
--    unos pagos, al querer eliminar de una quincena el pago que no corresponde,
--    no me lo permite, se vuelve a generar de nuevo. por ejemplo, pagos de
--    Telmex, telcel, y contabilidad son solo 1 vez al mes, pero no me permite
--    ajustarlo»
--
-- Sí lo borra. Lo que pasa es que la pantalla vuelve a armar las quincenas del
-- mes en curso cada vez que se abre, y la lista dice que TELMEX es quincenal,
-- así que el renglón regresa antes de que se apague el parpadeo. Desde donde se
-- ve, el botón de eliminar no sirve.
--
-- Faltaban dos cosas, y son distintas:
--
--   · Que quitar algo de UNA quincena deje huella. Un pago se puede saltar por
--     razones que no son periodicidad —este mes no se paga, se pagó por otro
--     lado, se adelantó— y hasta hoy no había dónde anotarlo, así que la única
--     memoria de la decisión era la ausencia del renglón, y eso es justo lo que
--     `generar_quincena` deshace. Es `pagos_fijos_omitidos`.
--
--   · Que quitarlo pueda querer decir «ya no le toca esta mitad del mes». Eso
--     no se arregla borrando renglones: se arregla en la lista, que es de donde
--     salen. La 045 sembró todo como quincenal a propósito —el historial decía
--     lo que hizo el copiado a ciegas, no lo que la empresa quiere— y dejó
--     `periodicidad` para que alguien lo corrigiera. Nadie lo encontró: se
--     corrige en otra pestaña y el duplicado se ve en ésta.
--
-- `quitar_pago_fijo` hace una o la otra, según lo que conteste quien borra. Lo
-- que no hace ninguna de las dos es tocar lo pagado ni lo que ya pasó.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- La huella. Clave por (programado, quincena): no se omite «un pago», se omite
-- que a alguien de la lista le toque esa quincena. Si el renglón se vuelve a
-- traer a mano, la huella se borra y todo queda como si nada.
-- ---------------------------------------------------------------------------
create table if not exists public.pagos_fijos_omitidos (
  programado_id uuid not null references public.pagos_programados(id) on delete cascade,
  quincena      date not null,
  quitado_por   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (programado_id, quincena)
);

create index if not exists pagos_fijos_omitidos_quincena
  on public.pagos_fijos_omitidos (quincena);

-- RLS · el patrón de la 003, explícito porque esta tabla no está en su bucle.
alter table public.pagos_fijos_omitidos enable row level security;

drop policy if exists staff_todo on public.pagos_fijos_omitidos;
create policy staff_todo on public.pagos_fijos_omitidos
  for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

drop policy if exists contador_lectura on public.pagos_fijos_omitidos;
create policy contador_lectura on public.pagos_fijos_omitidos
  for select to authenticated
  using (public.es_contador());

grant select, insert, update, delete on public.pagos_fijos_omitidos to authenticated;

comment on table public.pagos_fijos_omitidos is
  'Quincenas de las que alguien sacó a mano a un renglón de la lista.
   `generar_quincena` las respeta: es lo que hace que eliminar un pago fijo se
   quede eliminado y no vuelva a aparecer al recargar la pantalla.';

-- ===========================================================================
-- GENERAR LA QUINCENA · igual que en la 045, más la huella
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
     -- O alguien ya lo sacó de esta quincena a mano y no hay que discutírselo.
     and not exists (
       select 1 from public.pagos_fijos_omitidos om
        where om.quincena = p_quincena and om.programado_id = pp.id)
  on conflict (quincena, programado_id) where programado_id is not null
  do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- A qué quincena pertenece una fecha, con la misma regla que la pantalla: del
-- 1 al 15 es la primera, del 16 en adelante la segunda.
--
-- Hace falta porque la fecha de un pago se puede corregir a mano —la nómina de
-- dirección se paga sin fecha fija y cae fuera del ciclo—, así que preguntar si
-- el día es el 15 no basta para saber de qué mitad del mes se está hablando. Es
-- el gemelo de `quincenaDe` en `lib/finanzas.ts`: si se separan, la huella se
-- guarda en un día y la pantalla la busca en otro.
-- ---------------------------------------------------------------------------
create or replace function public.quincena_de(p_fecha date)
returns date language sql immutable set search_path = public as $$
  select case when extract(day from p_fecha) <= 15
              then date_trunc('month', p_fecha)::date + 14
              else (date_trunc('month', p_fecha) + interval '1 month - 1 day')::date
         end
$$;

-- ===========================================================================
-- QUITAR UN PAGO · y decir hasta dónde
-- ===========================================================================
-- `p_alcance`:
--   'esta'    — sólo de esta quincena. Deja la huella y la lista no se toca.
--   'siempre' — además, en la lista pasa a ser una vez al mes: se queda en la
--               otra mitad y se limpian las quincenas por venir que ya no le
--               tocan. Sólo aplica a lo que hoy está marcado como quincenal;
--               lo que ya es de una vez al mes cae en 'esta', porque saltarse
--               su único pago del mes no es cambiarle la periodicidad.
--
-- Devuelve qué pasó, para poder decirlo con todas sus letras en la pantalla y
-- no dejar a nadie adivinando si el cambio fue de un renglón o de la lista.
create or replace function public.quitar_pago_fijo(
  p_id      uuid,
  p_alcance text default 'esta'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_pago      public.pagos_fijos%rowtype;
  v_prog      public.pagos_programados%rowtype;
  v_quincena  date;
  v_primera   boolean;
  v_nueva     public.periodicidad_pago;
  v_limpiados integer := 0;
begin
  perform public.exigir_staff();

  select * into v_pago from public.pagos_fijos where id = p_id;
  if not found then
    raise exception 'Ese pago ya no existe: alguien más lo quitó.';
  end if;

  delete from public.pagos_fijos where id = p_id;

  -- Un pago suelto no sale de ninguna lista: borrarlo es borrarlo y ya.
  if v_pago.programado_id is null then
    return jsonb_build_object('beneficiario', v_pago.beneficiario,
                              'periodicidad', null, 'limpiados', 0);
  end if;

  select * into v_prog from public.pagos_programados where id = v_pago.programado_id;

  -- Siempre por `quincena_de`: es la fecha con la que la pantalla lo acomodó y
  -- con la que va a venir a buscarlo, aunque la del pago sea otra.
  v_quincena := public.quincena_de(v_pago.quincena);
  v_primera  := extract(day from v_quincena) = 15;

  if p_alcance = 'siempre' and v_prog.periodicidad = 'quincenal' then
    v_nueva := (case when v_primera then 'segunda' else 'primera' end)
                 ::public.periodicidad_pago;
    update public.pagos_programados
       set periodicidad = v_nueva
     where id = v_prog.id;

    /*
     * Y se van las quincenas por venir que ya no le tocan. El piso es la
     * quincena que se está borrando y no la fecha de hoy: quien está viendo el
     * 30 de septiembre dice «de aquí en adelante», y un pago de agosto que
     * nadie marcó no tiene por qué desaparecer por eso. Lo pagado tampoco se
     * toca: eso ya salió del banco.
     */
    with fuera as (
      delete from public.pagos_fijos pf
       where pf.programado_id = v_prog.id
         and pf.estado <> 'pagado'
         and public.quincena_de(pf.quincena) >= v_quincena
         and (extract(day from public.quincena_de(pf.quincena)) = 15) = v_primera
      returning 1
    )
    select count(*) into v_limpiados from fuera;
  else
    insert into public.pagos_fijos_omitidos (programado_id, quincena, quitado_por)
    values (v_pago.programado_id, v_quincena, auth.uid())
    on conflict (programado_id, quincena) do nothing;
  end if;

  return jsonb_build_object('beneficiario', v_pago.beneficiario,
                            'periodicidad', v_nueva::text,
                            'limpiados', v_limpiados);
end $$;

comment on function public.quitar_pago_fijo(uuid, text) is
  'Quita un pago fijo de su quincena. Con p_alcance = ''siempre'' además deja
   al renglón de la lista como de una vez al mes y limpia las quincenas por
   venir que ya no le tocan. Nunca toca lo pagado ni las quincenas anteriores.';

-- ---------------------------------------------------------------------------
-- Volver a traer lo que se quitó. La huella se borra y `generar_quincena`
-- vuelve a hacer su trabajo: sin esto, quitar algo por error no tendría vuelta
-- atrás más que capturándolo suelto, y un renglón suelto ya no es de la lista.
-- ---------------------------------------------------------------------------
create or replace function public.restaurar_pago_fijo(
  p_programado uuid,
  p_quincena   date
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_quincena date := public.quincena_de(p_quincena);
begin
  perform public.exigir_staff();

  delete from public.pagos_fijos_omitidos
   where programado_id = p_programado and quincena = v_quincena;

  return public.generar_quincena(v_quincena);
end $$;

comment on function public.restaurar_pago_fijo(uuid, date) is
  'Deshace un «quitar de esta quincena»: borra la huella y vuelve a generar.';

-- ===========================================================================
-- EL AJUSTE QUE PIDIÓ EL CLIENTE · lo que es de una vez al mes
-- ===========================================================================
-- La 045 no quiso adivinar la periodicidad mirando el historial, y hacía bien:
-- el historial decía lo que hizo el copiado a ciegas. Ya no hace falta
-- adivinar, la empresa lo dijo: «pagos de Telmex, telcel, y contabilidad son
-- solo 1 vez al mes».
--
-- Se dejan en la 1ª quincena, que es donde ya venían saliendo primero, y se
-- limpia el duplicado de la 2ª de lo que todavía no se paga y no ha pasado.
-- Quien prefiera cobrarlos a fin de mes lo cambia en «Personal y servicios»,
-- que para eso ya se ve.
--
-- Sólo toca lo que sigue marcado como quincenal: si alguien ya lo corrigió a
-- mano, esto no le pasa por encima.
with mensuales as (
  update public.pagos_programados pp
     set periodicidad = 'primera'
   where pp.periodicidad = 'quincenal'
     and (pp.beneficiario ilike '%telmex%'
          or pp.beneficiario ilike '%telcel%'
          or coalesce(pp.descripcion, '') ilike '%contab%')
  returning pp.id
)
delete from public.pagos_fijos pf
 using mensuales m
 where pf.programado_id = m.id
   and pf.estado <> 'pagado'
   and pf.quincena >= current_date
   and extract(day from public.quincena_de(pf.quincena)) <> 15;

notify pgrst, 'reload schema';
