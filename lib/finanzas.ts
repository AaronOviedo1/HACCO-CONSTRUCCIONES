import { parsearFecha } from '@/lib/format'
import type { TonoEtiqueta } from '@/components/ui'
import type {
  CategoriaGasto, CondicionCompra, EstadoCxp, EstadoPagoFijo, MetodoPago,
  TipoDeduccion, TipoPagoCobranza,
} from '@/types/database'

export const CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  material: 'Material',
  herramienta: 'Herramienta',
  gasolina: 'Gasolina',
  servicio_auto: 'Servicio de auto',
  garrafones: 'Garrafones',
  marketing: 'Marketing',
  oficina: 'Oficina',
  viaticos: 'Viáticos',
  otro: 'Otro',
}

export const METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta_empresa: 'Tarjeta empresa',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  deposito: 'Depósito',
}

export const CONDICION: Record<CondicionCompra, string> = {
  contado: 'Contado',
  credito: 'Crédito',
}

export const TIPO_PAGO_COBRANZA: Record<TipoPagoCobranza, string> = {
  anticipo: 'Anticipo',
  abono: 'Abono',
  liquidacion: 'Liquidación',
}

export const TIPO_DEDUCCION: Record<TipoDeduccion, string> = {
  prestamo: 'Préstamo',
  adelanto: 'Adelanto',
  reembolso: 'Reembolso',
}

export const ESTADO_CXP: Record<EstadoCxp, { texto: string; tono: TonoEtiqueta }> = {
  pagada: { texto: 'Pagada', tono: 'verde' },
  vencida: { texto: 'Vencida', tono: 'rojo' },
  urgente: { texto: 'Urgente', tono: 'rojo' },
  proxima: { texto: 'Próxima', tono: 'ambar' },
  al_corriente: { texto: 'Al corriente', tono: 'azul' },
  cancelada: { texto: 'Cancelada', tono: 'gris' },
}

export const ESTADO_PAGO_FIJO: Record<EstadoPagoFijo, { texto: string; tono: TonoEtiqueta }> = {
  pagado: { texto: 'Pagado', tono: 'verde' },
  pendiente: { texto: 'Pendiente', tono: 'ambar' },
  vencido: { texto: 'Vencido', tono: 'rojo' },
  programado: { texto: 'Programado', tono: 'gris' },
}

export const CATEGORIAS_PAGO_FIJO = [
  'Nómina',
  'Servicio',
  'Mensualidad',
  'Renta',
  'Seguro',
  'Impuestos',
  'Otro',
]

// ---------------------------------------------------------------------------
// Quincenas: la empresa paga el día 15 y el último día de cada mes.
// ---------------------------------------------------------------------------
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** La quincena a la que pertenece una fecha: el 15 o el fin de mes. */
export function quincenaDe(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(`${fecha}T00:00:00`) : fecha
  if (d.getDate() <= 15) return iso(new Date(d.getFullYear(), d.getMonth(), 15))
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

/** Las quincenas del mes indicado (formato "aaaa-mm"). */
export function quincenasDelMes(mes: string): string[] {
  const [anio, m] = mes.split('-').map(Number)
  return [iso(new Date(anio, m - 1, 15)), iso(new Date(anio, m, 0))]
}

export function etiquetaQuincena(quincena: string): string {
  const d = new Date(`${quincena}T00:00:00`)
  return d.getDate() === 15 ? '1ª quincena' : '2ª quincena'
}

/** Mes en curso en formato "aaaa-mm". */
export function mesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Primer día del mes y primer día del siguiente, para filtrar rangos. */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split('-').map(Number)
  return { desde: iso(new Date(anio, m - 1, 1)), hasta: iso(new Date(anio, m, 1)) }
}

/**
 * Traduce los parámetros `desde`/`hasta` de la URL a un rango de consulta.
 *
 * El `hasta` que devuelve es **exclusivo** (el día siguiente al elegido), que
 * es como se filtra en Postgres: `.gte(desde).lt(hasta)`. Sin parámetros, el
 * periodo por defecto es el mes en curso, salvo que se pida lo contrario.
 */
