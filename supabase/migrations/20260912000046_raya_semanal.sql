-- ===========================================================================
-- LA RAYA DE LA SEMANA · sueldo fijo para los pintores
--
--   «Se empezará a generar pago fijo por semana a pintores, eso se podría
--    habilitar para generar en nómina o en pago fijo?»
--
-- En nómina. Lo que se le paga a un pintor es mano de obra directa, y el valor
-- de esta app está en saber cuánto costó cada obra. `pagos_fijos` no tiene
-- obra, no emite recibo con folio, no descuenta préstamos, no entiende la
-- retención ni `es_externo`, y su ciclo está clavado al día 15 y al fin de
-- mes: una semana no le cabe. Metido ahí, el daño sería doble y callado —la
-- obra saldría barata y los costos fijos de la empresa engordarían con algo
-- que es variable, de modo que el punto de equilibrio se movería dos veces
-- por el mismo peso—.
--
-- Pero tampoco cabe en el contrato de hoy. `contratos_oficial` calcula
-- `subtotal`, `retencion_haaco` y `total_pagar` como columnas generadas sobre
-- m² × tarifa, y lo devengado sale de `total_pagar × avance de la obra`. Un
-- sueldo no devenga por avance sino por tiempo, y su total no se conoce de
-- antemano: son semanas × sueldo, un blanco móvil.
--
-- Así que la raya es un segundo motor que corre en paralelo al destajo y se
-- junta con él en un solo punto: el recibo. Un mismo recibo puede llevar
-- «tres obras a destajo + la raya de la semana», que es justo lo que pidió el
-- cliente cuando dijo que las dos formas van a convivir.
--
-- Lo que contestó, y que aquí queda fijo:
--
--   · «se va a manejar en 2 formas, por avance y pago fijo» → conviven. Nada
--     impide que el mismo pintor tenga contrato y sueldo; lo que sí hay es un
--     aviso en la pantalla, porque cargarle las dos cosas a la misma obra la
--     encarece doble.
--   · «en pago fijo no se retiene 5%» → `costo_haaco_pct` nace en 0.
--   · «se repartirá el sueldo en las obras trabajadas» → `raya_obras` guarda
--     el reparto en porcentaje.
--   · «semana corre de lunes a sábado, se sigue realizando pago los días
--     sábados» → la semana se nombra por su lunes y `dias_base` es 6.
-- ===========================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'estatus_raya') then
    create type public.estatus_raya as enum ('abierta', 'cerrada', 'cancelada');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- EL TRATO · cuánto gana a la semana
-- ---------------------------------------------------------------------------
create table if not exists public.sueldos_semanales (
  id              uuid primary key default gen_random_uuid(),
  trabajador_id   uuid not null references public.profiles(id) on delete restrict,
  monto_semanal   numeric(14,2) not null check (monto_semanal > 0),
  /** Lunes a sábado. Con esto se descuenta una falta: sueldo × días / 6. */
  dias_base       smallint not null default 6 check (dias_base between 1 and 7),
  /**
   * Cero por omisión: a sueldo la empresa pone todo, así que no hay Costo
   * Haaco que retener. Queda configurable por si algún trato lo lleva, y el
   * trigger lo anula igual si el trabajador es externo.
   */
  costo_haaco_pct numeric(5,2) not null default 0 check (costo_haaco_pct >= 0 and costo_haaco_pct <= 100),
  /**
   * La obra de siempre. Si está puesta, la raya nace cargada ahí; si no, se
   * reparte entre las obras donde tenga contrato vivo.
   */
  obra_id         uuid references public.obras(id) on delete set null,
  vigencia_desde  date not null default current_date,
  vigencia_hasta  date,
  activo          boolean not null default true,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

/* Un solo trato vigente por persona: subirle el sueldo cierra el anterior con
   `vigencia_hasta` y abre otro, y las rayas ya generadas conservan el monto
   con el que salieron. */
create unique index if not exists sueldo_vigente_unico
  on public.sueldos_semanales (trabajador_id) where activo;

drop trigger if exists set_updated_at on public.sueldos_semanales;
create trigger set_updated_at before update on public.sueldos_semanales
  for each row execute function public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- EL DEVENGO · una fila por persona y semana
-- ---------------------------------------------------------------------------
create table if not exists public.rayas_semanales (
  id              uuid primary key default gen_random_uuid(),
  sueldo_id       uuid references public.sueldos_semanales(id) on delete set null,
  trabajador_id   uuid not null references public.profiles(id) on delete restrict,
  /**
   * El LUNES de la semana trabajada. Coincide con `date_trunc('week')` de
   * Postgres, así que SQL y la app dicen lo mismo sin traducir nada. El mes al
   * que pertenece una raya lo decide su fecha de pago, no su lunes: de eso ya
   * se encarga `nomina_pagos.fecha`, que es por donde la leen los reportes.
   */
  semana          date not null,
  /** Copia del trato al momento de generarla: el historial no se mueve. */
  monto_semanal   numeric(14,2) not null check (monto_semanal > 0),
  dias_base       smallint not null default 6 check (dias_base between 1 and 7),
  dias_trabajados numeric(3,1) not null default 6 check (dias_trabajados >= 0),
  /** Tiempo extra, un bono, un castigo. Puede ser negativo. */
  ajuste          numeric(14,2) not null default 0,
  bruto           numeric(14,2) generated always as (
                    round(monto_semanal * dias_trabajados / dias_base + ajuste, 2)
                  ) stored,
  costo_haaco_pct numeric(5,2) not null default 0,
  retencion       numeric(14,2) generated always as (
                    round((monto_semanal * dias_trabajados / dias_base + ajuste)
                          * costo_haaco_pct / 100, 2)
                  ) stored,
  total_pagar     numeric(14,2) generated always as (
                    round((monto_semanal * dias_trabajados / dias_base + ajuste)
                          * (1 - costo_haaco_pct / 100), 2)
                  ) stored,
  estatus         public.estatus_raya not null default 'abierta',
  notas           text,
  registrado_por  uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  /** Generar dos veces la misma semana no duplica la raya de nadie. */
  unique (trabajador_id, semana)
);

create index if not exists rayas_semana on public.rayas_semanales (semana);

drop trigger if exists set_updated_at on public.rayas_semanales;
create trigger set_updated_at before update on public.rayas_semanales
  for each row execute function public.tg_set_updated_at();

/* Hermano de `contrato_retencion_externo`: a quien es externo no se le retiene. */
create or replace function public.tg_raya_retencion_externo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles p
              where p.id = new.trabajador_id and p.es_externo) then
    new.costo_haaco_pct := 0;
  end if;
  return new;
