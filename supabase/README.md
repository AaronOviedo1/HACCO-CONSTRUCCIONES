# Base de datos de HaacoPro

## Orden de las migraciones

| Archivo | Contenido |
|---|---|
| `20260726000001_schema.sql` | Enumeraciones y las 29 tablas del dominio |
| `20260726000002_funciones_vistas.sql` | Folios consecutivos, triggers de negocio y 7 vistas de reporte |
| `20260726000003_rls.sql` | Helpers de rol y políticas Row Level Security |
| `20260726000004_storage.sql` | Buckets privados `avances`, `tickets` y `comprobantes` |
| `20260727000005_cotizaciones.sql` | Materiales presupuestados, funciones `guardar_cotizacion`, `duplicar_cotizacion` y `aprobar_cotizacion`, vista `v_cotizaciones` |
| `20260728000006_obras.sql` | Recibos, detalles de entrega, bitácora y las operaciones de obra |
| `20260729000007_finanzas.sql` | Recibos de nómina, gasto ramificado, abonos parciales de CxP y quincenas recurrentes |
| `seed.sql` | Catálogo real: proveedores, pinturas, insumos de taller y 57 herramientas |

Aplicar en orden con `npm run bd:push` y después `npm run bd:seed`.
El seed es idempotente.

## Convención de rutas en Storage

```
avances/{obra_id}/{archivo}              fotos y videos de la cuadrilla
tickets/{aaaa-mm}/{archivo}              tickets y facturas de gastos
comprobantes/{cotizacion_id}/{archivo}   comprobantes de pago del cliente
```

La política de `avances` lee el `obra_id` del primer segmento de la ruta, así que **el archivo
tiene que subirse dentro de la carpeta de su obra** o el insert será rechazado.

## Consecutivos

La tabla `consecutivos (serie, anio, ultimo)` es la fuente de los folios.
El seed la deja donde va la empresa hoy:

| Serie | Año | Último | Siguiente |
|---|---|---|---|
| `cotizacion` | 0 (serie global) | 451 | `F-452` |
| `ot` | 2026 | 0 | `26000001` |
| `poliza` | 2026 | 404 | `H405-26` |

Si al arrancar en producción los folios reales van más adelante, basta un `update` sobre esta
tabla antes de capturar la primera cotización.

## Las tres operaciones atómicas

Guardar, duplicar y aprobar una cotización tocan cinco tablas cada una. Si se hicieran con
llamadas sueltas desde la app, un corte a media operación dejaría el documento a medias. Por eso
viven en funciones de Postgres, que corren dentro de una sola transacción:

| Función | Qué hace |
|---|---|
| `guardar_cotizacion(id, datos)` | Reemplaza bullets, partidas, conceptos de herrería y materiales. Cada concepto de herrería genera su partida con el precio de venta ya calculado |
| `duplicar_cotizacion(id)` | Copia todo con folio nuevo y estatus borrador, para armar variantes del mismo cliente |
| `aprobar_cotizacion(id, obras, anticipo)` | Cambia el estatus, abre una o varias OTs y copia el presupuesto de materiales a la primera como `origen = 'cotizado'` |

Las tres son `SECURITY INVOKER`: respetan RLS. Un usuario de cuadrilla que las llame recibe
`new row violates row-level security policy`.

## Qué NO hace la base

- **No timbra CFDI.** Guarda el folio de factura y la bandera `requiere_factura`; el timbrado
  sigue con el contador.
- **No calcula IVA por partida.** Los precios se cotizan más IVA, como hoy: el subtotal es la
  suma de las partidas y el total aplica `iva_pct` (16% por defecto).

## Validación

El esquema completo, los triggers, las vistas y las políticas RLS se probaron contra un
Postgres 17 limpio antes de entregarse: folios, retención del 5% con y sin trabajador externo,
préstamo y devolución de herramienta, gasto a crédito generando la cuenta por pagar, y el
aislamiento de la cuadrilla (sólo su obra, su contrato, su perfil y su herramienta a resguardo).
