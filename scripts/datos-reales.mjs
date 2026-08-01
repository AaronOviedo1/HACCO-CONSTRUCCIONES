/**
 * Carga la operación REAL de HAACO PRO, transcrita de los Excel del Drive
 * (Mi unidad → HACCO CONSTRUCCIONES, corte al 25/jul/2026):
 *
 *   1. COTIZACIONES PINTURAS 2026      → cotizaciones + partidas (las operativas)
 *   2. CONTRATOS PINTURAS 2026         → contrato de Jorge Ascacio (La Jolla 409)
 *   4. NÓMINAS PINTORES 2026           → contratos por obra, abonos, recibos, deducciones
 *   6. FORMATO PAGARÉ HERRAMIENTAS     → pagaré real de Jorge Ascacio ($47,838)
 *   7. FORMATO GARANTÍA                → póliza H404-26 (Rosario)
 *  11. CUENTAS_X_PAGAR                 → 65 facturas de proveedores
 *  13. REGISTRO CLIENTES_COBRANZA      → clientes, anticipos y abonos
 *  14. PROGRAMACION_PAGOS_QUINCENA     → pagos fijos de las quincenas de julio
 *  OTs JULIO                           → 7 órdenes de trabajo con material real
 *
 *   npm run bd:reales                  carga (falla si ya hay operación)
 *   npm run bd:reales -- --reiniciar   borra lo transaccional y recarga
 *
 * NO toca catálogos del seed (proveedores, productos, herramientas) ni
 * usuarios; solo AGREGA los productos con costo real vistos en las OTs.
 * Requiere haber corrido antes: npm run bd:seed  y  npm run usuarios:reales
 * (y usuarios:demo para Luis/Pati, que son los usuarios de Dirección).
 *
 * Los Excel no traen fecha en varios pagos: esos se cargan con fecha
 * aproximada y la nota «Fecha aproximada (migración Excel)».
 */
import pg from 'pg'

const cadena = process.env.SUPABASE_DB_URL
if (!cadena) {
  console.error('✗ Falta SUPABASE_DB_URL en .env.local (Supabase → Database → Connection string).')
  process.exit(1)
}

const reiniciar = process.argv.includes('--reiniciar')
const c = new pg.Client({ connectionString: cadena, ssl: { rejectUnauthorized: false } })
await c.connect()

const uno = async (sql, params = []) => (await c.query(sql, params)).rows[0]
const todos = async (sql, params = []) => (await c.query(sql, params)).rows

const APROX = 'Fecha aproximada (migración Excel)'

// Tablas de operación, en orden de borrado (las hijas primero).
const TRANSACCIONALES = [
  'bitacora_obra', 'recibos_nomina', 'recibos', 'obra_detalles',
  'polizas_garantia', 'caja_chica', 'pagos_fijos', 'deducciones', 'nomina_pagos',
  'pagos_cobranza', 'cuentas_por_pagar', 'solicitudes_material', 'avances',
  'pagare_items', 'pagares', 'contratos_oficial', 'insumos_kardex',
  'obra_materiales', 'gastos', 'cronograma_tareas', 'obra_conceptos', 'obras',
  'cotizacion_materiales', 'cotizacion_items', 'cotizacion_herreria_desglose',
  'cotizacion_procesos', 'cotizaciones', 'clientes',
]

