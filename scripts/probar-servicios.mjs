/**
 * Pruebas de las reparaciones · node scripts/probar-servicios.mjs
 *
 * Dos cosas que amarrar. La primera es la palabra con la que se lee cada
 * renglón: «Finalizado» no se guarda en ningún lado, se deriva de que el
 * trabajo quedó y no debe nada, y si esa derivación se tuerce la lista miente
 * sin que nada truene.
 *
 * La segunda es que el dinero de un portón se suma con el de las obras en la
 * misma función. Ahí lo que se vigila es que no contamine: los sobrepagos de
 * las cotizaciones tienen que seguir dando lo mismo con las reparaciones
 * dentro que sin ellas.
 *
 * Node 23 corre TypeScript de corrido; lo único que le falta es el alias «@/»
 * de Next, que aquí se resuelve a mano contra la raíz del proyecto.
 */

import { registerHooks } from 'node:module'

const RAIZ = new URL('../', import.meta.url)

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith('@/')) {
      return { url: new URL(`${especificador.slice(2)}.ts`, RAIZ).href, shortCircuit: true }
    }
    return siguiente(especificador, contexto)
  },
})

// Dinámico y no arriba: los imports estáticos se resuelven antes de que corra
// nada de este archivo, y para entonces el alias todavía no existiría.
const { resumenCobranza } = await import('../lib/cobranza.ts')
const {
  comoCobranza, etapaServicio, proximoPreventivo, serviciosCobrables, vendidoServicios,
} = await import('../lib/servicios.ts')

/** Un servicio con su dinero, como lo entrega `v_servicios`. */
const srv = (estatus, cotizado, cobrado, fechaVenta = null) => ({
  estatus,
  cotizado,
  cobrado,
  saldo: Math.round((cotizado - cobrado) * 100) / 100,
  fecha_venta: fechaVenta,
})

/**
 * Lo que la base calcula sola: cuánto se debe en cada etapa. Se replica aquí
 * para poder probar la cuenta sin base de por medio; la fórmula de verdad vive
 * en la columna generada de `servicios.total`.
 */
const debe = (estatus, cuotaVisita, trabajo) => {
  const visita = estatus === 'agendado' || estatus === 'cancelado' ? 0 : cuotaVisita
  const obra = estatus === 'aprobado' || estatus === 'reparado' ? trabajo : 0
  return Math.round((visita + obra) * 100) / 100
}

/** Una fila de cobranza de cotización, para el caso mezclado. */
const fila = (id, estatus, cotizado, cobrado) => ({
  cotizacion_id: id,
  estatus,
  cotizado,
  cobrado,
  saldo: Math.round((cotizado - cobrado) * 100) / 100,
  anticipo_esperado: 0,
  anticipo: 0,
})

// Los tres renglones del Excel que llevaba la oficina en agosto de 2026.
const GILBERTO = srv('reparado', 3200, 3200, '2026-08-13')
const JOSE_ARTURO = srv('reparado', 900, 900, '2026-08-15')
const LUIS = srv('diagnostico', 0, 0, '2026-08-25')
const REALES = [GILBERTO, JOSE_ARTURO, LUIS]

// Los once folios de cobranza del 18 de agosto: los mismos de
// `probar-cobranza.mjs`, para comprobar que meter reparaciones en la cuenta no
// mueve ni un centavo de lo que ya estaba.
const COTIZACIONES = [
  fila('F-409', 'aprobada', 173430.0, 60500.0),
  fila('F-468', 'aprobada', 157746.1, 91492.74),
  fila('F-397', 'aprobada', 103351.49, 51675.75),
  fila('F-403', 'aprobada', 228300.0, 196980.0),
  fila('F-471', 'aprobada', 31502.0, 16000.0),
  fila('F-484', 'aprobada', 8700.3, 0.0),
  fila('F-321', 'aprobada', 66700.0, 60030.0),
  fila('F-482', 'aprobada', 18000.92, 14917.88),
  fila('F-333', 'aprobada', 28500.0, 25650.0),
  fila('F-472', 'aprobada', 32800.0, 30000.0),
  fila('F-330', 'terminada', 97450.0, 108884.07),
]

