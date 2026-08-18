/**
 * Pruebas del cuadre de un comprobante · node scripts/probar-cuadre.mjs
 *
 * `cuadrarRenglones` reparte el descuento y el IVA de una factura entre sus
 * renglones para que la suma de los conceptos sea, al centavo, lo que se pagó.
 * Es aritmética de dinero y de ahí sale el costo del material que se carga a la
 * obra, así que conviene tenerla amarrada.
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
const { cuadrarRenglones } = await import('../lib/ticket.ts')

/** Un renglón como sale del comprobante; lo que no viene impreso va en null. */
const renglon = (descripcion, piezas, importe, descuento = null, impuesto = null) => ({
  descripcion,
  piezas,
  importe,
  descuento,
  impuesto,
})

/** El pie del comprobante. */
const pie = (subtotal, descuento, impuesto, total) => ({ subtotal, descuento, impuesto, total })

// La factura de MAPEX que destapó todo esto: dos cubetas de pintura con
// descuentos de porcentajes distintos —25% y 50%—, que es justo lo que impide
// repartir el total hacia atrás.
const MAPEX = [
  renglon('Super Kem Tone Extra White mate bajo VOC cubeta', 4, 15986.21, 3996.55, 1918.34),
  renglon('Exterior Prime bajo VOC 5G cubeta', 6, 15821.48, 7933.50, 1262.08),
]
const PIE_MAPEX = pie(31807.69, 11930.05, 3180.42, 23058.06)

const CASOS = [
  {
    nombre: 'MAPEX, con descuento e IVA renglón por renglón',
    leidos: MAPEX,
    desglose: PIE_MAPEX,
    montos: [13908.0, 9150.06],
    cuadra: true,
    diferencia: 0,
    descuento_incluido: false,
  },
  {
    nombre: 'MAPEX, con el IVA sólo al pie (se reparte sobre la base)',
    leidos: MAPEX.map((r) => ({ ...r, impuesto: null })),
    desglose: PIE_MAPEX,
    montos: [13908.0, 9150.06],
    cuadra: true,
    diferencia: 0,
    descuento_incluido: false,
    nota: 'Repartir el IVA sobre el bruto daría 1,598.42 / 1,582.00 y desviaría los dos renglones.',
  },
  {
    nombre: 'MAPEX, con todo al pie',
    leidos: MAPEX.map((r) => ({ ...r, descuento: null, impuesto: null })),
    desglose: PIE_MAPEX,
    montos: [11588.74, 11469.32],
    cuadra: true,
    diferencia: 0,
    descuento_incluido: false,
    nota: 'El total cuadra, los renglones no: sin el desglose impreso no hay de dónde sacarlo.',
  },
  {
    nombre: 'Ticket de tiendita, sin desglose ni total legible',
    leidos: [renglon('Thinner estándar galón', 2, 240)],
    desglose: pie(null, null, null, null),
    montos: [240],
    cuadra: true,
    diferencia: 0,
  },
  {
    nombre: 'Tres renglones parejos: el centavo de redondeo va al mayor',
    leidos: [renglon('Lija', 1, 33.33), renglon('Brocha', 1, 33.33), renglon('Cinta', 1, 33.33)],
    desglose: pie(null, null, null, 100.0),
    montos: [33.34, 33.33, 33.33],
    cuadra: true,
    diferencia: 0,
  },
  {
    nombre: 'Falta un renglón en la lista: no se fuerza nada, se avisa',
    leidos: [renglon('Rodillo', 1, 50), renglon('Charola', 1, 50)],
    desglose: pie(null, null, null, 105.0),
    montos: [50, 50],
    cuadra: false,
    diferencia: 5,
  },
  {
    nombre: 'Renglón regalado (100% de descuento)',
    leidos: [renglon('Cubeta de cortesía', 1, 100, 100), renglon('Sellador 19L', 1, 200, null, 32)],
    desglose: pie(300, 100, 32, 232),
    montos: [0, 232],
    cuadra: true,
    diferencia: 0,
    descuento_incluido: false,
  },
  // La factura de BROLORS que destapó lo del descuento: los importes de los
  // renglones ya suman el subtotal y el subtotal más el IVA ya da el total, así
  // que el «Ahorro por promoción» del pie viene rebajado de fondo. Restarlo otra
  // vez dejaba el gasto en 1,800.96 y corto por los 707.52 completos.
  {
    nombre: 'BROLORS, el ahorro por promoción ya viene incluido',
    leidos: [renglon('Rivinol base pastel 19L', 1, 1750.29), renglon('Rivinol base pastel 4L', 1, 412.19)],
    desglose: pie(2162.48, 707.52, 346.0, 2508.48),
    montos: [2030.34, 478.14],
    cuadra: true,
    diferencia: 0,
    descuento_incluido: true,
    nota: 'El IVA se reparte sobre los importes tal cual: 346 × 1750.29/2162.48 = 280.05.',
  },
  {
    nombre: 'BROLORS sin total legible: lo decide el IVA contra el 16%',
    leidos: [renglon('Rivinol base pastel 19L', 1, 1750.29), renglon('Rivinol base pastel 4L', 1, 412.19)],
    desglose: pie(2162.48, 707.52, 346.0, null),
    montos: [2030.34, 478.14],
    cuadra: true,
    diferencia: 0,
    descuento_incluido: true,
    nota: '16% de 2,162.48 son 346.00 impresos; de la base descontada saldrían 232.79.',
  },
  {
    nombre: 'El «Ud. ahorra» pegado a un renglón que ya venía rebajado',
    leidos: [
      renglon('Rivinol base pastel 19L', 1, 1750.29, 572.72),
      renglon('Rivinol base pastel 4L', 1, 412.19, 134.8),
    ],
    desglose: pie(2162.48, 707.52, 346.0, 2508.48),
    montos: [2030.34, 478.14],
    cuadra: true,
    diferencia: 0,
    descuento_incluido: true,
    nota: 'Da igual si el ahorro cae en el renglón o al pie: el total sigue mandando.',
  },
  {
    nombre: 'Descuento de verdad sin total legible: el subtotal ya viene neteado',
    leidos: [renglon('Esmalte 4L', 4, 2000), renglon('Thinner galón', 2, 500)],
    desglose: pie(2250, 250, 360, null),
    montos: [2088, 522],
    cuadra: true,
    diferencia: 0,
    descuento_incluido: false,
    nota: '16% de 2,250 son los 360 impresos, así que el descuento sí se resta.',
  },
]

