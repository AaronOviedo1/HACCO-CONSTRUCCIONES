/**
 * Saca el imagotipo de HAACO PRO RECUBRIMIENTOS del manual de marca.
 *
 *   npm run imagotipo
 *
 * Lee «MANUAL DE APLICACIÓN DE LOGOTIPO.pdf» y escribe lib/imagotipo.ts con el
 * símbolo, el wordmark y los dos juntos, como trazos SVG.
 *
 * Por qué esto en vez de tipografía: el nombre va en Akira Expanded Super Bold y
 * el giro en Circular Std Medium, las dos comerciales y las dos ausentes del
 * repo. Pero el imagotipo de la contraportada del manual no es texto, es dibujo:
 * veinticuatro rellenos vectoriales del mismo color. Copiándolos tal cual nos
 * quedamos con la tipografía exacta del manual sin depender de ninguna fuente.
 *
 * Ojo con el relleno: la caja del chip «PRO» lleva las letras caladas dentro del
 * mismo trazado y los contrapunzones de la P, la R y la O se repintan encima
 * como trazados aparte. Sale bien con la regla `nonzero`, la de por defecto;
 * con `evenodd` esos contrapunzones se cancelan y las letras salen agujereadas.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MANUAL = path.join(RAIZ, 'MANUAL DE APLICACIÓN DE LOGOTIPO.pdf')
const DESTINO = path.join(RAIZ, 'lib/imagotipo.ts')

/** El símbolo se escala hasta este alto: es el que ya usaba lib/marca.ts. */
const ALTO = 201.48
/** Hueco mínimo, en unidades del PDF, para separar el símbolo del texto. */
const SEPARACION = 15

// ---------------------------------------------------------------------------
// El PDF por dentro
// ---------------------------------------------------------------------------
const binario = readFileSync(MANUAL)
const texto = binario.toString('latin1')

/** Índice de los «N 0 obj» del archivo. */
const objetos = new Map()
for (const coincidencia of texto.matchAll(/(\d+)\s+0\s+obj\b/g)) {
  objetos.set(+coincidencia[1], coincidencia.index + coincidencia[0].length)
}

function cuerpoDe(numero) {
  const inicio = objetos.get(numero)
  if (inicio == null) throw new Error(`No existe el objeto ${numero}.`)
  return texto.slice(inicio, texto.indexOf('endobj', inicio))
}

/** Descomprime el stream de un objeto. El /Length puede ser una referencia. */
function streamDe(numero) {
  const inicio = objetos.get(numero)
  const cuerpo = cuerpoDe(numero)
  let arranque = inicio + cuerpo.indexOf('stream') + 'stream'.length
  if (texto[arranque] === '\r') arranque++
  if (texto[arranque] === '\n') arranque++

  const directo = cuerpo.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)
  const indirecto = cuerpo.match(/\/Length\s+(\d+)\s+0\s+R/)
  const largo = directo ? +directo[1] : parseInt(cuerpoDe(+indirecto[1]).trim())

  const crudo = binario.subarray(arranque, arranque + largo)
  return /\/FlateDecode/.test(cuerpo) ? inflateSync(crudo).toString('latin1') : crudo.toString('latin1')
}

/**
 * La contraportada: el imagotipo completo, grande y sin nada alrededor.
 *
 * Hay que seguir el orden de /Kids, no el número de objeto: la portada es el
 * objeto 70 y va primera, así que ordenar por número daría la página equivocada.
 */
function contraportada() {
  const catalogo = cuerpoDe(+texto.match(/\/Root\s+(\d+)\s+0\s+R/)[1])
  const arbol = cuerpoDe(+catalogo.match(/\/Pages\s+(\d+)\s+0\s+R/)[1])
  const kids = [...arbol.match(/\/Kids\s*\[([^\]]*)\]/)[1].matchAll(/(\d+)\s+0\s+R/g)].map((k) => +k[1])

  const ultima = cuerpoDe(kids[kids.length - 1])
  const contenidos = [...ultima.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/)[1].matchAll(/(\d+)\s+0\s+R/g)]
  return contenidos.map((c) => streamDe(+c[1])).join('\n')
}

