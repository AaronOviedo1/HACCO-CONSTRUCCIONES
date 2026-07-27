/**
 * Llena la base con una operación completa de ejemplo para poder recorrer la
 * app con datos reales: clientes, cotizaciones de los últimos seis meses,
 * órdenes de trabajo con avance, contratos de mano de obra, gastos, cobranza,
 * cuentas por pagar, nómina, caja chica y pólizas.
 *
 *   npm run bd:demo              carga los datos (falla si ya hay operación)
 *   npm run bd:demo -- --reiniciar   borra lo transaccional y vuelve a cargar
 *
 * NO toca catálogos (proveedores, pinturas, herramientas) ni usuarios: eso lo
 * cargan `npm run bd:seed` y `npm run usuarios:demo`.
 *
 * Todas las fechas son relativas al día que se corre, para que los estados
 * («vencida», «urgente», «esta quincena») siempre tengan sentido.
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

/** Ejecuta y devuelve la primera fila. */
const uno = async (sql, params = []) => (await c.query(sql, params)).rows[0]
const todos = async (sql, params = []) => (await c.query(sql, params)).rows

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
      `✗ La base ya tiene ${n} cotizaciones. Si son de prueba y quieres rehacerlas:\n` +
        '    npm run bd:demo -- --reiniciar\n',
    )
    process.exit(1)
  }

  await c.query('begin')

  if (reiniciar) {
    for (const t of TRANSACCIONALES) await c.query(`delete from public.${t}`)
    await c.query("delete from public.consecutivos where serie in ('cotizacion','ot','poliza','recibo','recibo_nomina')")
    console.log('  · operación anterior borrada')
  }

  // -------------------------------------------------------------------------
  // Gente y catálogos que ya existen
  // -------------------------------------------------------------------------
  const perfiles = await todos('select id, nombre, rol, oficio from public.profiles')
  const porRol = (rol, oficio) =>
    perfiles.find((p) => p.rol === rol && (!oficio || p.oficio === oficio)) ??
    perfiles.find((p) => p.rol === rol)

  const luis = porRol('admin')
  const pati = porRol('administracion') ?? luis
  const pintor = porRol('cuadrilla', 'pintor')
  const herrero = porRol('cuadrilla', 'herrero') ?? pintor

  if (!luis || !pintor) {
    throw new Error('Faltan usuarios. Corre antes: npm run usuarios:demo')
  }

  const proveedores = await todos('select id, nombre, dias_credito_default from public.proveedores order by nombre')
  const textos = await todos('select id, contenido from public.textos_proceso where activo order by orden limit 6')
  const pinturas = await todos("select id, nombre from public.productos where tipo = 'pintura' order by nombre limit 6")
  const herramientas = await todos('select id, valor from public.herramientas order by nombre limit 6')
  const proveedor = (i) => proveedores[i % Math.max(1, proveedores.length)]?.id ?? null

  // -------------------------------------------------------------------------
  // Clientes
  // -------------------------------------------------------------------------
  const CLIENTES = [
    ['Grupo Delta Construcciones', 'Ing.', '662 214 8890', 'compras@grupodelta.mx', 'Blvd. Solidaridad 1204, Hermosillo'],
    ['Inmobiliaria Aurora', 'Lic.', '662 310 4471', 'obras@aurora.mx', 'Carr. a Nogales km 9, Hermosillo'],
    ['Constructora Peñasco', 'Arq.', '662 118 2255', 'arq.penasco@gmail.com', 'Cerro del Sol 87, Hermosillo'],
    ['Ana Torres Villalobos', 'Sra.', '662 402 7719', null, 'Villa Satélite 22, Hermosillo'],
  ]
  const clientes = []
  for (const [nombre, titulo, telefono, correo, domicilio] of CLIENTES) {
    clientes.push(
      await uno(
        `insert into public.clientes (nombre, titulo_cortesia, telefono, correo, domicilio)
         values ($1,$2,$3,$4,$5) returning id, nombre`,
        [nombre, titulo, telefono, correo, domicilio],
      ),
    )
  }
  const [delta, aurora, penasco, torres] = clientes
  console.log(`  · ${clientes.length} clientes`)

  // -------------------------------------------------------------------------
  // Cotizaciones
  // -------------------------------------------------------------------------
  /** Crea la cotización con sus bullets, partidas y material presupuestado. */
  async function cotizar({
    cliente, obra, domicilio, tipo = 'pintura', estatus = 'borrador',
    diasAtras, anticipo = 50, factura = false, partidas = [], materiales = [],
  }) {
    const cot = await uno(
      `insert into public.cotizaciones
         (cliente_id, nombre_obra, domicilio_obra, tipo, estatus, requiere_factura,
          anticipo_pct, fecha, fecha_envio, fecha_resolucion, linea_calidad, creado_por)
       values ($1,$2,$3,$4::tipo_cotizacion,$5::estatus_cotizacion,$6,$7,
               current_date - $8::int,
               case when $5::text = 'borrador' then null else current_date - $8::int + 1 end,
               case when $5::text in ('aprobada','rechazada','terminada') then current_date - $8::int + 3 else null end,
               'Se utilizarán productos de la más alta calidad en el mercado.', $9)
       returning id, folio`,
      [cliente, obra, domicilio, tipo, estatus, factura, anticipo, diasAtras, luis.id],
    )

    for (const [i, t] of textos.slice(0, 4).entries()) {
      await c.query(
        `insert into public.cotizacion_procesos (cotizacion_id, texto_proceso_id, orden)
         values ($1,$2,$3)`,
        [cot.id, t.id, i],
      )
    }

    for (const [i, [descripcion, m2, pu]] of partidas.entries()) {
      await c.query(
        `insert into public.cotizacion_items (cotizacion_id, descripcion, m2, precio_unitario, orden)
         values ($1,$2,$3,$4,$5)`,
        [cot.id, descripcion, m2, pu, i],
      )
    }

    for (const [i, [material, piezas, costo, rubro = 'pintura']] of materiales.entries()) {
      await c.query(
        `insert into public.cotizacion_materiales (cotizacion_id, rubro, material, piezas, costo, orden)
         values ($1,$2,$3,$4,$5,$6)`,
        [cot.id, rubro, material, piezas, costo, i],
      )
    }

    // El total lo calcula un trigger desde las partidas: hay que releerlo para
    // poder cobrar cifras exactas y que ningún saldo quede en negativo.
    return uno('select id, folio, total from public.cotizaciones where id = $1', [cot.id])
  }

  /** Cobra una cotización: anticipo, abonos y, si se pide, la liquidación. */
  async function cobrar(cot, { anticipoPct = 50, abonos = [], liquidar = false, diasBase = 7 }) {
    const total = Number(cot.total)
    const anticipo = Math.round(total * (anticipoPct / 100) * 100) / 100
    let pagado = 0

    const registrar = async (tipo, monto, dias, metodo) => {
      if (monto <= 0) return
      pagado = Math.round((pagado + monto) * 100) / 100
      await c.query(
        `insert into public.pagos_cobranza (cotizacion_id, tipo, monto, metodo, fecha, registrado_por)
         values ($1,$2,$3,$4, current_date - $5::int, $6)`,
        [cot.id, tipo, monto, metodo, dias, pati.id],
      )
    }

    await registrar('anticipo', anticipo, diasBase, 'transferencia')
    for (const [i, monto] of abonos.entries()) {
      await registrar('abono', monto, Math.max(1, diasBase - 4 * (i + 1)), i % 2 ? 'cheque' : 'transferencia')
    }
    if (liquidar) {
      await registrar('liquidacion', Math.round((total - pagado) * 100) / 100, 1, 'transferencia')
    }
  }

  // Seis meses de historia para que la gráfica del inicio tenga qué contar.
  const HISTORIA = [
    [delta,   'Fraccionamiento Puerta Real', 168, 'aprobada',  286000],
    [aurora,  'Nave industrial 3',           152, 'rechazada', 214000],
    [penasco, 'Casa Loma Linda',             138, 'aprobada',  196500],
    [delta,   'Torres Poniente',             112, 'aprobada',  341000],
    [aurora,  'Bodega refrigerada',           95, 'terminada', 265400],
    [penasco, 'Departamentos Río',            74, 'aprobada',  198700],
    [delta,   'Escuela Anexa',                58, 'rechazada', 132000],
    [torres,  'Casa habitación Villa Sat.',   41, 'terminada', 96200],
  ]
  for (const [cliente, obra, dias, estatus, monto] of HISTORIA) {
    const vieja = await cotizar({
      cliente: cliente.id, obra, domicilio: cliente.domicilio ?? 'Hermosillo',
      estatus, diasAtras: dias, factura: monto > 200000,
      partidas: [[`Aplicación de pintura · ${obra}`, Math.round(monto / 150), 150]],
    })
    if (estatus === 'aprobada' || estatus === 'terminada') {
      await cobrar(vieja, { liquidar: true, diasBase: dias - 6 })
    }
  }
  console.log(`  · ${HISTORIA.length} cotizaciones de meses anteriores`)

  const c1 = await cotizar({
    cliente: delta.id, obra: 'Residencial Los Álamos', domicilio: 'Av. Solidaridad 1204, Hermosillo',
    tipo: 'pintura', estatus: 'aprobada', diasAtras: 9, factura: true,
    partidas: [
      ['Fachada exterior, 2 manos de vinílica', 620, 152],
      ['Interiores recámaras y estancia', 480, 138],
      ['Sellado y resanes menores', null, 18400],
    ],
    materiales: [
      [pinturas[0]?.nombre ?? 'Vinílica blanca 19 L', 14, 1980],
      ['Sellador 5 L', 8, 640],
      ['Lija de agua 220', 40, 18],
    ],
  })

  const c2 = await cotizar({
    cliente: aurora.id, obra: 'Bodega Parque Industrial', domicilio: 'Carr. a Nogales km 9, Hermosillo',
    tipo: 'pintura', estatus: 'aprobada', diasAtras: 16, factura: true,
    partidas: [
      ['Impermeabilizante elastomérico en azotea', 1420, 168],
      ['Aplicación de malla de refuerzo', null, 32000],
    ],
    materiales: [
      ['Impermeabilizante elastomérico 19 L', 22, 2640],
      ['Malla de refuerzo 1 m × 50 m', 12, 780],
    ],
  })

  const c3 = await cotizar({
    cliente: penasco.id, obra: 'Casa Vista Norte', domicilio: 'Cerro del Sol 87, Hermosillo',
    tipo: 'mixta', estatus: 'aprobada', diasAtras: 22, anticipo: 60,
    partidas: [
      ['Pintura interior, 2 manos', 310, 128],
      ['Portón de herrería 3.2 m', null, 58400],
      ['Protecciones de ventana (6 piezas)', null, 27600],
    ],
    materiales: [
      ['Vinílica arena 19 L', 6, 1980],
      ['PTR 1×1 calibre 14', 18, 420, 'herreria'],
      ['Primer anticorrosivo 4 L', 4, 690, 'herreria'],
    ],
  })

  const c4 = await cotizar({
    cliente: delta.id, obra: 'Plaza Sur · locales 4 al 9', domicilio: 'Blvd. Morelos 340, Hermosillo',
    tipo: 'pintura', estatus: 'aprobada', diasAtras: 34, factura: true,
    partidas: [['Repintado de locales comerciales', 540, 146]],
    materiales: [['Vinílica blanca 19 L', 9, 1980]],
  })

  await cotizar({
    cliente: penasco.id, obra: 'Casa muestra Poniente', domicilio: 'Poniente 45, Hermosillo',
    tipo: 'herreria', estatus: 'enviada', diasAtras: 4, anticipo: 60,
    partidas: [['Barandal de escalera en herrería', null, 50600]],
    materiales: [['Tubo redondo 2" cal. 14', 12, 560, 'herreria']],
  })

  await cotizar({
    cliente: torres.id, obra: 'Interiores casa Villa Satélite', domicilio: 'Villa Satélite 22, Hermosillo',
    tipo: 'pintura', estatus: 'borrador', diasAtras: 1,
    partidas: [['Interiores completos, 2 manos', 285, 132]],
  })

  await cotizar({
    cliente: aurora.id, obra: 'Oficinas Corporativo Centro', domicilio: 'Serdán 55, Hermosillo',
    tipo: 'pintura', estatus: 'rechazada', diasAtras: 12,
    partidas: [['Pintura de oficinas y pasillos', 430, 158]],
  })
  console.log('  · 7 cotizaciones recientes con partidas y material')

  // -------------------------------------------------------------------------
  // Órdenes de trabajo
  // -------------------------------------------------------------------------
  async function abrirObra({ cotizacion, nombre, domicilio, estatus, monto, avance, diasAbierta, diasEntrega }) {
    return uno(
      `insert into public.obras
         (cotizacion_id, nombre, domicilio, estatus, monto_cotizado, avance_pct,
          fecha_apertura, fecha_estimada_entrega, fecha_cierre)
       values ($1,$2,$3,$4::estatus_obra,$5,$6,
               current_date - $7::int,
               current_date + $8::int,
               case when $4::text = 'cerrada' then current_date - 5 else null end)
       returning id, ot_numero, nombre`,
      [cotizacion, nombre, domicilio, estatus, monto, avance, diasAbierta, diasEntrega],
    )
  }

  const o1 = await abrirObra({
    cotizacion: c1.id, nombre: 'Residencial Los Álamos · Exterior',
    domicilio: 'Av. Solidaridad 1204, Hermosillo', estatus: 'en_obra',
    monto: 214020, avance: 65, diasAbierta: 8, diasEntrega: 18,
  })
  await abrirObra({
    cotizacion: c1.id, nombre: 'Residencial Los Álamos · Interior',
    domicilio: 'Av. Solidaridad 1204, Hermosillo', estatus: 'agendada',
    monto: 111388, avance: 0, diasAbierta: 8, diasEntrega: 32,
  })
  const o3 = await abrirObra({
    cotizacion: c2.id, nombre: 'Bodega Parque Industrial · Impermeabilizante',
    domicilio: 'Carr. a Nogales km 9, Hermosillo', estatus: 'en_obra',
    monto: 311344, avance: 40, diasAbierta: 14, diasEntrega: 13,
  })
  const o4 = await abrirObra({
    cotizacion: c3.id, nombre: 'Casa Vista Norte · Herrería y pintura',
    domicilio: 'Cerro del Sol 87, Hermosillo', estatus: 'pausada',
    monto: 164720, avance: 25, diasAbierta: 20, diasEntrega: 25,
  })
  const o5 = await abrirObra({
    cotizacion: c4.id, nombre: 'Plaza Sur · Repintado de locales',
    domicilio: 'Blvd. Morelos 340, Hermosillo', estatus: 'en_entrega',
    monto: 91524, avance: 92, diasAbierta: 32, diasEntrega: 4,
  })
  console.log('  · 5 órdenes de trabajo')

  // Sub-conceptos con presupuesto propio (los usa el desglose de gastos)
  const conceptos = {}
  for (const [obra, nombres] of [
    [o1, [['Fachada norte', 68000], ['Fachada sur y poniente', 74000]]],
    [o4, [['Portón principal', 38000], ['Protecciones de ventana', 22000]]],
  ]) {
    conceptos[obra.id] = []
    for (const [i, [nombre, presupuesto]] of nombres.entries()) {
      conceptos[obra.id].push(
        await uno(
          `insert into public.obra_conceptos (obra_id, nombre, presupuesto, orden)
           values ($1,$2,$3,$4) returning id`,
          [obra.id, nombre, presupuesto, i],
        ),
      )
    }
  }

  // Cronograma
  const CRONOGRAMA = [
    [o1, [
      ['Preparación y resanes', -13, -9, 'terminada'],
      ['Sellador fachada norte', -8, -5, 'terminada'],
      ['Primera vinílica', -3, 1, 'en_proceso'],
      ['Segunda vinílica y detalles', 2, 6, 'pendiente'],
      ['Limpieza y entrega', 7, 9, 'pendiente'],
    ]],
    [o3, [
      ['Lavado de azotea', -12, -9, 'terminada'],
      ['Sellado de grietas', -8, -4, 'terminada'],
      ['Malla de refuerzo', -3, 3, 'en_proceso'],
      ['Segunda capa elastomérica', 4, 10, 'pendiente'],
    ]],
    [o4, [
      ['Fabricación de portón', -18, -12, 'terminada'],
      ['Pintura interior', -10, -4, 'en_proceso'],
      ['Montaje de protecciones', 5, 9, 'pendiente'],
    ]],
  ]
  for (const [obra, tareas] of CRONOGRAMA) {
    for (const [i, [nombre, inicio, fin, estatus]] of tareas.entries()) {
      await c.query(
        `insert into public.cronograma_tareas (obra_id, nombre, fecha_inicio, fecha_fin, estatus, responsable_id, orden)
         values ($1,$2, current_date + $3::int, current_date + $4::int, $5,$6,$7)`,
        [obra.id, nombre, inicio, fin, estatus, pintor.id, i],
      )
    }
  }

  // Material: lo cotizado contra lo que de verdad se compró
  const MATERIALES = [
    [o1, 'cotizado', [['Vinílica blanca 19 L', 14, 1980], ['Sellador 5 L', 8, 640], ['Lija de agua 220', 40, 18]]],
    [o1, 'real',     [['Vinílica blanca 19 L', 12, 2050], ['Sellador 5 L', 7, 655], ['Cinta masking 2"', 24, 42]]],
    [o3, 'cotizado', [['Impermeabilizante 19 L', 22, 2640], ['Malla de refuerzo', 12, 780]]],
    [o3, 'real',     [['Impermeabilizante 19 L', 26, 2710], ['Malla de refuerzo', 14, 795]]],
    [o4, 'cotizado', [['PTR 1×1 calibre 14', 18, 420], ['Primer anticorrosivo 4 L', 4, 690]]],
    [o4, 'real',     [['PTR 1×1 calibre 14', 20, 445], ['Primer anticorrosivo 4 L', 5, 705]]],
    [o5, 'cotizado', [['Vinílica blanca 19 L', 9, 1980]]],
    [o5, 'real',     [['Vinílica blanca 19 L', 9, 2010]]],
  ]
  for (const [obra, origen, filas] of MATERIALES) {
    for (const [material, piezas, costo] of filas) {
      await c.query(
        `insert into public.obra_materiales (obra_id, origen, material, piezas, costo, es_taller)
         values ($1,$2,$3,$4,$5,$6)`,
        [obra.id, origen, material, piezas, costo, origen === 'real' && material.includes('Cinta')],
      )
    }
  }

  // -------------------------------------------------------------------------
  // Contratos de mano de obra, pagarés de herramienta y nómina
  // -------------------------------------------------------------------------
  async function contratar({ obra, trabajador, m2, tarifa, otros = 0, diasInicio, trabajos }) {
    return uno(
      `insert into public.contratos_oficial
         (obra_id, trabajador_id, trabajos, m2, tarifa_m2, otros_importe, costo_haaco_pct,
          estatus, fecha_inicia, firma_oficial_at)
       values ($1,$2,$3::jsonb,$4,$5,$6,5,'activo', current_date - $7::int, now())
       returning id, total_pagar`,
      [obra.id, trabajador.id, JSON.stringify(trabajos), m2, tarifa, otros, diasInicio],
    )
  }

  const k1 = await contratar({
    obra: o1, trabajador: pintor, m2: 1240, tarifa: 22, diasInicio: 8,
    trabajos: { vinilicas: ['superficie_nueva', 'exterior', 'resanes_menores'] },
  })
  const k2 = await contratar({
    obra: o3, trabajador: herrero, m2: 1420, tarifa: 26, diasInicio: 14,
    trabajos: { impermeabilizantes: ['elastomerico', 'malla', 'mantenimiento'] },
  })
  const k3 = await contratar({
    obra: o4, trabajador: herrero, m2: 310, tarifa: 18, otros: 28000, diasInicio: 20,
    trabajos: { otros: ['herreria'], vinilicas: ['interior', 'repintado'] },
  })
  const k4 = await contratar({
    obra: o5, trabajador: pintor, m2: 540, tarifa: 20, diasInicio: 32,
    trabajos: { vinilicas: ['repintado', 'exterior'] },
  })

  // Abonos ya pagados: siempre por debajo de lo devengado, si no la prenómina
  // saldría en cero y no habría nada que pagar esta semana.
  const NOMINA = [
    [k1, 6000, -12, 'efectivo'], [k1, 3500, -5, 'transferencia'],
    [k2, 6000, -10, 'transferencia'],
    [k3, 3000, -15, 'efectivo'],
    [k4, 4000, -20, 'efectivo'], [k4, 2000, -6, 'transferencia'],
  ]
  for (const [contrato, monto, dias, metodo] of NOMINA) {
    await c.query(
      `insert into public.nomina_pagos (contrato_id, fecha, monto, metodo, registrado_por)
       values ($1, current_date + $2::int, $3, $4, $5)`,
      [contrato.id, dias, monto, metodo, pati.id],
    )
  }

  await c.query(
    `insert into public.deducciones (trabajador_id, contrato_id, tipo, monto, fecha, notas)
     values ($1,$2,'prestamo',1800, current_date - 9, 'Préstamo para llantas de la camioneta')`,
    [pintor.id, k1.id],
  )
  await c.query(
    `insert into public.deducciones (trabajador_id, tipo, monto, fecha, notas)
     values ($1,'adelanto',1200, current_date - 4, 'Adelanto de quincena')`,
    [herrero.id],
  )

  // Pagaré de herramientas del contrato de la obra más grande
  if (herramientas.length > 0) {
    const pagare = await uno(
      `insert into public.pagares (contrato_id, fecha_emision, firma_oficial_at)
       values ($1, current_date - 14, now()) returning id`,
      [k2.id],
    )
    for (const h of herramientas.slice(0, 4)) {
      await c.query(
        `insert into public.pagare_items (pagare_id, herramienta_id, cantidad, valor_unitario)
         values ($1,$2,1,$3)`,
        [pagare.id, h.id, h.valor ?? 1200],
      )
    }
  }
  console.log('  · 4 contratos de obra, nómina, préstamos y pagaré de herramienta')

  // -------------------------------------------------------------------------
  // Avances de cuadrilla (el trigger sube el avance de la obra)
  // -------------------------------------------------------------------------
  const AVANCES = [
    [o1, pintor, -12, 'nota', 'Llegó el andamio. Falta un tramo de PTR para la protección del portón.', null],
    [o1, pintor, -8,  'nota', 'Resanes de la barda perimetral listos.', 50],
    [o1, pintor, -1,  'nota', 'Terminamos el sellado de la fachada norte. Mañana entra la primera vinílica.', 65],
    [o3, herrero, -9, 'nota', 'Azotea lavada y seca, empezamos el sellado de grietas.', 25],
    [o3, herrero, -2, 'nota', 'Media azotea con malla puesta. Falta el lado poniente.', 40],
    [o4, herrero, -11,'nota', 'Portón fabricado en taller, pendiente el montaje.', 25],
    [o5, pintor, -3,  'nota', 'Locales 4 al 8 terminados, falta detalle del 9.', 92],
  ]
  for (const [obra, autor, dias, tipo, comentario, pct] of AVANCES) {
    await c.query(
      `insert into public.avances (obra_id, autor_id, tipo, comentario, porcentaje_avance, created_at)
       values ($1,$2,$3,$4,$5, now() + ($6::int * interval '1 day'))`,
      [obra.id, autor.id, tipo, comentario, pct, dias],
    )
  }

  await c.query(
    `insert into public.solicitudes_material (obra_id, autor_id, items, estatus, created_at)
     values ($1,$2,$3::jsonb,'cotizada', now() - interval '4 days'),
            ($1,$2,$4::jsonb,'comprada', now() - interval '9 days')`,
    [
      o4.id, herrero.id,
      JSON.stringify([
        { material: 'PTR 1x1 calibre 14', cantidad: 2, unidad: 'tramo', notas: 'Para la protección del portón' },
        { material: 'Sellador 5L', cantidad: 1, unidad: 'cubeta', notas: '' },
      ]),
      JSON.stringify([
        { material: 'Lija de agua 220', cantidad: 6, unidad: 'pza', notas: '' },
        { material: 'Thinner estándar', cantidad: 3, unidad: 'litro', notas: '' },
      ]),
    ],
  )
  console.log('  · avances de cuadrilla y solicitudes de material')

  // -------------------------------------------------------------------------
  // Gastos del mes (los de crédito abren su cuenta por pagar solos)
  // -------------------------------------------------------------------------
  const GASTOS = [
    [o1, 'material', 'Vinílica blanca 19 L', 12, 2050, 0, 'tarjeta_empresa', 'contado', 'PN-14741'],
    [o1, 'material', 'Sellador 5 L', 7, 655, -2, 'efectivo', 'contado', null],
    [o1, 'material', 'Cinta masking 2"', 24, 42, -3, 'efectivo', 'contado', null],
    [o3, 'material', 'Impermeabilizante elastomérico 19 L', 26, 2710, -5, 'transferencia', 'credito', 'A-8842'],
    [o3, 'material', 'Malla de refuerzo 1 m × 50 m', 14, 795, -6, 'transferencia', 'contado', 'A-8790'],
    [o4, 'material', 'PTR 1×1 calibre 14', 20, 445, -8, 'transferencia', 'credito', 'B-1207'],
    [o4, 'material', 'Primer anticorrosivo 4 L', 5, 705, -9, 'efectivo', 'contado', null],
    [o5, 'material', 'Vinílica blanca 19 L', 9, 2010, -12, 'tarjeta_empresa', 'contado', 'PN-14602'],
    [null, 'gasolina', 'Gasolina camioneta de obra', 1, 4800, -1, 'tarjeta_empresa', 'contado', null],
    [null, 'gasolina', 'Gasolina camioneta de obra', 1, 4200, -7, 'tarjeta_empresa', 'contado', null],
    [null, 'gasolina', 'Gasolina camioneta de taller', 1, 3900, -14, 'efectivo', 'contado', null],
    [o1, 'herramienta', 'Rodillos y extensiones', 6, 380, -4, 'efectivo', 'contado', null],
    [null, 'herramienta', 'Compresor de repuesto', 1, 8900, -11, 'transferencia', 'credito', 'C-3391'],
    [o3, 'viaticos', 'Comidas de cuadrilla en obra', 8, 320, -2, 'efectivo', 'contado', null],
    [o1, 'viaticos', 'Comidas de cuadrilla en obra', 9, 290, -6, 'efectivo', 'contado', null],
    [null, 'garrafones', 'Garrafones de agua para obra', 14, 45, -3, 'efectivo', 'contado', null],
    [null, 'oficina', 'Papelería y tóner', 1, 2350, -10, 'tarjeta_empresa', 'contado', null],
    [null, 'oficina', 'Internet y telefonía', 1, 1890, -13, 'transferencia', 'contado', null],
    [null, 'servicio_auto', 'Servicio de frenos camioneta', 1, 4600, -16, 'transferencia', 'contado', null],
    [null, 'marketing', 'Lonas y volantes', 1, 2800, -18, 'efectivo', 'contado', null],
  ]
  for (const [i, [obra, categoria, descripcion, piezas, unitario, dias, metodo, condicion, folio]] of GASTOS.entries()) {
    await c.query(
      `insert into public.gastos
         (obra_id, categoria, descripcion, piezas, costo_unitario, monto, folio_factura,
          proveedor_id, metodo, condicion, fecha, registrado_por)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, current_date + $11::int, $12)`,
      [
        obra?.id ?? null, categoria, descripcion, piezas, unitario, piezas * unitario, folio,
        condicion === 'credito' || folio ? proveedor(i) : null,
        metodo, condicion, dias, pati.id,
      ],
    )
  }
  console.log(`  · ${GASTOS.length} gastos del mes`)

  // Facturas de proveedor capturadas a mano, para tener los cuatro estados
  const CXP = [
    ['B-2210', 18400, -34, 30, 0],        // venció hace 4 días
    ['A-9012', 24800, -28, 30, 0],        // vence en 2 días
    ['C-4455', 9600, -20, 30, 0],         // vence en 10
    ['D-0455', 5200, -7, 30, 0],          // vence en 23
    ['E-7781', 14300, -60, 30, 14300],    // pagada
  ]
  for (const [i, [folio, monto, dias, credito, pagado]] of CXP.entries()) {
    await c.query(
      `insert into public.cuentas_por_pagar
         (proveedor_id, folio_factura, monto, fecha_factura, dias_credito, monto_pagado, fecha_pago)
       values ($1,$2,$3, current_date + $4::int, $5, $6,
               case when $6::numeric > 0 then current_date - 3 else null end)`,
      [proveedor(i + 1), folio, monto, dias, credito, pagado],
    )
  }
  console.log('  · cuentas por pagar con vencimientos escalonados')

  // -------------------------------------------------------------------------
  // Cobranza
  // -------------------------------------------------------------------------
  await cobrar(c1, { anticipoPct: 50, abonos: [40000], diasBase: 7 })
  await cobrar(c2, { anticipoPct: 50, diasBase: 14 })
  await cobrar(c3, { anticipoPct: 60, diasBase: 19 })
  await cobrar(c4, { anticipoPct: 50, liquidar: true, diasBase: 30 })
  console.log('  · anticipos, abonos y una obra liquidada')

  // -------------------------------------------------------------------------
  // Caja chica y pagos fijos
  // -------------------------------------------------------------------------
  const CAJA = [
    ['entrada', 'Fondo fijo de la quincena', 25000, -15],
    ['salida',  'Garrafones de agua para obra', 630, -12],
    ['salida',  'Comidas de cuadrilla', 2610, -9],
    ['salida',  'Gasolina camioneta de taller', 3900, -7],
    ['entrada', 'Reembolso de Dirección', 6000, -5],
    ['salida',  'Rodillos y extensiones', 2280, -4],
    ['salida',  'Papelería', 890, -2],
  ]
  for (const [tipo, concepto, monto, dias] of CAJA) {
    await c.query(
      `insert into public.caja_chica (tipo, concepto, monto, fecha, registrado_por)
       values ($1,$2,$3, current_date + $4::int, $5)`,
      [tipo, concepto, monto, dias, pati.id],
    )
  }

  const PAGOS_FIJOS = [
    ['Nómina', 'Patricia Moreno · administración', 9800, 'pagado'],
    ['Nómina', 'Auxiliar de taller', 6200, 'pagado'],
    ['Renta', 'Bodega y taller', 12500, 'pendiente'],
    ['Servicio', 'CFE bodega', 3400, 'pendiente'],
    ['Servicio', 'Internet y telefonía', 1890, 'pagado'],
    ['Seguro', 'Póliza de camioneta', 2750, 'programado'],
  ]
  for (const [categoria, beneficiario, monto, estado] of PAGOS_FIJOS) {
    await c.query(
      `insert into public.pagos_fijos (quincena, categoria, beneficiario, monto, estado, fecha_pago)
       values (case when extract(day from current_date) <= 15
                    then date_trunc('month', current_date)::date + 14
                    else (date_trunc('month', current_date) + interval '1 month - 1 day')::date end,
               $1,$2,$3,$4::estado_pago_fijo,
               case when $4::text = 'pagado' then current_date - 2 else null end)`,
      [categoria, beneficiario, monto, estado],
    )
  }
  console.log('  · caja chica y pagos fijos de la quincena')

  // -------------------------------------------------------------------------
  // Póliza de garantía de la obra que está por entregarse
  // -------------------------------------------------------------------------
  await c.query(
    `insert into public.polizas_garantia (obra_id, items, fecha_emision, fecha_conclusion, vigencia_dias)
     values ($1, $2::jsonb, current_date - 2, current_date + 4, 365)`,
    [
      o5.id,
      JSON.stringify([
        { area: 'Locales 4 al 9 · interior', pintura: 'Vinílica', color: 'Blanco ostión', codigo: 'RV-7' },
        { area: 'Fachada de locales', pintura: 'Vinílica', color: 'Arena', codigo: 'RV-12' },
      ]),
    ],
  )

  await c.query('commit')

  // -------------------------------------------------------------------------
  const resumen = await todos(`
    select 'cotizaciones' t, count(*)::int n from public.cotizaciones
    union all select 'obras', count(*)::int from public.obras
    union all select 'gastos', count(*)::int from public.gastos
    union all select 'cuentas por pagar', count(*)::int from public.cuentas_por_pagar
    union all select 'pagos de cobranza', count(*)::int from public.pagos_cobranza
    union all select 'contratos', count(*)::int from public.contratos_oficial
    union all select 'avances', count(*)::int from public.avances
  `)
  console.log('\nOperación de ejemplo cargada:')
  for (const r of resumen) console.log(`  ${String(r.n).padStart(4)}  ${r.t}`)
  console.log('\nEntra con luis@haacopro.mx para verlo todo.\n')
} catch (error) {
  await c.query('rollback').catch(() => {})
  console.error('✗ No se pudo cargar la demo:', error.message)
  process.exitCode = 1
} finally {
  await c.end()
}
