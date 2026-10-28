-- ===========================================================================
-- PERMISOS DEL RESIDENTE
--
-- Hasta hoy la base sólo conocía dos niveles de oficina: Dirección y
-- Administración, que pasan por `staff_todo` en todas las tablas. El
-- residente queda en medio, como el MAESTRO de COS:
--
--   ✓ obras, cronograma, bitácora, avances, materiales, conceptos, detalles
--   ✓ cotizaciones (con márgenes), recordatorios y clientes
--   ✓ contratos de mano de obra, pagarés, pólizas y herramientas
--   ✓ gastos de obra y salidas de caja chica
--   ✓ nómina: raya, sueldos, préstamos y pagos
--   ✗ cobranza, cuentas por pagar, pagos fijos, precios, usuarios, reportes
--   ✗ meterle dinero a la caja chica
--   ✗ borrar cualquier cosa
--
-- La regla para escribir: lo que la app guarda directo en la tabla lleva su
-- política; lo que pasa por una función (gastos, nómina, pagarés) se abre en
-- la función y la tabla le queda de sólo lectura. Así el motor de precios y
-- las cuentas por pagar que un gasto arrastra por dentro siguen cerradas.
-- ===========================================================================

create or replace function public.es_residente()
returns boolean language sql stable security definer set search_path = public
as $$ select public.mi_rol() = 'residente' $$;

-- Quien opera: los dos de oficina más el residente.
create or replace function public.es_equipo()
returns boolean language sql stable security definer set search_path = public
as $$ select public.mi_rol() in ('admin', 'administracion', 'residente') $$;

create or replace function public.exigir_equipo()
returns void
language plpgsql stable set search_path = public as $$
begin
  if not public.es_equipo() then
    raise exception 'Esta operación es de Dirección, Administración o Residencia'
      using errcode = '42501';
  end if;
end $$;

grant execute on function public.es_residente(), public.es_equipo(), public.exigir_equipo()
  to authenticated;

