-- ===========================================================================
-- EL AVISO DE LA MAÑANA APRENDE LA HORA
--
-- La tabla de recordatorios trae `hora` desde el primer día —«sin hora es un
-- pendiente del día; con hora es una cita»— y hasta ahora nadie la había
-- usado: los recordatorios de cotización son llamadas, y una llamada se hace
-- cuando se puede. La visita del técnico sí tiene hora, y decirla en el aviso
-- es la mitad del aviso: «Visita Gilberto Inda» sirve de poco si no dice si es
-- a las nueve o a las cinco.
--
-- De paso entra la tercera liga, la del servicio, para que el aviso lleve a la
-- reparación y no al tablero.
--
-- Va en archivo aparte porque `create or replace` no puede cambiar las
-- columnas de un `returns table` —«cannot change return type of existing
-- function»— y hay que tirar la función. Con el drop se van los permisos: si
-- no se vuelven a emitir, el cron falla a las siete de la mañana y nadie se
-- entera hasta que alguien pregunta por qué no le llegó nada.
-- ===========================================================================

drop function if exists public.avisos_de_recordatorios();

create function public.avisos_de_recordatorios()
returns table (
  recordatorio_id uuid,
  titulo          text,
  nota            text,
  fecha           date,
  hora            time,
  vencido         boolean,
  cotizacion_id   uuid,
  obra_id         uuid,
  servicio_id     uuid,
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
  select r.id, r.titulo, r.nota, r.fecha, r.hora,
         r.fecha < public.hoy_hermosillo(),
         r.cotizacion_id, r.obra_id, r.servicio_id,
         s.id, s.endpoint, s.p256dh, s.auth
    from public.recordatorios r
    join public.push_suscripciones s
      on r.para is null or s.profile_id = r.para
   where r.atendido_en is null
     and r.fecha <= public.hoy_hermosillo()
   -- Las citas del día salen en el orden en que hay que atenderlas; lo que no
   -- tiene hora es un pendiente y va al final.
   order by r.fecha, r.hora nulls last, r.id;
$$;

-- Sólo el service_role: son para el cron, que corre sin sesión. Se vuelven a
-- emitir porque el drop de arriba se llevó los de la migración 034.
revoke all on function public.avisos_de_recordatorios() from public, anon, authenticated;
grant execute on function public.avisos_de_recordatorios() to service_role;