// ---------------------------------------------------------------------------
// Los operadores de dibujo
// ---------------------------------------------------------------------------

/**
 * Recorre el flujo de contenido y devuelve los subtrazados que se rellenan,
 * en el orden en que se pintan y con la matriz de transformación ya aplicada.
 * Las curvas se conservan como Bézier: aplanarlas a segmentos rectos redondearía
 * las letras y estropearía la marca en tamaños grandes.
 */
function subtrazados(flujo) {
  const piezas = []
  let matriz = [1, 0, 0, 1, 0, 0]
  const pila = []
  let trazado = []
  let actual = null
  let recorte = false
  const numeros = []

  // El PDF trabaja en el espacio del dispositivo; aplicamos la matriz al vuelo.
  const punto = (x, y) => [
    matriz[0] * x + matriz[2] * y + matriz[4],
    matriz[1] * x + matriz[3] * y + matriz[5],
  ]
  const cerrarSubtrazado = () => {
    if (actual && actual.length > 1) trazado.push(actual)
    actual = null
  }

  for (const ficha of flujo.replace(/[\r\n]/g, ' ').split(/\s+/)) {
    if (/^[-+]?[\d.]+$/.test(ficha)) {
      numeros.push(parseFloat(ficha))
      continue
    }
    const n = numeros.splice(0)
    const ultimo = () => actual[actual.length - 1].fin

    switch (ficha) {
      case 'q':
        pila.push(matriz.slice())
        break
      case 'Q':
        matriz = pila.pop() ?? [1, 0, 0, 1, 0, 0]
        break
      case 'cm': {
        const [a, b, c, d, e, f] = n.slice(-6)
        const m = matriz
        matriz = [
          m[0] * a + m[2] * b, m[1] * a + m[3] * b,
          m[0] * c + m[2] * d, m[1] * c + m[3] * d,
          m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5],
        ]
        break
      }
      case 'm':
        cerrarSubtrazado()
        actual = [{ tipo: 'M', fin: punto(n[0], n[1]) }]
        break
      case 'l':
        if (actual) actual.push({ tipo: 'L', fin: punto(n[0], n[1]) })
        break
      case 'c':
        if (actual) {
          actual.push({
            tipo: 'C',
            c1: punto(n[0], n[1]),
            c2: punto(n[2], n[3]),
            fin: punto(n[4], n[5]),
          })
        }
        break
      case 'v':
        // El primer punto de control es el punto actual.
        if (actual) {
          actual.push({
            tipo: 'C',
            c1: ultimo(),
            c2: punto(n[0], n[1]),
            fin: punto(n[2], n[3]),
          })
        }
        break
      case 'y':
        // El segundo punto de control coincide con el final.
        if (actual) {
          const fin = punto(n[2], n[3])
          actual.push({ tipo: 'C', c1: punto(n[0], n[1]), c2: fin, fin })
        }
        break
      case 'h':
        if (actual) actual.push({ tipo: 'Z', fin: actual[0].fin })
        break
      case 're': {
        cerrarSubtrazado()
        const [x, y, ancho, alto] = n.slice(-4)
        actual = [
          { tipo: 'M', fin: punto(x, y) },
          { tipo: 'L', fin: punto(x + ancho, y) },
          { tipo: 'L', fin: punto(x + ancho, y + alto) },
          { tipo: 'L', fin: punto(x, y + alto) },
          { tipo: 'Z', fin: punto(x, y) },
        ]
        cerrarSubtrazado()
        break
      }
      case 'W':
      case 'W*':
        recorte = true
        break
      case 'f': case 'F': case 'f*':
      case 'B': case 'B*': case 'b': case 'b*':
        cerrarSubtrazado()
        // Los trazados de recorte delimitan, no dibujan.
        if (!recorte) piezas.push(...trazado)
        trazado = []
        recorte = false
        break
      case 'S': case 's': case 'n':
        cerrarSubtrazado()
        trazado = []
        recorte = false
        break
    }
  }
  return piezas
}