export function rangoDeUrl(
  params: { desde?: string; hasta?: string },
  { porDefecto = 'mes' }: { porDefecto?: 'mes' | 'todo' } = {},
): { desde: string | null; hasta: string | null; etiqueta: string; filtrado: boolean } {
  const valida = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const desde = valida(params.desde)
  const hastaElegido = valida(params.hasta)

  if (!desde && !hastaElegido) {
    if (porDefecto === 'todo') {
      return { desde: null, hasta: null, etiqueta: 'todo el histórico', filtrado: false }
    }
    const { desde: d, hasta: h } = rangoMes(mesActual())
    return { desde: d, hasta: h, etiqueta: etiquetaMes(mesActual()), filtrado: false }
  }

  // El día final se guarda inclusivo, pero se consulta con el siguiente.
  const siguiente = hastaElegido
    ? (() => {
        const [a, m, d] = hastaElegido.split('-').map(Number)
        return iso(new Date(a, m - 1, d + 1))
      })()
    : null

  return {
    desde,
    hasta: siguiente,
    etiqueta: etiquetaRangoLegible(desde, hastaElegido),
    filtrado: true,
  }
}

const MESES_LARGOS_MIN = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                          'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "julio de 2026", "del 1 al 15 de julio" o "desde el 3 de agosto". */
export function etiquetaRangoLegible(desde: string | null, hasta: string | null): string {
  const partes = (v: string) => v.split('-').map(Number)

  if (desde && hasta) {
    const [a1, m1, d1] = partes(desde)
    const [a2, m2, d2] = partes(hasta)
    const finDeMes = new Date(a1, m1, 0).getDate()
    if (a1 === a2 && m1 === m2 && d1 === 1 && d2 === finDeMes) {
      return `${MESES_LARGOS_MIN[m1 - 1]} de ${a1}`
    }
    if (a1 === a2 && m1 === m2) return `del ${d1} al ${d2} de ${MESES_LARGOS_MIN[m1 - 1]}`
    return `del ${d1} de ${MESES_LARGOS_MIN[m1 - 1]} al ${d2} de ${MESES_LARGOS_MIN[m2 - 1]} de ${a2}`
  }

  const solo = desde ?? hasta
  if (!solo) return 'todo el histórico'
  const [a, m, d] = partes(solo)
  return `${desde ? 'desde' : 'hasta'} el ${d} de ${MESES_LARGOS_MIN[m - 1]} de ${a}`
}

export function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${meses[m - 1]} de ${anio}`
}

/**
 * Lo que vence en las próximas cuatro semanas, contadas desde hoy.
 * Lo ya vencido se acumula en la primera barra: en la calle eso es «esta
 * semana», no historia.
 */
export function vencimientosPorSemana(
  cuentas: { vencimiento: string | null; saldo: number }[],
): { etiqueta: string; monto: number; texto: string }[] {
  const cortos = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                  'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  return Array.from({ length: 4 }, (_, i) => {
    const desde = new Date(hoy)
    desde.setDate(hoy.getDate() + i * 7)
    const hasta = new Date(desde)
    hasta.setDate(desde.getDate() + 7)

    const monto = cuentas
      .filter((c) => {
        const v = parsearFecha(c.vencimiento)
        if (!v) return false
        return i === 0 ? v < hasta : v >= desde && v < hasta
      })
      .reduce((s, c) => s + c.saldo, 0)

    return {
      etiqueta: `${desde.getDate()} ${cortos[desde.getMonth()]}`,
      monto,
      texto: monto > 0 ? `$${Math.round(monto / 1000)}k` : '—',
    }
  })
}

/** Tono de la barra de cobranza según lo que falte por cobrar. */
export function tonoCobranza(pctPendiente: number): TonoEtiqueta {
  if (pctPendiente <= 0) return 'verde'
  if (pctPendiente <= 50) return 'azul'
  return 'ambar'
}