end $$;

drop trigger if exists raya_retencion_externo on public.rayas_semanales;
create trigger raya_retencion_externo before insert on public.rayas_semanales
  for each row execute function public.tg_raya_retencion_externo();

-- ---------------------------------------------------------------------------
-- EL REPARTO · a qué obras se le carga la semana
--
-- Se guarda el porcentaje y no el importe: así la suma cuadra por construcción
-- con `total_pagar` y no hay dos contabilidades del mismo número. Sin filas =
-- costo general de la empresa, que es un caso legítimo (taller, limpieza, una
-- semana sin obra asignada).
-- ---------------------------------------------------------------------------
create table if not exists public.raya_obras (
  raya_id uuid not null references public.rayas_semanales(id) on delete cascade,
  obra_id uuid not null references public.obras(id) on delete cascade,
  pct     numeric(5,2) not null check (pct > 0 and pct <= 100),
  primary key (raya_id, obra_id)
);

create index if not exists raya_obras_obra on public.raya_obras (obra_id);

-- ---------------------------------------------------------------------------
-- RLS · staff escribe, contador lee, y cada quien ve su propia raya.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['sueldos_semanales', 'rayas_semanales', 'raya_obras'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_todo on public.%I', t);
    execute format('create policy staff_todo on public.%I for all to authenticated
                    using (public.es_staff()) with check (public.es_staff())', t);
    execute format('drop policy if exists contador_lectura on public.%I', t);
    execute format('create policy contador_lectura on public.%I for select to authenticated
                    using (public.es_contador())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists cuadrilla_ve_su_raya on public.rayas_semanales;
create policy cuadrilla_ve_su_raya on public.rayas_semanales
  for select to authenticated
  using (public.es_cuadrilla() and trabajador_id = auth.uid());

-- ---------------------------------------------------------------------------
-- EL RECIBO ACEPTA LOS DOS MOTORES
--
-- Un renglón de recibo abona a un contrato o a una raya, nunca a los dos ni a
-- ninguno. Con esto, el folio, el PDF, los préstamos descontados y la
-- cancelación siguen funcionando igual para las dos formas de pago.
-- ---------------------------------------------------------------------------
alter table public.nomina_pagos alter column contrato_id drop not null;

alter table public.nomina_pagos
  add column if not exists raya_id uuid references public.rayas_semanales(id) on delete cascade;

alter table public.nomina_pagos drop constraint if exists nomina_pago_de_uno;
alter table public.nomina_pagos add constraint nomina_pago_de_uno
  check (num_nonnulls(contrato_id, raya_id) = 1);

create index if not exists nomina_pagos_raya on public.nomina_pagos (raya_id)
  where raya_id is not null;

-- ===========================================================================
-- VISTAS
-- ===========================================================================
-- `v_nomina_contratos` NO se toca: es la garantía de que los pintores a
-- destajo que hoy están en producción no se enteran de nada.

create or replace view public.v_rayas_semanales with (security_invoker = on) as
select r.id                                   as raya_id,
       r.trabajador_id,
       p.nombre                               as trabajador,
       p.es_externo,
       p.oficio,
       r.semana,
       (r.semana + 5)                         as semana_termina,
       r.monto_semanal,
       r.dias_base,
       r.dias_trabajados,
       r.ajuste,
       r.bruto                                as mano_obra,
       r.costo_haaco_pct,
       r.retencion                            as retencion_haaco,
       r.total_pagar                          as total,
       -- Una raya vale lo que dice desde que existe: el tiempo ya se trabajó.
       -- Sólo cancelarla la pone en cero.
       case when r.estatus = 'cancelada' then 0 else r.total_pagar end as devengado,
       coalesce(sum(n.monto), 0)              as pagado,
       round(r.total_pagar - coalesce(sum(n.monto), 0), 2) as por_pagar,
       greatest(0, round(
         case when r.estatus = 'cancelada' then 0 else r.total_pagar end
         - coalesce(sum(n.monto), 0), 2))     as disponible,
       max(n.fecha)                           as ultimo_pago,
       r.estatus,
       r.notas,
       (select string_agg(o.nombre || ' (' || ro.pct || '%)', ' · ' order by ro.pct desc)
          from public.raya_obras ro join public.obras o on o.id = ro.obra_id
         where ro.raya_id = r.id)             as obras,
       (select coalesce(sum(ro.pct), 0) from public.raya_obras ro
         where ro.raya_id = r.id)             as pct_asignado
  from public.rayas_semanales r
  join public.profiles p on p.id = r.trabajador_id
  left join public.nomina_pagos n on n.raya_id = r.id
 group by r.id, p.id;

grant select on public.v_rayas_semanales to authenticated;

-- ---------------------------------------------------------------------------
-- `v_prenomina` se vuelve la suma de los dos motores.
--
-- Los nombres y los tipos de las columnas de antes se conservan tal cual para
-- que la app no se entere; lo nuevo se agrega al final. De regalo, un pintor a
-- puro sueldo —sin un solo contrato— antes no existía para la pantalla, y
-- ahora aparece solo.
-- ---------------------------------------------------------------------------
drop view if exists public.v_prenomina;

create view public.v_prenomina with (security_invoker = on) as
with destajo as (
  select v.trabajador_id,
         count(*)                  as contratos_activos,
         sum(v.mano_obra)          as total_mano_obra,
         sum(v.retencion_haaco)    as retencion,
         sum(v.total)              as total_contratos,
         sum(v.devengado)          as devengado,
         sum(v.pagado)             as pagado,
         sum(v.por_pagar)          as pendiente,
         sum(v.disponible)         as disponible,
         max(v.ultimo_pago)        as ultimo_pago
    from public.v_nomina_contratos v
   where v.estatus = 'activo'
   group by v.trabajador_id
), sueldo as (
  select r.trabajador_id,
         count(*) filter (where r.por_pagar > 0) as semanas_por_pagar,
         sum(r.mano_obra)          as total_mano_obra,
         sum(r.retencion_haaco)    as retencion,
         sum(r.total)              as total_contratos,
         sum(r.devengado)          as devengado,
         sum(r.pagado)             as pagado,
         sum(r.por_pagar)          as pendiente,
         sum(r.disponible)         as disponible,
         max(r.ultimo_pago)        as ultimo_pago
    from public.v_rayas_semanales r
   where r.estatus <> 'cancelada'
   group by r.trabajador_id
)
select p.id                                                        as trabajador_id,
       p.nombre                                                    as trabajador,
       p.es_externo,
       p.oficio,
       coalesce(d.contratos_activos, 0) + coalesce(s.semanas_por_pagar, 0) as contratos_activos,
       coalesce(d.total_mano_obra, 0) + coalesce(s.total_mano_obra, 0)     as total_mano_obra,
       coalesce(d.retencion, 0)       + coalesce(s.retencion, 0)           as retencion,
       coalesce(d.total_contratos, 0) + coalesce(s.total_contratos, 0)     as total_contratos,
       coalesce(d.devengado, 0)       + coalesce(s.devengado, 0)           as devengado,
       coalesce(d.pagado, 0)          + coalesce(s.pagado, 0)              as pagado,
       coalesce(d.pendiente, 0)       + coalesce(s.pendiente, 0)           as pendiente,
       coalesce(d.disponible, 0)      + coalesce(s.disponible, 0)          as disponible,
       case when coalesce(d.total_contratos, 0) + coalesce(s.total_contratos, 0) > 0
            then round((coalesce(d.pagado, 0) + coalesce(s.pagado, 0))
                     / (coalesce(d.total_contratos, 0) + coalesce(s.total_contratos, 0)) * 100, 2)
            else 0 end                                              as pct_pagado,
       coalesce((select sum(x.monto) from public.deducciones x
                  where x.trabajador_id = p.id and not x.saldado), 0) as deducciones,
       greatest(d.ultimo_pago, s.ultimo_pago)                       as ultimo_pago,
       -- Nuevas: para separar en pantalla lo que viene de cada motor.
       coalesce(d.disponible, 0)                                    as disponible_destajo,
       coalesce(s.disponible, 0)                                    as disponible_sueldo,
       coalesce(s.semanas_por_pagar, 0)                             as semanas_por_pagar
  from public.profiles p
  left join destajo d on d.trabajador_id = p.id
  left join sueldo  s on s.trabajador_id = p.id
 where d.trabajador_id is not null or s.trabajador_id is not null;

grant select on public.v_prenomina to authenticated;

-- ---------------------------------------------------------------------------
-- `v_obra_concentrado` · la raya también es costo de la obra
--
-- Se parte de la definición vigente (la de `20260805000018_cotizaciones_v2`,
-- con `mo_cot` y el respaldo con descuento) y sólo se le añade `mo_sueldo`. Se
-- suma `total_pagar × pct`, el neto, igual que la rama de destajo suma
-- `contratos_oficial.total_pagar`: lo retenido no sale de la caja, así que no
-- es costo de la obra.
-- ---------------------------------------------------------------------------
create or replace view public.v_obra_concentrado as
 WITH mo AS (
         SELECT contratos_oficial.obra_id,
            sum(contratos_oficial.total_pagar) AS mano_obra,
            count(*) AS contratos
           FROM contratos_oficial
          GROUP BY contratos_oficial.obra_id
        ), mo_sueldo AS (
         SELECT ro.obra_id,
            sum(round(r.total_pagar * ro.pct / 100::numeric, 2)) AS mano_obra
           FROM raya_obras ro
             JOIN rayas_semanales r ON r.id = ro.raya_id
          WHERE r.estatus <> 'cancelada'::estatus_raya
          GROUP BY ro.obra_id
        ), mo_cot AS (
         SELECT cotizacion_herreria_desglose.cotizacion_id,
            sum(cotizacion_herreria_desglose.mano_obra) AS mano_obra
           FROM cotizacion_herreria_desglose
          GROUP BY cotizacion_herreria_desglose.cotizacion_id
        ), mat_cot AS (
         SELECT obra_materiales.obra_id,
            sum(obra_materiales.total) AS material
           FROM obra_materiales
          WHERE obra_materiales.origen = 'cotizado'::origen_material
          GROUP BY obra_materiales.obra_id
        ), mat_real AS (
         SELECT obra_materiales.obra_id,
            sum(obra_materiales.total) AS material
           FROM obra_materiales
          WHERE obra_materiales.origen = 'real'::origen_material
          GROUP BY obra_materiales.obra_id
        ), gas AS (
         SELECT g.obra_id,
            sum(g.monto) FILTER (WHERE g.categoria = 'viaticos'::categoria_gasto) AS viaticos,
            sum(g.monto) FILTER (WHERE g.categoria <> ALL (ARRAY['viaticos'::categoria_gasto, 'material'::categoria_gasto])) AS adicionales,
            sum(g.monto) FILTER (WHERE g.categoria = 'material'::categoria_gasto AND NOT (EXISTS ( SELECT 1
                   FROM obra_materiales m
                  WHERE m.gasto_id = g.id))) AS material_suelto
           FROM gastos g
          WHERE g.obra_id IS NOT NULL
          GROUP BY g.obra_id
        ), av AS (
         SELECT avances.obra_id,
            count(*) AS avances,
            max(avances.created_at) AS ultimo_avance
           FROM avances
          GROUP BY avances.obra_id
        )
 SELECT o.id AS obra_id,
    o.ot_numero,
    o.nombre,
    o.domicilio,
    o.estatus,
    o.cotizacion_id,
    c.folio AS cotizacion_folio,
    c.tipo AS cotizacion_tipo,
    cl.id AS cliente_id,
    cl.nombre AS cliente,
    o.fecha_apertura,
    o.fecha_estimada_entrega,
    o.fecha_ultima_actualizacion,
    o.fecha_cierre,
    o.avance_pct,
        CASE
            WHEN o.monto_cotizado > 0::numeric THEN o.monto_cotizado
            ELSE round(c.subtotal * (1::numeric - c.descuento_pct / 100::numeric), 2)
        END AS cotizado,
    COALESCE(mo_cot.mano_obra, 0::numeric) AS mano_obra_cotizada,
    COALESCE(mo.mano_obra, 0::numeric) + COALESCE(mo_sueldo.mano_obra, 0::numeric) AS mano_obra,
    COALESCE(mo.contratos, 0::bigint) AS contratos,
    COALESCE(mat_cot.material, 0::numeric) AS material_cotizado,
    COALESCE(mat_real.material, 0::numeric) + COALESCE(gas.material_suelto, 0::numeric) AS material_real,
    COALESCE(c.viaticos, 0::numeric) AS viaticos_cotizados,
    COALESCE(gas.viaticos, 0::numeric) AS viaticos,
    COALESCE(gas.adicionales, 0::numeric) AS gastos_adicionales,
        CASE
            WHEN o.monto_cotizado > 0::numeric THEN o.monto_cotizado
            ELSE round(c.subtotal * (1::numeric - c.descuento_pct / 100::numeric), 2)
        END - COALESCE(mo.mano_obra, 0::numeric) - COALESCE(mo_sueldo.mano_obra, 0::numeric) - (COALESCE(mat_real.material, 0::numeric) + COALESCE(gas.material_suelto, 0::numeric)) - COALESCE(gas.viaticos, 0::numeric) - COALESCE(gas.adicionales, 0::numeric) AS utilidad,
    COALESCE(av.avances, 0::bigint) AS avances,
    av.ultimo_avance
   FROM obras o
     JOIN cotizaciones c ON c.id = o.cotizacion_id
     JOIN clientes cl ON cl.id = c.cliente_id
     LEFT JOIN mo ON mo.obra_id = o.id
     LEFT JOIN mo_sueldo ON mo_sueldo.obra_id = o.id
     LEFT JOIN mo_cot ON mo_cot.cotizacion_id = o.cotizacion_id
     LEFT JOIN mat_cot ON mat_cot.obra_id = o.id
     LEFT JOIN mat_real ON mat_real.obra_id = o.id
     LEFT JOIN gas ON gas.obra_id = o.id
     LEFT JOIN av ON av.obra_id = o.id;

-- ===========================================================================
-- FUNCIONES
-- ===========================================================================

/** El trato: al subirle el sueldo se cierra el anterior y se abre el nuevo. */
create or replace function public.guardar_sueldo_semanal(
  p_trabajador uuid,
  p_monto      numeric,
  p_dias_base  smallint default 6,
  p_pct        numeric default 0,
  p_obra       uuid default null,
  p_notas      text default null
) returns uuid
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  perform public.exigir_staff();
  if p_monto is null or p_monto <= 0 then
    raise exception 'El sueldo semanal tiene que ser mayor a cero';
  end if;

  /* El índice único no deja dos tratos vivos para la misma persona, así que
     primero se cierra el que había. La raya ya generada no se mueve: guarda su
     propia copia del monto. */
  update public.sueldos_semanales
     set activo = false,
         vigencia_hasta = coalesce(vigencia_hasta, current_date)
   where trabajador_id = p_trabajador and activo;

  insert into public.sueldos_semanales
    (trabajador_id, monto_semanal, dias_base, costo_haaco_pct, obra_id, notas)
  values (p_trabajador, p_monto, coalesce(p_dias_base, 6), coalesce(p_pct, 0), p_obra, p_notas)
  returning id into v_id;

  return v_id;
end $$;

/** Saca del trato la raya de esa semana. Repetirla no duplica a nadie. */
create or replace function public.generar_raya(p_semana date)
returns integer
language plpgsql set search_path = public as $$
declare
  v_lunes  date;
  v_sueldo record;
  v_raya   uuid;
  v_n      integer := 0;
begin
  perform public.exigir_staff();
  if p_semana is null then return 0; end if;
  v_lunes := date_trunc('week', p_semana)::date;

  perform pg_advisory_xact_lock(hashtext('generar_raya'), (v_lunes - date '2000-01-01'));

  for v_sueldo in
    select * from public.sueldos_semanales
     where activo
       and vigencia_desde <= v_lunes + 6
       and (vigencia_hasta is null or vigencia_hasta >= v_lunes)
     order by created_at
  loop
    v_raya := null;

    insert into public.rayas_semanales
      (sueldo_id, trabajador_id, semana, monto_semanal, dias_base,
       dias_trabajados, costo_haaco_pct, registrado_por)
    values
      (v_sueldo.id, v_sueldo.trabajador_id, v_lunes, v_sueldo.monto_semanal,
       v_sueldo.dias_base, v_sueldo.dias_base, v_sueldo.costo_haaco_pct, auth.uid())
    on conflict (trabajador_id, semana) do nothing
    returning id into v_raya;

    if v_raya is null then continue; end if;
    v_n := v_n + 1;

    /* A qué obra se carga, de lo más concreto a lo más vago:
         1. la obra de siempre del trato,
         2. si no, sus contratos vivos en obras abiertas, en partes iguales,
         3. si no, ninguna: es costo general y la pantalla lo marca. */
    if v_sueldo.obra_id is not null then
      insert into public.raya_obras (raya_id, obra_id, pct) values (v_raya, v_sueldo.obra_id, 100);
    else
      /* Por obras distintas, no por contratos: en una misma obra un oficial
         puede tener tres contratos —interior, exterior, reparaciones— y
         repartir entre ellos dejaba la obra al 33%% y el resto se iba a costo
         general sin que nadie lo pidiera. */
      insert into public.raya_obras (raya_id, obra_id, pct)
      select v_raya, x.obra_id, round(100.0 / count(*) over (), 2)
        from (select distinct c.obra_id
                from public.contratos_oficial c
                join public.obras o on o.id = c.obra_id
               where c.trabajador_id = v_sueldo.trabajador_id
                 and c.estatus = 'activo'
                 and o.estatus not in ('cerrada', 'terminada')) x
      on conflict do nothing;
    end if;
  end loop;

  return v_n;
end $$;

/**
 * Corregir una raya: los días, el ajuste y el reparto por obra.
 *
 * El reparto se borra y se reinserta entero, como hace `editar_recibo_nomina`
 * con los renglones: el formulario manda el documento completo, así que una
 * obra que se quitó deja de cargar.
 */
create or replace function public.guardar_raya(
  p_raya            uuid,
  p_dias_trabajados numeric,
  p_ajuste          numeric default 0,
  p_notas           text default null,
  p_obras           jsonb default '[]'::jsonb
) returns void
language plpgsql set search_path = public as $$
declare
  v_total numeric := 0;
  v_fila  jsonb;
begin
  perform public.exigir_staff();

  if not exists (select 1 from public.rayas_semanales where id = p_raya) then
    raise exception 'Esa raya ya no existe';
  end if;

  if p_dias_trabajados is null or p_dias_trabajados < 0 then
    raise exception 'Los días trabajados no pueden ser negativos';
  end if;

  for v_fila in select * from jsonb_array_elements(coalesce(p_obras, '[]'::jsonb)) loop
    v_total := v_total + coalesce((v_fila->>'pct')::numeric, 0);
  end loop;

  if v_total > 100 then
    raise exception 'El reparto entre obras suma % por ciento, y no puede pasar de 100', v_total;
  end if;

  update public.rayas_semanales
     set dias_trabajados = p_dias_trabajados,
         ajuste          = coalesce(p_ajuste, 0),
         notas           = p_notas
   where id = p_raya;

  delete from public.raya_obras where raya_id = p_raya;

  insert into public.raya_obras (raya_id, obra_id, pct)
  select p_raya, (v->>'obra_id')::uuid, (v->>'pct')::numeric
    from jsonb_array_elements(coalesce(p_obras, '[]'::jsonb)) v
   where coalesce((v->>'pct')::numeric, 0) > 0
  on conflict (raya_id, obra_id) do update set pct = excluded.pct;
end $$;

/** Marcar la semana como cerrada, o reabrirla si se cerró antes de tiempo. */
create or replace function public.cerrar_raya(p_raya uuid, p_cerrada boolean default true)
returns void
language plpgsql set search_path = public as $$
begin
  perform public.exigir_staff();
  update public.rayas_semanales
     set estatus = case when p_cerrada then 'cerrada'::estatus_raya else 'abierta'::estatus_raya end
   where id = p_raya and estatus <> 'cancelada';
end $$;

/** Cancelar una raya que no debió existir. Si ya se pagó, primero el recibo. */
create or replace function public.cancelar_raya(p_raya uuid)
returns void
language plpgsql set search_path = public as $$
begin
  perform public.exigir_staff();

  if exists (select 1 from public.nomina_pagos where raya_id = p_raya) then
    raise exception 'Esta raya ya tiene abonos. Cancela primero el recibo donde se pagó';
  end if;

  update public.rayas_semanales set estatus = 'cancelada' where id = p_raya;
end $$;

-- ---------------------------------------------------------------------------
-- El recibo, ampliado: cada bloque abona a un contrato o a una raya.
-- Un mismo recibo puede llevar las dos cosas, que es el caso que pidió el
-- cliente: unos pintores por avance y otros a sueldo, y alguno con ambas.
-- ---------------------------------------------------------------------------
create or replace function public.pagar_nomina(
  p_trabajador uuid, p_fecha date, p_metodo metodo_pago, p_pagos jsonb,
  p_deducciones uuid[] default '{}'::uuid[], p_notas text default null
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_recibo      uuid;
  v_bloque      jsonb;
  v_subtotal    numeric := 0;
  v_deducciones numeric := 0;
  v_monto       numeric;
begin
  perform public.exigir_staff();

  if jsonb_array_length(coalesce(p_pagos, '[]'::jsonb)) = 0 then
    raise exception 'Hay que abonar a por lo menos una obra';
  end if;

  select coalesce(sum(monto), 0) into v_deducciones
    from public.deducciones
   where id = any(p_deducciones) and trabajador_id = p_trabajador and not saldado;

  for v_bloque in select * from jsonb_array_elements(p_pagos) loop
    v_subtotal := v_subtotal + coalesce((v_bloque->>'monto')::numeric, 0);
  end loop;

  if v_subtotal <= 0 then raise exception 'El importe del recibo tiene que ser mayor a cero'; end if;
  if v_deducciones > v_subtotal then
    raise exception 'Las deducciones (%) superan el importe del recibo (%)',
      to_char(v_deducciones, 'FM$999,999,990.00'), to_char(v_subtotal, 'FM$999,999,990.00');
  end if;

  insert into public.recibos_nomina
    (trabajador_id, fecha, metodo, subtotal, deducciones, total, notas, registrado_por)
  values (p_trabajador, p_fecha, p_metodo, round(v_subtotal, 2), round(v_deducciones, 2),
          round(v_subtotal - v_deducciones, 2), p_notas, auth.uid())
  returning id into v_recibo;

  for v_bloque in select * from jsonb_array_elements(p_pagos) loop
    v_monto := coalesce((v_bloque->>'monto')::numeric, 0);
    if v_monto <= 0 then continue; end if;

    insert into public.nomina_pagos
      (contrato_id, raya_id, fecha, monto, porcentaje_del_pago, metodo, recibo_id, registrado_por)
    values (
      nullif(v_bloque->>'contrato_id', '')::uuid,
      nullif(v_bloque->>'raya_id', '')::uuid,
      p_fecha,
      v_monto,
      nullif(v_bloque->>'porcentaje', '')::numeric,
      p_metodo,
      v_recibo,
      auth.uid()
    );
  end loop;

  update public.deducciones
     set saldado = true, recibo_id = v_recibo
   where id = any(p_deducciones) and trabajador_id = p_trabajador and not saldado;

  /* La semana que queda saldada se cierra sola: es la señal de «ya quedó». */
  update public.rayas_semanales r
     set estatus = 'cerrada'
   where r.estatus = 'abierta'
     and r.id in (select raya_id from public.nomina_pagos where recibo_id = v_recibo and raya_id is not null)
     and r.total_pagar <= (select coalesce(sum(n.monto), 0) from public.nomina_pagos n where n.raya_id = r.id);

  return v_recibo;
end $$;

create or replace function public.editar_recibo_nomina(
  p_recibo uuid, p_fecha date, p_metodo metodo_pago, p_pagos jsonb, p_notas text default null
) returns void
language plpgsql set search_path = public as $$
declare
  v_bloque      jsonb;
  v_subtotal    numeric := 0;
  v_deducciones numeric := 0;
  v_monto       numeric;
begin
  perform public.exigir_staff();

  if not exists (select 1 from public.recibos_nomina where id = p_recibo) then
    raise exception 'Ese recibo ya no existe';
  end if;

  if exists (select 1 from public.recibos_nomina
              where id = p_recibo and cancelado_en is not null) then
    raise exception 'Ese recibo está cancelado: no se puede corregir';
  end if;

  if jsonb_array_length(coalesce(p_pagos, '[]'::jsonb)) = 0 then
    raise exception 'Hay que abonar a por lo menos una obra';
  end if;

  for v_bloque in select * from jsonb_array_elements(p_pagos) loop
    v_subtotal := v_subtotal + coalesce((v_bloque->>'monto')::numeric, 0);
  end loop;

  if v_subtotal <= 0 then raise exception 'El importe del recibo tiene que ser mayor a cero'; end if;

  select coalesce(sum(monto), 0) into v_deducciones
    from public.deducciones where recibo_id = p_recibo;

  if v_deducciones > v_subtotal then
    raise exception 'Las deducciones (%) superan el importe corregido (%). Cancela el recibo y captúralo de nuevo.',
      to_char(v_deducciones, 'FM$999,999,990.00'), to_char(v_subtotal, 'FM$999,999,990.00');
  end if;

  -- Se borran y se reinsertan: el formulario manda el documento completo, y
  -- así un contrato que se quitó del recibo deja de tener su abono.
  delete from public.nomina_pagos where recibo_id = p_recibo;

  for v_bloque in select * from jsonb_array_elements(p_pagos) loop
    v_monto := coalesce((v_bloque->>'monto')::numeric, 0);
    if v_monto <= 0 then continue; end if;

    insert into public.nomina_pagos
      (contrato_id, raya_id, fecha, monto, porcentaje_del_pago, metodo, recibo_id,
       registrado_por, editado_por)
    values (
      nullif(v_bloque->>'contrato_id', '')::uuid,
      nullif(v_bloque->>'raya_id', '')::uuid,
      p_fecha,
      v_monto,
      nullif(v_bloque->>'porcentaje', '')::numeric,
      p_metodo,
      p_recibo,
      auth.uid(),
      auth.uid()
    );
  end loop;

  update public.recibos_nomina
     set fecha       = p_fecha,
         metodo      = p_metodo,
         subtotal    = round(v_subtotal, 2),
         deducciones = round(v_deducciones, 2),
         total       = round(v_subtotal - v_deducciones, 2),
         notas       = p_notas,
         editado_por = auth.uid()
   where id = p_recibo;
end $$;

grant execute on function public.guardar_sueldo_semanal(uuid, numeric, smallint, numeric, uuid, text) to authenticated;
grant execute on function public.generar_raya(date) to authenticated;
grant execute on function public.guardar_raya(uuid, numeric, numeric, text, jsonb) to authenticated;
grant execute on function public.cerrar_raya(uuid, boolean) to authenticated;
grant execute on function public.cancelar_raya(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- `eliminar_obra` también mira las rayas
--
-- Contaba la mano de obra pagada uniendo `nomina_pagos` con los contratos de
-- la obra. Con la raya semanal eso se queda corto: el sueldo de un pintor se
-- reparte entre las obras donde anduvo, y sin sumar esa parte se podría borrar
-- una OT que ya tiene sueldo pagado encima. El resto de la función va igual.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.eliminar_obra(p_obra uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_obra         record;
  v_pagare       record;
  v_herramientas integer := 0;
  v_nomina       numeric;
  v_gastos       integer;
  v_caja         integer;
  v_kardex       integer;
  v_borrado      jsonb;
begin
  perform public.exigir_staff();

  select * into v_obra from public.obras where id = p_obra;
  if not found then raise exception 'La obra no existe o no tienes acceso'; end if;

  if v_obra.estatus = 'cerrada' then
    raise exception 'La OT % ya está cerrada: es histórico y no se borra', v_obra.ot_numero;
  end if;

  /* La mano de obra pagada de una obra ya no sale sólo de los contratos: la
     raya semanal de un pintor se reparte entre las obras donde anduvo, y esa
     parte también cuenta. Sin sumarla se podría borrar una OT que ya tiene
     sueldo pagado encima. */
  select coalesce(sum(n.monto), 0) into v_nomina
    from public.nomina_pagos n
    join public.contratos_oficial c on c.id = n.contrato_id
   where c.obra_id = p_obra;

  select v_nomina + coalesce(sum(round(n.monto * ro.pct / 100, 2)), 0) into v_nomina
    from public.nomina_pagos n
    join public.raya_obras ro on ro.raya_id = n.raya_id
   where ro.obra_id = p_obra;

  if v_nomina > 0 then
    raise exception 'La OT % ya tiene % pagados de mano de obra: cancela los pagos antes de borrarla',
      v_obra.ot_numero, to_char(v_nomina, 'FM$999,999,990.00');
  end if;

  select count(*) into v_gastos from public.gastos          where obra_id = p_obra;
  select count(*) into v_caja   from public.caja_chica      where obra_id = p_obra;
  select count(*) into v_kardex from public.insumos_kardex  where obra_id = p_obra;

  if v_gastos > 0 or v_caja > 0 or v_kardex > 0 then
    raise exception 'La OT % tiene movimientos de dinero ligados (% gastos, % de caja chica, % de almacén): desligalos antes de borrarla',
      v_obra.ot_numero, v_gastos, v_caja, v_kardex;
  end if;

  -- Lo que se va, para poder decírselo a quien apretó el botón.
  select jsonb_build_object(
    'ot_numero',  v_obra.ot_numero,
    'nombre',     v_obra.nombre,
    'conceptos',  (select count(*) from public.obra_conceptos       where obra_id = p_obra),
    'tareas',     (select count(*) from public.cronograma_tareas    where obra_id = p_obra),
    'materiales', (select count(*) from public.obra_materiales      where obra_id = p_obra),
    'avances',    (select count(*) from public.avances              where obra_id = p_obra),
    'contratos',  (select count(*) from public.contratos_oficial    where obra_id = p_obra),
    'rayas',      (select count(*) from public.raya_obras            where obra_id = p_obra),
    'polizas',    (select count(*) from public.polizas_garantia     where obra_id = p_obra),
    'solicitudes',(select count(*) from public.solicitudes_material where obra_id = p_obra)
  ) into v_borrado;

  -- Primero la herramienta de regreso al taller, luego el borrado.
  for v_pagare in
    select p.id from public.pagares p
      join public.contratos_oficial c on c.id = p.contrato_id
     where c.obra_id = p_obra and p.estatus = 'activo'
  loop
    v_herramientas := v_herramientas + public.cancelar_pagare(v_pagare.id);
  end loop;

  -- Los recibos de anticipo se quedan con el cliente: son de la cotización y
  -- sólo pierden la referencia a la OT (on delete set null).
  delete from public.obras where id = p_obra;

  return v_borrado
      || jsonb_build_object('herramientas_devueltas', v_herramientas)
      || jsonb_build_object('cotizacion_id', v_obra.cotizacion_id);
end $function$;

notify pgrst, 'reload schema';
