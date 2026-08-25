/**
 * Genera los PNG de arranque de iPhone y iPad para la pantalla de entrada.
 *
 *   npm run splash
 *
 * Escribe public/splash-ios/*.png y lib/splash-ios.ts, la lista que app/layout.tsx
 * le pasa a `appleWebApp.startupImage` para que Next emita los <link>.
 *
 * Por qué hacen falta: iOS no lee el `background_color` del manifest. Sin estos
 * PNG, la app instalada arranca con un rectángulo blanco del sistema —o negro,
 * según la versión— y luego aparece nuestra pantalla; se ve como un parpadeo.
 * Con ellos, los tres fondos empalman: el del manifest (que usa Android), estos
 * PNG (que usa iOS) y el overlay de components/splash.tsx.
 *
 * iOS es literal con las medidas: si el PNG no mide EXACTAMENTE lo que mide la
 * pantalla del modelo, lo descarta sin avisar. De ahí que vaya uno por modelo y
 * orientación.
 *
 * El dibujo es el mismo imagotipo del manual, colocado con las mismas
 * proporciones que el CSS (--hp-alto, el hueco y el ancho del nombre): así el
 * logo del PNG queda donde va a aparecer el del overlay y el relevo no se nota.
 *
 * Rasteriza con sharp, que ya viene instalado con Next. Es un script de mano
 * —no corre en el build—, así que no añade nada a lo que Vercel compila.
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = path.join(RAIZ, 'public/splash-ios')
const LISTA = path.join(RAIZ, 'lib/splash-ios.ts')
const sharp = createRequire(path.join(RAIZ, 'package.json'))('sharp')

/** Los mismos tres valores del bloque .hp-splash de app/globals.css. */
const FONDO = '#ffffff'
const TINTA = '#12341c'

/** Los trazos del manual, leídos de lib/imagotipo.ts para no duplicarlos. */
const fuente = readFileSync(path.join(RAIZ, 'lib/imagotipo.ts'), 'utf8')
const pieza = (nombre) => {
  const caja = fuente.match(
    new RegExp(`export const ${nombre}_CAJA = \\{ ancho: ([\\d.]+), alto: ([\\d.]+) \\}`),
  )
  const trazo = fuente.match(new RegExp(`export const ${nombre}_TRAZO =\\s*\\n\\s*'([^']+)'`))
  if (!caja || !trazo) throw new Error(`no encuentro ${nombre} en lib/imagotipo.ts`)
  return { ancho: +caja[1], alto: +caja[2], d: trazo[1] }
}
const SIMBOLO = pieza('LOGO')
const NOMBRE = pieza('WORDMARK')

/*
 * Modelos vigentes. `p` es el ancho y el alto en puntos CSS (los que ve la media
 * query) y `r` la densidad; el PNG se escribe a puntos × densidad.
 */
const MODELOS = [
  { nombre: 'iphone-16-pro-max', p: [440, 956], r: 3 },
  { nombre: 'iphone-16-plus', p: [430, 932], r: 3 },
  { nombre: 'iphone-16-pro', p: [402, 874], r: 3 },
  { nombre: 'iphone-16', p: [393, 852], r: 3 },
  { nombre: 'iphone-14-plus', p: [428, 926], r: 3 },
  { nombre: 'iphone-14', p: [390, 844], r: 3 },
  { nombre: 'iphone-13-mini', p: [375, 812], r: 3 },
  { nombre: 'iphone-11-pro-max', p: [414, 896], r: 3 },
  { nombre: 'iphone-11', p: [414, 896], r: 2 },
  { nombre: 'iphone-8-plus', p: [414, 736], r: 3 },
  { nombre: 'iphone-se', p: [375, 667], r: 2 },
  { nombre: 'ipad-pro-13', p: [1024, 1366], r: 2 },
  { nombre: 'ipad-pro-11', p: [834, 1194], r: 2 },
  { nombre: 'ipad-10', p: [810, 1080], r: 2 },
  { nombre: 'ipad-mini', p: [744, 1133], r: 2 },
  { nombre: 'ipad-97', p: [768, 1024], r: 2 },
]

/** El mismo `clamp(72px, 21vmin, 108px)` que usa el CSS. */
const altoSimbolo = (an, al) => Math.min(108, Math.max(72, 0.21 * Math.min(an, al)))

function lamina(anchoPt, altoPt) {
  const h = altoSimbolo(anchoPt, altoPt)
  const anchoSim = (h * SIMBOLO.ancho) / SIMBOLO.alto
  const anchoNom = h * 2.08
  const altoNom = (anchoNom * NOMBRE.alto) / NOMBRE.ancho
  const hueco = h * 0.29
  const cx = anchoPt / 2
  const y0 = (altoPt - (h + hueco + altoNom)) / 2

  const esc = (caja, ancho) => ancho / caja.ancho
  const eSim = esc(SIMBOLO, anchoSim)
  const eNom = esc(NOMBRE, anchoNom)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${anchoPt}" height="${altoPt}" viewBox="0 0 ${anchoPt} ${altoPt}">
  <rect width="${anchoPt}" height="${altoPt}" fill="${FONDO}"/>
  <g fill="${TINTA}">
    <g transform="translate(${cx - anchoSim / 2} ${y0}) scale(${eSim})"><path d="${SIMBOLO.d}"/></g>
    <g transform="translate(${cx - anchoNom / 2} ${y0 + h + hueco}) scale(${eNom})"><path d="${NOMBRE.d}"/></g>
  </g>
</svg>`
}

rmSync(DESTINO, { recursive: true, force: true })
mkdirSync(DESTINO, { recursive: true })

const enlaces = []
let total = 0

for (const m of MODELOS) {
  const [an, al] = m.p
  for (const [giro, w, h] of [
    ['portrait', an, al],
    ['landscape', al, an],
  ]) {
    const archivo = `${m.nombre}-${giro}.png`
    const png = await sharp(Buffer.from(lamina(w, h)), { density: 72 * m.r })
      .resize(w * m.r, h * m.r)
      .png({ palette: true })
      .toBuffer()
    writeFileSync(path.join(DESTINO, archivo), png)
    total += png.length
    enlaces.push(
      `  {\n` +
        `    url: '/splash-ios/${archivo}',\n` +
        `    media:\n` +
        `      '(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${m.r}) and (orientation: ${giro})',\n` +
        `  },`,
    )
  }
}

writeFileSync(
  LISTA,
  `/**\n` +
    ` * Las láminas de arranque de iOS, una por modelo y orientación.\n` +
    ` *\n` +
    ` * GENERADO POR \`npm run splash\` — no lo edites a mano.\n` +
    ` *\n` +
    ` * app/layout.tsx se lo pasa a \`appleWebApp.startupImage\` y Next emite un\n` +
    ` * <link rel="apple-touch-startup-image"> por entrada. iOS elige el que case\n` +
    ` * con la pantalla exacta del aparato; si ninguno casa, no pinta ninguno.\n` +
    ` */\n` +
    `export const LAMINAS_IOS = [\n${enlaces.join('\n')}\n] as const\n`,
)
console.log(`${MODELOS.length * 2} láminas en public/splash-ios/ · ${(total / 1024).toFixed(0)} KB en total`)
console.log('Lista para app/layout.tsx escrita en lib/splash-ios.ts')
