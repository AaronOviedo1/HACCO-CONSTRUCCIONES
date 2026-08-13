import 'server-only'
import ExcelJS from 'exceljs'
import { EMPRESA } from '@/lib/empresa'
import { CATEGORIA_GASTO, METODO_PAGO } from '@/lib/finanzas'
import { ESTATUS_COTIZACION } from '@/lib/cotizaciones'
import { ESTATUS_OBRA } from '@/lib/obras'
import { parsearFecha } from '@/lib/format'
import type { ReporteMensual } from '@/lib/reportes'
import type { EstatusObra } from '@/types/database'

const VERDE = 'FF145836'
const VERDE_CLARO = 'FFEEF7F1'
const MONEDA = '"$"#,##0.00'
const PORCENTAJE = '0.0"%"'
const FECHA = 'dd/mmm/yyyy'

type Columna = {
  titulo: string
  ancho: number
  formato?: string
}

/** Encabezado de la hoja con el membrete y el mes del cierre. */
function titular(hoja: ExcelJS.Worksheet, titulo: string, subtitulo: string, columnas: number) {
  hoja.mergeCells(1, 1, 1, columnas)
  const t = hoja.getCell(1, 1)
  t.value = `${EMPRESA.nombre} · ${titulo}`
  t.font = { bold: true, size: 13, color: { argb: VERDE } }

  hoja.mergeCells(2, 1, 2, columnas)
  const s = hoja.getCell(2, 1)
  s.value = subtitulo
  s.font = { size: 10, color: { argb: 'FF6B776E' } }

  hoja.getRow(3).height = 6
}

function encabezados(hoja: ExcelJS.Worksheet, columnas: Columna[], fila: number) {
  const r = hoja.getRow(fila)
  columnas.forEach((c, i) => {
    const celda = r.getCell(i + 1)
    celda.value = c.titulo
    celda.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } }
    celda.alignment = { vertical: 'middle', horizontal: c.formato === MONEDA ? 'right' : 'left' }
    hoja.getColumn(i + 1).width = c.ancho
    if (c.formato) hoja.getColumn(i + 1).numFmt = c.formato
  })
  r.height = 20
}

function agregarFilas(
  hoja: ExcelJS.Worksheet,
  filas: (string | number | Date | null)[][],
  desde: number,
) {
  filas.forEach((valores, i) => {
    const r = hoja.getRow(desde + i)
    valores.forEach((v, j) => {
      r.getCell(j + 1).value = v
    })
    if (i % 2 === 1) {
      r.eachCell((celda) => {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFBFA' } }
      })
    }
  })
}

function totalizar(hoja: ExcelJS.Worksheet, fila: number, valores: (string | number | null)[]) {
  const r = hoja.getRow(fila)
  valores.forEach((v, j) => {
    const celda = r.getCell(j + 1)
    celda.value = v
    celda.font = { bold: true }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }
  })
}

const aFecha = (v: string | null | undefined) => parsearFecha(v) ?? null

