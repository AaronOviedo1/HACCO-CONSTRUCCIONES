import 'server-only'
import type Stripe from 'stripe'
import { PRICE_ID } from '@/lib/stripe/cliente'

export type PrecioMensual = {
  montoCentavos: number
  moneda: string
  nombre: string
  intervalo: string
}

/**
 * Lo que cuesta la app, leído de Stripe. Se consulta sólo mientras no hay
 * tarjeta registrada —una vez activa, el monto viene en la fila— y nunca se
 * escribe en el código: cambiarlo es cambiar el precio en el dashboard.
 */
export async function precioMensual(stripe: Stripe): Promise<PrecioMensual | null> {
  if (!PRICE_ID) return null
  try {
    const precio = await stripe.prices.retrieve(PRICE_ID, { expand: ['product'] })
    const producto = precio.product
    const nombre =
      typeof producto === 'object' && !producto.deleted ? producto.name : 'Mensualidad HaacoPro'
    return {
      montoCentavos: precio.unit_amount ?? 0,
      moneda: precio.currency,
      nombre,
      intervalo: precio.recurring?.interval ?? 'month',
    }
  } catch (e) {
    console.error('[stripe] no se pudo leer el precio', e)
    return null
  }
}
