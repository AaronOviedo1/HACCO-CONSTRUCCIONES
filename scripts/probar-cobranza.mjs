/**
 * Pruebas de la cuenta de la cobranza · node scripts/probar-cobranza.mjs
 *
 * De aquí salen el «por cobrar» del panel y el total de la pantalla de
 * cobranza, que es el número contra el que Dirección suma a mano lo que le
 * deben. Ya se separaron una vez —el panel restaba los sobrepagos y la pantalla
 * contaba otro universo—, así que conviene tenerlo amarrado.
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
const { cobranzaViva, resumenCobranza } = await import('../lib/cobranza.ts')

/** Una fila de cobranza. El saldo es lo cotizado menos lo cobrado, como en la vista. */
const fila = (id, estatus, cotizado, cobrado, anticipoEsperado = 0, anticipo = 0) => ({
  cotizacion_id: id,
  estatus,
  cotizado,
  cobrado,
  saldo: Math.round((cotizado - cobrado) * 100) / 100,
  anticipo_esperado: anticipoEsperado,
  anticipo,
})

// Los diez folios que deben el 18 de agosto de 2026, más el F-330 que pagó de
// más. Es el caso que destapó todo: Dirección sumó a mano los diez y le dio
// 301,784.44, mientras el panel enseñaba 290,350.37 porque le restaba el
// sobrepago del F-330.
const REALES = [
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

const CASOS = [
  {
    nombre: 'Los folios reales del 18 de agosto: el sobrepago no resta',
    filas: REALES,
    conObra: [],
    esperado: { porCobrar: 301784.44, sobrepagos: 11434.07, cuantosSobrepagos: 1 },
    nota: 'El panel enseñaba 290,350.37 y la suma a mano de Dirección daba 301,784.44.',
  },
  {
    nombre: 'Un cliente pagó de más',
    filas: [fila('a', 'aprobada', 120000, 0), fila('b', 'terminada', 50000, 55000)],
    conObra: [],
    esperado: { porCobrar: 120000, sobrepagos: 5000, cuantosSobrepagos: 1, contratado: 170000 },
  },
  {
    nombre: 'Cotización en borrador con obra abierta: entra',
    filas: [fila('a', 'aprobada', 10000, 0), fila('b', 'borrador', 7000, 1000)],
    conObra: ['b'],
    esperado: { porCobrar: 16000, sobrepagos: 0 },
    nota: 'Sin su OT, la de borrador se quedaría fuera y las dos pantallas volverían a discrepar.',
  },
  {
    nombre: 'Cotización en borrador SIN obra: se queda fuera',
    filas: [fila('a', 'aprobada', 10000, 0), fila('b', 'borrador', 7000, 0)],
    conObra: [],
    esperado: { porCobrar: 10000, contratado: 10000 },
  },
  {
    nombre: 'Terminada con saldo: cuenta en por cobrar, no en anticipos',
    filas: [fila('a', 'terminada', 40000, 30000, 20000, 0)],
    conObra: [],
    esperado: { porCobrar: 10000, anticiposPendientes: 0 },
    nota: 'Su anticipo ya no se persigue: lo que falta ya está contado en «por cobrar».',
  },
  {
    nombre: 'Aprobada a la que le falta anticipo',
    filas: [fila('a', 'aprobada', 40000, 5000, 20000, 5000)],
    conObra: [],
    esperado: { porCobrar: 35000, anticiposPendientes: 15000 },
  },
  {
    nombre: 'Todo cobrado: el porcentaje llega a 100 y no se pasa',
    filas: [fila('a', 'terminada', 50000, 50000), fila('b', 'terminada', 10000, 12000)],
    conObra: [],
    esperado: { porCobrar: 0, sobrepagos: 2000, pctCobrado: 100 },
    nota: 'Con el sobrepago, lo cobrado supera lo contratado y el anillo se saturaría.',
  },
  {
    nombre: 'Sin nada: no divide entre cero',
    filas: [],
    conObra: [],
    esperado: { porCobrar: 0, cobrado: 0, contratado: 0, pctCobrado: 0, anticiposPendientes: 0 },
  },
]

let fallaron = 0

for (const caso of CASOS) {
  const vivas = cobranzaViva(caso.filas, new Set(caso.conObra))
  const salio = resumenCobranza(vivas)

  const problemas = []
  for (const [campo, valor] of Object.entries(caso.esperado)) {
    if (salio[campo] !== valor) {
      problemas.push(`${campo}: se esperaba ${valor} y salió ${salio[campo]}`)
    }
  }
  // La razón de ser de todo esto: el total tiene que ser lo que da sumar a mano
  // los renglones que la lista enseña, que son los que deben.
  const aMano =
    Math.round(vivas.filter((c) => c.saldo > 0).reduce((s, c) => s + c.saldo, 0) * 100) / 100
  if (salio.porCobrar !== aMano) {
    problemas.push(`sumar a mano los renglones da ${aMano} y el total dice ${salio.porCobrar}`)
  }

  if (problemas.length === 0) {
    console.log(`✓ ${caso.nombre}`)
    if (caso.nota) console.log(`  ${caso.nota}`)
  } else {
    fallaron++
    console.error(`✗ ${caso.nombre}`)
    for (const p of problemas) console.error(`  ${p}`)
  }
}

console.log('')
if (fallaron > 0) {
  console.error(`${fallaron} de ${CASOS.length} casos fallaron.`)
  process.exit(1)
}
console.log(`Los ${CASOS.length} casos cuadran.`)
