/**
 * Convierte las capturas de una entrega en los WebP que enseña el aviso de
 * novedades, y deja impreso el pedazo de TypeScript listo para pegar en
 * lib/novedades.ts.
 *
 *   npm run novedades:imagenes -- 2026-08-12 [carpeta-origen]
 *
 * Lee los PNG de la carpeta origen (si no se da, docs/novedades/<version>/,
 * que vive fuera de git como todo /docs/) y escribe en
 * public/novedades/<version>/, que sí se versiona y se despliega.
 *
 * El nombre de cada PNG ya debe ser el definitivo: <tema>-movil.png o
 * <tema>-escritorio.png. La variante decide a cuánto se encoge:
 * escritorio a 1600 de ancho, móvil a 1080 —de sobra para la lupa—.
 *
 * La marca (el anillo que señala el cambio) no la calcula este script: se
 * mide a mano SOBRE EL WEBP FINAL, no sobre el PNG. Abre el WebP en Vista
 * Previa o en el inspector del navegador, apunta el píxel del cambio y
 * conviértelo a porcentaje: x = px ÷ ancho × 100, y = px ÷ alto × 100, con
 * un decimal basta. Ese par va en `marca` del snippet impreso.
 *
 * No pide red ni dependencias nuevas: sharp ya viene con el proyecto.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const CALIDAD = 82
const ANCHO_MAXIMO = { escritorio: 1600, movil: 1080 }

const version = process.argv[2]
if (!version || !/^\d{4}-\d{2}-\d{2}/.test(version)) {
  console.error('✗ Falta la versión de la entrega. Uso: npm run novedades:imagenes -- 2026-08-12 [origen]')
  process.exit(1)
}

const origen = path.resolve(RAIZ, process.argv[3] ?? path.join('docs/novedades', version))
if (!existsSync(origen)) {
  console.error(`✗ No existe la carpeta de origen: ${origen}`)
  process.exit(1)
}

const pngs = readdirSync(origen).filter((a) => a.toLowerCase().endsWith('.png')).sort()
if (pngs.length === 0) {
  console.error(`✗ No hay ningún PNG en ${origen}`)
  process.exit(1)
}

const destino = path.join(RAIZ, 'public/novedades', version)
mkdirSync(destino, { recursive: true })

console.log(`\nCapturas de la entrega ${version}\n`)

/** { tema: { movil?: {…}, escritorio?: {…} } } para armar el snippet junto. */
const figuras = new Map()

for (const png of pngs) {
  const nombre = png.replace(/\.png$/i, '')
  const variante = nombre.endsWith('-movil') ? 'movil'
    : nombre.endsWith('-escritorio') ? 'escritorio'
    : null
  if (!variante) {
    console.warn(`  · ${png} se salta: el nombre debe terminar en -movil o -escritorio`)
    continue
  }

  const webp = await sharp(path.join(origen, png))
    .resize({ width: ANCHO_MAXIMO[variante], withoutEnlargement: true })
    .webp({ quality: CALIDAD })
    .toBuffer()
  await sharp(webp).toFile(path.join(destino, `${nombre}.webp`))

  const { width, height } = await sharp(webp).metadata()
  const tema = nombre.slice(0, -(variante.length + 1))
  if (!figuras.has(tema)) figuras.set(tema, {})
  figuras.get(tema)[variante] = {
    ruta: `/novedades/${version}/${nombre}.webp`,
    ancho: width,
    alto: height,
  }
  console.log(`  ✓ public/novedades/${version}/${nombre}.webp (${width}×${height}, ${Math.round(webp.length / 1024)} KB)`)
}

if (figuras.size === 0) {
  console.error('\n✗ Ninguna captura tenía nombre válido; no hay nada que pegar.')
  process.exit(1)
}

console.log('\nPara pegar en lib/novedades.ts (falta el pie, y medir cada marca sobre el WebP):\n')
for (const [tema, capturas] of figuras) {
  console.log(`    // ${tema}`)
  console.log('    figura: {')
  console.log("      pie: '…',")
  for (const variante of ['movil', 'escritorio']) {
    const c = capturas[variante]
    if (!c) continue
    console.log(
      `      ${variante}: { ruta: '${c.ruta}', ancho: ${c.ancho}, alto: ${c.alto}, marca: { x: 0, y: 0 } },`,
    )
  }
  console.log('    },\n')
}
