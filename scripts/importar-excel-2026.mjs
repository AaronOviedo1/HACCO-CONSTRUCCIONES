/**
 * Importa el histórico 2026 de «1. COTIZACIONES PINTURAS 2026.xlsx»:
 * el libro trae UNA HOJA POR COTIZACIÓN (formato carta) con el número de OT
 * en el nombre de la hoja. Se importan las OTs 303–474 SOLO COMO HISTORIAL:
 * cotización 'enviada' con su folio original (F-303…) y partidas reales, sin
 * obra ni pagos (decisión del 3/ago: el cruce contra nóminas, cobranza y OTs
 * mostró que las ganadas ya viven en la base; el resto no tiene rastro de
 * dinero y no debe inflar ingresos).
 *
 *   node --env-file=.env.local scripts/importar-excel-2026.mjs             (dry-run)
 *   node --env-file=.env.local scripts/importar-excel-2026.mjs --ejecutar
 *
 * Opciones: --archivo <ruta> · --desde-ot 303 · --hasta-ot 474 · --ejecutar
 *
 * Reglas:
 *  · Folios que ya existen en la base se saltan (son las obras operativas).
 *  · Hojas duplicadas del mismo folio: gana la primera visible sin «copia»;
 *    si el cliente es OTRO (folio reutilizado), entra con sufijo B.
 *  · Clientes se casan por nombre sin acentos; si no existe, se crea.
 *  · Todo lo escrito lleva la nota «Importado del Excel 2026».
 */
import { existsSync } from 'node:fs'
import ExcelJS from 'exceljs'
import pg from 'pg'

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const ARCHIVO = arg('archivo') ?? '1. COTIZACIONES PINTURAS 2026.xlsx'
const DESDE = Number(arg('desde-ot') ?? 303)
const HASTA = Number(arg('hasta-ot') ?? 474)
const EJECUTAR = process.argv.includes('--ejecutar')
const NOTA = 'Importado del Excel 2026'

