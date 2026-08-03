/**
 * Importa el histórico 2026 del Excel del cliente («Cotizaciones pinturas 26»,
 * OTs 303–474) como cotizaciones + obras, para que el dashboard y los reportes
 * por mes traigan todo el año.
 *
 *   node --env-file=.env.local scripts/importar-excel-2026.mjs --archivo "ruta.xlsx"
 *   node --env-file=.env.local scripts/importar-excel-2026.mjs --archivo "ruta.xlsx" --ejecutar
 *
 * Opciones:
 *   --archivo <ruta>   el .xlsx que mande el cliente (obligatorio)
 *   --hoja <nombre|n>  hoja a leer (por defecto la primera)
 *   --desde-ot 303     ignora renglones con OT menor
 *   --hasta-ot 474     ignora renglones con OT mayor
 *   --ejecutar         SIN esta bandera solo reporta qué haría (dry-run)
 *
 * Cuando llegue el archivo real sólo hay que ajustar el MAPEO de columnas de
 * aquí abajo (letra de columna por campo) y correr primero el dry-run.
 */
import { existsSync } from 'node:fs'
import ExcelJS from 'exceljs'
import pg from 'pg'

// ---------------------------------------------------------------------------
// MAPEO DE COLUMNAS · ajustar con el archivo real a la vista
// ---------------------------------------------------------------------------
const MAPEO = {
  filaInicial: 2,      // 1 = encabezados
  columnas: {
    ot: 'A',           // "303", "F-475", "OT 26000303"…
    fecha: 'B',        // fecha de la cotización / apertura
    cliente: 'C',
    obra: 'D',         // nombre o descripción de la obra
    domicilio: 'E',
    total: 'F',        // importe total (con IVA, ver abajo)
    cobrado: 'G',      // opcional: cuánto se le cobró (deja '' si no viene)
    estatus: 'H',      // opcional: texto libre ("terminada", "cancelada"…)
  },
  totalIncluyeIva: true,  // si el importe del Excel ya trae IVA
  ivaPct: 16,
}

// Cómo se traduce el estatus libre del Excel al de la app.
const ESTATUS = (texto) => {
  const t = String(texto ?? '').toLowerCase()
  if (t.includes('cancel') || t.includes('rechaz')) return 'rechazada'
  if (t.includes('proceso') || t.includes('curso')) return 'aprobada'
  return 'terminada' // histórico: lo normal es que ya se haya entregado
}

