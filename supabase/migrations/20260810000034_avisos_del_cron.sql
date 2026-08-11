-- ===========================================================================
-- LO QUE EL CRON DE RECORDATORIOS NECESITA VER
--
-- `service_role` no tiene lectura sobre ninguna tabla de este esquema —a
-- propósito: la llave de servicio anda en el entorno de Vercel y en los
-- scripts, y no debería poder leerlo todo—. Por eso el cron de precios trabaja
-- contra una RPC `security definer` estrecha y no contra las tablas, y por eso
-- éste hace lo mismo.
--
-- Son tres funciones y ninguna hace de más: una devuelve exactamente los
-- avisos que hay que mandar —el recordatorio ya cruzado con los teléfonos de
-- quien le toca—, y las otras dos guardan el resultado del envío.
-- ===========================================================================

/**
 * Un renglón por cada aviso a mandar: el recordatorio pendiente y el aparato
 * al que va. Un recordatorio sin dueño le toca a quien lo vea, así que sale
 * cruzado con todos los teléfonos dados de alta.
 *
 * Entran los de hoy y los que se pasaron de fecha: un pendiente que nadie hizo
 * no deja de existir porque amaneció.
 */
create or replace function public.avisos_de_recordatorios()
returns table (
  recordatorio_id uuid,
  titulo          text,
  nota            text,
  fecha           date,
  vencido         boolean,
  cotizacion_id   uuid,
  obra_id         uuid,
  suscripcion_id  uuid,
  endpoint        text,
  p256dh          text,
  auth            text
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.titulo, r.nota, r.fecha, r.fecha < public.hoy_hermosillo(),
         r.cotizacion_id, r.obra_id,
         s.id, s.endpoint, s.p256dh, s.auth
    from public.recordatorios r
    join public.push_suscripciones s
      on r.para is null or s.profile_id = r.para
   where r.atendido_en is null
     and r.fecha <= public.hoy_hermosillo()
   order by r.fecha, r.id;
$$;

/** Los teléfonos que el servicio de push ya no reconoce: se dan de baja. */
create or replace function public.olvidar_suscripciones(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.push_suscripciones where id = any(p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

/** Deja constancia de cuándo se le mandó algo a cada teléfono. */
create or replace function public.marcar_envio_push(p_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_suscripciones set ultimo_envio = now() where id = any(p_ids);
$$;

-- Sólo el service_role: son para el cron, que corre sin sesión. Nadie del
-- navegador tiene por qué leer los teléfonos de los demás.
revoke all on function
  public.avisos_de_recordatorios(),
  public.olvidar_suscripciones(uuid[]),
  public.marcar_envio_push(uuid[])
  from public, anon, authenticated;

grant execute on function
  public.avisos_de_recordatorios(),
  public.olvidar_suscripciones(uuid[]),
  public.marcar_envio_push(uuid[])
  to service_role;
