/**
 * Genera los iconos de la app (favicon y PWA) a partir del imagotipo de
 * HAACO PRO RECUBRIMIENTOS, el mismo que dibuja components/marca.tsx.
 *
 *   npm run iconos
 *
 * Escribe:
 *   app/icon.svg                  favicon vectorial (versión simplificada)
 *   app/apple-icon.png    180×180 «Agregar a inicio» de iPhone y iPad
 *   public/icono-192.png  192×192 manifest, atajo de Android
 *   public/icono-512.png  512×512 manifest, splash y tiendas
 *   public/icono-maskable-512.png  con la zona segura de Android (arte al 50%)
 *
 * Rasteriza con el Chrome del sistema por el protocolo DevTools: así no hace
 * falta ninguna dependencia binaria para compilar la app.
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Verde de marca del icono (= haaco-900, el verde exacto del manual). */
const FONDO = '#12341c'
const TRAZO = '#ffffff'

// ---------------------------------------------------------------------------
// El imagotipo: astas rayadas, travesaños curvos y base en perspectiva.
// Coordenadas en el lienzo original de 96×116 de components/marca.tsx.
// ---------------------------------------------------------------------------
const LOGO = [
  'M13 12V110', 'M19.5 6V109.5', 'M26 4V108.5', 'M32.5 8V107',
  'M13 66C28 61 46 57 62 55', 'M13 77C28 72 46 68 62 66',
  'M62 4V98', 'M68.5 30V95', 'M75 36V92.5', 'M81.5 44V89.5',
  'M13 110C36 108 68 100 92 84',
]

/** A 32 px las ocho astas se emplastan: el favicon lleva la mitad. */
const LOGO_SIMPLE = [
  'M13 12V110', 'M26 4V108.5',
  'M13 66C28 61 46 57 62 55', 'M13 77C28 72 46 68 62 66',
  'M62 4V98', 'M75 36V92.5',
  'M13 110C36 108 68 100 92 84',
]

// El dibujo ocupa x∈[13,92], y∈[4,110]; su centro es el punto de anclaje.
const CENTRO = { x: 52.5, y: 57 }
const ALTO_ARTE = 106

/**
 * Compone el icono cuadrado.
 * `ocupacion` es la altura del imagotipo respecto al lienzo: 0.62 llena el
 * cuadro, 0.5 respeta la zona segura que Android recorta en los maskable.
 */
function svgIcono({ lado, ocupacion = 0.62, radio = 0, trazos = LOGO, grosor = 3.4 }) {
  const escala = (lado * ocupacion) / ALTO_ARTE
  const x = lado / 2 - CENTRO.x * escala
  const y = lado / 2 - CENTRO.y * escala

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}">
  <rect width="${lado}" height="${lado}"${radio ? ` rx="${radio}"` : ''} fill="${FONDO}"/>
  <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${escala.toFixed(4)})"
     fill="none" stroke="${TRAZO}" stroke-width="${grosor}" stroke-linecap="round">
${trazos.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
</svg>
`
}

// ---------------------------------------------------------------------------
// Rasterizado con Chrome
// ---------------------------------------------------------------------------
const CHROMES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const chrome = CHROMES.find((c) => existsSync(c))
if (!chrome) {
  console.error('✗ No se encontró Chrome. Define CHROME_PATH con la ruta al navegador.')
  process.exit(1)
}

const PUERTO = 9455
const perfil = path.join(tmpdir(), 'haaco-iconos')
rmSync(perfil, { recursive: true, force: true })

const navegador = execFile(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  'about:blank',
])

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function conectar() {
  for (let intento = 0; intento < 30; intento++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json()
      const pagina = lista.find((t) => t.type === 'page')
      if (pagina) return pagina.webSocketDebuggerUrl
    } catch {
      // el navegador todavía está arrancando
    }
    await esperar(300)
  }
  throw new Error('Chrome no respondió en el puerto de depuración.')
}

const ws = new WebSocket(await conectar())
await new Promise((r) => (ws.onopen = r))

let id = 0
const pendientes = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pendientes.has(msg.id)) {
    pendientes.get(msg.id)(msg.result)
    pendientes.delete(msg.id)
  }
}
const cmd = (method, params = {}) =>
  new Promise((res) => {
    const n = ++id
    pendientes.set(n, res)
    ws.send(JSON.stringify({ id: n, method, params }))
  })

await cmd('Page.enable')

async function png(svg, lado, destino) {
  const html = `data:text/html,${encodeURIComponent(
    `<!doctype html><style>html,body{margin:0;padding:0}svg{display:block}</style>${svg}`,
  )}`
  await cmd('Emulation.setDeviceMetricsOverride', {
    width: lado, height: lado, deviceScaleFactor: 1, mobile: false,
  })
  await cmd('Page.navigate', { url: html })
  await esperar(350)
  const foto = await cmd('Page.captureScreenshot', { format: 'png' })
  const ruta = path.join(RAIZ, destino)
  mkdirSync(path.dirname(ruta), { recursive: true })
  writeFileSync(ruta, Buffer.from(foto.data, 'base64'))
  console.log(`  ✓ ${destino} (${lado}×${lado})`)
}

console.log('\nIconos de HaacoPro\n')

// Favicon vectorial: se ve nítido en cualquier tamaño de pestaña.
writeFileSync(
  path.join(RAIZ, 'app/icon.svg'),
  svgIcono({ lado: 128, ocupacion: 0.66, radio: 26, trazos: LOGO_SIMPLE, grosor: 4.6 }),
)
console.log('  ✓ app/icon.svg (vectorial)')

// iOS recorta las esquinas por su cuenta: el arte llega hasta el borde.
await png(svgIcono({ lado: 180 }), 180, 'app/apple-icon.png')
await png(svgIcono({ lado: 192 }), 192, 'public/icono-192.png')
await png(svgIcono({ lado: 512 }), 512, 'public/icono-512.png')
// Android puede recortarlo en círculo, hoja o gota: el arte se encoge.
await png(svgIcono({ lado: 512, ocupacion: 0.5 }), 512, 'public/icono-maskable-512.png')

ws.close()
navegador.kill()
rmSync(perfil, { recursive: true, force: true })
console.log('\nListo.\n')
