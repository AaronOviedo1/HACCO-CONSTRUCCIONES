import { redondear } from '@/lib/cotizaciones'
import type { FilaCobranza } from '@/lib/cobranza'
import type { TonoEtiqueta } from '@/components/ui'
import type { EstatusServicio, TipoServicio, VServicio } from '@/types/database'

/**
 * Los cálculos de las reparaciones, en un solo lugar.
 *
 * La regla que manda aquí: el estatus cuenta el trabajo y los pagos cuentan el
 * dinero. Nunca hay una columna que diga «cobrado», porque el día en que
 * alguien la marque mal deja de coincidir con la suma de los pagos y ya no se
 * vuelven a juntar.
 */

/** Cómo se llama cada etapa en pantalla. Los filtros lo derivan, no lo copian. */
export const ESTATUS_SERVICIO: Record<EstatusServicio, { texto: string; tono: TonoEtiqueta }> = {
  agendado:      { texto: 'Agendado',      tono: 'gris' },
  diagnostico:   { texto: 'En diagnóstico', tono: 'azul' },
  presupuestado: { texto: 'Presupuestado', tono: 'ambar' },
  aprobado:      { texto: 'Aprobado',      tono: 'verde' },
  rechazado:     { texto: 'Rechazado',     tono: 'rojo' },
  reparado:      { texto: 'Reparado',      tono: 'verde' },
  cancelado:     { texto: 'Cancelado',     tono: 'gris' },
}

/** El orden en que ocurren las cosas: sirve para pintar el avance del flujo. */
export const PASOS_SERVICIO: { estatus: EstatusServicio; texto: string }[] = [
  { estatus: 'agendado',      texto: 'Cita' },
  { estatus: 'diagnostico',   texto: 'Diagnóstico' },
  { estatus: 'presupuestado', texto: 'Presupuesto' },
  { estatus: 'aprobado',      texto: 'Aprobado' },
  { estatus: 'reparado',      texto: 'Reparado' },
]

/** Cuántos pasos lleva andados. -1 si se salió del camino (rechazado, cancelado). */
export function pasoActual(estatus: EstatusServicio): number {
  return PASOS_SERVICIO.findIndex((p) => p.estatus === estatus)
}

/**
 * La palabra con la que se lee el renglón en la lista.
 *
 * «Finalizado» es como lo escribe el cliente en su Excel, y aquí se deriva en
 * vez de guardarse: un servicio está finalizado cuando quedó reparado y ya no
 * debe nada. Mientras deba, la palabra útil es otra —«Por cobrar»—, que es lo
 * que hay que hacer con él.
 */
export function etapaServicio(s: {
  estatus: EstatusServicio
  cotizado: number
  cobrado: number
  saldo: number
}): { texto: string; tono: TonoEtiqueta } {
  const debe = Number(s.saldo) > 0

  if (s.estatus === 'reparado') {
    if (Number(s.cotizado) > 0 && !debe) return { texto: 'Finalizado', tono: 'verde' }
    return { texto: 'Por cobrar', tono: 'ambar' }
  }
  if (s.estatus === 'aprobado') {
    // Con anticipo cobrado ya no es sólo «por reparar»: es un trabajo pagado
    // a medias que sigue pendiente de hacerse.
    return { texto: Number(s.cobrado) > 0 ? 'Con anticipo' : 'Por reparar', tono: 'azul' }
  }
  // Un «no» del cliente deja la visita a deber: mientras eso pase, lo que hay
  // que hacer con el renglón no es archivarlo, es cobrarlo.
  if (s.estatus === 'rechazado' && debe) return { texto: 'Visita por cobrar', tono: 'ambar' }
  if (s.estatus === 'presupuestado') {
    return { texto: 'Presupuesto enviado', tono: 'ambar' }
  }
  return ESTATUS_SERVICIO[s.estatus]
}

/**
 * El dinero de un servicio se persigue desde que el técnico fue.
 *
 * Ir a ver un portón cuesta, y ese costo no depende de que el cliente acepte:
 * un presupuesto rechazado deja una visita cobrada. Lo que se debe en cada
 * etapa ya lo resuelve la propia fila —la cuota mientras decide, la reparación
 * completa sólo al aprobar—, así que aquí basta con dejar fuera lo que todavía
 * no ha pasado o no pasó nunca.
 */
export function serviciosCobrables<T extends { estatus: EstatusServicio }>(filas: T[]): T[] {
  return filas.filter((s) => s.estatus !== 'agendado' && s.estatus !== 'cancelado')
}

/**
 * Una fila de `v_servicios` leída como cobranza, para sumarla con el resto.
 *
 * El anticipo va en cero a propósito y no nulo: una reparación se cobra al
 * terminar, así que nunca hay anticipo pendiente que perseguir, y dejarlo
 * indefinido haría que el «anticipos sin cobrar» del panel se moviera solo.
 */
export function comoCobranza(s: {
  estatus: EstatusServicio
  cotizado: number
  cobrado: number
  saldo: number
}): FilaCobranza {
  return {
    estatus: s.estatus,
    cotizado: Number(s.cotizado),
    cobrado: Number(s.cobrado),
    saldo: Number(s.saldo),
    anticipo: 0,
    anticipo_esperado: 0,
  }
}

/**
 * Lo vendido en reparaciones dentro del mes, por la fecha en que el cliente
 * aprobó. Mismo criterio que las cotizaciones desde la entrega del 18 de
 * agosto: la venta es del mes en que se cerró, no del que se levantó el papel.
 */
export function vendidoServicios(
  filas: { estatus: EstatusServicio; cotizado: number; fecha_venta: string | null }[],
  mes: string,
): number {
  return redondear(
    serviciosCobrables(filas)
      .filter((s) => String(s.fecha_venta ?? '').startsWith(mes))
      .reduce((suma, s) => suma + Number(s.cotizado), 0),
  )
}

export const TIPO_SERVICIO: Record<TipoServicio, { texto: string; tono: TonoEtiqueta }> = {
  reparacion: { texto: 'Reparación',  tono: 'gris' },
  preventivo: { texto: 'Preventivo',  tono: 'azul' },
}

/** Cada cuánto se vuelve a revisar un portón, según lo que hace la empresa. */
export const MESES_ENTRE_PREVENTIVOS = 6

/**
 * El día del siguiente preventivo, contando desde el trabajo que acaba de
 * quedar. Si el mes destino no tiene ese día —un 31 que cae en un mes de 30—,
 * se usa el último del mes en vez de saltar al siguiente.
 */
export function proximoPreventivo(desde: string): string {
  const [anio, mes, dia] = desde.split('-').map(Number)
  const destino = new Date(anio, mes - 1 + MESES_ENTRE_PREVENTIVOS, 1)
  const ultimoDelMes = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate()
  destino.setDate(Math.min(dia, ultimoDelMes))
  const m = String(destino.getMonth() + 1).padStart(2, '0')
  const d = String(destino.getDate()).padStart(2, '0')
  return `${destino.getFullYear()}-${m}-${d}`
}

/** Las visitas que tocan hoy o que se pasaron sin atender. */
export function citasPendientes(filas: VServicio[], hoy: string): VServicio[] {
  return filas
    .filter((s) => s.estatus === 'agendado' && s.fecha_visita <= hoy)
    .sort((a, b) =>
      `${a.fecha_visita} ${a.hora_visita ?? '99'}`.localeCompare(
        `${b.fecha_visita} ${b.hora_visita ?? '99'}`,
      ),
    )
}
