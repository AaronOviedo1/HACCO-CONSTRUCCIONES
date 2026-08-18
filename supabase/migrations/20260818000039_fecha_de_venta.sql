-- La fecha en que se vendió, no la fecha en que se cotizó
--
-- El panel contaba la venta del mes por `cotizaciones.fecha`, que es cuando se
-- escribió la cotización. Una cotización de julio que el cliente aprobó en
-- agosto sumaba a julio, y un mes ya cerrado seguía creciendo hacia atrás cada
-- vez que se aprobaba algo viejo. Al 18 de agosto de 2026 eso dejaba fuera tres
-- obras aprobadas en el mes: el panel enseñaba $124,701.22 de $346,749.32.
--
-- El dato bueno ya se guardaba —`fecha_resolucion`, que llena
-- `aprobar_cotizacion`—, nada más no salía a la vista. Aquí se expone junto con
-- `fecha_venta`, que es la de aprobación con la de elaboración de respaldo: las
-- cotizaciones viejas que no traen resolución siguen contando por su fecha, tal
-- como hoy, en vez de desaparecer del histórico.
--
-- Sólo se agregan columnas, así que quien consulta la vista con `select *` no
-- se entera.

drop view if exists public.v_cotizaciones;

create view public.v_cotizaciones with (security_invoker = on) as
select c.id,
       c.folio,
       c.fecha,
       c.fecha_resolucion,
       -- El mes al que pertenece la venta.
       coalesce(c.fecha_resolucion, c.fecha)                           as fecha_venta,
       c.tipo,
       c.estatus,
       c.requiere_factura,
       c.nombre_obra,
       c.subtotal,
       c.descuento_pct,
       round(c.subtotal * c.descuento_pct / 100, 2)                    as descuento,
       c.iva_pct,
       c.total,
       c.anticipo_pct,
       round(c.total * coalesce(c.anticipo_pct, 50) / 100, 2)          as anticipo_esperado,
       c.vigencia_dias,
       (c.fecha + c.vigencia_dias)                                     as vence,
       c.cliente_id,
       cl.nombre                                                       as cliente,
       (select count(*) from public.obras o where o.cotizacion_id = c.id)      as obras,
       coalesce((select sum(p.monto) from public.pagos_cobranza p
                  where p.cotizacion_id = c.id), 0)                    as cobrado,
       c.created_at,
       c.updated_at
  from public.cotizaciones c
  join public.clientes cl on cl.id = c.cliente_id;
