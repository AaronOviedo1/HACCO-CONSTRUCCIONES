/**
 * Toma las capturas de una entrega de novedades: acercadas al cambio y con el
 * recuadro ya medido, para que nadie tenga que medir píxeles a mano.
 *
 *   npm run novedades:capturar -- 2026-11-13 [--solo tema] [--base http://localhost:3002]
 *
 * Lee el guion de scripts/novedades/<version>.mjs: una lista de escenas, cada
 * una con su tema, la pantalla a la que se va, lo que se toca antes y el
 * selector del cambio. Por cada escena y tamaño deja en docs/novedades/<version>/
 * el PNG <tema>-<variante>.png y, al lado, <tema>-<variante>.json con el
 * recuadro en porcentaje del recorte. Después, `npm run novedades:imagenes`
 * los pasa a WebP e imprime el TypeScript con el recuadro ya puesto.
 *
 * Corre contra el dev local con datos clonados, nunca contra producción: con
 * DEV_AUTOLOGIN la sesión se abre sola, y si no, entra con DEV_AUTOLOGIN y
 * DEV_AUTOLOGIN_PASSWORD (o luis@haacopro.mx / hacco123).
 *
 * El navegador es el Chrome del Mac (`channel: 'chrome'`): no se descarga nada.
 *
 * Una escena:
 *   {
 *     tema: 'cos-pdf',
 *     variantes: ['escritorio', 'movil'],     // por omisión, las dos
 *     ruta: '/admin/cotizaciones/nueva',      // o async ({ sql, variante }) => '/…'
 *     antes: async (page, { variante }) => {}, // clics, campos… opcional
 *     selector: 'button:has-text("¿Viene de COS?")',
 *     foco: 'text=¿Viene de COS?',            // dónde centrar, si el cambio es muy ancho
 *     contexto: 120,                          // px de aire alrededor, opcional
 *     proporcion: { movil: 4 / 3 },           // ancho ÷ alto por tamaño, si sobra blanco
 *   }
 * El recuadro enmarca `selector`; el recorte se centra en `foco` (o en el
 * mismo selector). Un recuadro más grande que el recorte se corta en la orilla.
 * `sql(consulta, valores)` consulta la base local directo —devuelve los
 * renglones— para buscar el registro que sirve de ejemplo (una cotización
 * congelada, un cliente con varias obras…). Sólo lee: el guion no escribe.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import pg from 'pg'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const VISTAS = {
  movil: { viewport: { width: 390, height: 845 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  escritorio: { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 },
}

/** Ancho entre alto del recorte: lo que mejor llena la hoja en cada tamaño. */
const PROPORCION = { movil: 4 / 5, escritorio: 16 / 10 }
/**
 * El recorte de escritorio, entre estos dos: menos, y se pierde dónde está;
 * más, y en la hoja de novedades —670 px— las letras ya no se leen.
 */
const ANCHO_MINIMO_ESCRITORIO = 720
const ANCHO_MAXIMO_ESCRITORIO = 960
/** Lo que el recuadro sobresale del elemento, para no pisarle el borde. */
const HOLGURA = 6

// -- Argumentos -------------------------------------------------------------

const args = process.argv.slice(2)
const version = args.find((a) => !a.startsWith('--') && /^\d{4}-\d{2}-\d{2}/.test(a))
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`)
  return i >= 0 ? args[i + 1] : undefined
}
const base = opcion('base') ?? 'http://localhost:3002'
const solo = opcion('solo')

if (!version) {
  console.error('✗ Falta la versión. Uso: npm run novedades:capturar -- 2026-11-13 [--solo tema]')
  process.exit(1)
}
if (!/^http:\/\/localhost(:\d+)?$/.test(base)) {
  // 127.0.0.1 pinta pero no hidrata (Next bloquea sus recursos de dev por
  // origen cruzado), y cualquier otra cosa sería producción.
  console.error(`✗ Sólo contra http://localhost: ${base}`)
  process.exit(1)
}