try {
  const { n } = await uno('select count(*)::int n from public.cotizaciones')
  if (n > 0 && !reiniciar) {
    console.error(
      `✗ La base ya tiene ${n} cotizaciones. Si quieres reemplazarlas por los datos reales:\n` +
        '    npm run bd:reales -- --reiniciar\n',
    )
    process.exit(1)
  }

  // Gente (fuera de la transacción: solo lectura)
  const perfiles = await todos('select id, nombre, correo, rol, oficio, es_externo from public.profiles')
  const porNombre = (nombre) => {
    const p = perfiles.find((x) => x.nombre === nombre)
    if (!p) throw new Error(`Falta el perfil «${nombre}». Corre antes: npm run usuarios:reales`)
    return p
  }
  // Luis y Pati son ambos admin, así que se identifican por correo.
  const porCorreo = (correo) => perfiles.find((p) => p.correo === correo)
  const luis = porCorreo('luis@haacopro.mx')
  const pati = porCorreo('pati@haacopro.mx') ?? luis
  if (!luis) throw new Error('Falta el usuario admin (Luis). Corre antes: npm run usuarios:demo')

  const T = {
    jorge: porNombre('Jorge Alejandro Ascacio'),
    jesus: porNombre('Jesús Ramos'),
    yasxen: porNombre('Yasxen Leyva'),
    jcb: porNombre('Juan Carlos Barajas'),
    abraham: porNombre('Abraham Salazar'),
    enrique: porNombre('Enrique Chaparro'),
    alejandro: porNombre('Alejandro González López'),
  }

  await c.query('begin')

  if (reiniciar) {
    for (const t of TRANSACCIONALES) await c.query(`delete from public.${t}`)
    await c.query(
      "delete from public.consecutivos where serie in ('cotizacion','ot','poliza','recibo','recibo_nomina')",
    )
    console.log('  · operación anterior borrada')
  }

  // -------------------------------------------------------------------------
  // CLIENTES · «13. REGISTRO CLIENTES_COBRANZA» + hojas de cotización
  // -------------------------------------------------------------------------
  const CLIENTES = {
    martin:     ['Martín Díaz', 'Arq.', null, null, null, 'Cotización 234 sin concepto en el registro de cobranza'],
    villasenor: ['Andrés Villaseñor', 'Ing.', null, null, 'VIGA Constructores · Las Riberas Residencial', null],
    danielr:    ['Daniel Rodríguez Navarro', 'Ing.', null, null, 'Salamanca #19, Puerta Grande Residencial / Esmeralda #6, La Jolla Residencial, Hermosillo', 'Cliente recurrente (cotizaciones 194, 326, 330 y 409)'],
    faz:        ['Daniel Faz', null, null, null, 'Calle del Quetzal #112, La Gran Reserva, Los Lagos Residencial', null],
    villalba:   ['Carolina Villalba', 'Arq.', null, null, 'Villa del Parque, Las Riberas Residencial', 'Obra de la hoja 403 (Atn. Daniel Silva en la cotización original)'],
    gutierrez:  ['Javier Gutiérrez', 'Sr.', null, null, 'Herminio Ciscomani #922, Col. Pitic, Hermosillo', 'La hoja 439 va Atn. Rosa Elena de Gutiérrez'],
    astiazaran: ['Luis Fernando Astiazarán', null, null, null, 'Monterosa Residencial', null],
    flores:     ['Jorge Flores', null, null, null, 'Bonaterra Residencial', null],
    coronado:   ['Carlos Coronado', 'Ing.', null, null, null, null],
    oviedo:     ['César Oviedo', 'Arq.', null, null, null, 'Cliente recurrente (~25 cotizaciones en 2026)'],
    alba:       ['Alba Beltrán', 'Sra.', null, null, 'Los Lagos Residencial (Atn. Arq. Liz Aros)', null],
    moreno:     ['Francisco Javier Moreno', null, '662 140 0027', null, 'Villa de Parras Residencial', null],
    violeta:    ['Violeta Ayala', null, null, null, null, 'Cotización sin folio en el registro («xx»)'],
    monteverde: ['Alejandro Monteverde', null, null, null, null, 'Cotización sin folio en el registro («xx»)'],
    rosario:    ['Rosario', null, null, null, 'Miguel Alemán #13, Col. ISSSTE Federal, Hermosillo', 'Póliza de garantía H404-26'],
    vazquez:    ['Javier Vázquez', null, null, null, 'Monterosa Residencial', null],
  }
  const cli = {}
  for (const [k, [nombre, titulo, telefono, correo, domicilio, notas]] of Object.entries(CLIENTES)) {
    cli[k] = await uno(
      `insert into public.clientes (nombre, titulo_cortesia, telefono, correo, domicilio, notas)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [nombre, titulo, telefono, correo, domicilio, notas],
    )
  }
  console.log(`  · ${Object.keys(cli).length} clientes`)

  // -------------------------------------------------------------------------
  // COTIZACIONES · folios reales; iva_pct=0 cuando el monto del registro de
  // cobranza NO trae IVA (total = subtotal), 16 cuando sí (321 y 439).
  // -------------------------------------------------------------------------
  const COTIZACIONES = [
    // clave, folio, cliente, obra, domicilio, tipo, factura, iva, fecha, esperado, notas, partidas [desc, m2, pu]
    ['c194', 'F-194', 'danielr', 'Rep. exterior, detallado de muros y albañilería', 'Salamanca #19, Puerta Grande Residencial', 'pintura', true, 0, '2026-02-25', 75960.40,
      'Facturación: Sí (el registro de cobranza maneja el monto sin IVA)',
      [['Exterior (fondo ES-7049 + Rivinol 7)', 763.6, 89], ['Detallado de muros y albañilería', null, 8000]]],
    ['c234', 'F-234', 'martin', 'Obra Arq. Martín Díaz', null, 'pintura', false, 0, '2025-12-15', 88044.52,
      'Sin concepto ni hoja de cotización en el Excel; fecha aproximada. Partida única con el total del registro de cobranza.',
      [['Trabajos cotizados (concepto no registrado en el Excel)', null, 88044.52]]],
    ['c321', 'F-321', 'villasenor', 'Vistas de herrería · Las Riberas', 'Las Riberas Residencial', 'herreria', true, 16, '2026-02-17', 66700.00,
      'El registro de cobranza incluye IVA ($57,500 + 16% = $66,700)',
      [['Fabricación e instalación de vistas de herrería para 16.65 ml con láminas en C14, incluye pintura en herrería', null, 27700],
       ['Fabricación e instalación de vistas de herrería para 12.45 ml con láminas en C14, incluye pintura en herrería', null, 25600],
       ['Vistas de herrería entre ventanas con láminas 4x10 C14 y varilla corrugada 3/8', null, 4200]]],
    ['c326', 'F-326', 'danielr', 'Rep. interior y rep. de vistas de herrería', 'Puerta Grande Residencial', 'mixta', true, 0, '2026-02-25', 128250.00,
      'Facturación: Sí (el registro de cobranza maneja el monto sin IVA)',
      [['Repintado interior con Rivinol 7', 1490, 75], ['Repintado de vistas de herrería de exterior', null, 16500]]],
    ['c330', 'F-330', 'danielr', 'Puerta con vidrio y puerta peatonal', 'Puerta Grande Residencial', 'herreria', true, 0, '2026-03-12', 97450.00,
      'Facturación: Sí sin IVA. La hoja suma $93,450; el registro de cobranza dice $97,450 (se agrega partida «Adicional»).',
      [['Puerta principal con vidrios templados 6 mm, secciones 1.23+1.2+1.2+1.23 x 3.22 m, incluye pintura e instalación', null, 77450],
       ['Puerta peatonal de herrería 2.41 x 0.88 m, incluye pintura', null, 16000],
       ['Adicional (diferencia registrada en cobranza)', null, 4000]]],
    ['c333', 'F-333', 'flores', 'Puerta doble de pasillo · Bonaterra', 'Bonaterra Residencial', 'herreria', false, 0, '2026-03-04', 28500.00, null,
      [['Puerta de pasillo doble 2.4 x 1.95 m, tableros al frente y lámina lisa atrás, incluye jaladeras y pintura', null, 28500]]],
    ['c359', 'F-359', 'moreno', 'Repintado de asador', 'Villa de Parras Residencial', 'pintura', false, 0, '2026-04-07', 11900.00, null,
      [['Repintado de asador (primario Primetal EB 4301 + esmalte PU50)', null, 11900]]],
    ['c397', 'F-397', 'coronado', 'Superficie nueva interior', null, 'pintura', true, 0, '2026-05-06', 103351.49,
      'La hoja de cotización suma $122,395.68; manda el registro de cobranza ($103,351.49). Partida única.',
      [['Suministro y aplicación de fondo y pintura Rivinol 7 en interior (incluye lambrín WPC)', null, 103351.49]]],
    ['c403', 'F-403', 'villalba', 'Vistas, barandal y forrado de trabe · Villa del Parque, Las Riberas', 'Villa del Parque, Las Riberas Residencial', 'herreria', false, 0, '2026-05-20', 228300.00,
      'Conceptos 1, 2 y 3 de la hoja 403 (Atn. Daniel Silva). El registro de cobranza la asigna a la Arq. Carolina Villalba.',
      [['Fabricación e instalación de vistas frontales y traseras de herrería (molduras en ventanas, acceso y parte trasera), lámina lisa C12, incluye pintura', null, 144500],
       ['Fabricación e instalación de barandal para terraza, PTR 6x4 C11 con placas de acero 3/8', null, 25500],
       ['Forrado de trabe en cochera de 3 x 4 m, lámina lisa 4x10 C12 y PTR 1 1/2 C14', null, 58300]]],
    ['c404', 'F-404', 'rosario', 'Repintado interior y exterior · Alemán #13', 'Miguel Alemán #13, Col. ISSSTE Federal', 'pintura', false, 0, '2026-05-18', 22710.76, null,
      [['Repintado interior (fondo E-8325 + Rivinol 7)', 38, 93],
       ['Repintado exterior (fondo ES-7049 + Rivinol 7)', 179.32, 93],
       ['Detalles de albañilería menor', null, 2500]]],
    ['c409', 'F-409', 'danielr', 'Pintura interior y exterior · La Jolla 1era parte', 'Esmeralda #6, La Jolla Residencial', 'pintura', false, 0, '2026-06-13', 173430.00,
      'Versión «anticipo» de la hoja 409 (la que empata con cobranza). Anticipo 50%, abono 25% al iniciar pintura, resto al finalizar.',
      [['Área de interior (fondo E-8325 + Rivinol 7)', 1014, 100], ['Área de exterior (fondo ES-7049 + Rivinol 7)', 686, 105]]],
    ['c436', 'F-436', 'astiazaran', 'Pintura interior y exterior · Monterosa', 'Monterosa Residencial', 'pintura', false, 0, '2026-06-17', 39930.00,
      'La hoja suma $33,770 (pintura suministrada por el cliente); el registro de cobranza dice $39,930 (se agrega partida «Adicional»).',
      [['Muros de interior (pintura suministrada por el cliente)', 425, 55],
       ['Exterior (pintura suministrada por el cliente)', 189, 55],
       ['Trabajos adicionales (diferencia registrada en cobranza)', null, 6160]]],
    ['c437', 'F-437', 'vazquez', 'Repintado de puertas de herrería · Monterosa', 'Monterosa Residencial', 'herreria', false, 0, '2026-06-17', 10900.00,
      'No aparece en el registro de cobranza; se agrega porque su obra existe en las nóminas de junio.',
      [['Repintado de puerta principal y puerta de pasillo con esmalte base agua Berel 100% acrílico', null, 10900]]],
    ['c439', 'F-439', 'gutierrez', 'Trabajos de techo y teja', 'Herminio Ciscomani #922, Col. Pitic', 'pintura', true, 16, '2026-06-18', 117728.40,
      'El registro de cobranza incluye IVA ($101,490 + 16% = $117,728.40). Hoja Atn. Rosa Elena de Gutiérrez.',
      [['Trabajos en losa de sala/recibidor y baño: retiro y reinstalación de teja, estuco fibratado Blindotex e impermeabilizante elastomérico 5 años con malla', 93, 995],
       ['Impermeabilizante en área de aires acondicionados', 45, 199]]],
    ['c443', 'F-443', 'faz', 'Puertas de herrería e impermeabilizante · Los Lagos', 'Calle del Quetzal #112, La Gran Reserva, Los Lagos Residencial', 'herreria', false, 0, '2026-06-22', 60000.00,
      'Subtotal $63,600 − descuento $3,600 = $60,000',
      [['Puerta peatonal de herrería 1.00 x 2.23 m, R400 C14, lámina 4x8 C18 (2 piezas x $18,000)', 2, 18000],
       ['Puerta de herrería para salida a campo de golf 1 x 1.4 m', null, 11500],
       ['Esmalte anticorrosivo en puerta principal, incluye cambio de sella polvo', null, 12600],
       ['Impermeabilizante fibratado 5 años con malla reforzada en pérgola', null, 3500],
       ['Descuento', null, -3600]]],
    ['c446', 'F-446', 'oviedo', 'Pintura interior de baños · Hípico', null, 'pintura', false, 0, '2026-07-01', 19980.00,
      'El registro de cobranza la anota como «445»; la hoja y la OT 25000123 son la 446.',
      [['Interior de baños (fondo ES-7049 + Rivinol 7)', 222, 90]]],
    ['c451', 'F-451', 'alba', 'Rep. de herrería y fabricación · Los Lagos', 'Los Lagos Residencial', 'herreria', false, 0, '2026-07-10', 66500.00,
      'Partidas de la hoja 451 ($63,300) + adicional para empatar el registro de cobranza ($66,500).',
      [['Repintado de herrerías con esmalte acrílico automotriz: vistas frontales y traseras, puerta de garage corrediza y barandales de exterior', null, 33450],
       ['Fabricación e instalación de macetero flotante 2.5 x 0.40 x 0.40 m, lámina lisa C12, PTR 2" C14 y metal desplegado C12', null, 18600],
       ['Tapadera para registro con lámina antiderrapante 3/16 y ángulo 2" x 3/16', null, 6750],
       ['Vista para puerta principal con solera 2" x 3/16', null, 4500],
       ['Trabajos adicionales (diferencia registrada en cobranza)', null, 3200]]],
    ['c475', 'F-475', 'violeta', 'Repintado', null, 'pintura', false, 0, '2026-05-15', 82357.58,
      'Folio original «xx» en el registro de cobranza; se asignó el siguiente consecutivo. Fecha aproximada.',
      [['Repintado (concepto del registro de cobranza)', null, 82357.58]]],
    ['c476', 'F-476', 'monteverde', 'Pintura interior', null, 'pintura', false, 0, '2026-07-15', 29250.00,
      'Folio original «xx» en el registro de cobranza; se asignó el siguiente consecutivo. Fecha aproximada. Sin anticipo (100% pendiente).',
      [['Pintura interior (concepto del registro de cobranza)', null, 29250.00]]],
  ]

  const cot = {}
  for (const [clave, folio, cliente, obra, domicilio, tipo, factura, iva, fecha, esperado, notas, partidas] of COTIZACIONES) {
    const fila = await uno(
      `insert into public.cotizaciones
         (folio, cliente_id, nombre_obra, domicilio_obra, tipo, estatus, requiere_factura,
          iva_pct, fecha, fecha_envio, fecha_resolucion, notas, creado_por,
          linea_calidad)
       values ($1,$2,$3,$4,$5::tipo_cotizacion,'aprobada',$6,$7,$8::date,$8::date,$8::date + 3,$9,$10,
               'Los productos mencionados son de la mejor calidad y son aplicados con equipos altamente profesionales.')
       returning id, folio`,
      [folio, cli[cliente].id, obra, domicilio, tipo, factura, iva, fecha, notas, luis.id],
    )
    for (const [i, [descripcion, m2, pu]] of partidas.entries()) {
      await c.query(
        `insert into public.cotizacion_items (cotizacion_id, descripcion, m2, precio_unitario, orden)
         values ($1,$2,$3,$4,$5)`,
        [fila.id, descripcion, m2, pu, i],
      )
    }
    const { total } = await uno('select total from public.cotizaciones where id = $1', [fila.id])
    if (Math.abs(Number(total) - esperado) > 0.05) {
      throw new Error(`Cotización ${folio}: total ${total} ≠ esperado ${esperado}`)
    }
    cot[clave] = { id: fila.id, folio, total: Number(total) }
  }
  console.log(`  · ${COTIZACIONES.length} cotizaciones con partidas (totales verificados)`)

  // -------------------------------------------------------------------------
  // COBRANZA · anticipos y abonos del registro (sin fechas en el Excel:
  // se reparten desde la fecha de la cotización, con nota).
  // -------------------------------------------------------------------------
  const COBRANZA = [
    // cotización, [tipo, monto][]  (fechas ≈ fecha cotización + 5, +20, +35...)
    ['c234', [['anticipo', 42942.27]]],
    ['c321', [['anticipo', 40020.00], ['abono', 20010.00]]],
    ['c194', [['anticipo', 30000.00], ['abono', 12931.03], ['abono', 12931.03], ['abono', 18706.46], ['liquidacion', 1391.88]]],
    ['c326', [['anticipo', 64125.00], ['abono', 21551.72], ['abono', 17000.00], ['abono', 12931.03], ['abono', 7000.00], ['liquidacion', 5642.25]]],
    ['c330', [['anticipo', 56034.48], ['abono', 6896.55], ['abono', 15500.00], ['abono', 5050.00], ['abono', 100.00], ['abono', 3325.80]]],
    ['c443', [['anticipo', 40000.00], ['abono', 10000.00]]],
    ['c403', [['anticipo', 136980.00], ['abono', 60000.00]]],
    ['c439', [['anticipo', 58864.20], ['abono', 30446.55]]],
    ['c436', [['anticipo', 25000.00], ['abono', 8770.00], ['liquidacion', 6160.00]]],
    ['c333', [['anticipo', 17100.00], ['abono', 8550.00]]],
    ['c397', [['anticipo', 51675.75]]],
    ['c446', [['anticipo', 4500.00], ['abono', 8000.00]]],
    ['c451', [['anticipo', 38000.00], ['liquidacion', 28500.00]]],
    ['c409', [['anticipo', 60500.00]]],
    ['c359', [['anticipo', 5000.00]]],
    ['c475', [['anticipo', 31100.00], ['abono', 7750.00]]],
    // c476 Monteverde: sin pagos (100% pendiente)
    ['c404', [['anticipo', 11355.38], ['liquidacion', 11355.38]]], // no estaba en el registro; obra cerrada con garantía
    ['c437', [['anticipo', 5450.00], ['liquidacion', 5450.00]]],   // no estaba en el registro; obra terminada en junio
  ]
  for (const [clave, pagos] of COBRANZA) {
    const { fecha } = await uno('select fecha from public.cotizaciones where id = $1', [cot[clave].id])
    for (const [i, [tipo, monto]] of pagos.entries()) {
      await c.query(
        `insert into public.pagos_cobranza (cotizacion_id, tipo, monto, metodo, fecha, notas, registrado_por)
         values ($1,$2,$3,'transferencia', $4::date + $5::int, $6, $7)`,
        [cot[clave].id, tipo, monto, fecha, 5 + i * 15, APROX, pati.id],
      )
    }
  }
  console.log('  · cobranza: anticipos y abonos de 18 cotizaciones')

  // -------------------------------------------------------------------------
  // OBRAS · las 7 OTs de julio (números reales) + obras históricas de nómina
  // -------------------------------------------------------------------------
  async function abrirObra({ ot = null, cotizacion, nombre, domicilio = null, estatus, monto, avance = 0, apertura, actualizacion = null, cierre = null, notas = null }) {
    return uno(
      `insert into public.obras
         (ot_numero, cotizacion_id, nombre, domicilio, estatus, monto_cotizado, avance_pct,
          fecha_apertura, fecha_ultima_actualizacion, fecha_cierre, notas)
       values ($1,$2,$3,$4,$5::estatus_obra,$6,$7,$8::date,coalesce($9::date,$8::date),$10::date,$11)
       returning id, ot_numero`,
      [ot, cotizacion.id, nombre, domicilio, estatus, monto, avance, apertura, actualizacion, cierre, notas],
    )
  }

  const o122 = await abrirObra({ ot: '25000122', cotizacion: cot.c436, nombre: 'Luis Astiazarán · Interior Monterosa', domicilio: 'Monterosa Residencial', estatus: 'cerrada', monto: 29535, avance: 100, apertura: '2026-07-01', actualizacion: '2026-07-09', cierre: '2026-07-10' })
  const o123 = await abrirObra({ ot: '25000123', cotizacion: cot.c446, nombre: 'César Oviedo · Hípico', estatus: 'cerrada', monto: 19980, avance: 100, apertura: '2026-07-09', actualizacion: '2026-07-09', cierre: '2026-07-14' })
  const o124 = await abrirObra({ ot: '25000124', cotizacion: cot.c451, nombre: 'Alba Beltrán · Repintado herrería · Los Lagos', domicilio: 'Los Lagos Residencial', estatus: 'en_obra', monto: 33450, avance: 60, apertura: '2026-07-15', actualizacion: '2026-07-18' })
  const o125 = await abrirObra({ ot: '25000125', cotizacion: cot.c451, nombre: 'Alba Beltrán · Herrería · Los Lagos', domicilio: 'Los Lagos Residencial', estatus: 'en_obra', monto: 29850, avance: 50, apertura: '2026-07-15', actualizacion: '2026-07-23', notas: 'El Excel registra «PAGO JESUS RAMOS $2,000» como material del registro; aquí ese pago vive en nómina.' })
  const o126 = await abrirObra({ ot: '25000126', cotizacion: cot.c409, nombre: 'La Jolla 1era parte · Exterior', domicilio: 'Esmeralda #6, La Jolla Residencial', estatus: 'en_obra', monto: 36015, avance: 35, apertura: '2026-07-22', actualizacion: '2026-07-23' })
  const o127 = await abrirObra({ ot: '25000127', cotizacion: cot.c359, nombre: 'Fco. Javier Moreno · Asador', domicilio: 'Villa de Parras Residencial', estatus: 'en_obra', monto: 11900, avance: 85, apertura: '2026-07-22', actualizacion: '2026-07-22' })
  const o128 = await abrirObra({ ot: '25000128', cotizacion: cot.c409, nombre: 'La Jolla 1era parte · Interior', domicilio: 'Esmeralda #6, La Jolla Residencial', estatus: 'en_obra', monto: 50700, avance: 25, apertura: '2026-07-23', actualizacion: '2026-07-23' })

  const HIST = 'OT histórica: número no registrado en el Excel (solo existe en nóminas/cobranza).'
  const h437 = await abrirObra({ cotizacion: cot.c437, nombre: 'Repintado de puertas · Monterosa 437', domicilio: 'Monterosa Residencial', estatus: 'cerrada', monto: 10900, avance: 100, apertura: '2026-06-20', cierre: '2026-06-27', notas: HIST })
  const h436x = await abrirObra({ cotizacion: cot.c436, nombre: 'Repintado exterior · Monterosa 436', domicilio: 'Monterosa Residencial', estatus: 'cerrada', monto: 10395, avance: 100, apertura: '2026-06-20', cierre: '2026-06-30', notas: HIST })
  const h439 = await abrirObra({ cotizacion: cot.c439, nombre: 'Trabajos de techo y teja · Sr. Gutiérrez', domicilio: 'Herminio Ciscomani #922, Col. Pitic', estatus: 'terminada', monto: 117728.40, avance: 100, apertura: '2026-05-04', notas: HIST })
  const h330 = await abrirObra({ cotizacion: cot.c330, nombre: 'Puerta con vidrios · Puerta Grande', domicilio: 'Puerta Grande Residencial', estatus: 'en_obra', monto: 97450, avance: 85, apertura: '2026-04-01', notas: HIST + ' ' + APROX })
  const h321 = await abrirObra({ cotizacion: cot.c321, nombre: 'Vistas Las Riberas · VIGA', domicilio: 'Las Riberas Residencial', estatus: 'en_obra', monto: 66700, avance: 75, apertura: '2026-03-17', notas: HIST })
  const h333 = await abrirObra({ cotizacion: cot.c333, nombre: 'Cerco Bonaterra · Jorge Flores', domicilio: 'Bonaterra Residencial', estatus: 'en_obra', monto: 28500, avance: 70, apertura: '2026-04-10', notas: HIST + ' ' + APROX })
  const h403 = await abrirObra({ cotizacion: cot.c403, nombre: 'Las Riberas parte 1 · Villa del Parque', domicilio: 'Villa del Parque, Las Riberas Residencial', estatus: 'en_obra', monto: 228300, avance: 75, apertura: '2026-06-01', notas: HIST + ' Contrato de herrero: entrega/instalación del 16 al 20 de junio de 2026.' })
  const h443 = await abrirObra({ cotizacion: cot.c443, nombre: 'Puertas Los Lagos · Daniel Faz', domicilio: 'La Gran Reserva, Los Lagos Residencial', estatus: 'en_obra', monto: 60000, avance: 85, apertura: '2026-06-25', notas: HIST + ' ' + APROX })
  const h404 = await abrirObra({ cotizacion: cot.c404, nombre: 'Rosario · Alemán #13', domicilio: 'Miguel Alemán #13, Col. ISSSTE Federal', estatus: 'cerrada', monto: 22710.76, avance: 100, apertura: '2026-05-25', cierre: '2026-06-13', notas: HIST + ' Con póliza de garantía H404-26.' })
  console.log('  · 7 OTs de julio (25000122–25000128) + 9 obras históricas')

  // -------------------------------------------------------------------------
  // MATERIAL CONSUMIDO POR OT · lado «real» del Excel OTs JULIO
  // folio 'TALLER' → es_taller. Piezas/costos tal cual el Excel.
  // -------------------------------------------------------------------------
  const MATERIALES = [
    [o122, [
      ['Trapos amarillos', 2, 34], ['Papel café', 2, 99], ['Lija L120', 5, 12],
      ['Camiseta Prisa', 3, 0], ['Masking amarillo', 10, 34], ['Masking azul', 2, 93.35],
      ['Hule negro', 15, 21], ['Colorex base agua blanco', 1, 0],
      ['Lija orbital 150', 5, 20.13, 'PN14667'], ['Maneral', 1, 56.64],
      ['Felpa microfibra 9" lisa 3/8', 2, 66.06, 'PN14662'], ['Brocha 4" mango recto', 1, 107.67, 'PN14662'],
      ['Onetime', 4, 107.67, 'PN14662'], ['Desarmador estrella', 1, 36.27, 'PN14742'],
      ['Película plástica', 1, 499, 'PN14742'], ['Sellador negro', 1, 41.68],
    ]],
    [o123, [
      ['Papel café', 4, 99], ['Lija LE120', 6, 12], ['Masking amarillo', 5, 34],
      ['Masking azul', 2, 93.35], ['Hule negro', 15, 21], ['Película plástica', 1, 499],
      ['Uniforme L', 5, 84.50],
      ['Rivinol 7 · 19 L · AP14-1', 1, 2030.33, 'PN14741'], ['Rivinol 7 · 19 L · AP56-6', 1, 2030.33, 'PN14741'],
      ['Fondo blanco vinil-acrílico E-8325', 1, 971.88, 'PN14741'], ['Onetime', 2, 110.50, 'PN14741'],
      ['Lija orbital 150', 4, 22, 'PN14741'], ['Trapo amarillo', 2, 34],
      ['Brocha 3"', 2, 29.68, '9280'], ['Rivinol 7 · 4 L · AP56-6', 1, 478.14, 'PN14773'],
      ['Cuña con mango', 1, 27, null, false], ['Sellador negro', 4, 41.68, null, false],
    ]],
    [o124, [
      ['Lija orbital 80', 5, 7.66], ['Trapo amarillo', 3, 34], ['Masking amarillo', 26, 34],
      ['Hule negro', 5, 21], ['Colador papel', 3, 0], ['Papel café', 8, 99],
      ['Fondo gris claro · 4 L', 1, 816.66, 'PN14816'], ['Thinner 5 · 4 L', 1, 479.99, 'PN14816'],
      ['Thinner estándar · 4 L', 4, 55, 'PN14816'], ['Masking azul', 5, 93.35],
      ['Cuña hule verde', 2, 4.84, '24625'], ['W201 .125 1/8', 1, 56.28, '24625'],
      ['Lija L400', 1, 12.41, '24625'], ['Lija D80 5"', 10, 10.44, '24627'],
      ['Uniforme M', 1, 84.50], ['Uniforme L', 1, 84.50],
      ['Extensión eléctrica', 1, 460, null, false], ['Thinner · L', 2, 76.87, 'X-9343'],
      ['Cemplast blanco · L', 2, 113.10, 'X-9343'], ['Sobrante imper 19 L', 0.5, 0],
      ['Película plástica', 1, 499], ['Thinner acrílico · L', 4, 80, '20686'],
      ['Reductor · L', 1, 250, null, false],
    ]],
    [o125, [
      ['PTR 1 1/2" C14', 3, 387.80], ['Taquete arpón 3/8 x 3 3/4', 6, 12.80],
      ['Soldadura 6011 1/8 kg', 1, 94.39], ['Metal desplegado C12', 1.5, 259],
      ['Disco de corte 4 1/2"', 10, 13.78], ['Disco laminado 4 1/2"', 3, 59.70],
      ['Esmalte SR igualado · L', 1, 350.01], ['Solera 1" x 1/8', 1.5, 114.77],
    ].map((m) => [m[0], m[1], m[2], null, false])],
    [o126, [
      ['Fondo 100% acrílico · cubeta', 3, 2165.27, 'PN14882'], ['Maneral prof 9"', 2, 63.75, 'PN14882'],
      ['Felpa microfibra 9" rugosa 3/4', 2, 83.29, 'PN14882'], ['Brocha prof 6"', 1, 85.85, 'PN14882'],
      ['Brocha prof 4"', 1, 66.30, 'PN14882'], ['Masking amarillo', 3, 34],
      ['Película plástica', 1, 499], ['Hule negro', 10, 21],
      ['Saco de estuco', 1, 146.33, 'Fac. 60636'], ['Uniforme L', 3, 84.50],
      ['Gorra Prisa', 3, 0], ['Estuco', 1, 214.50, 'X-9358'],
    ]],
    [o127, [
      ['Masking amarillo', 2, 34], ['Trapo amarillo', 2, 34],
      ['Primetal blanco 4300', 0.5, 2177.73, 'PN14883, PN14894'], ['Catalizador Primetal 4302', 0.5, 568.63, 'PN14883, PN14894'],
      ['Solvente EXY-B', 0.3, 633.97, 'PN14883, PN14894'], ['Lija L400', 2, 11.05, 'PN14883'],
      ['Thinner estándar', 1, 54.99, 'PN14883'], ['Brocha doméstica 3"', 1, 28.04, 'PN14883'],
      ['Mini rodillo nylon 4"', 1, 38.24, 'PN14883'], ['Cemenquin 20 kg', 1, 357, 'X-9352'],
      ['Solvente APU · L', 0.5, 777.98, 'PN14894'],
    ]],
    [o128, [
      ['Repuesto rodillo esponja', 1, 32.16, 'X-9356'], ['Flota esponja', 1, 149.64, 'X-9356'],
      ['Resanamix', 1, 382.80, 'X-9356'], ['Masking amarillo', 5, 34],
      ['Papel café', 2, 99], ['Trapo amarillo', 2, 34], ['Cuña con mango', 2, 27],
      ['Colador tela', 1, 50], ['Uniforme M', 1, 84.50], ['Gorra Prisa', 1, 0],
    ]],
  ]
  for (const [obra, filas] of MATERIALES) {
    for (const [material, piezas, costo, folio = null, taller = folio == null] of filas) {
      await c.query(
        `insert into public.obra_materiales (obra_id, origen, material, piezas, costo, folio_factura, es_taller)
         values ($1,'real',$2,$3,$4,$5,$6)`,
        [obra.id, material, piezas, costo, folio, taller],
      )
    }
  }
  // Lado cotizado de la OT 25000125 (única con presupuesto de material en el Excel)
  const COTIZADO_125 = [
    ['PTR 1 1/2" C14', 3, 525], ['Lámina lisa 3x10 C12', 1, 1637], ['Soldadura 6011 1/8 kg', 1, 95],
    ['Metal desplegado C12', 2.5, 259], ['Disco de corte 4 1/2"', 10, 15], ['Disco laminado 4 1/2"', 3, 35],
    ['Fondo anticorrosivo, solvente y pintura (lote)', 1, 2500],
  ]
  for (const [material, piezas, costo] of COTIZADO_125) {
    await c.query(
      `insert into public.obra_materiales (obra_id, origen, material, piezas, costo)
       values ($1,'cotizado',$2,$3,$4)`,
      [o125.id, material, piezas, costo],
    )
  }
  // Gasto adicional real de la OT 25000123
  await c.query(
    `insert into public.gastos (obra_id, categoria, descripcion, piezas, costo_unitario, monto, metodo, condicion, fecha, registrado_por)
     values ($1,'gasolina','Gasolina para generador (OT 25000123)',1,239.90,239.90,'efectivo','contado','2026-07-12',$2)`,
    [o123.id, pati.id],
  )
  console.log('  · material consumido de las 7 OTs y gasto adicional')

  // -------------------------------------------------------------------------
  // CONTRATOS DE MANO DE OBRA · «4. NÓMINAS PINTORES 2026» + archivo 2 + PDF
  // El TOTAL del Excel es lo pagadero: con retención 5% se pasa otros=M.O. y
  // pct=5 (el total generado coincide); sin retención, pct=0.
  // -------------------------------------------------------------------------
  async function contratar({ obra, trabajador, m2 = 0, tarifa = 0, otros = 0, pct, inicia = null, finaliza = null, cerrado = false, trabajos = {}, notas = null, firmado = true }) {
    return uno(
      `insert into public.contratos_oficial
         (obra_id, trabajador_id, trabajos, m2, tarifa_m2, otros_importe, costo_haaco_pct,
          estatus, fecha_inicia, fecha_finaliza, fecha_cierre, firma_oficial_at, firma_director_at, notas)
       values ($1,$2,$3::jsonb,$4,$5,$6,$7,$8::estatus_contrato,$9::date,$10::date,
               case when $8 = 'cerrado' then coalesce($10::date, current_date) end,
               case when $11 then now() end, case when $11 then now() end, $12)
       returning id, total_pagar`,
      [obra.id, trabajador.id, JSON.stringify(trabajos), m2, tarifa, otros, pct,
       cerrado ? 'cerrado' : 'activo', inicia, finaliza, firmado, notas],
    )
  }

  const k437  = await contratar({ obra: h437, trabajador: T.jorge, otros: 3270, pct: 5, inicia: '2026-06-20', cerrado: true, trabajos: { otros: ['herreria'] }, notas: 'Repintado de puertas Monterosa 437' })
  const k436x = await contratar({ obra: h436x, trabajador: T.jorge, otros: 3600, pct: 5, inicia: '2026-06-20', cerrado: true, trabajos: { vinilicas: ['repintado', 'exterior'] } })
  const k436i = await contratar({ obra: o122, trabajador: T.jorge, otros: 10600, pct: 5, inicia: '2026-07-01', cerrado: true, trabajos: { vinilicas: ['repintado', 'interior'] }, notas: 'Interior Monterosa 436' })
  const k451j = await contratar({ obra: o124, trabajador: T.jorge, otros: 10500, pct: 0, inicia: '2026-07-15', cerrado: true, trabajos: { otros: ['herreria'] }, notas: 'El Excel maneja M.O. $10,000 + $500 y total pagadero $10,500 (sin retención).' })
  const k409i = await contratar({ obra: o128, trabajador: T.jorge, m2: 967, tarifa: 12.50, pct: 5, inicia: '2026-07-23', finaliza: '2026-07-31', trabajos: { vinilicas: ['superficie_nueva', 'interior'] }, notas: 'Contrato del archivo «2. CONTRATOS PINTURAS 2026» (La Jolla Interior 1era parte, cot. 409).' })
  const k359  = await contratar({ obra: o127, trabajador: T.jorge, otros: 2800, pct: 5, inicia: '2026-07-22', trabajos: { otros: ['epoxicos_apu'] }, notas: 'Repintado de asador (Primetal + PU50)' })
  const k443j = await contratar({ obra: h443, trabajador: T.jorge, otros: 4200, pct: 5, inicia: '2026-06-25', cerrado: true, trabajos: { otros: ['herreria'] }, notas: 'Puerta Los Lagos 443 (pintura de puerta)' })
  const k439  = await contratar({ obra: h439, trabajador: T.yasxen, otros: 35600, pct: 0, inicia: '2026-05-04', cerrado: true, trabajos: { impermeabilizantes: ['mantenimiento', 'elastomerico', 'malla'] }, notas: 'Trabajos de techo/teja, Sr. Gutiérrez 439. Trabajador externo: sin retención.' })
  const k446  = await contratar({ obra: o123, trabajador: T.jcb, otros: 5250, pct: 5, inicia: '2026-05-08', cerrado: true, trabajos: { vinilicas: ['interior'] } })
  const k330  = await contratar({ obra: h330, trabajador: T.abraham, otros: 25000, pct: 0, inicia: '2026-04-01', trabajos: { otros: ['herreria'] }, notas: 'Puerta con vidrios 330. Sin retención en el Excel. ' + APROX })
  const k321  = await contratar({ obra: h321, trabajador: T.enrique, otros: 12400, pct: 0, inicia: '2026-03-17', trabajos: { otros: ['herreria'] }, notas: 'Vistas Las Riberas VIGA 321. Sin retención en el Excel.' })
  const k409e = await contratar({ obra: o126, trabajador: T.alejandro, otros: 8575, pct: 5, inicia: '2026-07-22', trabajos: { vinilicas: ['superficie_nueva', 'exterior'] }, notas: 'La Jolla ext. 1era parte' })
  const k333  = await contratar({ obra: h333, trabajador: T.jesus, otros: 8500, pct: 0, inicia: '2026-04-10', trabajos: { otros: ['herreria'] }, notas: 'Cerco Bonaterra 333. Sin retención en el Excel. ' + APROX })
  const k403  = await contratar({ obra: h403, trabajador: T.jesus, otros: 61250, pct: 0, inicia: '2026-06-01', trabajos: { otros: ['herreria'] }, notas: 'Herrero encargado de obra (contrato PDF): vistas frontales y traseras $32,250, barandal terraza $9,500 y forrado de trabe $19,500. Entrega/instalación 16–20 jun 2026.' })
  const k443x = await contratar({ obra: h443, trabajador: T.jesus, otros: 16500, pct: 0, inicia: '2026-06-25', trabajos: { otros: ['herreria'] }, notas: 'Fabricación de puertas Los Lagos (Daniel Faz 443).' })
  const k451x = await contratar({ obra: o125, trabajador: T.jesus, otros: 11000, pct: 0, inicia: '2026-07-15', cerrado: true, trabajos: { otros: ['herreria'] }, notas: 'Alba Beltrán Los Lagos 451 + adicional.' })
  console.log('  · 16 contratos de mano de obra')

  // -------------------------------------------------------------------------
  // NÓMINA · abonos por fecha, recibos y deducciones
  // -------------------------------------------------------------------------
  const PAGOS = [
    // contrato, fecha, monto, notas
    [k437,  '2026-06-23', 3106.50],
    [k436x, '2026-06-23', 3093.50], [k436x, '2026-06-27', 326.50],
    [k436i, '2026-07-07', 4068.25], [k436i, '2026-07-09', 6001.75],
    [k451j, '2026-07-18', 6333.25],
    [k443j, '2026-07-07', 431.75], [k443j, '2026-07-09', 3391.50], [k443j, '2026-07-11', 166.75],
    [k439,  '2026-06-23', 12000], [k439, '2026-06-27', 8000], [k439, '2026-07-11', 6000], [k439, '2026-07-18', 8000], [k439, '2026-07-25', 1600],
    [k446,  '2026-07-11', 4987.50],
    [k330,  '2026-06-15', 21500, APROX],
    [k321,  '2026-05-15', 9000, APROX],
    [k333,  '2026-06-10', 6000, APROX],
    [k403,  '2026-06-03', 300], [k403, '2026-06-06', 17000], [k403, '2026-06-17', 2000],
    [k403,  '2026-06-23', 4500], [k403, '2026-07-04', 1500],
    [k403,  '2026-07-09', 7000, 'Monto reconstruido para cuadrar el pagado del Excel ($46,300)'],
    [k443x, '2026-06-20', 2000, APROX], [k443x, '2026-06-23', 10000],
    [k451x, '2026-07-11', 2000],
  ]
  for (const [contrato, fecha, monto, notas = null] of PAGOS) {
    await c.query(
      `insert into public.nomina_pagos (contrato_id, fecha, monto, metodo, notas, registrado_por)
       values ($1,$2::date,$3,'transferencia',$4,$5)`,
      [contrato.id, fecha, monto, notas, pati.id],
    )
  }

  // Recibos reales de la hoja «Recibos» (mandan los montos numéricos)
  async function reciboNomina({ trabajador, fecha, subtotal, deducciones = 0, notas = null, pagos }) {
    const r = await uno(
      `insert into public.recibos_nomina (trabajador_id, fecha, metodo, subtotal, deducciones, total, notas, registrado_por)
       values ($1,$2::date,'transferencia',$3,$4,$5,$6,$7) returning id, folio`,
      [trabajador.id, fecha, subtotal, deducciones, subtotal - deducciones, notas, pati.id],
    )
    for (const [contrato, monto] of pagos) {
      await c.query(
        `insert into public.nomina_pagos (contrato_id, fecha, monto, metodo, recibo_id, recibo_folio, registrado_por)
         values ($1,$2::date,$3,'transferencia',$4,$5,$6)`,
        [contrato.id, fecha, monto, r.id, r.folio, pati.id],
      )
    }
    return r
  }

  await reciboNomina({
    trabajador: T.jesus, fecha: '2026-07-11', subtotal: 14000,
    notas: 'Abono a mano de obra · Las Riberas (sábado 11 de julio)',
    pagos: [[k403, 14000]],
  })
  const rJorge = await reciboNomina({
    trabajador: T.jorge, fecha: '2026-07-25', subtotal: 10150.18, deducciones: 600,
    notas: 'Abono a mano de obra (Alba Beltrán 451, La Jolla 409 y asador 359) − préstamo $600',
    pagos: [[k451j, 3966.75], [k409i, 3789.43], [k359, 2394.00]],
  })
  await reciboNomina({
    trabajador: T.jesus, fecha: '2026-07-25', subtotal: 11338.26,
    notas: 'Abono a mano de obra (Alba Beltrán 451 + adicional y puertas Daniel Faz 443). Incluye reembolso de la factura 4654 por $338.26.',
    pagos: [[k451x, 9000], [k443x, 2000]],
  })

  await c.query(
    `insert into public.deducciones (trabajador_id, contrato_id, tipo, monto, fecha, saldado, notas)
     values ($1,$2,'adelanto',200,'2026-06-26',true,'Adelanto 26/06; descontado de Alba Beltrán 451 (fila negativa del Excel)')`,
    [T.jorge.id, k451j.id],
  )
  await c.query(
    `insert into public.deducciones (trabajador_id, contrato_id, recibo_id, tipo, monto, fecha, saldado, notas)
     values ($1,$2,$3,'prestamo',600,'2026-07-20',true,'Préstamo descontado en el recibo del 25/jul (concentrado de prenómina)')`,
    [T.jorge.id, k451j.id, rJorge.id],
  )
  console.log('  · nómina: abonos, 3 recibos y 2 deducciones')

  // -------------------------------------------------------------------------
  // PAGARÉ DE HERRAMIENTAS · «6. FORMATO PAGARÉ» (Jorge Ascacio, $47,838,
  // 23/jul/2026, obra La Jolla int. 409). La suma de valores del catálogo
  // da exactamente $47,838.
  // -------------------------------------------------------------------------
  const CODIGOS_PAGARE = [
    'Graco', 'Hus-CH', 'LR-1', 'LR-2', 'LO-CH', 'CH-1', 'CH-2',
    'E7-14.1', 'E7-14.2', 'E7-14.3', 'EM-1', 'EM-3', 'CM', 'LA-1', 'EX-G1', 'LM-1', 'MR',
  ]
  const pagare = await uno(
    `insert into public.pagares (contrato_id, fecha_emision, firma_oficial_at, texto_generado)
     values ($1,'2026-07-23',now(),$2) returning id`,
    [k409i.id, 'Pagaré 1 de 1 suscrito por Jorge Alejandro Ascacio a la orden de Luis Enrique Inda Franco por $47,838.00, pagadero el 23 de julio de 2026 en Cruz Gálvez #24, Col. Villa de Seris, Hermosillo, Sonora. Interés ordinario 10% mensual; moratorio al doble. Obra: La Jolla Int. Parte 1, Esmeralda 6.'],
  )
  for (const codigo of CODIGOS_PAGARE) {
    const h = await uno('select id, valor from public.herramientas where codigo = $1', [codigo])
    if (!h) throw new Error(`Herramienta ${codigo} no está en el catálogo (corre npm run bd:seed)`)
    await c.query(
      `insert into public.pagare_items (pagare_id, herramienta_id, cantidad, valor_unitario)
       values ($1,$2,1,$3)`,
      [pagare.id, h.id, h.valor ?? 0],
    )
  }
  const { valor_total } = await uno('select valor_total from public.pagares where id = $1', [pagare.id])
  if (Math.abs(Number(valor_total) - 47838) > 0.05) {
    throw new Error(`Pagaré: valor total ${valor_total} ≠ $47,838 del documento`)
  }
  console.log('  · pagaré de herramientas de Jorge ($47,838, verificado)')

  // -------------------------------------------------------------------------
  // PÓLIZA DE GARANTÍA · «7. FORMATO GARANTÍA» H404-26 (Rosario)
  // -------------------------------------------------------------------------
  await c.query(
    `insert into public.polizas_garantia
       (obra_id, folio, items, fecha_emision, fecha_conclusion, vigencia_dias, condiciones, deslindes)
     values ($1,'H404-26',$2::jsonb,'2026-06-13','2026-06-13',365,$3,$4)`,
    [
      h404.id,
      JSON.stringify([
        { area: 'Interior', pintura: 'Rivinol 7', color: 'Blanco', codigo: 'RIVINOL-7' },
        { area: 'Exterior y reparaciones menores', pintura: 'Rivinol 7', color: 'Blanco', codigo: 'RIVINOL-7' },
      ]),
      'Garantía válida solo cuando el producto se haya encontrado dañino o en mal estado y su aplicación no haya sido la correcta. Para hacerla válida, personal técnico de la empresa valorará el núcleo del problema (humedad interna, salitre, hongos, entre otros).',
      'Haaco Pro se deslinda de toda responsabilidad cuando el daño haya sido realizado por personal externo a la empresa o provocado por problemas ambientales y/o internos en la estructura.',
    ],
  )
  console.log('  · póliza de garantía H404-26')

  // -------------------------------------------------------------------------
  // CUENTAS POR PAGAR · «11. CUENTAS_X_PAGAR» (65 facturas; manda la hoja
  // principal, no el dashboard). Sin gasto asociado: son captura histórica.
  // -------------------------------------------------------------------------
  const provs = {}
  for (const p of await todos('select id, nombre from public.proveedores')) provs[p.nombre] = p.id
  if (!provs['PIC DESARROLLOS (EXTERNA)']) {
    provs['PIC DESARROLLOS (EXTERNA)'] = (await uno(
      `insert into public.proveedores (nombre, dias_credito_default, notas)
       values ('PIC DESARROLLOS (EXTERNA)', 5, 'Facturación externa de PIC Desarrollos (5 días de crédito)')
       returning id`,
    )).id
  }
  for (const nombre of ['FERRECASA', 'TOOLS', 'PIC DESARROLLOS', 'PRO SYSTEMS MR', 'PINTURAS EL VAQUERO']) {
    if (!provs[nombre]) throw new Error(`Falta el proveedor ${nombre} (corre npm run bd:seed)`)
  }

  const F = 'FERRECASA', TL = 'TOOLS', PIC = 'PIC DESARROLLOS', PICX = 'PIC DESARROLLOS (EXTERNA)',
        PS = 'PRO SYSTEMS MR', VAQ = 'PINTURAS EL VAQUERO'
  // proveedor, factura, fecha, días, importe, pagado, fechaPago, notas, cancelada
  const CXP = [
    [F, '9182', '2026-06-16', 15, 326.82, 326.82, '2026-07-15'],
    [F, '9195', '2026-06-18', 15, 357.00, 257.00, '2026-07-15', 'El Excel la marca pagada pero deja saldo de $100'],
    [F, '9215', '2026-06-24', 15, 78.31, 78.31, '2026-07-15'],
    [F, '9217', '2026-06-24', 15, 881.30, 881.30, '2026-07-15'],
    [F, '9225', '2026-06-26', 15, 70.70, 70.70, '2026-07-15'],
    [F, '9252', '2026-07-03', 15, 832.49, 832.49, '2026-07-15'],
    [TL, '676547', '2026-06-24', 21, 3547.28, 3547.28, '2026-07-15'],
    [PICX, 'F141', '2026-07-03', 5, 2352.00, 2352.00, '2026-07-08'],
    [PIC, '12342', '2025-12-23', 30, 7935.86],
    [PIC, '12370', '2025-12-30', 30, 435.24],
    [PIC, '12386', '2026-01-05', 30, 52.70],
    [PIC, '12419', '2026-01-08', 30, 2018.96],
    [PIC, '12424', '2026-01-08', 30, 123.24],
    [PIC, '12427', '2026-01-08', 30, 5541.12],
    [PIC, '12471', '2026-01-12', 30, 1847.04],
    [PIC, '12481', '2026-01-13', 30, 435.24],
    [PIC, '12486', '2026-01-14', 30, 12151.41],
    [PIC, '12501', '2026-01-15', 30, 3571.93],
    [PIC, '12536', '2026-01-19', 30, 692.16],
    [PIC, '12543', '2026-01-19', 30, 509.91],
    [PIC, '12555', '2026-01-20', 30, 870.48],
    [PIC, '12556', '2026-01-20', 30, 2463.65],
    [PIC, '12557', '2026-01-20', 30, 114.74],
    [PIC, '12559', '2026-01-20', 30, 11389.73],
    [PIC, '12573', '2026-01-21', 30, 4885.92],
    [PIC, '12574', '2026-01-21', 30, 1294.80],
    [PIC, '12587', '2026-01-21', 30, 1294.80],
    [PIC, '12588', '2026-01-21', 30, 246.48],
    [PIC, '12597', '2026-01-22', 30, 175.94],
    [PIC, '12607', '2026-01-23', 30, 1847.04],
    [PIC, '12608', '2026-01-23', 30, 2376.89],
    [PIC, '12618', '2026-01-23', 30, 2584.62],
    [PIC, '12628', '2026-01-24', 30, 1305.72],
    [PIC, '12636', '2026-01-26', 30, 8896.68],
    [PIC, '12672', '2026-01-28', 30, 125.80],
    [PIC, '12678', '2026-01-29', 30, 3350.59],
    [PIC, '12679', '2026-01-29', 30, 95.20],
    [PIC, '12680', '2026-01-29', 30, 1139.60],
    [PIC, '12689', '2026-01-30', 30, 492.97],
    [PIC, '12694', '2026-01-30', 30, 673.93],
    [PIC, '12699', '2026-01-31', 30, 2965.56],
    [PS, '20127', '2026-04-01', 15, 319.00, 319.00, '2026-07-07'],
    [PS, '20277', '2026-05-01', 15, 319.00, 319.00, '2026-07-07'],
    [PS, '20439', '2026-06-01', 15, 319.00, 319.00, '2026-07-07'],
    [PS, '20590', '2026-07-01', 15, 319.00, 319.00, '2026-07-07'],
    [F, '9262', '2026-07-06', 15, 36.27, 36.27, '2026-07-24'],
    [F, '9280', '2026-07-10', 15, 196.12, 196.12, '2026-07-24'],
    [TL, '679092', '2026-07-13', 21, 5815.94],
    [VAQ, '3883', '2026-04-27', 10, 986.00, 986.00, '2026-07-15'],
    [VAQ, '3857', '2026-04-23', 10, 3234.96, 2291.16, null, 'Pago parcial registrado en el Excel; saldo $943.80'],
    [VAQ, '3657', '2026-03-25', 10, 859.98, 859.98, '2026-07-15'],
    [VAQ, '3493', '2026-02-27', 10, 695.00, 695.00, '2026-07-15'],
    [VAQ, '3486', '2026-02-27', 10, 279.98, 279.98, '2026-07-15'],
    [VAQ, '2426', '2025-10-04', 10, 749.97, 749.97, '2026-07-15'],
    [VAQ, '2422', '2025-10-03', 10, 1900.01, 1900.01, '2026-07-23'],
    [VAQ, '2409', '2025-10-03', 10, 4749.97, 4749.97, '2026-07-23'],
    [VAQ, '2215', '2025-09-10', 10, 1264.99, 1264.99, '2026-07-15'],
    [PS, '20620', '2026-07-14', 15, 638.00, 638.00, '2026-07-07', 'El Excel registra fecha de pago anterior a la factura'],
    [F, '9343', '2026-07-21', 15, 379.95],
    [F, '9344', '2026-07-21', 15, 139.20],
    [F, '9352', '2026-07-22', 15, 357.00],
    [F, '9356', '2026-07-23', 15, 564.84],
    [F, '9357', '2026-07-23', 15, 0, 0, null, 'El Excel registra «CANCELADA» en el importe', true],
    [F, '9358', '2026-07-23', 15, 214.50],
    [TL, '680945', '2026-07-24', 21, 5814.95],
  ]
  for (const [prov, factura, fecha, dias, monto, pagado = 0, fechaPago = null, notas = null, cancelada = false] of CXP) {
    await c.query(
      `insert into public.cuentas_por_pagar
         (proveedor_id, folio_factura, monto, fecha_factura, dias_credito, monto_pagado, fecha_pago, cancelada, notas)
       values ($1,$2,$3,$4::date,$5,$6,$7::date,$8,$9)`,
      [provs[prov], factura, monto, fecha, dias, pagado, fechaPago, cancelada, notas],
    )
  }
  console.log(`  · ${CXP.length} cuentas por pagar`)

  // -------------------------------------------------------------------------
  // PAGOS FIJOS · «14. PROGRAMACION_PAGOS_QUINCENA» (quincenas de julio)
  // -------------------------------------------------------------------------
  const PAGOS_FIJOS = [
    // quincena, categoría, beneficiario, monto, estado, descripción, notas, fecha_pago, recurrente
    ['2026-07-15', 'Nómina', 'Patricia Figueroa Arcoamarillo', 8000, 'pagado', 'Nómina + gasolina', 'Se agrega gasolina pendiente 1 semana', '2026-07-15', true],
    ['2026-07-15', 'Nómina', 'Fernanda Colsa', 10000, 'pagado', 'Nómina mensual', null, '2026-07-15', false],
    ['2026-07-15', 'Servicio', 'German Figueroa Arcoamarillo', 4640, 'pagado', 'Servicio contable', 'Mensualidades mayo y junio', '2026-07-15', false],
    ['2026-07-31', 'Nómina', 'Patricia Figueroa Arcoamarillo', 7500, 'pendiente', 'Nómina', null, null, true],
    ['2026-07-31', 'Servicio', 'Fernanda Colsa', 8000, 'pendiente', 'Marketing · mensualidad julio', null, null, true],
    ['2026-07-31', 'Servicio', 'German Figueroa Arcoamarillo', 2320, 'pendiente', 'Servicio contable · mensualidad julio', null, null, true],
    ['2026-07-31', 'Servicio', 'TELCEL', 279, 'pendiente', 'Plan Telcel · mensualidad julio', null, null, true],
    ['2026-07-31', 'Servicio', 'TELMEX', 399, 'pendiente', 'Internet · mensualidad julio', null, null, true],
  ]
  for (const [quincena, categoria, beneficiario, monto, estado, descripcion, notas, fechaPago, recurrente] of PAGOS_FIJOS) {
    await c.query(
      `insert into public.pagos_fijos (quincena, categoria, beneficiario, monto, metodo, estado, descripcion, notas, fecha_pago, recurrente)
       values ($1::date,$2,$3,$4,'transferencia',$5::estado_pago_fijo,$6,$7,$8::date,$9)`,
      [quincena, categoria, beneficiario, monto, estado, descripcion, notas, fechaPago, recurrente],
    )
  }
  console.log('  · pagos fijos de las quincenas 15 y 31 de julio')

  // -------------------------------------------------------------------------
  // CATÁLOGO · productos con costo real vistos en las OTs (complementa el
  // seed; no duplica). También fija el costo real de 3 pinturas del seed.
  // -------------------------------------------------------------------------
  await c.query(`update public.productos set costo = 2030.33 where codigo = 'RIVINOL-7' and coalesce(costo,0) = 0`)
  await c.query(`update public.productos set costo = 971.88  where codigo = 'E-8325'    and coalesce(costo,0) = 0`)
  await c.query(`update public.productos set costo = 2165.27 where codigo = 'ES-7049'   and coalesce(costo,0) = 0`)

  const PRODUCTOS = [
    // nombre, código, unidad, tipo, costo
    ['Rivinol 7 vinil acrílica mate · galón 4 L', 'RIVINOL-7-4', 'galón', 'pintura', 478.14],
    ['Fondo gris claro · 4 L', 'FON-GRIS-4', 'galón', 'pintura', 816.66],
    ['Primetal blanco 4300', 'PRIMETAL-4300', 'cubeta', 'herreria', 2177.73],
    ['Catalizador Primetal 4302', 'PRIMETAL-4302', 'litro', 'herreria', 568.63],
    ['Esmalte SR igualado', 'ESM-SR', 'litro', 'herreria', 350.01],
    ['Cemplast blanco', 'CEMPLAST', 'litro', 'pintura', 113.10],
    ['Thinner 5 · 4 L', 'THIN5-4', 'galón', 'otro', 479.99],
    ['Thinner estándar · 4 L', 'THIN-STD-4', 'galón', 'otro', 55.00],
    ['Thinner · litro', 'THIN-LT', 'litro', 'otro', 76.87],
    ['Thinner acrílico · litro', 'THIN-ACR', 'litro', 'otro', 80.00],
    ['Reductor · litro', 'REDUCTOR', 'litro', 'otro', 250.00],
    ['Solvente EXY-B', 'EXY-B', 'litro', 'otro', 633.97],
    ['Solvente APU · litro', 'SOLV-APU', 'litro', 'otro', 777.98],
    ['Cemenquin 20 kg', 'CEMENQUIN-20', 'saco', 'otro', 357.00],
    ['Onetime (resanador)', 'ONETIME', 'pza', 'otro', 110.50],
    ['Resanamix', 'RESANAMIX', 'pza', 'otro', 382.80],
    ['Estuco · saco', 'ESTUCO', 'saco', 'otro', 146.33],
    ['PTR 1 1/2" C14', 'PTR-112-C14', 'tramo', 'herreria', 387.80],
    ['Lámina lisa 3x10 C12', 'LAM-3X10-C12', 'pza', 'herreria', 1637.00],
    ['Soldadura 6011 1/8', 'SOLD-6011', 'kg', 'herreria', 94.39],
    ['Metal desplegado C12', 'MET-DESP-C12', 'pza', 'herreria', 259.00],
    ['Disco de corte 4 1/2"', 'DISCO-C-45', 'pza', 'herreria', 13.78],
    ['Disco laminado 4 1/2"', 'DISCO-L-45', 'pza', 'herreria', 59.70],
    ['Taquete arpón 3/8', 'TAQ-ARPON-38', 'pza', 'herreria', 12.80],
    ['Solera 1" x 1/8', 'SOLERA-1-18', 'tramo', 'herreria', 114.77],
    ['Maneral', 'MANERAL', 'pza', 'insumo_taller', 56.64],
    ['Maneral profesional 9"', 'MANERAL-9P', 'pza', 'insumo_taller', 63.75],
    ['Felpa microfibra 9" lisa 3/8', 'FELPA-L-38', 'pza', 'insumo_taller', 66.06],
    ['Felpa microfibra 9" rugosa 3/4', 'FELPA-R-34', 'pza', 'insumo_taller', 83.29],
    ['Brocha 4" mango recto', 'BRO-4-RECTO', 'pza', 'insumo_taller', 107.67],
    ['Brocha profesional 6"', 'BRO-6-PROF', 'pza', 'insumo_taller', 85.85],
    ['Brocha profesional 4"', 'BRO-4-PROF', 'pza', 'insumo_taller', 66.30],
    ['Brocha 3"', 'BRO-3', 'pza', 'insumo_taller', 29.68],
    ['Brocha doméstica 3"', 'BRO-3-DOM', 'pza', 'insumo_taller', 28.04],
    ['Mini rodillo nylon 4"', 'ROD-4-NYLON', 'pza', 'insumo_taller', 38.24],
    ['Repuesto rodillo esponja', 'ROD-ESPONJA', 'pza', 'insumo_taller', 32.16],
    ['Flota esponja', 'FLOTA-ESP', 'pza', 'insumo_taller', 149.64],
    ['Trapo amarillo', 'TRAPO-AM', 'pza', 'insumo_taller', 34.00],
  ]
  let nuevos = 0
  for (const [nombre, codigo, unidad, tipo, costo] of PRODUCTOS) {
    const r = await c.query(
      `insert into public.productos (nombre, codigo, unidad, tipo, costo, iva, precio_neto, notas)
       values ($1,$2,$3,$4::tipo_producto,$5, round($5 * 0.16, 2), round($5 * 1.16, 2),
               'Costo real tomado de las OTs de julio 2026')
       on conflict (codigo) where codigo is not null do nothing`,
      [nombre, codigo, unidad, tipo, costo],
    )
    nuevos += r.rowCount
  }
  console.log(`  · ${nuevos} productos nuevos con costo real de las OTs`)

  // -------------------------------------------------------------------------
  // CONSECUTIVOS · continúan donde van las series reales
  // -------------------------------------------------------------------------
  await c.query(
    `insert into public.consecutivos (serie, anio, ultimo) values
       ('cotizacion', 0, 476),   -- F-474 es la última hoja real; 475/476 se usaron para las «xx»
       ('poliza', 2026, 404)     -- siguiente: H405-26
     on conflict (serie, anio) do update set ultimo = excluded.ultimo`,
  )

  await c.query('commit')

  // -------------------------------------------------------------------------
  // RESUMEN Y VERIFICACIÓN contra los totales de los Excel
  // -------------------------------------------------------------------------
  const resumen = await todos(`
    select 'clientes' t, count(*)::int n from public.clientes
    union all select 'cotizaciones', count(*)::int from public.cotizaciones
    union all select 'pagos de cobranza', count(*)::int from public.pagos_cobranza
    union all select 'obras', count(*)::int from public.obras
    union all select 'materiales de obra', count(*)::int from public.obra_materiales
    union all select 'contratos', count(*)::int from public.contratos_oficial
    union all select 'pagos de nómina', count(*)::int from public.nomina_pagos
    union all select 'recibos de nómina', count(*)::int from public.recibos_nomina
    union all select 'pagarés', count(*)::int from public.pagares
    union all select 'pólizas', count(*)::int from public.polizas_garantia
    union all select 'cuentas por pagar', count(*)::int from public.cuentas_por_pagar
    union all select 'pagos fijos', count(*)::int from public.pagos_fijos
  `)
  console.log('\nOperación real cargada:')
  for (const r of resumen) console.log(`  ${String(r.n).padStart(4)}  ${r.t}`)

  console.log('\nVerificación contra los Excel:')
  const cobranza = await uno('select round(sum(saldo),2) s from public.v_cobranza')
  console.log(`  Saldo por cobrar: ${cobranza.s}  (Excel: 386,646.39 = 313,888.81 del concentrado + Ayala y Monteverde)`)
  const cxpVencido = await uno(
    "select round(sum(saldo),2) s from public.v_cuentas_por_pagar where estado = 'vencida'",
  )
  console.log(`  CxP vencido: ${cxpVencido.s}  (Excel: 84,949.75 = PIC 83,905.95 + Vaquero 943.80 + resto FERRECASA 9195 100.00)`)
  const ots = await todos(
    "select ot_numero, cotizado, mano_obra, material_real, gastos_adicionales, utilidad from public.v_obra_concentrado where ot_numero like '250001%' order by ot_numero",
  )
  console.log('  Concentrado de las 7 OTs (la M.O. sale de contratos; puede variar centavos vs el Excel):')
  for (const o of ots) {
    console.log(`    ${o.ot_numero}  cotizado ${o.cotizado}  M.O. ${o.mano_obra}  material ${o.material_real}  adic. ${o.gastos_adicionales}  utilidad ${o.utilidad}`)
  }
  console.log('\nListo. Revisa /admin: cobranza, obras, nómina y cuentas por pagar.\n')
} catch (error) {
  await c.query('rollback').catch(() => {})
  console.error('✗ No se pudieron cargar los datos reales:', error.message)
  process.exitCode = 1
} finally {
  await c.end()
}
