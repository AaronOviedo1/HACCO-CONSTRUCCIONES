-- ===========================================================================
-- LA VISITA SE COBRA, EL ANTICIPO A VECES Y EL PREVENTIVO CADA SEIS MESES
--
-- Tres cosas que se preguntaron a Dirección después de la primera entrega y
-- que cambian el modelo, no sólo la pantalla:
--
--   «Se cobra la visita de $400.»
--   «Se pide anticipo cuando es algo grande (a veces), no siempre.»
--   «Sí, los servicios preventivos son cada 6 meses.»
--
-- La primera es la que pesa. Ir a ver un portón cuesta, y ese costo no depende
-- de que el cliente acepte: un presupuesto rechazado deja una visita cobrada.
-- Como estaba, un servicio rechazado no podía cobrarse nunca y esos $400 se
-- perdían sin que nadie los viera.
--
-- Por eso la cuota de la visita es una columna aparte y no una partida más del
-- presupuesto: son dos cosas que se deben por razones distintas y en momentos
-- distintos. La visita se debe desde que el técnico fue; la reparación, sólo
-- desde que el cliente dijo que sí. El total lo resuelve la propia fila:
--
--   agendado, cancelado  → no se debe nada; el técnico todavía no va o no fue
--   diagnóstico          → se debe la visita
--   presupuestado        → se debe la visita, mientras el cliente decide
--   rechazado            → se debe la visita, y nada más
--   aprobado, reparado   → la visita y la reparación
--
-- Si en algún trabajo la visita se absorbe —pasa cuando el cliente acepta y se
-- le hace el favor—, se pone en cero y ya. La decisión se toma caso por caso,
-- que es como la toman.
--
-- El anticipo no pide nada nuevo: ya se podían registrar varios cobros contra
-- un servicio, y un anticipo es el primero de ellos. Lo único que hacía falta
-- era dejar cobrar antes de reparar, y eso vive en la pantalla.
--
-- El preventivo sí: es otro tipo de trabajo —nadie lo pide, se ofrece— y nace
-- del anterior. Se guarda de dónde vino para poder seguir la cadena de un
-- portón a lo largo de los años.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- QUÉ CLASE DE VISITA ES
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_servicio') then
    create type public.tipo_servicio as enum ('reparacion', 'preventivo');
  end if;
end $$;

alter table public.servicios
  add column if not exists tipo public.tipo_servicio not null default 'reparacion';

-- De qué servicio nació este. El preventivo de dentro de seis meses cuelga de
-- la reparación que lo originó; `set null` porque borrar el viejo no debe
-- llevarse el que ya está agendado.
alter table public.servicios
  add column if not exists origen_id uuid references public.servicios(id) on delete set null;

create index if not exists servicios_por_origen
  on public.servicios (origen_id) where origen_id is not null;

-- ---------------------------------------------------------------------------
-- LO QUE CUESTA IR
--
-- Entra en cero para lo ya capturado —esos servicios se cobraron sin cuota y
-- cambiarles el total ahora los dejaría debiendo dinero que nadie debe— y en
-- 400 de aquí en adelante.
-- ---------------------------------------------------------------------------
alter table public.servicios
  add column if not exists cuota_visita numeric(14,2) not null default 0;

alter table public.servicios
  alter column cuota_visita set default 400;

-- ---------------------------------------------------------------------------
-- EL TOTAL, QUE AHORA DEPENDE DE EN QUÉ VA
--
-- La expresión de una columna generada no se puede cambiar: hay que tirarla y
-- volverla a poner. La vista la usa, así que se va primero y se recrea al
-- final del archivo.
-- ---------------------------------------------------------------------------
drop view if exists public.v_servicios;

alter table public.servicios drop column if exists total;

alter table public.servicios
  add column total numeric(14,2) generated always as (
    round(
      (
        case when estatus in ('agendado', 'cancelado') then 0 else cuota_visita end
        + case when estatus in ('aprobado', 'reparado') then subtotal else 0 end
      ) * (1 + iva_pct / 100),
      2
    )
  ) stored;

-- ---------------------------------------------------------------------------
-- LA VISTA
--
-- `cotizado` sigue siendo lo que se debe, para que la cuenta del dinero no
-- cambie de sitio. Se agrega `presupuesto` —lo que se le pasó al cliente— para
-- poder enseñar los $3,200 que se presupuestaron aunque hoy sólo se deban los
-- $400 de la visita porque dijo que no.
-- ---------------------------------------------------------------------------
create view public.v_servicios with (security_invoker = on) as
select s.id                                         as servicio_id,
       s.folio,
       s.tipo,
       s.origen_id,
       s.descripcion,
       s.domicilio,
       s.estatus,
       s.fecha_visita,
       s.hora_visita,
       s.diagnostico,
       s.tecnico_id,
       t.nombre                                     as tecnico,
       cl.id                                        as cliente_id,
       cl.nombre                                    as cliente,
       cl.telefono                                  as cliente_telefono,
       s.requiere_factura,
       s.subtotal,
       s.iva_pct,
       s.cuota_visita,
       /**
        * Lo que dice el papel que se le pasó al cliente: la reparación y la
        * visita juntas, se haya aprobado o no. Distinto de `cotizado`, que es
        * lo que se debe hoy —de un rechazado, sólo la visita—.
        */
       round((s.subtotal + s.cuota_visita) * (1 + s.iva_pct / 100), 2) as presupuesto,
       s.total                                      as cotizado,
       coalesce(sum(p.monto), 0)                    as cobrado,
       round(s.total - coalesce(sum(p.monto), 0), 2) as saldo,
       max(p.fecha)                                 as ultimo_pago,
       case when s.total > 0
            then round((s.total - coalesce(sum(p.monto), 0)) / s.total * 100, 2)
            else 0 end                              as pct_pendiente,
       -- La venta es del mes en que el cliente dijo que sí. Mismo criterio que
       -- `v_cotizaciones.fecha_venta`: antes de resolverse, la fecha de la
       -- visita hace de referencia para no dejar el renglón sin mes.
       coalesce(s.fecha_resolucion, s.fecha_visita) as fecha_venta,
       s.fecha_presupuesto,
       s.fecha_reparacion,
       s.vigencia_dias,
       s.garantia_dias,
       s.notas,
       s.created_at,
       s.updated_at
  from public.servicios s
  join public.clientes cl on cl.id = s.cliente_id
  left join public.profiles t on t.id = s.tecnico_id
  left join public.servicio_pagos p on p.servicio_id = s.id
 group by s.id, cl.id, t.nombre;

grant select on public.v_servicios to authenticated;
