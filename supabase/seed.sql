-- ============================================================================
-- HaacoPro · Seed
-- Datos reales tomados de los archivos de operación de HAACO PRO:
--   15. CONTROL_HERRAMIENTAS.xlsx  → herramientas, insumos de taller y precios
--   11. CUENTAS_X_PAGAR.xlsx       → proveedores y días de crédito
-- Ejecutar después de las migraciones. Es idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- CONSECUTIVOS · continúan las series que la empresa ya trae
-- ---------------------------------------------------------------------------
insert into public.consecutivos (serie, anio, ultimo) values
  ('cotizacion', 0,    451),   -- siguiente: F-452
  ('ot',         2026, 0),     -- siguiente: 26000001
  ('poliza',     2026, 404)    -- siguiente: H405-26
on conflict (serie, anio) do nothing;

-- ---------------------------------------------------------------------------
-- PROVEEDORES · con sus días de crédito reales
-- ---------------------------------------------------------------------------
insert into public.proveedores (nombre, dias_credito_default, notas) values
  ('FERRECASA',           15, 'Ferretería general'),
  ('TOOLS',               21, 'Herramienta y consumibles'),
  ('PIC DESARROLLOS',     30, 'Material de construcción'),
  ('PRO SYSTEMS MR',      15, 'Servicios y sistemas'),
  ('PINTURAS EL VAQUERO', 10, 'Pintura'),
  ('PRISA',                0, 'Proveedor principal de pintura. Folios tipo PN#####')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------------------------
-- PRODUCTOS · pinturas y recubrimientos que se cotizan seguido
-- ---------------------------------------------------------------------------
insert into public.productos (nombre, codigo, unidad, tipo, proveedor_id, notas)
select v.nombre, v.codigo, v.unidad, v.tipo::tipo_producto,
       (select id from public.proveedores where nombre = v.proveedor), v.notas
from (values
  ('Fondo / sellador vinílico blanco E-8325', 'E-8325',       'cubeta', 'pintura', 'PRISA', 'Interior'),
  ('Fondo 100% acrílico blanco ES-7049',      'ES-7049',      'cubeta', 'pintura', 'PRISA', 'Exterior'),
  ('Rivinol 7 vinil acrílica mate',           'RIVINOL-7',    'cubeta', 'pintura', 'PRISA', 'Vinílica de acabado'),
  ('Polprisa premium',                        'POLPRISA',     'cubeta', 'pintura', 'PRISA', 'Vinílica premium'),
  ('Esmalte acrílico automotriz',             'ESM-AUTO',     'litro',  'herreria','PRISA', 'Acabado de herrería'),
  ('Esmalte anticorrosivo Milco',             'MILCO',        'litro',  'herreria','PRISA', 'Anticorrosivo'),
  ('Colorex Supreme 2000',                    'COLOREX-2000', 'litro',  'herreria','PRISA', 'Esmalte anticorrosivo'),
  ('Prometal epóxico',                        'PROMETAL',     'litro',  'herreria','PRISA', 'Epóxico'),
  ('Poliuretano PU50',                        'PU50',         'litro',  'herreria','PRISA', 'APU / poliuretano'),
  ('Impermeabilizante elastomérico',          'IMP-ELAST',    'cubeta', 'otro',    'PRISA', null),
  ('Impermeabilizante fibratado',             'IMP-FIBRA',    'cubeta', 'otro',    'PRISA', null),
  ('Malla para impermeabilizante',            'IMP-MALLA',    'rollo',  'otro',    'PRISA', null)
) as v(nombre, codigo, unidad, tipo, proveedor, notas)
on conflict (codigo) where codigo is not null do nothing;

