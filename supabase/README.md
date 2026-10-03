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
| `20260731000008_viaticos_cotizados.sql` | Viáticos presupuestados y cotizado en la OT |
| `20260801000009_subtareas_cronograma.sql` | Subtareas del cronograma |
| `20260801000010_conceptos_automaticos.sql` | Conceptos de la obra desde la cotización |
| `20260802000011_avance_cronograma.sql` | Avance por cronograma |
| `20260802000012_material_kardex.sql` | Materiales y kardex de la mano |
| `20260803000013_eliminar_obra.sql` | Eliminar una orden de trabajo |
| `20260805000014_enums.sql` | Valores nuevos de enumeración |
| `20260805000015_reabrir_obra.sql` | Reabrir una orden de trabajo cerrada |
| `20260805000016_abonar_cxp_lote.sql` | Pagar varias facturas de un proveedor de una sola vez |
| `20260805000017_reasignar_contrato.sql` | Pasarle una obra a otro oficial |
| `20260805000018_cotizaciones_v2.sql` | Cotizaciones · unidad de la partida y descuento en porcentaje |
| `20260806000019_personal_sin_acceso.sql` | Personal sin acceso a la app |
| `20260806000020_editar_gasto.sql` | Editar un gasto ya registrado |
| `20260806000021_material_con_iva.sql` | El material de la obra se carga con IVA |
| `20260806000022_factura_por_cliente.sql` | Quién factura se decide en el cliente |
| `20260806000023_estatus_seguimiento.sql` | «En seguimiento», entre enviada y aprobada |
| `20260806000024_precios_pintura.sql` | La pintura y sus tres precios |
| `20260806000025_ajustes.sql` | Ajustes de la casa |
| `20260806000026_editar_pago_cobranza.sql` | Corregir un pago de cobranza |
| `20260808000027_precios_vivos.sql` | Precios vivos del material |
| `20260808000028_ronda_precios.sql` | La ronda de la mañana |
| `20260810000029_insumos_desde_factura.sql` | La factura de insumos entra al taller, y es una sola cuenta por pagar |
| `20260810000030_corregir_capturas.sql` | Corregir lo capturado |
| `20260810000031_corregir_recibo_nomina.sql` | Corregir y cancelar un recibo de abono |
| `20260810000032_recordatorios.sql` | Recordatorios |
| `20260810000033_push_suscripciones.sql` | Notificaciones en el teléfono |
| `20260810000034_avisos_del_cron.sql` | Lo que el cron de recordatorios necesita ver |
| `20260812000035_conceptos_de_su_obra.sql` | Un gasto no se carga al concepto de otra obra |
| `20260812000036_taller_con_iva.sql` | El material que sale del taller entra por lo que costó, ahora sí |
| `20260813000037_utilidad_sobre_precio.sql` | La utilidad del cotizador de herrería es un % del precio, no del costo |
| `20260813000038_gasto_desde_caja.sql` | Un gasto pagado de caja chica descuenta solo el saldo de la caja |
| `20260818000039_fecha_de_venta.sql` | La fecha en que se vendió, no la fecha en que se cotizó |
| `20260825000040_servicios.sql` | Servicios y reparaciones |
| `20260825000041_avisos_con_hora.sql` | El aviso de la mañana aprende la hora |
| `20260825000042_visita_anticipo_preventivo.sql` | La visita se cobra, el anticipo a veces y el preventivo cada seis meses |
| `20260826000043_pagares_editables.sql` | El pagaré se corrige y se pueden firmar varios |
| `20260903000044_terminos_cotizacion.sql` | Los términos y condiciones de la cotización |
| `20260910000045_pagos_programados.sql` | La lista de a quién se le paga cada quincena |
| `20260912000046_raya_semanal.sql` | LA RAYA DE LA SEMANA · sueldo fijo para los pintores |
| `20260912000047_raya_correcciones.sql` | Correcciones a la raya semanal (revisión del PR) |
| `20260915000048_pago_una_vez_al_mes.sql` | Quitar un pago de una quincena y que se quede quitado |
| `20260916000049_sueldo_entre_obras.sql` | El sueldo se reparte entre las obras que uno diga |
| `20260916000050_permisos_quitar_pago_fijo.sql` | El permiso que le faltó a la 048 |
| `20260921000051_raya_semanas_viejas.sql` | Las semanas que quedaron pendientes |
| `20260921000052_recibo_de_pago.sql` | El recibo de pago que se le manda al cliente |
| `20261002000053_suscripcion_app.sql` | Suscripción de la app |
| `seed.sql` | Catálogo real: proveedores, pinturas, insumos de taller y 57 herramientas |

Aplicar en orden con `npm run bd:push` y después `npm run bd:seed`.
El seed es idempotente.

Las siete primeras son los cimientos; de la 008 en adelante cada archivo es un cambio pedido
por la operación y abre con un comentario largo que cuenta qué se pidió y por qué. Una
migración ya aplicada en producción no se edita: lo que haya que corregir va en una nueva.

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