if (!existsSync(ARCHIVO)) {
  console.error(`✗ No existe el archivo: ${ARCHIVO}`)
  process.exit(1)
}
const cadena = process.env.SUPABASE_DB_URL
if (!cadena) {
  console.error('✗ Falta SUPABASE_DB_URL (corre con node --env-file=.env.local).')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Utilería de celdas
// ---------------------------------------------------------------------------
const valor = (c) => {
  let x = c?.value
  if (x == null) return null
  if (typeof x === 'object' && 'result' in x) x = x.result
  if (typeof x === 'object' && x?.richText) x = x.richText.map((r) => r.text).join('')
  if (x instanceof Date) return x
  if (typeof x === 'string') {
    x = x.trim()
    return x || null
  }
  return x
}

const sinAcentos = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

/** «Hermosillo, Sonora a 25 de julio de 2026» → '2026-07-25' */
function fechaDeTexto(t) {
  const m = String(t).match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+(?:del?\s+)?(\d{4})/i)
  if (!m) return null
  const mes = MESES[sinAcentos(m[2])]
  if (!mes) return null
  return `${m[3]}-${String(mes).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Parser de una hoja-cotización
// ---------------------------------------------------------------------------
function parsearHoja(h) {
  let fecha = null
  let cliente = null
  let folioTexto = null
  let encabezado = null // { fila, colNum, colDesc, colM2, colPU, colImp }

  const filas = Math.min(h.rowCount, 400)
  for (let f = 1; f <= filas && !encabezado; f++) {
    const fila = h.getRow(f)
    const celdas = []
    fila.eachCell({ includeEmpty: false }, (c, col) => celdas.push({ col, v: valor(c) }))
    for (const { v } of celdas) {
      if (v == null) continue
      const s = String(v)
      if (!fecha) {
        if (v instanceof Date) fecha = v.toISOString().slice(0, 10)
        else if (/hermosillo/i.test(s)) fecha = fechaDeTexto(s)
      }
      if (!folioTexto) {
        const m = s.match(/COTIZACI[ÓO]N\s+F?\s*-?\s*(\d+)/i)
        if (m) folioTexto = Number(m[1])
      }
      if (!cliente && /^(atn\.?|estimad[oa]s?)\s+/i.test(s)) {
        cliente = s.replace(/^(atn\.?|estimad[oa]s?)\s+/i, '').replace(/[.\s]+$/, '').trim()
      }
    }

    // ¿Es esta fila el encabezado de la tabla de partidas? Formatos vistos:
    // «# Descripción M2 P.U. Importe», «Descripción PZA. P.U. Subtotal»,
    // «CONCEPTO … # M2 P.U. Importe», «# ALBAÑILERÍAS # M2 P.U. Importe»,
    // e incluso sin columna de importe — luego se calcula m2 × p.u.
    const cols = {}
    const libres = []
    let marcadores = 0
    for (const { col: c2, v: v2 } of celdas) {
      if (typeof v2 !== 'string') continue
      const t = v2.trim()
      if (t === '#') { cols.num = cols.num ?? c2; marcadores++ }
      else if (/^(descripci[óo]n|concepto)$/i.test(t)) { cols.desc = cols.desc ?? c2; marcadores++ }
      else if (/^#?\s*m2$/i.test(t) || /^(cantidad|pza\.?s?)$/i.test(t)) { cols.m2 = cols.m2 ?? c2; marcadores++ }
      else if (/^p\.?\s?u\.?$/i.test(t)) { cols.pu = cols.pu ?? c2; marcadores++ }
      else if (/^(importe|subtotal|total)\b/i.test(t) && t.length < 30) { cols.imp = cols.imp ?? c2; cols.impUlt = c2; marcadores++ }
      else if (t.length < 60) libres.push(c2)
    }
    if (marcadores >= 2 && (cols.imp || cols.pu)) {
      // sin encabezado «Descripción»: la columna de texto libre hace de tal
      if (!cols.desc && libres.length) cols.desc = libres[0]
      if (!cols.desc && cols.num) cols.desc = cols.num + 1
      if (cols.desc) encabezado = { fila: f, ...cols }
    }
  }

  if (!encabezado) return { error: 'sin tabla de partidas', fecha, cliente }

  // Partidas: filas siguientes. Aguanta cotizaciones por secciones (varios
  // encabezados CONCEPTO/… con renglones «Subtotal sección» intermedios).
  const partidas = []
  const duplicadas = []
  let subtotal = null
  const colTope = Math.min(
    ...[encabezado.m2, encabezado.pu, encabezado.imp].filter(Boolean),
  )
  let vacias = 0
  for (let f = encabezado.fila + 1; f <= filas; f++) {
    const fila = h.getRow(f)
    // descripción = todo el texto antes de las columnas numéricas
    const trozos = []
    fila.eachCell({ includeEmpty: false }, (c, col) => {
      if (col >= colTope || col === encabezado.num) return
      const v = valor(c)
      if (typeof v === 'string' && v && !trozos.includes(v)) trozos.push(v)
    })
    const descTxt = trozos.join(' — ')
    let impCrudo = encabezado.imp ? valor(fila.getCell(encabezado.imp)) : null
    // encabezado «Importe» combinado en varias columnas: el valor puede vivir
    // en cualquiera de ellas (visto en las hojas de herrería: C:E)
    if (impCrudo == null && encabezado.impUlt > encabezado.imp) {
      for (let c = encabezado.impUlt; c > encabezado.imp && impCrudo == null; c--) {
        impCrudo = valor(fila.getCell(c))
      }
    }
    const m2 = encabezado.m2 ? numOnull(valor(fila.getCell(encabezado.m2))) : null
    const pu = encabezado.pu ? numOnull(valor(fila.getCell(encabezado.pu))) : null

    if (!descTxt && impCrudo == null) {
      if (partidas.length > 0 && ++vacias >= 8) break
      continue
    }
    vacias = 0

    // ¿otro encabezado de sección? (las columnas numéricas traen texto tipo
    // «P.U.» / «Importe» / «M2») — se ignora y se sigue con la sección nueva
    const pareceEncabezado =
      typeof impCrudo === 'string' && /^(importe|subtotal|total|p\.?\s?u\.?|#?\s*m2)/i.test(impCrudo)
    if (pareceEncabezado || (/^(descripci[óo]n|concepto)\b/i.test(descTxt) && typeof impCrudo !== 'number')) continue
    // firma o letras chicas: se acabó la tabla
    if (/^(\*|lic\.|sin m[aá]s|c\.\s*66?2)/i.test(descTxt)) {
      if (partidas.length > 0) break
      continue
    }
    // renglón de subtotal/total/IVA (de sección o general): no es partida
    if (/(sub)?total|^iva\b/i.test(descTxt) && typeof impCrudo === 'number') continue

    if (descTxt) {
      // sin columna de importe, se calcula con lo que hay: m2 × p.u.
      let importe =
        typeof impCrudo === 'number' ? impCrudo : Math.round((m2 ?? 1) * (pu ?? 0) * 100) / 100

      // Renglón de continuación: repite el «#» de la partida anterior con el
      // mismo importe (celdas combinadas verticales) — es más descripción de
      // la misma partida, no otra partida.
      const numVal = encabezado.num ? numOnull(valor(fila.getCell(encabezado.num))) : null
      const previa = partidas[partidas.length - 1]
      const combinada = m2 != null && m2 === pu && (typeof impCrudo !== 'number' || impCrudo === m2)
      // fila idéntica a la anterior (combinación vertical): es la misma partida
      if (previa && descTxt === previa.descCruda && importe === previa.importe) {
        duplicadas.push(importe)
        continue
      }
      if (
        previa &&
        ((numVal != null && numVal === previa.num && (importe === previa.importe || importe === 0)) ||
          (combinada && previa.combinada && previa.importe === importe))
      ) {
        previa.descripcion = `${previa.descripcion} — ${descTxt}`.slice(0, 300)
        continue
      }

      if (/descuento/i.test(descTxt) && importe > 0) importe = -importe

      // La base deriva importe = m2 × p.u. (trigger de cotizacion_items); si
      // el importe del Excel no cuadra con ese producto (capturas con el monto
      // repetido en M2/P.U., o sin P.U.), se guarda como 1 × importe.
      const producto = Math.round((m2 ?? 1) * (pu ?? 0) * 100) / 100
      const cuadra = Math.abs(producto - importe) <= Math.max(0.02, Math.abs(importe) * 0.002)
      partidas.push({
        descripcion: descTxt.slice(0, 300),
        descCruda: descTxt,
        m2: cuadra ? m2 : null,
        pu: cuadra ? (pu ?? 0) : importe,
        importe,
        num: numVal,
        combinada,
      })
    } else if (typeof impCrudo === 'number' && partidas.length > 0 && subtotal == null) {
      subtotal = impCrudo // subtotal clásico: importe sin descripción. No se
      // corta aquí: puede venir un descuento en los renglones siguientes.
    }
  }

  if (partidas.length === 0) return { error: 'sin partidas', fecha, cliente }
  const suma = partidas.reduce((s, p) => s + p.importe, 0)
  if (subtotal == null || Math.abs(subtotal - suma) > Math.max(1, suma * 0.5)) subtotal = suma

  return { fecha, cliente, folioTexto, partidas, duplicadas, subtotal: Math.round(subtotal * 100) / 100 }
}

const numOnull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// ---------------------------------------------------------------------------
// Recorrer el libro
// ---------------------------------------------------------------------------
console.log(`· Leyendo ${ARCHIVO} …`)
const libro = new ExcelJS.Workbook()
await libro.xlsx.readFile(ARCHIVO)

const candidatas = []
const saltadas = []
for (const h of libro.worksheets) {
  const nombre = h.name.trim()
  if (/^(hoja\s*\d*|.*membretada.*|copia\s+segura.*)$/i.test(nombre)) {
    saltadas.push(`«${nombre}» (plantilla/copia)`)
    continue
  }
  const m = nombre.match(/^C?\s*(\d{3})/)
  if (!m) {
    saltadas.push(`«${nombre}» (sin número de OT)`)
    continue
  }
  const ot = Number(m[1])
  if (ot < DESDE || ot > HASTA) continue // fuera de rango, silencioso
  candidatas.push({ hoja: h, nombre, ot, oculta: h.state !== 'visible' })
}

// Dedupe por OT: gana la primera visible sin «(2)»; cliente distinto = folio B.
candidatas.sort((a, b) => a.ot - b.ot || Number(a.oculta) - Number(b.oculta) || Number(/\(\d\)/.test(a.nombre)) - Number(/\(\d\)/.test(b.nombre)))

const porFolio = new Map()
const filasImportar = []
const avisos = []

for (const c of candidatas) {
  const datos = parsearHoja(c.hoja)
  if (datos.error) {
    avisos.push(`OT ${c.ot} «${c.nombre}»: ${datos.error}, se salta`)
    continue
  }
  if (!datos.cliente) {
    // último recurso: el nombre de la hoja sin el número
    datos.cliente = c.nombre.replace(/^C?\s*\d{3}\s*/, '').replace(/\(\d\)\s*$/, '').trim() || 'Cliente sin nombre'
    avisos.push(`OT ${c.ot}: sin «Atn.», cliente tomado del nombre de la hoja («${datos.cliente}»)`)
  }
  if (datos.folioTexto && datos.folioTexto !== c.ot) {
    avisos.push(`OT ${c.ot} «${c.nombre}»: la hoja dice F-${datos.folioTexto}; manda el nombre de la hoja`)
  }
  if (datos.duplicadas.length) {
    const quitado = datos.duplicadas.reduce((s, x) => s + x, 0)
    avisos.push(`OT ${c.ot}: ${datos.duplicadas.length} fila(s) idéntica(s) consecutiva(s) ignoradas ($${quitado.toLocaleString('es-MX')})`)
  }

  const previa = porFolio.get(c.ot)
  if (previa) {
    if (sinAcentos(previa.cliente) === sinAcentos(datos.cliente)) {
      saltadas.push(`«${c.nombre}» (duplicado de F-${c.ot})`)
      continue
    }
    // Folio reutilizado con otro cliente: entra como F-###B
    let sufijo = 'B'
    while (porFolio.has(`${c.ot}${sufijo}`)) sufijo = String.fromCharCode(sufijo.charCodeAt(0) + 1)
    porFolio.set(`${c.ot}${sufijo}`, datos)
    filasImportar.push({ ...datos, ot: c.ot, folio: `F-${c.ot}${sufijo}`, nombre: c.nombre })
    avisos.push(`OT ${c.ot} reutilizada con otro cliente («${datos.cliente}») → F-${c.ot}${sufijo}`)
    continue
  }
  porFolio.set(c.ot, datos)
  filasImportar.push({ ...datos, ot: c.ot, folio: `F-${c.ot}`, nombre: c.nombre })
}

// Nombre de la obra: lo que queda del nombre de hoja tras número y cliente.
for (const f of filasImportar) {
  const resto = f.nombre
    .replace(/^C?\s*\d{3}\s*(?:[AB]\b\s*)?/i, '')
    .replace(/\(\d\)\s*$/, '')
    .trim()
  f.tipo = /\bHERR/i.test(f.nombre) ? 'herreria' : 'pintura'
  f.obra = resto && sinAcentos(resto) !== sinAcentos(f.cliente)
    ? resto.slice(0, 80)
    : (f.partidas[0]?.descripcion.slice(0, 80) || 'Trabajos de pintura')
}

// DEBUG_HOJA=313 → volcar el parseo de esa OT y salir sin tocar la base
if (process.env.DEBUG_HOJA) {
  for (const f of filasImportar.filter((x) => String(x.ot) === process.env.DEBUG_HOJA)) {
    console.log(JSON.stringify(f, null, 1))
  }
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Contra la base
// ---------------------------------------------------------------------------
// Supabase exige TLS; el Postgres que levanta `supabase start` en la máquina no
// lo ofrece siquiera, así que pedirlo ahí tumba la conexión.
const esLocal = /(^|@|\/\/)(localhost|127\.0\.0\.1)/.test(cadena)
const sslDeLaCadena = esLocal ? false : { rejectUnauthorized: false }
const bd = new pg.Client({ connectionString: cadena, ssl: sslDeLaCadena })
await bd.connect()

try {
  const { rows: foliosBd } = await bd.query(`select folio from cotizaciones`)
  const existentes = new Set(foliosBd.map((r) => r.folio))
  const { rows: clientesBd } = await bd.query(`select id, nombre from clientes`)
  const clientePorNombre = new Map(clientesBd.map((c) => [sinAcentos(c.nombre), c.id]))

  const nuevas = filasImportar.filter((f) => !existentes.has(f.folio))
  const yaEstaban = filasImportar.length - nuevas.length
  const clientesNuevos = [...new Set(
    nuevas.filter((f) => !clientePorNombre.has(sinAcentos(f.cliente))).map((f) => f.cliente),
  )]

  // Resumen por mes (con IVA, que es como queda el total en la app)
  const porMes = new Map()
  for (const f of nuevas) {
    const mes = (f.fecha ?? 'sin-fecha').slice(0, 7)
    const t = porMes.get(mes) ?? { n: 0, total: 0 }
    t.n++
    t.total += f.subtotal * 1.16
    porMes.set(mes, t)
  }

  console.log(`\n════ RESUMEN ════`)
  console.log(`Hojas con OT ${DESDE}–${HASTA}: ${candidatas.length}`)
  console.log(`Cotizaciones a importar: ${nuevas.length} · ya estaban en la base: ${yaEstaban}`)
  console.log(`Clientes nuevos: ${clientesNuevos.length}`)
  const granTotal = nuevas.reduce((s, f) => s + f.subtotal * 1.16, 0)
  console.log(`Importe total cotizado (con IVA, solo informativo — no entra como ingreso): $${granTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`)
  console.log(`\nPor mes:`)
  for (const [mes, t] of [...porMes.entries()].sort()) {
    console.log(`  ${mes}: ${String(t.n).padStart(3)} cotizaciones · $${t.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`)
  }
  if (avisos.length) {
    console.log(`\nAvisos (${avisos.length}):`)
    for (const a of avisos) console.log(`  ⚠ ${a}`)
  }
  if (saltadas.length) {
    console.log(`\nHojas saltadas (${saltadas.length}):`)
    for (const s of saltadas) console.log(`  · ${s}`)
  }

  if (!EJECUTAR) {
    console.log(`\nTop 10 por importe (para olfatear parseos malos):`)
    for (const f of [...nuevas].sort((a, b) => b.subtotal - a.subtotal).slice(0, 10)) {
      console.log(`  ${f.folio} · ${f.fecha ?? '¿?'} · ${f.cliente} · ${f.partidas.length} partidas · $${(f.subtotal * 1.16).toLocaleString('es-MX')} · «${f.nombre}»`)
    }
    console.log(`\nMuestra de lo que entraría:`)
    for (const f of nuevas.slice(0, 8)) {
      console.log(`  ${f.folio} · ${f.fecha ?? '¿fecha?'} · ${f.cliente} · ${f.obra} · ${f.partidas.length} partidas · $${(f.subtotal * 1.16).toFixed(2)}`)
    }
    if (nuevas.length > 8) console.log(`  … y ${nuevas.length - 8} más`)
    console.log(`\n— DRY RUN — nada se escribió. Cuando cuadre, repite con --ejecutar\n`)
    process.exit(0)
  }

  // -------------------------------------------------------------------------
  // Carga real: todo o nada
  // -------------------------------------------------------------------------
  await bd.query('begin')
  let hechas = 0
  for (const f of nuevas) {
    const fecha = f.fecha ?? '2026-01-01'
    const clave = sinAcentos(f.cliente)

    let clienteId = clientePorNombre.get(clave)
    if (!clienteId) {
      const { rows: [cli] } = await bd.query(
        `insert into clientes (nombre, titulo_cortesia, notas) values ($1, null, $2) returning id`,
        [f.cliente, NOTA],
      )
      clienteId = cli.id
      clientePorNombre.set(clave, clienteId)
    }

    // El IVA lo decide el cliente, no el importador. Las hojas del Excel no
    // dicen quién facturó, y meterle 16% a todo el mundo era pedir en cobranza
    // un impuesto que a la mayoría nunca se le cobró.
    const { rows: [cot] } = await bd.query(
      `insert into cotizaciones (folio, cliente_id, nombre_obra, tipo, estatus,
                                 requiere_factura, iva_pct, fecha, notas)
       select $1, c.id, $3, $4, 'enviada',
              c.requiere_factura, case when c.requiere_factura then 16 else 0 end, $5, $6
         from clientes c where c.id = $2
       returning id`,
      [f.folio, clienteId, f.obra, f.tipo, fecha, NOTA],
    )

    for (const [i, p] of f.partidas.entries()) {
      await bd.query(
        `insert into cotizacion_items (cotizacion_id, descripcion, m2, precio_unitario, importe, orden)
         values ($1, $2, $3, $4, $5, $6)`,
        [cot.id, p.descripcion, p.m2, p.pu, p.importe, i],
      )
    }
    hechas++
  }

  await bd.query('commit')
  console.log(`\n✓ ${hechas} cotizaciones importadas como historial ('enviada'), sin obras ni pagos.\n`)
} catch (e) {
  await bd.query('rollback').catch(() => {})
  console.error(`✗ Nada se guardó (rollback): ${e.message}`)
  process.exitCode = 1
} finally {
  await bd.end()
}