-- ---------------------------------------------------------------------------
-- INSUMOS DE TALLER · con la lista de precios real (costo / IVA / neto)
-- ---------------------------------------------------------------------------
insert into public.productos (nombre, codigo, unidad, tipo, costo, iva, precio_neto)
select v.nombre, v.codigo, v.unidad, 'insumo_taller'::tipo_producto, v.costo, v.iva, v.neto
from (values
  ('Pepe sellador negro',          'INS-01', 'pza',    41.68,  6.67,  48.35),
  ('Cuña con mango grande',        'INS-02', 'pza',    10.23,  1.64,  11.87),
  ('Papel café',                   'INS-03', 'rollo',  91.84, 14.69, 106.53),
  ('Masking amarillo 203',         'INS-04', 'rollo',  27.77,  4.44,  32.21),
  ('Masking azul',                 'INS-05', 'rollo',  80.47, 12.88,  93.35),
  ('Película plástica',            'INS-06', 'rollo', 478.10, 76.50, 554.60),
  ('Colador tela',                 'INS-07', 'pza',    39.57,  6.33,  45.90),
  ('Toalla azul Scott',            'INS-08', 'rollo',  32.26,  5.16,  37.42),
  ('Toalla amarilla',              'INS-09', 'pza',     9.77,  1.56,  11.33),
  ('Bolsa de basura',              'INS-10', 'pza',     4.39,  0.70,   5.09),
  ('Lija E 120',                   'INS-11', 'pza',    10.24,  1.64,  11.88),
  ('Lija E 80',                    'INS-12', 'pza',    10.24,  1.64,  11.88),
  ('Lija E 50',                    'INS-13', 'pza',    10.24,  1.64,  11.88),
  ('Lija E 36',                    'INS-14', 'pza',    10.24,  1.64,  11.88),
  ('Lija disco 80',                'INS-15', 'pza',     9.05,  1.45,  10.50),
  ('Felpa borrego 3/4',            'INS-16', 'pza',   219.58, 35.13, 254.71),
  ('Guantes',                      'INS-17', 'par',    22.00,  3.52,  25.52),
  ('Hule negro',                   'INS-18', 'rollo',  21.58,  3.45,  25.03),
  ('Uniforme HaacoPro blanco M',   'UNI-01', 'pza',    84.48, 13.52,  98.00),
  ('Uniforme HaacoPro blanco L',   'UNI-02', 'pza',    84.48, 13.52,  98.00),
  ('Uniforme HaacoPro blanco XL',  'UNI-03', 'pza',    84.98, 13.60,  98.58),
  ('Camiseta Prisa M',             'UNI-04', 'pza',     0.00,  0.00,   0.00),
  ('Camiseta Prisa L',             'UNI-05', 'pza',     0.00,  0.00,   0.00),
  ('Camiseta Prisa XL',            'UNI-06', 'pza',     0.00,  0.00,   0.00),
  ('Gorra HaacoPro verde',         'UNI-07', 'pza',   180.00, 28.80, 208.80),
  ('Gorra Hacco negra',            'UNI-08', 'pza',     0.00,  0.00,   0.00),
  ('Gorra Prisa',                  'UNI-09', 'pza',     0.00,  0.00,   0.00),
  ('Chaleco HaacoPro',             'UNI-10', 'pza',     0.00,  0.00,   0.00),
  ('Uniforme herrero mezclilla',   'UNI-11', 'pza',     0.00,  0.00,   0.00)
) as v(nombre, codigo, unidad, costo, iva, neto)
on conflict (codigo) where codigo is not null do nothing;

-- Existencia inicial del kardex (corte al 26/jul/2026)
insert into public.insumos_kardex (producto_id, tipo, cantidad, fecha, notas)
select p.id, 'entrada'::tipo_movimiento, v.cant, date '2026-07-26', 'Existencia inicial · migración de Excel'
  from (values
  ('INS-01', 18), ('INS-03', 18), ('INS-04', 46), ('INS-05', 19), ('INS-06',  4),
  ('INS-07', 27), ('INS-08', 1.5),('INS-09', 17), ('INS-11', 49), ('INS-12',  3),
  ('INS-13',  5), ('INS-14',  2), ('INS-15',  3), ('INS-16',  2), ('INS-17',  2),
  ('UNI-01',  9), ('UNI-02',  2), ('UNI-04', 17), ('UNI-05', 13), ('UNI-06', 10),
  ('UNI-07',  1), ('UNI-08',  1), ('UNI-09', 13), ('UNI-10',  3), ('UNI-11',  1)
) as v(codigo, cant)
  join public.productos p on p.codigo = v.codigo
 where not exists (select 1 from public.insumos_kardex k where k.producto_id = p.id);