-- ---------------------------------------------------------------------------
-- TABLAS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  -- Lee, da de alta y corrige. Nunca borra.
  foreach t in array array[
    'obras', 'obra_conceptos', 'cronograma_tareas', 'obra_materiales', 'obra_detalles',
    'avances', 'solicitudes_material', 'bitacora_obra',
    'cotizaciones', 'cotizacion_items', 'cotizacion_procesos',
    'cotizacion_herreria_desglose', 'cotizacion_materiales', 'recordatorios', 'clientes',
    'contratos_oficial', 'pagare_items', 'polizas_garantia', 'herramientas', 'deducciones'
  ] loop
    execute format(
      'create policy residente_lee on public.%I for select to authenticated
         using (public.es_residente())', t);
    execute format(
      'create policy residente_crea on public.%I for insert to authenticated
         with check (public.es_residente())', t);
    execute format(
      'create policy residente_corrige on public.%I for update to authenticated
         using (public.es_residente()) with check (public.es_residente())', t);
  end loop;

  -- Sólo lectura: o se escriben por función, o son catálogo de oficina que el
  -- residente consulta (el buscador de la cotización enseña el último precio
  -- pagado) pero no edita.
  foreach t in array array[
    'gastos', 'cuentas_por_pagar', 'pagares', 'insumos_kardex',
    'nomina_pagos', 'recibos_nomina', 'rayas_semanales', 'raya_obras',
    'sueldos_semanales', 'sueldo_obras',
    'productos', 'proveedores', 'producto_alias', 'precios_material', 'textos_proceso'
  ] loop
    execute format(
      'create policy residente_lee on public.%I for select to authenticated
         using (public.es_residente())', t);
  end loop;

  -- Guardar una cotización reescribe sus renglones (guardar_cotizacion_hijos
  -- borra y vuelve a insertar). Eso es editar, no borrar: sin esto, el
  -- residente no podría quitarle una partida a su propia cotización.
  foreach t in array array[
    'cotizacion_items', 'cotizacion_procesos', 'cotizacion_materiales',
    'cotizacion_herreria_desglose'
  ] loop
    execute format(
      'create policy residente_reescribe on public.%I for delete to authenticated
         using (public.es_residente())', t);
  end loop;
end $$;

-- Caja chica: gasta del fondo y ve el saldo, pero el dinero lo mete la oficina.
create policy residente_lee on public.caja_chica
  for select to authenticated using (public.es_residente());

create policy residente_saca on public.caja_chica
  for insert to authenticated
  with check (public.es_residente() and tipo = 'salida');

create policy residente_corrige on public.caja_chica
  for update to authenticated
  using (public.es_residente() and tipo = 'salida')
  with check (public.es_residente() and tipo = 'salida');

-- Ve al equipo: elige oficial en los contratos, responsable en el cronograma
-- y a quién se le paga en la nómina. Dar de alta gente sigue siendo de Dirección.
alter policy profiles_ver_equipo on public.profiles
  using (public.es_staff() or public.es_contador() or public.es_residente());

-- ---------------------------------------------------------------------------
-- STORAGE · fotos de avance y bitácora, y tickets de gasto
-- ---------------------------------------------------------------------------
create policy storage_residente_lee on storage.objects
  for select to authenticated
  using (bucket_id in ('avances', 'tickets') and public.es_residente());

create policy storage_residente_sube on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avances', 'tickets') and public.es_residente());

-- ---------------------------------------------------------------------------
-- FUNCIONES · las que el residente sí opera
--
-- Hoy empiezan con exigir_staff() y corren con los permisos de quien llama.
-- Se les cambia la guarda por exigir_equipo() y pasan a correr como su dueño:
-- un gasto toca por dentro el motor de precios y las cuentas por pagar, y una
-- raya toca los recibos, y nada de eso debe quedarle abierto al residente
-- fuera de la función. La guarda va primero, así que nadie más entra.
--
-- Se reescriben desde su definición vigente en vez de copiarlas aquí: son
-- dieciocho funciones largas y una copia a mano es donde se cuela un error.
-- OJO para el futuro: si una migración vuelve a definir alguna de éstas, debe
-- llevar exigir_equipo() y `security definer`, o le quitará el acceso al
-- residente sin que nadie lo note.
-- ---------------------------------------------------------------------------
do $$
declare
  abiertas constant text[] := array[
    -- obra
    'recorrer_cronograma', 'salida_taller_a_obra', 'entregar_obra',
    -- contratos y pagarés
    'reasignar_contrato', 'crear_pagare', 'editar_pagare', 'cancelar_pagare',
    -- gastos
    'registrar_gasto', 'editar_gasto', 'entrada_inventario_desde_gasto',
    -- nómina
    'generar_raya', 'guardar_raya', 'cerrar_raya', 'cancelar_raya',
    'guardar_sueldo_semanal', 'pagar_nomina', 'editar_recibo_nomina',
    'cancelar_recibo_nomina'
  ];
  f regprocedure;
  definicion text;
  vistas integer := 0;
begin
  for f in
    select p.oid::regprocedure
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = any (abiertas)
  loop
    definicion := pg_get_functiondef(f);
    if position('public.exigir_staff()' in definicion) = 0 then
      raise exception '% ya no empieza con exigir_staff(): revisar a mano', f;
    end if;
    execute replace(definicion, 'public.exigir_staff()', 'public.exigir_equipo()');
    execute format('alter function %s security definer', f);
    vistas := vistas + 1;
  end loop;

  -- Una función renombrada o con una sobrecarga nueva no debe pasar en silencio.
  if vistas <> cardinality(abiertas) then
    raise exception 'Se esperaban % funciones y se encontraron %', cardinality(abiertas), vistas;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- El concentrado de la obra había perdido su security_invoker: la 046 lo
-- recreó con `create or replace view` sin la opción, y Postgres la descarta.
-- Desde entonces cualquier sesión —la cuadrilla incluida— podía leer el
-- dinero de todas las obras pidiéndolo a la API. Con la opción de vuelta, la
-- vista respeta las políticas de sus tablas, como todas las demás.
-- ---------------------------------------------------------------------------
alter view public.v_obra_concentrado set (security_invoker = on);
