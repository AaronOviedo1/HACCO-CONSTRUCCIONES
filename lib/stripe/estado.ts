import type { EstadoSuscripcionApp } from '@/types/database'

/**
 * Cómo se lee cada estado de la suscripción. Sin `server-only`: lo usan la
 * pantalla, el aviso y el botón del navegador por igual.
 */

/** Hay una suscripción de pie: no se debe abrir otro checkout. */
export function suscripcionViva(estado: EstadoSuscripcionApp): boolean {
  return (
    estado === 'active' ||
    estado === 'trialing' ||
    estado === 'past_due' ||
    estado === 'unpaid' ||
    estado === 'incomplete' ||
    estado === 'paused'
  )
}

/**
 * Hay una factura esperando: el cobro del 12 no entró (`past_due`, `unpaid`)
 * o el primer cargo se quedó a medias (`incomplete`). Sólo los dos primeros
 * cierran la app; el tercero caduca solo en un día y vuelve a «sin tarjeta».
 */
export function conImpago(estado: EstadoSuscripcionApp): boolean {
  return estado === 'past_due' || estado === 'unpaid' || estado === 'incomplete'
}

/** Todavía no hay tarjeta, o la que había ya no cuenta. */
export function sinSuscripcion(estado: EstadoSuscripcionApp): boolean {
  return estado === 'sin_tarjeta' || estado === 'canceled' || estado === 'incomplete_expired'
}

/** «Visa •••• 4242», con la marca como la escribe la gente. */
export function etiquetaTarjeta(marca: string | null, ultimos4: string | null): string | null {
  if (!ultimos4) return null
  const MARCAS: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    american_express: 'American Express',
    discover: 'Discover',
    jcb: 'JCB',
    unionpay: 'UnionPay',
    diners: 'Diners Club',
  }
  const nombre = marca ? (MARCAS[marca] ?? marca) : 'Tarjeta'
  return `${nombre} •••• ${ultimos4}`
}
