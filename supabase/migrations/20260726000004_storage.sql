-- ============================================================================
-- HaacoPro · Migración 004 · Buckets privados de Storage
--
-- Convención de rutas:
--   avances/{obra_id}/{archivo}          fotos y videos de la cuadrilla
--   tickets/{aaaa-mm}/{archivo}          fotos de tickets y facturas de gastos
--   comprobantes/{cotizacion_id}/{archivo}  comprobantes de pago del cliente
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avances',      'avances',      false, 52428800,
   array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']),
  ('tickets',      'tickets',      false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf']),
  ('comprobantes', 'comprobantes', false, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Staff y contador
-- ---------------------------------------------------------------------------
create policy storage_staff_todo on storage.objects
  for all to authenticated
  using (bucket_id in ('avances','tickets','comprobantes') and public.es_staff())
  with check (bucket_id in ('avances','tickets','comprobantes') and public.es_staff());

create policy storage_contador_lectura on storage.objects
  for select to authenticated
  using (bucket_id in ('avances','tickets','comprobantes') and public.es_contador());

-- ---------------------------------------------------------------------------
-- Cuadrilla · sólo la carpeta de sus obras dentro de "avances"
-- ---------------------------------------------------------------------------
create policy storage_cuadrilla_lee_avances on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avances'
    and public.es_cuadrilla()
    and public.es_mi_obra(((storage.foldername(name))[1])::uuid)
  );

create policy storage_cuadrilla_sube_avances on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avances'
    and public.es_cuadrilla()
    and public.es_mi_obra(((storage.foldername(name))[1])::uuid)
  );