// ===========================================================================
// HOJAS
// ===========================================================================
function hojaFinanciero(libro: ExcelJS.Workbook, r: ReporteMensual) {
  const hoja = libro.addWorksheet('Resumen financiero')
  const f = r.finanzas
  titular(hoja, 'Resumen financiero', `Cierre de ${r.etiqueta}`, 3)

  hoja.getColumn(1).width = 42
  hoja.getColumn(2).width = 18
  hoja.getColumn(2).numFmt = MONEDA
  hoja.getColumn(3).width = 14

  const renglones: [string, number | null, string | null][] = [
    ['Facturado (obra liquidada en el mes)', f.facturado, null],
    ['Cobrado en el mes (flujo de caja)', f.cobrado, null],
    ['', null, null],
    ['Material consumido', -f.costoObra.material, null],
    ['Mano de obra pagada', -f.costoObra.manoObra, null],
    ['Viáticos', -f.costoObra.viaticos, null],
    ['Gastos adicionales de obra', -f.costoObra.adicionales, null],
    ['Costo de obra', -f.costoObra.total, null],
    ['', null, null],
    ['UTILIDAD BRUTA', f.utilidadBruta, `${f.margenPct.toFixed(1)}%`],
    ['', null, null],
    ['Gastos generales', -f.totalGastosGenerales, null],
    ['Pagos fijos de quincena', -f.totalPagosFijos, null],
    ['Costos fijos', -f.costosFijos, null],
    ['', null, null],
    ['UTILIDAD A FECHA DE CORTE', f.utilidadCorte, null],
    ['Punto de equilibrio', f.puntoEquilibrio, f.puntoEquilibrio == null ? 'sin margen' : null],
  ]

  let fila = 4
  for (const [concepto, monto, nota] of renglones) {
    const r2 = hoja.getRow(fila)
    r2.getCell(1).value = concepto
    if (monto != null) r2.getCell(2).value = monto
    if (nota) r2.getCell(3).value = nota

    if (concepto.startsWith('UTILIDAD') || concepto === 'Costo de obra' || concepto === 'Costos fijos') {
      r2.eachCell((celda) => {
        celda.font = { bold: true }
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } }
      })
    }
    fila++
  }

  fila += 1
  hoja.getCell(fila, 1).value = 'Gastos generales por categoría'
  hoja.getCell(fila, 1).font = { bold: true, color: { argb: VERDE } }
  fila++

  encabezados(hoja, [{ titulo: 'Categoría', ancho: 42 }, { titulo: 'Monto', ancho: 18, formato: MONEDA }], fila)
  fila++
  agregarFilas(hoja, f.categorias.map((c) => [CATEGORIA_GASTO[c.categoria], c.monto]), fila)
  fila += f.categorias.length
  totalizar(hoja, fila, ['Total', f.totalGastosGenerales])

  hoja.getCell(fila + 2, 1).value =
    'Facturado cuenta sólo las obras que terminaron de cobrarse dentro del mes.'
  hoja.getCell(fila + 3, 1).value =
    'Punto de equilibrio = costos fijos ÷ margen de contribución del mes.'
  for (const n of [2, 3]) {
    hoja.getCell(fila + n, 1).font = { size: 9, italic: true, color: { argb: 'FF6B776E' } }
  }
}

function hojaObras(libro: ExcelJS.Workbook, r: ReporteMensual) {
  const hoja = libro.addWorksheet('Obras')
  titular(hoja, 'Obras del mes', `Cierre de ${r.etiqueta} · ${r.obras.length} órdenes de trabajo`, 12)

  const columnas: Columna[] = [
    { titulo: 'OT', ancho: 12 },
    { titulo: 'Obra', ancho: 30 },
    { titulo: 'Cliente', ancho: 24 },
    { titulo: 'Cotización', ancho: 12 },
    { titulo: 'Apertura', ancho: 13, formato: FECHA },
    { titulo: 'Actualizada', ancho: 13, formato: FECHA },
    { titulo: 'Estatus', ancho: 13 },
    { titulo: 'Material presupuestado', ancho: 20, formato: MONEDA },
    { titulo: 'Material real', ancho: 16, formato: MONEDA },
    { titulo: 'Mano de obra', ancho: 16, formato: MONEDA },
    { titulo: 'Gastos adicionales', ancho: 18, formato: MONEDA },
    { titulo: 'Utilidad', ancho: 16, formato: MONEDA },
    { titulo: '% utilidad', ancho: 11, formato: PORCENTAJE },
  ]
  encabezados(hoja, columnas, 4)

  agregarFilas(
    hoja,
    r.obras.map((o) => [
      o.ot_numero,
      o.nombre,
      o.cliente,
      o.cotizacion_folio,
      aFecha(o.fecha_apertura),
      aFecha(o.fecha_ultima_actualizacion?.slice(0, 10)),
      ESTATUS_OBRA[o.estatus as EstatusObra].texto,
      Number(o.material_cotizado),
      Number(o.material_real),
      Number(o.mano_obra),
      Number(o.gastos_adicionales),
      Number(o.utilidad),
      Number(o.cotizado) > 0 ? (Number(o.utilidad) / Number(o.cotizado)) * 100 : 0,
    ]),
    5,
  )

  const suma = (f: (o: ReporteMensual['obras'][number]) => number) =>
    r.obras.reduce((s, o) => s + f(o), 0)

  totalizar(hoja, 5 + r.obras.length, [
    'TOTAL', null, null, null, null, null, null,
    suma((o) => Number(o.material_cotizado)),
    suma((o) => Number(o.material_real)),
    suma((o) => Number(o.mano_obra)),
    suma((o) => Number(o.gastos_adicionales)),
    suma((o) => Number(o.utilidad)),
    null,
  ])
}