// ---------------------------------------------------------------------------
// Medir y componer
// ---------------------------------------------------------------------------

/** Extremos de una cúbica en un eje, resolviendo la derivada igual a cero. */
function extremosCubica(p0, p1, p2, p3) {
  const valores = [p0, p3]
  const a = -p0 + 3 * p1 - 3 * p2 + p3
  const b = 2 * (p0 - 2 * p1 + p2)
  const c = p1 - p0

  const anotar = (t) => {
    if (t <= 0 || t >= 1) return
    const u = 1 - t
    valores.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3)
  }

  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9) anotar(-c / b)
  } else {
    const disc = b * b - 4 * a * c
    if (disc >= 0) {
      const raiz = Math.sqrt(disc)
      anotar((-b + raiz) / (2 * a))
      anotar((-b - raiz) / (2 * a))
    }
  }
  return valores
}

/** Caja real de un conjunto de subtrazados: cuenta la curva, no sus tiradores. */
function caja(piezas) {
  const c = [Infinity, Infinity, -Infinity, -Infinity]
  const anotar = (x, y) => {
    if (x < c[0]) c[0] = x
    if (y < c[1]) c[1] = y
    if (x > c[2]) c[2] = x
    if (y > c[3]) c[3] = y
  }
  for (const pieza of piezas) {
    let previo = pieza[0].fin
    for (const paso of pieza) {
      if (paso.tipo === 'C') {
        for (const x of extremosCubica(previo[0], paso.c1[0], paso.c2[0], paso.fin[0])) anotar(x, previo[1])
        for (const y of extremosCubica(previo[1], paso.c1[1], paso.c2[1], paso.fin[1])) anotar(previo[0], y)
      }
      anotar(paso.fin[0], paso.fin[1])
      previo = paso.fin
    }
  }
  return c
}

/**
 * Escribe los subtrazados como atributo `d`, con el origen arriba a la
 * izquierda: el PDF cuenta la Y hacia arriba y el SVG hacia abajo.
 */
function dibujar(piezas, origen, escala) {
  const [minX, , , maxY] = origen
  const n = (v) => (Math.round(v * 100) / 100).toString()
  const x = (v) => n((v - minX) * escala)
  const y = (v) => n((maxY - v) * escala)

  return piezas
    .map((pieza) =>
      pieza
        .map((paso) => {
          if (paso.tipo === 'M') return `M ${x(paso.fin[0])} ${y(paso.fin[1])}`
          if (paso.tipo === 'L') return `L ${x(paso.fin[0])} ${y(paso.fin[1])}`
          if (paso.tipo === 'Z') return 'Z'
          return `C ${x(paso.c1[0])} ${y(paso.c1[1])} ${x(paso.c2[0])} ${y(paso.c2[1])} ${x(paso.fin[0])} ${y(paso.fin[1])}`
        })
        .join(' '),
    )
    .join(' ')
}

// ---------------------------------------------------------------------------
// Manos a la obra
// ---------------------------------------------------------------------------
const todos = subtrazados(contraportada())

// Fuera el rectángulo del fondo de la página.
const piezas = todos.filter((pieza) => {
  const [x1, y1, x2, y2] = caja([pieza])
  return x2 - x1 < 700 && y2 - y1 < 500
})

// El símbolo y el texto se separan por el único hueco horizontal grande que hay
// en el imagotipo; entre las letras de RECUBRIMIENTOS el hueco nunca llega a 15.
const ordenadas = piezas.map((pieza) => ({ pieza, c: caja([pieza]) })).sort((a, b) => a.c[0] - b.c[0])
const bloques = []
for (const { pieza, c } of ordenadas) {
  const bloque = bloques.find((b) => c[0] <= b.derecha + SEPARACION)
  if (bloque) {
    bloque.piezas.push(pieza)
    bloque.derecha = Math.max(bloque.derecha, c[2])
  } else {
    bloques.push({ piezas: [pieza], derecha: c[2] })
  }
}

