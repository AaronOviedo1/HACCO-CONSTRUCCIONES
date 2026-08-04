// ============================================================================
// HaacoPro · Formatos mexicanos
// Moneda en pesos, fechas dd/mmm/aaaa y monto con letra para los recibos.
// ============================================================================

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                      'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * Convierte a Date respetando el día calendario.
 * Postgres entrega los `date` como "2026-07-26"; si eso se pasa directo a
 * `new Date()` se interpreta como UTC y en Hermosillo se corre un día.
 */
export function parsearFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null
  if (valor instanceof Date) return valor
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (soloFecha) {
    return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
  }
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 26/jul/2026 */
export function fecha(valor: string | Date | null | undefined): string {
  const d = parsearFecha(valor)
  if (!d) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${MESES_CORTOS[d.getMonth()]}/${d.getFullYear()}`
}

/** 26/jul/2026 09:41 */
export function fechaHora(valor: string | Date | null | undefined): string {
  const d = parsearFecha(valor)
  if (!d) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${fecha(d)} ${hh}:${mm}`
}

/** 26 de julio de 2026 — para el encabezado de la cotización */
export function fechaLarga(valor: string | Date | null | undefined): string {
  const d = parsearFecha(valor)
  if (!d) return '—'
  return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}`
}

/** $12,345.67 */
export function pesos(valor: number | null | undefined): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor ?? 0))
}

/** $12,346 — para tarjetas de resumen donde los centavos estorban */
export function pesosCortos(valor: number | null | undefined): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Number(valor ?? 0))
}

/** 87.5% */
export function porcentaje(valor: number | null | undefined, decimales = 1): string {
  return `${Number(valor ?? 0).toFixed(decimales)}%`
}

/**
 * Clase de tamaño según lo que mide el monto ya formateado.
 *
 * En el teléfono los números van de dos o tres en tres por renglón y un millón
 * con sus comas no cabe al tamaño base: se cortaba. Aquí baja de tamaño en vez
 * de recortarse. `kpi` es la tarjeta de indicador; `dato` el renglón de un
 * concentrado, donde el tamaño de partida ya es chico.
 */
export function tamanoMonto(valor: string, escala: 'kpi' | 'dato' = 'kpi'): string {
  const n = valor.length
  if (escala === 'dato') return n > 12 ? 'text-[12px]' : n > 10 ? 'text-[13px]' : 'text-sm'
  return n > 9 ? 'text-[15.5px]' : n > 7 ? 'text-[19px]' : 'text-[22px]'
}

/** 125.5 m² */
export function metros(valor: number | null | undefined): string {
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(valor ?? 0))} m²`
}

// ---------------------------------------------------------------------------
// Monto con letra (recibos de abono a mano de obra y recibo-contrato)
// ---------------------------------------------------------------------------
const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE']
const DECENAS = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA',
  'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function centenasEnLetra(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS[c])
  if (resto > 0) {
    if (resto <= 20) {
      partes.push(UNIDADES[resto])
    } else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      if (d === 2) partes.push(u === 0 ? 'VEINTE' : `VEINTI${UNIDADES[u]}`)
      else partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`)
    }
  }
  return partes.join(' ')
}

function enteroEnLetra(n: number): string {
  if (n === 0) return 'CERO'
  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (millones > 0) {
    partes.push(millones === 1 ? 'UN MILLÓN' : `${centenasEnLetra(millones)} MILLONES`)
  }
  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${centenasEnLetra(miles)} MIL`)
  }
  if (resto > 0) partes.push(centenasEnLetra(resto))
  return partes.join(' ').replace(/\s+/g, ' ').trim()
}

/** "DOCE MIL TRESCIENTOS CUARENTA Y CINCO PESOS 67/100 M.N." */
export function montoEnLetra(valor: number | null | undefined): string {
  const monto = Math.abs(Number(valor ?? 0))
  const entero = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  const letra = enteroEnLetra(entero)
  const peso = entero === 1 ? 'PESO' : 'PESOS'
  return `${letra} ${peso} ${String(centavos).padStart(2, '0')}/100 M.N.`
}