const archivoGuion = path.join(RAIZ, 'scripts/novedades', `${version}.mjs`)
if (!existsSync(archivoGuion)) {
  console.error(`✗ No hay guion para ${version}: ${path.relative(RAIZ, archivoGuion)}`)
  process.exit(1)
}
const { default: escenas } = await import(pathToFileURL(archivoGuion).href)

// -- Entorno ----------------------------------------------------------------

const leerEnv = (archivo) =>
  Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split('\n')
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]),
  )
const env = leerEnv(path.join(RAIZ, '.env.local'))
const urlBd = env.SUPABASE_DB_URL ?? ''
if (!/^postgres(ql)?:\/\/[^@]+@(127\.0\.0\.1|localhost):/.test(urlBd)) {
  console.error('✗ SUPABASE_DB_URL de .env.local no es la base local; no se capturan datos de producción.')
  process.exit(1)
}
const cliente = new pg.Client({ connectionString: urlBd })
await cliente.connect()
// Por si a alguien se le ocurre escribir desde un guion.
await cliente.query('set default_transaction_read_only = on')
const sql = async (consulta, valores = []) => (await cliente.query(consulta, valores)).rows

/** La versión vigente del aviso, para que no salga encima de la captura. */
const versionAviso = readFileSync(path.join(RAIZ, 'lib/novedades.ts'), 'utf8').match(
  /const ENTREGAS[^=]*=\s*\[\s*\{\s*version:\s*'([^']+)'/,
)?.[1]

const destino = path.join(RAIZ, 'docs/novedades', version)
mkdirSync(destino, { recursive: true })

// -- Captura ----------------------------------------------------------------

const navegador = await chromium.launch({ channel: 'chrome' })

async function entrar(page) {
  if (!new URL(page.url()).pathname.startsWith('/login')) return
  await page.fill('input[name="correo"]', env.DEV_AUTOLOGIN ?? 'luis@haacopro.mx')
  await page.fill('input[name="contrasena"]', env.DEV_AUTOLOGIN_PASSWORD ?? 'hacco123')
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 }),
    page.click('button[type="submit"]'),
  ])
}

/**
 * El recorte: con la proporción de su tamaño, centrado en el cambio y sin
 * salirse de la pantalla. Si el cambio no cabe con su aire, el recorte crece.
 */
function recortar(caja, variante, contexto, izquierda = 0, proporcion = PROPORCION[variante]) {
  const { height: vh } = VISTAS[variante].viewport
  // En escritorio la barra lateral no es parte del cambio: el recorte empieza
  // donde ella termina.
  const vw = VISTAS[variante].viewport.width - izquierda
  const r = proporcion
  let w =
    variante === 'movil'
      ? vw
      : Math.min(ANCHO_MAXIMO_ESCRITORIO, Math.max(ANCHO_MINIMO_ESCRITORIO, caja.width + 2 * contexto))
  let h = w / r
  if (caja.height + 2 * contexto > h) {
    h = Math.min(vh, caja.height + 2 * contexto)
    w = variante === 'movil' ? vw : Math.min(ANCHO_MAXIMO_ESCRITORIO, h * r)
  }
  const x = izquierda + Math.max(0, Math.min(vw - w, caja.x - izquierda + caja.width / 2 - w / 2))
  const y = Math.max(0, Math.min(vh - h, caja.y + caja.height / 2 - h / 2))
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) }
}

const pct = (n) => Math.round(Math.max(0, Math.min(100, n)) * 10) / 10

let fallas = 0
console.log(`\nCapturas de la entrega ${version} contra ${base}\n`)