if (bloques.length !== 2) {
  console.error(`✗ Esperaba dos bloques (símbolo y texto) y encontré ${bloques.length}.`)
  process.exit(1)
}

const simbolo = bloques[0].piezas
const wordmark = bloques[1].piezas

const cajaSimbolo = caja(simbolo)
const cajaWordmark = caja(wordmark)
const cajaTodo = caja(piezas)
const escala = ALTO / (cajaSimbolo[3] - cajaSimbolo[1])

const medida = (c) => ({
  ancho: Math.round((c[2] - c[0]) * escala * 100) / 100,
  alto: Math.round((c[3] - c[1]) * escala * 100) / 100,
})

const cajas = {
  LOGO_CAJA: medida(cajaSimbolo),
  WORDMARK_CAJA: medida(cajaWordmark),
  IMAGOTIPO_CAJA: medida(cajaTodo),
}

console.log('\nImagotipo de HaacoPro\n')
console.log(`  ${simbolo.length} subtrazados en el símbolo, ${wordmark.length} en el texto`)
for (const [nombre, m] of Object.entries(cajas)) {
  console.log(`  ${nombre.padEnd(15)} ${m.ancho} × ${m.alto}`)
}

// Prueba del intérprete: el símbolo tiene que salir igual que el que ya usábamos.
const REFERENCIA = { ancho: 165.01, alto: 201.48 }
const desvio = Math.max(
  Math.abs(cajas.LOGO_CAJA.ancho - REFERENCIA.ancho),
  Math.abs(cajas.LOGO_CAJA.alto - REFERENCIA.alto),
)
if (desvio > 0.5) {
  console.error(
    `\n✗ El símbolo salió ${cajas.LOGO_CAJA.ancho}×${cajas.LOGO_CAJA.alto} y esperaba ` +
      `${REFERENCIA.ancho}×${REFERENCIA.alto}. Si no cuadra el símbolo, el texto tampoco es de fiar.`,
  )
  process.exit(1)
}
console.log(`\n  ✓ El símbolo coincide con el de siempre (desvío ${desvio.toFixed(2)})`)

const archivo = `/**
 * El imagotipo de HAACO PRO RECUBRIMIENTOS, tal cual viene en el manual.
 *
 * GENERADO POR \`npm run imagotipo\` — no lo edites a mano.
 *
 * Son los trazos vectoriales de la contraportada del manual, así que el nombre
 * lleva su Akira Expanded Super Bold y el giro su Circular Std Medium sin que
 * haga falta ninguna fuente instalada. Se rellenan con la regla \`nonzero\` (la
 * de por defecto): con \`evenodd\` las letras del chip «PRO» salen agujereadas.
 *
 * Cada trazo trae su propia caja y arranca en el origen, así que el viewBox va
 * siempre \`0 0 ancho alto\`.
 */

/** Sólo el símbolo, para iconos y marca de agua. */
export const LOGO_CAJA = { ancho: ${cajas.LOGO_CAJA.ancho}, alto: ${cajas.LOGO_CAJA.alto} } as const

export const LOGO_TRAZO =
  '${dibujar(simbolo, cajaSimbolo, escala)}'

/** Sólo el texto: HAACO, el chip PRO y RECUBRIMIENTOS. */
export const WORDMARK_CAJA = { ancho: ${cajas.WORDMARK_CAJA.ancho}, alto: ${cajas.WORDMARK_CAJA.alto} } as const

export const WORDMARK_TRAZO =
  '${dibujar(wordmark, cajaWordmark, escala)}'

/** Los dos juntos, con la separación del manual. Es el bloque de marca. */
export const IMAGOTIPO_CAJA = { ancho: ${cajas.IMAGOTIPO_CAJA.ancho}, alto: ${cajas.IMAGOTIPO_CAJA.alto} } as const

export const IMAGOTIPO_TRAZO =
  '${dibujar(piezas, cajaTodo, escala)}'
`

writeFileSync(DESTINO, archivo)
console.log(`  ✓ lib/imagotipo.ts (${(archivo.length / 1024).toFixed(1)} kB)\n`)
