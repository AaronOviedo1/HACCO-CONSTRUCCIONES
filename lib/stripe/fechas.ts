/**
 * El día de cobro.
 *
 * Vercel corre en UTC y la empresa vive en Hermosillo (UTC−7 todo el año, sin
 * horario de verano), así que la cuenta es aritmética y no hace falta
 * librería: se corre el reloj siete horas, se lee la fecha civil y se arma el
 * 12 que sigue. Misma regla que `hoyHermosillo()` en lib/format.ts.
 */

/** Horas que Hermosillo va detrás de UTC. */
const OFFSET_HORAS = 7

/** El día del mes en que se cobra la mensualidad. */
export const DIA_DE_COBRO = 12

/**
 * El próximo día 12 a las 00:00 de Hermosillo, en segundos Unix, que es como
 * Stripe quiere el `billing_cycle_anchor`.
 *
 * Stripe exige que el ancla esté estrictamente en el futuro, así que si hoy ya
 * es 12 se va al 12 del mes que entra: quien registra la tarjeta el mismo día
 * 12 no paga hasta el mes siguiente. Es a propósito y es raro —la tarjeta se
 * registra una vez en la vida—, pero conviene saberlo.
 */
export function proximoDia12(ahora: Date = new Date()): number {
  const local = new Date(ahora.getTime() - OFFSET_HORAS * 3_600_000)
  let anio = local.getUTCFullYear()
  let mes = local.getUTCMonth()
  if (local.getUTCDate() >= DIA_DE_COBRO) {
    mes += 1
    if (mes === 12) {
      mes = 0
      anio += 1
    }
  }
  // Las 00:00 del 12 en Hermosillo son las 07:00 UTC.
  return Math.floor(Date.UTC(anio, mes, DIA_DE_COBRO, OFFSET_HORAS, 0, 0) / 1000)
}
