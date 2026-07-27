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