function hojaCotizaciones(libro: ExcelJS.Workbook, r: ReporteMensual) {
  const hoja = libro.addWorksheet('Cotizaciones')
  titular(hoja, 'Cotizaciones del mes', `Cierre de ${r.etiqueta}`, 8)

  encabezados(
    hoja,
    [
      { titulo: 'Folio', ancho: 12 },
      { titulo: 'Fecha', ancho: 13, formato: FECHA },
      { titulo: 'Cliente', ancho: 28 },
      { titulo: 'Obra', ancho: 26 },
      { titulo: 'Tipo', ancho: 12 },
      { titulo: 'Estatus', ancho: 13 },
      { titulo: 'Factura', ancho: 10 },
      { titulo: 'Total', ancho: 16, formato: MONEDA },
    ],
    4,
  )

  agregarFilas(
    hoja,
    r.cotizaciones.map((c) => [
      c.folio,
      aFecha(c.fecha),
      c.cliente,
      c.nombre_obra ?? '',
      c.tipo,
      ESTATUS_COTIZACION[c.estatus].texto,
      c.requiere_factura ? 'Sí' : 'No',
      Number(c.total),
    ]),
    5,
  )

  let fila = 5 + r.cotizaciones.length
  totalizar(hoja, fila, [
    'TOTAL', null, null, null, null, null, null,
    r.cotizaciones.reduce((s, c) => s + Number(c.total), 0),
  ])

  fila += 3
  hoja.getCell(fila, 1).value = 'Obra aprobada NO liquidada al corte (todavía no es ingreso)'
  hoja.getCell(fila, 1).font = { bold: true, color: { argb: 'FFB45309' } }
  fila++

  encabezados(
    hoja,
    [
      { titulo: 'Cliente', ancho: 28 },
      { titulo: 'Cotización', ancho: 13 },
      { titulo: 'Factura', ancho: 10 },
      { titulo: 'Contratado', ancho: 16, formato: MONEDA },
      { titulo: 'Cobrado', ancho: 16, formato: MONEDA },
      { titulo: 'Pendiente', ancho: 16, formato: MONEDA },
    ],
    fila,
  )
  fila++

  agregarFilas(
    hoja,
    r.aprobadasNoLiquidadas.map((c) => [
      c.cliente,
      c.folio,
      c.requiere_factura ? 'Sí' : 'No',
      Number(c.cotizado),
      Number(c.cobrado),
      Number(c.saldo),
    ]),
    fila,
  )
  fila += r.aprobadasNoLiquidadas.length

  totalizar(hoja, fila, [
    'TOTAL NO REALIZABLE AÚN', null, null,
    r.aprobadasNoLiquidadas.reduce((s, c) => s + Number(c.cotizado), 0),
    r.aprobadasNoLiquidadas.reduce((s, c) => s + Number(c.cobrado), 0),
    r.aprobadasNoLiquidadas.reduce((s, c) => s + Number(c.saldo), 0),
  ])
}