let fallaron = 0

function comprobar(nombre, problemas, nota) {
  if (problemas.length === 0) {
    console.log(`✓ ${nombre}`)
    if (nota) console.log(`  ${nota}`)
    return
  }
  fallaron++
  console.error(`✗ ${nombre}`)
  for (const p of problemas) console.error(`  ${p}`)
}

// ---------------------------------------------------------------------------
// La palabra con la que se lee cada renglón
// ---------------------------------------------------------------------------
const ETAPAS = [
  { nombre: 'Gilberto: reparado y pagado se lee «Finalizado»', s: GILBERTO, texto: 'Finalizado' },
  { nombre: 'Jose Arturo: pagó el mismo día', s: JOSE_ARTURO, texto: 'Finalizado' },
  { nombre: 'Luis: sin presupuesto todavía', s: LUIS, texto: 'En diagnóstico' },
  {
    nombre: 'Reparado pero sin cobrar: lo que urge es cobrarlo',
    s: srv('reparado', 3200, 0),
    texto: 'Por cobrar',
    nota: '«Finalizado» aquí sería mentira: el trabajo quedó, el dinero no.',
  },
  {
    nombre: 'Reparado y cobrado a medias: sigue siendo por cobrar',
    s: srv('reparado', 3200, 1500),
    texto: 'Por cobrar',
  },
  { nombre: 'Aprobado: falta hacerlo', s: srv('aprobado', 3200, 0), texto: 'Por reparar' },
  {
    nombre: 'Presupuestado: la pelota está con el cliente',
    s: srv('presupuestado', 3200, 0),
    texto: 'Presupuesto enviado',
  },
  { nombre: 'Agendado', s: srv('agendado', 0, 0), texto: 'Agendado' },
  {
    nombre: 'Rechazado sin visita que cobrar',
    s: srv('rechazado', 0, 0),
    texto: 'Rechazado',
    nota: 'Cuando la visita no se cobra, un «no» del cliente cierra el renglón.',
  },
  {
    nombre: 'Reparado de cortesía: sin monto no se puede dar por finalizado',
    s: srv('reparado', 0, 0),
    texto: 'Por cobrar',
    nota: 'Con total en cero, el saldo también es cero y «Finalizado» saldría solo.',
  },
]

for (const caso of ETAPAS) {
  const salio = etapaServicio(caso.s)
  comprobar(
    caso.nombre,
    salio.texto === caso.texto
      ? []
      : [`se esperaba «${caso.texto}» y salió «${salio.texto}»`],
    caso.nota,
  )
}

// ---------------------------------------------------------------------------
// Qué dinero se persigue
// ---------------------------------------------------------------------------
{
  // Los tres del Excel se capturaron sin cuota de visita, así que Luis —que
  // sigue en diagnóstico— entra a la lista pero no debe nada.
  const cobrables = serviciosCobrables(REALES)
  const problemas = []
  if (cobrables.length !== 3) {
    problemas.push(`se esperaban 3 cobrables y salieron ${cobrables.length}`)
  }
  const { porCobrar } = resumenCobranza(cobrables.map(comoCobranza))
  if (porCobrar !== 0) {
    problemas.push(`porCobrar: se esperaba 0 y salió ${porCobrar}`)
  }
  comprobar(
    'Se persigue desde que el técnico fue, no desde que el cliente aprueba',
    problemas,
    'Sin cuota de visita no se debe nada, aunque el renglón esté en la lista.',
  )
}