for (const escena of escenas) {
  if (solo && escena.tema !== solo) continue
  for (const variante of escena.variantes ?? ['escritorio', 'movil']) {
    const nombre = `${escena.tema}-${variante}`
    const ctx = await navegador.newContext({ ...VISTAS[variante], reducedMotion: 'reduce', locale: 'es-MX' })
    if (versionAviso) {
      await ctx.addInitScript(
        (v) => localStorage.setItem('haaco:novedades-vistas', v),
        versionAviso,
      )
    }
    const page = await ctx.newPage()
    try {
      const ruta =
        typeof escena.ruta === 'function' ? await escena.ruta({ sql, variante }) : escena.ruta
      await page.goto(base + ruta, { waitUntil: 'networkidle' })
      await entrar(page)
      if (new URL(page.url()).pathname !== new URL(base + ruta).pathname) {
        await page.goto(base + ruta, { waitUntil: 'networkidle' })
      }
      // La insignia de Next, el «+» flotante y la barra de pestañas del
      // teléfono no son el cambio: en un recorte sólo estorban.
      await page.addStyleTag({
        content: [
          'nextjs-portal{display:none!important}',
          '.fixed.right-4.z-50{display:none!important}',
          '.fixed.inset-x-0.bottom-0.z-40{display:none!important}',
        ].join(''),
      })
      if (escena.antes) await escena.antes(page, { variante, sql })

      const el = page.locator(escena.selector).filter({ visible: true }).first()
      await el.waitFor({ state: 'visible', timeout: 15_000 })
      await el.evaluate((n) => n.scrollIntoView({ block: 'center', inline: 'center' }))
      await page.waitForTimeout(400)
      const b = await el.boundingBox()
      if (!b) throw new Error(`el selector no tiene caja: ${escena.selector}`)
      const caja = { x: b.x - HOLGURA, y: b.y - HOLGURA, width: b.width + 2 * HOLGURA, height: b.height + 2 * HOLGURA }

      let centro = caja
      if (escena.foco) {
        const f = await page.locator(escena.foco).filter({ visible: true }).first().boundingBox()
        if (!f) throw new Error(`el foco no tiene caja: ${escena.foco}`)
        centro = f
      }
      const barra = await page.locator('aside.bg-haaco-900').filter({ visible: true }).first().boundingBox().catch(() => null)
      const clip = recortar(
        centro,
        variante,
        escena.contexto ?? (variante === 'movil' ? 60 : 120),
        barra ? Math.round(barra.x + barra.width) : 0,
        escena.proporcion?.[variante],
      )
      await page.screenshot({ path: path.join(destino, `${nombre}.png`), clip })

      // Lo que del recuadro cae dentro del recorte: si se sale, se corta.
      const x0 = Math.max(caja.x, clip.x)
      const y0 = Math.max(caja.y, clip.y)
      const x1 = Math.min(caja.x + caja.width, clip.x + clip.width)
      const y1 = Math.min(caja.y + caja.height, clip.y + clip.height)
      const recuadro = {
        x: pct(((x0 - clip.x) / clip.width) * 100),
        y: pct(((y0 - clip.y) / clip.height) * 100),
        ancho: pct(((x1 - x0) / clip.width) * 100),
        alto: pct(((y1 - y0) / clip.height) * 100),
      }
      writeFileSync(path.join(destino, `${nombre}.json`), JSON.stringify({ recuadro }, null, 2) + '\n')
      console.log(`  ✓ ${nombre}  recorte ${clip.width}×${clip.height}  recuadro ${JSON.stringify(recuadro)}`)
    } catch (e) {
      fallas++
      await page.screenshot({ path: path.join(destino, `${nombre}.fallo.png`) }).catch(() => {})
      console.error(`  ✗ ${nombre}: ${e instanceof Error ? e.message.split('\n')[0] : e}`)
      console.error(`    (quedó ${nombre}.fallo.png con lo que se veía)`)
    } finally {
      await ctx.close()
    }
  }
}

await navegador.close()
await cliente.end()

if (fallas) {
  console.error(`\n✗ ${fallas} captura(s) no salieron.`)
  process.exit(1)
}
console.log(`\nSiguiente: npm run novedades:imagenes -- ${version}  (y ver cada imagen antes de subirla)\n`)
