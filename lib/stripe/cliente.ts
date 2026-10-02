import 'server-only'
import Stripe from 'stripe'

/**
 * El cliente de Stripe del servidor.
 *
 * Sin `apiVersion` a propósito: el SDK ya trae fijada la versión con la que
 * se generaron sus tipos (`node_modules/stripe/cjs/apiVersion.js`), y pasarle
 * otra haría que los objetos que llegan no coincidan con lo que el código
 * espera. El endpoint del webhook en el dashboard de Stripe se fija a esa
 * misma versión.
 *
 * Como el resto de las llaves del servidor: si falta, se devuelve null y
 * quien llama contesta con un mensaje claro en vez de tronar.
 */
export function crearStripe(): Stripe | null {
  const llave = process.env.STRIPE_SECRET_KEY
  if (!llave) return null
  return new Stripe(llave, { appInfo: { name: 'HaacoPro' } })
}

/** El precio mensual, creado en el dashboard de Stripe. La app sólo lo cita. */
export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? ''

/**
 * Marca en el `metadata` de la suscripción. Una cuenta de Stripe puede tener
 * otras suscripciones —de otro cliente del proveedor, de un `stripe trigger`
 * de prueba—, y la fila única de esta app sólo se deja tocar por la suya.
 */
export const META_APP = 'haacopro'

export const SIN_STRIPE =
  'Falta STRIPE_SECRET_KEY en el servidor: sin ella no se puede manejar la suscripción.'

/** Las cuatro variables que hacen falta para que la pantalla funcione. */
export function stripeConfigurado(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_ID &&
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  )
}