function hojaCobranza(libro: ExcelJS.Workbook, r: ReporteMensual) {
  const hoja = libro.addWorksheet('Cobranza')
  titular(hoja, 'Concentrado de cobranza', `Cierre de ${r.etiqueta}`, 9)

  encabezados(
    hoja,
    [
      { titulo: 'Cliente', ancho: 28 },
      { titulo: 'Cotización', ancho: 13 },
      { titulo: 'Fecha', ancho: 13, formato: FECHA },
      { titulo: 'Factura', ancho: 10 },
      { titulo: 'Cotizado', ancho: 16, formato: MONEDA },
      { titulo: 'Anticipo', ancho: 16, formato: MONEDA },
      { titulo: 'Abonos', ancho: 16, formato: MONEDA },
      { titulo: 'Saldo por liquidar', ancho: 18, formato: MONEDA },
      { titulo: '% pendiente', ancho: 13, formato: PORCENTAJE },
    ],
    4,
  )

  agregarFilas(
    hoja,
    r.cobranza.map((c) => [
      c.cliente,
      c.folio,
      aFecha(c.fecha),
      c.requiere_factura ? 'Sí' : 'No',
      Number(c.cotizado),
      Number(c.anticipo),
      Number(c.abonos) + Number(c.liquidacion),
      Number(c.saldo),
      Number(c.pct_pendiente),
    ]),
    5,
  )

  totalizar(hoja, 5 + r.cobranza.length, [
    'TOTAL GENERAL POR COBRAR', null, null, null,
    r.cobranza.reduce((s, c) => s + Number(c.cotizado), 0),
    r.cobranza.reduce((s, c) => s + Number(c.anticipo), 0),
    r.cobranza.reduce((s, c) => s + Number(c.abonos) + Number(c.liquidacion), 0),
    r.cobranza.reduce((s, c) => s + Number(c.saldo), 0),
    null,
  ])
}

function hojaMovimientos(libro: ExcelJS.Workbook, r: ReporteMensual) {
  const hoja = libro.addWorksheet('Movimientos')
  titular(
    hoja,
    'Movimientos: tarjeta de empresa vs efectivo',
    `Cierre de ${r.etiqueta} · ${r.movimientos.length} movimientos`,
    6,
  )

  encabezados(
    hoja,
    [
      { titulo: 'Fecha', ancho: 13, formato: FECHA },
      { titulo: 'Origen', ancho: 13 },
      { titulo: 'Concepto', ancho: 36 },
      { titulo: 'Referencia', ancho: 32 },
      { titulo: 'Método', ancho: 18 },
      { titulo: 'Monto', ancho: 16, formato: MONEDA },
    ],
    4,
  )

  agregarFilas(
    hoja,
    r.movimientos.map((m) => [
      aFecha(m.fecha),
      m.origen,
      m.concepto,
      m.referencia,
      METODO_PAGO[m.metodo],
      m.monto,
    ]),
    5,
  )

  let fila = 5 + r.movimientos.length
  totalizar(hoja, fila, ['TOTAL', null, null, null, null, r.totales.salidas])

  fila += 3
  hoja.getCell(fila, 1).value = 'Concentrado por método'
  hoja.getCell(fila, 1).font = { bold: true, color: { argb: VERDE } }
  fila++

  encabezados(
    hoja,
    [{ titulo: 'Método', ancho: 24 }, { titulo: 'Monto', ancho: 18, formato: MONEDA }],
    fila,
  )
  fila++

  agregarFilas(
    hoja,
    [
      ['Tarjeta de empresa', r.totales.tarjeta],
      ['Efectivo', r.totales.efectivo],
      ['Caja chica', r.totales.cajaChica],
      ['Transferencias', r.totales.transferencia],
      ['Otros (cheque y depósito)', r.totales.otros],
    ],
    fila,
  )
  totalizar(hoja, fila + 5, ['TOTAL', r.totales.salidas])
}

// ===========================================================================
export const HOJAS = {
  financiero: hojaFinanciero,
  obras: hojaObras,
  cotizaciones: hojaCotizaciones,
  cobranza: hojaCobranza,
  movimientos: hojaMovimientos,
} as const

export type NombreHoja = keyof typeof HOJAS

/** Libro completo o una sola hoja, según lo que pida el usuario. */
export async function generarLibro(
  reporte: ReporteMensual,
  hoja?: NombreHoja,
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  libro.creator = EMPRESA.nombre
  libro.created = new Date()

  if (hoja) HOJAS[hoja](libro, reporte)
  else for (const construir of Object.values(HOJAS)) construir(libro, reporte)

  const datos = await libro.xlsx.writeBuffer()
  return Buffer.from(datos)
}
