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
// El imagotipo ORIGINAL del manual: un solo path relleno (mismo trazo que
// LOGO_TRAZO en lib/marca.ts — si cambia allá, cambia acá).
// ---------------------------------------------------------------------------
const LOGO_TRAZO =
  'M 98.53 77.63 C 66.48 78.33 44.19 86.86 37.24 89.89 L 37.24 80.13 C 56.5 70.52 78.61 67.79 98.53 66.38 Z ' +
  'M 98.53 94.54 C 66.2 95.27 43.84 103.98 37.24 106.91 L 37.24 95.47 L 37.3 95.61 C 37.55 95.49 61.63 83.7 98.53 82.87 Z ' +
  'M 98.53 155.68 C 94.76 156.63 90.96 157.64 87.24 158.71 C 87.16 158.73 87.07 158.76 87.03 158.78 C 70.39 163.53 53.66 169.6 37.24 176.83 L 37.24 112.66 C 37.48 112.53 61.76 100.66 98.53 99.76 Z ' +
  'M 135.82 148.57 L 135.82 29.89 L 130.6 28.74 L 130.6 149.29 C 127.01 149.82 123.4 150.41 119.78 151.08 L 119.78 26.36 L 114.55 25.2 L 114.55 152.08 C 110.96 152.79 107.36 153.57 103.75 154.42 L 103.75 22.82 L 98.53 21.68 L 98.53 61.14 C 78.78 62.54 56.85 65.15 37.24 74.32 L 37.24 8.2 L 32 7.05 L 32 179.17 C 31.6 179.38 31.2 179.56 30.79 179.74 C 27.64 181.19 24.45 182.71 21.26 184.28 L 21.26 4.67 L 16.04 3.52 L 16.04 186.91 C 12.47 188.73 8.84 190.63 5.23 192.61 L 5.23 1.14 L 0 0 L 0 201.48 L 3.82 199.34 C 9.12 196.38 14.5 193.52 19.75 190.88 C 24.17 188.65 28.61 186.49 32.98 184.48 C 33.61 184.2 34.23 183.91 34.84 183.63 L 35.69 183.25 C 53.08 175.38 70.85 168.83 88.51 163.78 C 88.52 163.78 88.52 163.78 88.54 163.77 C 88.55 163.77 88.59 163.77 88.61 163.75 C 92.95 162.52 97.37 161.34 101.75 160.25 C 107.24 158.93 112.79 157.71 118.26 156.66 C 124.18 155.54 130.12 154.57 135.92 153.82 C 152.41 151.7 162.13 151.98 162.23 151.98 L 164.84 152.06 L 165.01 146.84 L 162.4 146.76 C 162 146.74 152.43 146.46 135.82 148.57 Z'

// El dibujo ocupa 165.01×201.48; su centro es el punto de anclaje.
const CENTRO = { x: 82.5, y: 100.74 }
const ALTO_ARTE = 201.48

/**
 * Compone el icono cuadrado.
 * `ocupacion` es la altura del imagotipo respecto al lienzo: 0.62 llena el
 * cuadro, 0.5 respeta la zona segura que Android recorta en los maskable.
 */
function svgIcono({ lado, ocupacion = 0.62, radio = 0 }) {
  const escala = (lado * ocupacion) / ALTO_ARTE
  const x = lado / 2 - CENTRO.x * escala
  const y = lado / 2 - CENTRO.y * escala

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lado} ${lado}" width="${lado}" height="${lado}">
  <rect width="${lado}" height="${lado}"${radio ? ` rx="${radio}"` : ''} fill="${FONDO}"/>
  <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${escala.toFixed(4)})">
    <path fill="${TRAZO}" d="${LOGO_TRAZO}"/>
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
  svgIcono({ lado: 128, ocupacion: 0.66, radio: 26 }),
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