let fallaron = 0

for (const caso of CASOS) {
  const salio = cuadrarRenglones(caso.leidos, caso.desglose)
  const montos = salio.renglones.map((r) => r.monto)

  const problemas = []
  if (JSON.stringify(montos) !== JSON.stringify(caso.montos)) {
    problemas.push(`montos: se esperaba [${caso.montos}] y salió [${montos}]`)
  }
  if (salio.cuadra !== caso.cuadra) {
    problemas.push(`cuadra: se esperaba ${caso.cuadra} y salió ${salio.cuadra}`)
  }
  if (salio.diferencia !== caso.diferencia) {
    problemas.push(`diferencia: se esperaba ${caso.diferencia} y salió ${salio.diferencia}`)
  }
  // Qué se concluyó del descuento impreso: null cuando el comprobante no traía.
  const incluido = caso.descuento_incluido ?? null
  if (salio.descuento_incluido !== incluido) {
    problemas.push(
      `descuento_incluido: se esperaba ${incluido} y salió ${salio.descuento_incluido}`,
    )
  }
  // Cuando la cuenta cierra, la suma tiene que dar el total exacto: es la razón
  // de ser de todo esto.
  const suma = Math.round(montos.reduce((s, m) => s + m, 0) * 100) / 100
  if (salio.cuadra && caso.desglose.total !== null && suma !== caso.desglose.total) {
    problemas.push(`la suma dio ${suma} y el comprobante dice ${caso.desglose.total}`)
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