// ---------------------------------------------------------------------------
const arg = (nombre) => {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const archivo = arg('archivo')
const hoja = arg('hoja')
const desdeOt = Number(arg('desde-ot') ?? 0)
const hastaOt = Number(arg('hasta-ot') ?? Infinity)
const ejecutar = process.argv.includes('--ejecutar')

if (!archivo) {
  console.error('✗ Falta --archivo <ruta.xlsx>. Corre con --help en mente: ver cabecera del script.')
  process.exit(1)
}
if (!existsSync(archivo)) {
  console.error(`✗ No existe el archivo: ${archivo}`)
  process.exit(1)
}

const cadena = process.env.SUPABASE_DB_URL
if (!cadena) {
  console.error('✗ Falta SUPABASE_DB_URL en .env.local (corre con node --env-file=.env.local).')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Leer el Excel
// ---------------------------------------------------------------------------
const libro = new ExcelJS.Workbook()
await libro.xlsx.readFile(archivo)
const pagina = hoja
  ? (libro.getWorksheet(Number.isNaN(Number(hoja)) ? hoja : Number(hoja)))
  : libro.worksheets[0]
if (!pagina) {
  console.error(`✗ No se encontró la hoja «${hoja}». Hojas: ${libro.worksheets.map((w) => w.name).join(', ')}`)
  process.exit(1)
}
console.log(`· Leyendo «${pagina.name}» de ${archivo}`)

const celda = (fila, col) => {
  const v = pagina.getCell(`${col}${fila}`).value
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object' && 'result' in v) return v.result ?? ''
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((r) => r.text).join('')
  return v
}

const aNumero = (v) => {
  const n = Number(String(v).replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const aFecha = (v) => {
  const t = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/) // dd/mm/aaaa
  if (m) {
    const anio = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}
const numeroOt = (v) => {
  const m = String(v).match(/(\d{3,})/)
  return m ? Number(m[1]) : null
}

const renglones = []
for (let fila = MAPEO.filaInicial; fila <= pagina.rowCount; fila++) {
  const c = MAPEO.columnas
  const ot = numeroOt(celda(fila, c.ot))
  const cliente = String(celda(fila, c.cliente)).trim()
  if (!ot && !cliente) continue // renglón vacío

  renglones.push({
    fila,
    ot,
    fecha: aFecha(celda(fila, c.fecha)),
    cliente,
    obra: String(celda(fila, c.obra)).trim(),
    domicilio: String(celda(fila, c.domicilio)).trim() || null,
    total: aNumero(celda(fila, c.total)),
    cobrado: c.cobrado ? aNumero(celda(fila, c.cobrado)) : 0,
    estatus: ESTATUS(celda(fila, c.estatus)),
  })
}

const validos = []
const avisos = []
for (const r of renglones) {
  if (!r.ot) { avisos.push(`Fila ${r.fila}: sin número de OT, se salta («${r.cliente}»)`); continue }
  if (r.ot < desdeOt || r.ot > hastaOt) continue
  if (!r.cliente) { avisos.push(`Fila ${r.fila}: OT ${r.ot} sin cliente, se salta`); continue }
  if (r.total <= 0) avisos.push(`Fila ${r.fila}: OT ${r.ot} con total en cero`)
  if (!r.fecha) avisos.push(`Fila ${r.fila}: OT ${r.ot} sin fecha legible, se usará 2026-01-01`)
  validos.push(r)
}

console.log(`· ${renglones.length} renglones leídos, ${validos.length} dentro del rango ${desdeOt}–${hastaOt === Infinity ? 'fin' : hastaOt}`)
for (const a of avisos) console.log(`  ⚠ ${a}`)

// ---------------------------------------------------------------------------
// Contra la base: duplicados y clientes
// ---------------------------------------------------------------------------
const bd = new pg.Client({ connectionString: cadena, ssl: { rejectUnauthorized: false } })
await bd.connect()

try {
  const { rows: existentes } = await bd.query(`select ot_numero from obras`)
  const otsExistentes = new Set(existentes.map((o) => numeroOt(o.ot_numero)).filter(Boolean))

  const { rows: clientesBd } = await bd.query(`select id, nombre from clientes`)
  const clientePorNombre = new Map(clientesBd.map((c) => [c.nombre.trim().toLowerCase(), c.id]))

  const nuevos = validos.filter((r) => !otsExistentes.has(r.ot))
  const duplicados = validos.length - nuevos.length
  const clientesNuevos = [...new Set(
    nuevos.map((r) => r.cliente).filter((n) => !clientePorNombre.has(n.trim().toLowerCase())),
  )]

  console.log(`· ${duplicados} OTs ya estaban en la base (se saltan)`)
  console.log(`· ${nuevos.length} OTs por importar · ${clientesNuevos.length} clientes nuevos`)
  const total = nuevos.reduce((s, r) => s + r.total, 0)
  console.log(`· Importe total a cargar: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`)

  if (!ejecutar) {
    console.log('\n— DRY RUN — nada se escribió. Muestra de lo que entraría:')
    for (const r of nuevos.slice(0, 10)) {
      console.log(`  OT ${r.ot} · ${r.fecha ?? '2026-01-01'} · ${r.cliente} · ${r.obra || '(sin nombre)'} · $${r.total} · ${r.estatus}`)
    }
    if (nuevos.length > 10) console.log(`  … y ${nuevos.length - 10} más`)
    console.log('\nCuando cuadre todo, repite con --ejecutar')
    process.exit(0)
  }

  // -------------------------------------------------------------------------
  // Carga real, todo o nada
  // -------------------------------------------------------------------------
  await bd.query('begin')

  let importadas = 0
  for (const r of nuevos) {
    const fecha = r.fecha ?? '2026-01-01'
    const clave = r.cliente.trim().toLowerCase()

    let clienteId = clientePorNombre.get(clave)
    if (!clienteId) {
      const { rows: [cli] } = await bd.query(
        `insert into clientes (nombre, notas) values ($1, 'Importado del Excel 2026') returning id`,
        [r.cliente.trim()],
      )
      clienteId = cli.id
      clientePorNombre.set(clave, clienteId)
    }

    const subtotal = MAPEO.totalIncluyeIva
      ? Math.round((r.total / (1 + MAPEO.ivaPct / 100)) * 100) / 100
      : r.total

    const { rows: [cot] } = await bd.query(
      `insert into cotizaciones (cliente_id, nombre_obra, domicilio_obra, estatus, subtotal, iva_pct, fecha, notas)
       values ($1, $2, $3, $4, $5, $6, $7, 'Importada del Excel 2026')
       returning id`,
      [clienteId, r.obra || `OT ${r.ot}`, r.domicilio, r.estatus, subtotal, MAPEO.ivaPct, fecha],
    )

    // Una partida resumen para que el subtotal del trigger cuadre.
    await bd.query(
      `insert into cotizacion_items (cotizacion_id, descripcion, precio_unitario, importe, orden)
       values ($1, $2, $3, $3, 0)`,
      [cot.id, r.obra || 'Trabajos de pintura (histórico)', subtotal],
    )

    if (r.estatus !== 'rechazada') {
      await bd.query(
        `insert into obras (ot_numero, cotizacion_id, nombre, domicilio, estatus, monto_cotizado, avance_pct, fecha_apertura, fecha_cierre, notas)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Importada del Excel 2026')`,
        [
          `26${String(r.ot).padStart(6, '0')}`,
          cot.id,
          r.obra || `OT ${r.ot}`,
          r.domicilio,
          r.estatus === 'terminada' ? 'cerrada' : 'en_obra',
          r.total,
          r.estatus === 'terminada' ? 100 : 0,
          fecha,
          r.estatus === 'terminada' ? fecha : null,
        ],
      )
    }

    if (r.cobrado > 0) {
      await bd.query(
        `insert into pagos_cobranza (cotizacion_id, tipo, monto, metodo, fecha, notas)
         values ($1, $2, $3, 'transferencia', $4, 'Importado del Excel 2026 (fecha aproximada)')`,
        [cot.id, r.cobrado >= r.total ? 'liquidacion' : 'abono', r.cobrado, fecha],
      )
    }

    importadas++
  }

  await bd.query('commit')
  console.log(`\n✓ ${importadas} OTs importadas.`)
} catch (e) {
  await bd.query('rollback').catch(() => {})
  console.error(`✗ Nada se guardó (rollback): ${e.message}`)
  process.exitCode = 1
} finally {
  await bd.end()
}