{
  const { porCobrar, anticiposPendientes } = resumenCobranza(
    serviciosCobrables([srv('aprobado', 4500, 0)]).map(comoCobranza),
  )
  const problemas = []
  if (porCobrar !== 4500) problemas.push(`porCobrar: se esperaba 4500 y salió ${porCobrar}`)
  if (anticiposPendientes !== 0) {
    problemas.push(`anticiposPendientes: se esperaba 0 y salió ${anticiposPendientes}`)
  }
  comprobar(
    'Aprobado sin cobrar: entra al por cobrar y no a los anticipos',
    problemas,
    'Una reparación se cobra al terminar; no hay anticipo que perseguir.',
  )
}

// ---------------------------------------------------------------------------
// El caso mezclado: obras y reparaciones en la misma cuenta
// ---------------------------------------------------------------------------
{
  const soloObras = resumenCobranza(COTIZACIONES)
  const conServicios = resumenCobranza([
    ...COTIZACIONES,
    ...serviciosCobrables([...REALES, srv('aprobado', 4500, 0), srv('reparado', 3200, 1200)]).map(
      comoCobranza,
    ),
  ])

  const problemas = []
  if (soloObras.porCobrar !== 301784.44) {
    problemas.push(`el punto de partida cambió: ${soloObras.porCobrar} en vez de 301784.44`)
  }
  // 4,500 de la aprobada sin cobrar + 2,000 de la reparada a medias.
  const esperado = Math.round((301784.44 + 6500) * 100) / 100
  if (conServicios.porCobrar !== esperado) {
    problemas.push(`porCobrar: se esperaba ${esperado} y salió ${conServicios.porCobrar}`)
  }
  if (conServicios.sobrepagos !== 11434.07) {
    problemas.push(
      `el sobrepago del F-330 se contaminó: ${conServicios.sobrepagos} en vez de 11434.07`,
    )
  }
  if (conServicios.cuantosSobrepagos !== 1) {
    problemas.push(`cuantosSobrepagos: se esperaba 1 y salió ${conServicios.cuantosSobrepagos}`)
  }
  comprobar(
    'Reparaciones y obras en la misma cuenta, sin contaminarse',
    problemas,
    'Es el número que Dirección revisa sumando a mano los renglones de la lista.',
  )
}

// ---------------------------------------------------------------------------
// Lo vendido del mes
// ---------------------------------------------------------------------------
{
  const lista = [
    ...REALES,
    // Se presupuestó en julio y el cliente aceptó en agosto: cuenta en agosto.
    srv('aprobado', 5000, 0, '2026-08-20'),
    // Rechazado: lo vendido es la visita, no el presupuesto que no aceptó.
    // Su `cotizado` ya viene siendo sólo la cuota, que es lo que se le cobra.
    srv('rechazado', 400, 0, '2026-08-21'),
    srv('reparado', 1500, 1500, '2026-07-30'),
  ]
  const problemas = []
  // 3,200 + 900 de los dos finalizados, 5,000 del aprobado y los 400 de la
  // visita que se cobra aunque el cliente haya dicho que no.
  const agosto = vendidoServicios(lista, '2026-08')
  if (agosto !== 9500) problemas.push(`agosto: se esperaba 9500 y salió ${agosto}`)

  const julio = vendidoServicios(lista, '2026-07')
  if (julio !== 1500) problemas.push(`julio: se esperaba 1500 y salió ${julio}`)

  comprobar(
    'La venta se cuenta en el mes en que el cliente dijo que sí',
    problemas,
    'Mismo criterio que las cotizaciones desde la entrega del 18 de agosto.',
  )
}