-- ---------------------------------------------------------------------------
-- HERRAMIENTAS · inventario real con códigos, valor, estado y ubicación
-- ---------------------------------------------------------------------------
insert into public.herramientas (codigo, nombre, marca, valor, estado, ubicacion)
select v.codigo, v.nombre, nullif(v.marca, ''), v.valor, v.estado::estado_herramienta, v.ubicacion
from (values
  ('Graco',    'Graco 490',                    'Graco',        20000.00, 'en_obra',       'Jorge'),
  ('Hidro',    'Hidrolavadora',                'Dewalt',        7000.00, 'disponible',    'Taller'),
  ('Planta N', 'Planta de energía',            'Power Rush',   11000.00, 'en_obra',       'Luis Enrique'),
  ('Hus-CH',   'Compresor negro chico',        'Husky',         4000.00, 'en_obra',       'Jorge'),
  ('Hus-GR',   'Compresor negro grande',       'Husky',        10199.00, 'disponible',    'Taller'),
  ('SP',       'Sopladora amarilla',           'Ryobi',         7000.00, 'disponible',    'Taller'),
  ('CP',       'Compresor azul',               'Goodyear',      4000.00, 'disponible',    'Taller'),
  ('LR-1',     'Lijadora roja',                'Bessom',        3272.40, 'en_obra',       'Jorge'),
  ('LR-2',     'Lijadora roja',                'Bessom',        3272.40, 'en_obra',       'Jorge'),
  ('LR-3',     'Lijadora roja',                'Bessom',        3272.40, 'disponible',    'Taller'),
  ('LR-4',     'Lijadora roja',                'Bessom',        3272.40, 'disponible',    'Taller'),
  ('LO-CH',    'Lijadora orbital chica',       'Truper',        1000.00, 'en_obra',       'Jorge'),
  ('CH-1',     'Caja de herramientas',         'Truper',         840.00, 'en_obra',       'Jorge'),
  ('CH-2',     'Caja de herramientas',         'Truper',         840.00, 'en_obra',       'Jorge'),
  ('CH-G1',    'Caja de herramientas grande',  'Husky',         2275.00, 'disponible',    'Taller'),
  ('CH-G2',    'Caja de herramientas grande',  'Husky',         2275.00, 'disponible',    'Taller'),
  ('E5-10.1',  'Escalera tijera 5-10',         'Truper',            null, 'disponible',    'Taller'),
  ('E6-12.1',  'Escalera tijera 6-12',         'Truper',        2500.00, 'disponible',    'Taller'),
  ('E6-12.2',  'Escalera tijera 6-12',         'Truper',        2500.00, 'disponible',    'Taller'),
  ('E6-12.3',  'Escalera tijera 6-12',         'Truper',        2500.00, 'disponible',    'Taller'),
  ('E6-12.4',  'Escalera tijera 6-12',         'Truper',        2500.00, 'fuera_servicio','Taller'),
  ('E6-12.5',  'Escalera tijera 6-12',         'Truper',        2500.00, 'fuera_servicio','Taller'),
  ('E7-14.1',  'Escalera tijera 7-14',         'Truper',        3500.00, 'en_obra',       'Jorge'),
  ('E7-14.2',  'Escalera tijera 7-14',         'Truper',        3500.00, 'en_obra',       'Jorge'),
  ('E7-14.3',  'Escalera tijera 7-14',         'Truper',        3500.00, 'en_obra',       'Jorge'),
  ('E14-28',   'Escalera tijera 14-28',        'Truper',        7200.00, 'en_obra',       'Alejandro'),
  ('EP',       'Escalera de peldaño negra',    'Truper',        2000.00, 'disponible',    'Taller'),
  ('EM-1',     'Empapeladora',                 '3M',             400.00, 'en_obra',       'Jorge'),
  ('EM-2',     'Empapeladora',                 '3M',             400.00, 'disponible',    'Alejandro'),
  ('EM-3',     'Empapeladora',                 '3M',             400.00, 'disponible',    'Jorge'),
  ('EM-4',     'Empapeladora',                 '3M',             400.00, 'disponible',    'Taller'),
  ('EM-5',     'Empapeladora',                 '3M',             400.00, 'disponible',    'Taller'),
  ('EM-6',     'Empapeladora',                 '3M',             400.00, 'disponible',    'Taller'),
  ('EM-7',     'Empapeladora',                 '3M',             400.00, 'disponible',    'Taller'),
  ('CM',       'Cámara con base',              'Steren',        1700.00, 'en_obra',       'Jorge'),
  ('LA-1',     'Letrero anuncio',              'Personalizado',  603.20, 'en_obra',       'Jorge'),
  ('LA-2',     'Letrero anuncio',              'Personalizado',  603.20, 'en_obra',       'Yasxen'),
  ('EX-CH1',   'Extensión eléctrica chica',    'Truper',         300.00, 'disponible',    'Taller'),
  ('EX-CH2',   'Extensión eléctrica chica',    'Truper',         300.00, 'disponible',    'Taller'),
  ('EX-G1',    'Extensión eléctrica grande',   'Truper',         460.00, 'en_obra',       'Jorge'),
  ('LM-1',     'Lona de montaje',              'Personalizado',  550.00, 'en_obra',       'Jorge'),
  ('LM-2',     'Lona de montaje',              'Personalizado',  550.00, 'disponible',    'Alejandro'),
  ('LM-3',     'Lona de montaje',              'Personalizado',  550.00, 'disponible',    'Taller'),
  ('EX-R1',    'Extensión de rodillo',         'byp',            200.00, 'disponible',    'Taller'),
  ('EX-R2',    'Extensión de rodillo',         'byp',            200.00, 'disponible',    'Alejandro'),
  ('EX-R3',    'Extensión de rodillo',         'byp',            200.00, 'disponible',    'Taller'),
  ('EX-R4',    'Extensión de rodillo',         'byp',            200.00, 'disponible',    'Taller'),
  ('PL-1',     'Pala',                         '',               250.00, 'disponible',    'Taller'),
  ('PL-2',     'Pala',                         '',               250.00, 'disponible',    'Taller'),
  ('PP-1',     'Pistola de pintura',           'Goni',           750.00, 'disponible',    'Taller'),
  ('PP-2',     'Pistola de pintura',           'Goni',           750.00, 'disponible',    'Taller'),
  ('MN',       'Manguera',                     '',               750.00, 'disponible',    'Taller'),
  ('CC',       'Casa de campaña',              '',                  null, 'disponible',    'Taller'),
  ('MR',       'Manta reusable',               '',                  null, 'en_obra',       'Jorge'),
  ('AN-1',     'Andamio torre',                '',              3000.00, 'disponible',    'Taller'),
  ('AN-2',     'Andamio torre',                '',              3000.00, 'disponible',    'Taller'),
  ('ESME',     'Esmeriladora inalámbrica',     'Ryobi',         1400.00, 'disponible',    'Taller')
) as v(codigo, nombre, marca, valor, estado, ubicacion)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- BIBLIOTECA DE TEXTOS DE PROCESO (bullets del PDF de cotización)
-- Ajustables desde Catálogo → Textos de proceso.
-- ---------------------------------------------------------------------------
insert into public.textos_proceso (titulo, contenido, orden)
select v.titulo, v.contenido, v.orden
from (values
  ('Protección de áreas', 1,
   'Proteger pisos, ventanería, cancelería, muebles y accesorios que no serán intervenidos, con película plástica, papel y masking.'),
  ('Preparación de superficie', 2,
   'Preparación de superficie: retiro de material desprendido, limpieza y resane de imperfecciones menores.'),
  ('Lijado de superficie', 3,
   'Lijado de superficie para dar adherencia al recubrimiento. HAACO PRO no se hace responsable por imperfecciones propias del acabado de tablaroca (juntas, cintas o cabezas de tornillo) existentes previamente a la aplicación.'),
  ('Sellador', 4,
   'Suministro y aplicación de sellador con el producto {PRODUCTO}.'),
  ('Pintura', 5,
   'Suministro y aplicación de pintura con el producto {PRODUCTO}, a dos manos.'),
  ('Esmalte', 6,
   'Suministro y aplicación de esmalte con el producto {PRODUCTO} en los elementos que apliquen.'),
  ('Impermeabilizante', 7,
   'Suministro y aplicación de impermeabilizante {PRODUCTO}, incluye aplicación de malla en juntas y desagües.'),
  ('Limpieza', 8,
   'Limpieza total del área al concluir los trabajos, retirando protecciones y residuos.')
) as v(titulo, orden, contenido)
where not exists (select 1 from public.textos_proceso t where t.titulo = v.titulo);
