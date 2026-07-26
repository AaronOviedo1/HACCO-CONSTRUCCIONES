-- ============================================================================
-- HaacoPro · Migración 003 · Row Level Security
--
--  admin           → todo, incluida la gestión de usuarios
--  administracion  → todo lo operativo y administrativo, sin tocar usuarios
--  cuadrilla       → SÓLO sus obras: avances, solicitudes de material,
--                    su contrato, su pagaré y su cronograma. Nunca dinero ajeno.
--  contador        → sólo lectura (la UI únicamente le expone Reportes)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HELPERS · security definer para no recursar sobre las propias políticas
-- ---------------------------------------------------------------------------
create or replace function public.mi_rol()
returns rol_usuario
language sql stable security definer set search_path = public
as $$ select rol from public.profiles where id = auth.uid() and activo $$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.mi_rol() = 'admin' $$;

create or replace function public.es_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select public.mi_rol() in ('admin', 'administracion') $$;

create or replace function public.es_contador()
returns boolean language sql stable security definer set search_path = public
as $$ select public.mi_rol() = 'contador' $$;

create or replace function public.es_cuadrilla()
returns boolean language sql stable security definer set search_path = public
as $$ select public.mi_rol() = 'cuadrilla' $$;

-- ¿La obra está asignada al usuario actual mediante un contrato de mano de obra?
create or replace function public.es_mi_obra(p_obra uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.contratos_oficial c
     where c.obra_id = p_obra and c.trabajador_id = auth.uid()
  )
$$;

grant execute on function public.mi_rol, public.es_admin, public.es_staff,
                          public.es_contador, public.es_cuadrilla, public.es_mi_obra
  to authenticated;

-- Los permisos de tabla se dejan explícitos para no depender de los privilegios
-- por defecto del proyecto: quien decide qué se ve son las políticas de abajo.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ---------------------------------------------------------------------------
-- Habilitar RLS + reglas base (staff escribe / contador lee) en todas las tablas
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','proveedores','productos','herramientas','textos_proceso',
    'cotizaciones','cotizacion_procesos','cotizacion_items','cotizacion_herreria_desglose',
    'obras','obra_conceptos','cronograma_tareas','obra_materiales','insumos_kardex',
    'gastos','contratos_oficial','pagares','pagare_items','avances','solicitudes_material',
    'cuentas_por_pagar','pagos_cobranza','nomina_pagos','deducciones','pagos_fijos',
    'caja_chica','polizas_garantia','consecutivos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy staff_todo on public.%I for all to authenticated
         using (public.es_staff()) with check (public.es_staff())', t);
    execute format(
      'create policy contador_lectura on public.%I for select to authenticated
         using (public.es_contador())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- PROFILES · la gestión de usuarios es exclusiva del admin
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_ver_propio on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_ver_equipo on public.profiles
  for select to authenticated using (public.es_staff() or public.es_contador());

create policy profiles_admin_todo on public.profiles
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- ---------------------------------------------------------------------------
-- CUADRILLA · acceso acotado a sus obras
-- ---------------------------------------------------------------------------

-- Ve la ficha de sus obras (sin conceptos ni presupuestos)
create policy cuadrilla_ve_sus_obras on public.obras
  for select to authenticated
  using (public.es_cuadrilla() and public.es_mi_obra(id));

-- Ve el cronograma de sus obras
create policy cuadrilla_ve_cronograma on public.cronograma_tareas
  for select to authenticated
  using (public.es_cuadrilla() and public.es_mi_obra(obra_id));

-- Sube y consulta avances de sus obras
create policy cuadrilla_lee_avances on public.avances
  for select to authenticated
  using (public.es_cuadrilla() and public.es_mi_obra(obra_id));

create policy cuadrilla_sube_avances on public.avances
  for insert to authenticated
  with check (public.es_cuadrilla() and public.es_mi_obra(obra_id) and autor_id = auth.uid());

create policy cuadrilla_edita_su_avance on public.avances
  for update to authenticated
  using (public.es_cuadrilla() and autor_id = auth.uid())
  with check (autor_id = auth.uid());

-- Captura su lista de materiales (el herrero)
create policy cuadrilla_lee_solicitudes on public.solicitudes_material
  for select to authenticated
  using (public.es_cuadrilla() and public.es_mi_obra(obra_id));

create policy cuadrilla_crea_solicitudes on public.solicitudes_material
  for insert to authenticated
  with check (public.es_cuadrilla() and public.es_mi_obra(obra_id) and autor_id = auth.uid());

create policy cuadrilla_edita_su_solicitud on public.solicitudes_material
  for update to authenticated
  using (public.es_cuadrilla() and autor_id = auth.uid() and estatus = 'pendiente')
  with check (autor_id = auth.uid());

-- Ve SU contrato (su propio pago, no el de los demás)
create policy cuadrilla_ve_su_contrato on public.contratos_oficial
  for select to authenticated
  using (public.es_cuadrilla() and trabajador_id = auth.uid());

-- Ve SU pagaré y las herramientas que tiene a resguardo
create policy cuadrilla_ve_su_pagare on public.pagares
  for select to authenticated
  using (public.es_cuadrilla() and exists (
    select 1 from public.contratos_oficial c
     where c.id = pagares.contrato_id and c.trabajador_id = auth.uid()));

create policy cuadrilla_ve_sus_pagare_items on public.pagare_items
  for select to authenticated
  using (public.es_cuadrilla() and exists (
    select 1 from public.pagares pg
      join public.contratos_oficial c on c.id = pg.contrato_id
     where pg.id = pagare_items.pagare_id and c.trabajador_id = auth.uid()));

-- Sólo la herramienta que trae a resguardo: al devolverla deja de verla.
create policy cuadrilla_ve_sus_herramientas on public.herramientas
  for select to authenticated
  using (public.es_cuadrilla() and exists (
    select 1 from public.pagare_items i
      join public.pagares pg on pg.id = i.pagare_id and pg.estatus = 'activo'
      join public.contratos_oficial c on c.id = pg.contrato_id
     where i.herramienta_id = herramientas.id
       and c.trabajador_id = auth.uid()
       and not i.devuelta));