// ---------------------------------------------------------------------------
// La visita se cobra aunque el cliente diga que no
// ---------------------------------------------------------------------------
{
  const problemas = []

  // El mismo portón, con $400 de visita y $3,200 de reparación, etapa por etapa.
  const esperado = {
    agendado: 0,        // el técnico todavía no va
    diagnostico: 400,   // ya fue: la visita se debe
    presupuestado: 400, // el cliente está pensándolo
    rechazado: 400,     // dijo que no; la visita se cobra igual
    aprobado: 3600,     // dijo que sí: visita y reparación
    reparado: 3600,
    cancelado: 0,       // no se hizo la visita
  }

  for (const [estatus, monto] of Object.entries(esperado)) {
    const salio = debe(estatus, 400, 3200)
    if (salio !== monto) problemas.push(`${estatus}: se esperaba ${monto} y salió ${salio}`)
  }

  comprobar(
    'Lo que se debe en cada etapa: la visita desde que el técnico va',
    problemas,
    'Un presupuesto rechazado deja $400 cobrables; antes se perdían.',
  )
}

{
  const rechazado = srv('rechazado', 400, 0)
  const problemas = []

  if (etapaServicio(rechazado).texto !== 'Visita por cobrar') {
    problemas.push(`se esperaba «Visita por cobrar» y salió «${etapaServicio(rechazado).texto}»`)
  }
  if (!serviciosCobrables([rechazado]).includes(rechazado)) {
    problemas.push('un rechazado que debe la visita tiene que entrar al por cobrar')
  }

  const yaPagada = srv('rechazado', 400, 400)
  if (etapaServicio(yaPagada).texto !== 'Rechazado') {
    problemas.push(`ya pagada debía leerse «Rechazado» y salió «${etapaServicio(yaPagada).texto}»`)
  }

  comprobar('El «no» del cliente cierra el trabajo, no la cuenta', problemas)
}

{
  // Nada que cobrar antes de ir, y nada que cobrar de lo que no se hizo.
  const problemas = []
  for (const estatus of ['agendado', 'cancelado']) {
    const s = srv(estatus, 0, 0)
    if (serviciosCobrables([s]).length !== 0) {
      problemas.push(`un servicio ${estatus} no se persigue`)
    }
  }
  comprobar('Antes de la visita no se debe nada', problemas)
}

// ---------------------------------------------------------------------------
// El anticipo
// ---------------------------------------------------------------------------
{
  const conAnticipo = srv('aprobado', 8600, 3000)
  const problemas = []

  if (etapaServicio(conAnticipo).texto !== 'Con anticipo') {
    problemas.push(`se esperaba «Con anticipo» y salió «${etapaServicio(conAnticipo).texto}»`)
  }
  const { porCobrar } = resumenCobranza([comoCobranza(conAnticipo)])
  if (porCobrar !== 5600) problemas.push(`porCobrar: se esperaba 5600 y salió ${porCobrar}`)

  comprobar(
    'Un trabajo grande con anticipo cobrado sigue debiendo el resto',
    problemas,
    'Se pide anticipo cuando es algo grande; el resto se cobra al terminar.',
  )
}

// ---------------------------------------------------------------------------
// El preventivo, seis meses después
// ---------------------------------------------------------------------------
{
  const CASOS = [
    ['2026-08-13', '2027-02-13'],
    ['2026-01-31', '2026-07-31'],
    // 31 de marzo + 6 meses cae en septiembre, que no tiene 31: el último día
    // del mes en vez de saltarse a octubre.
    ['2026-03-31', '2026-09-30'],
    ['2026-08-31', '2027-02-28'],
    ['2026-12-15', '2027-06-15'],
  ]
  const problemas = []
  for (const [desde, esperado] of CASOS) {
    const salio = proximoPreventivo(desde)
    if (salio !== esperado) problemas.push(`${desde} → se esperaba ${esperado} y salió ${salio}`)
  }
  comprobar(
    'El preventivo cae seis meses después, sin saltarse de mes',
    problemas,
    'Un 31 en un mes de 30 se acomoda al último día, no se va al siguiente.',
  )
}

console.log('')
if (fallaron > 0) {
  console.error(`${fallaron} casos fallaron.`)
  process.exit(1)
}
console.log('Todos los casos cuadran.')
