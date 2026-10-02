'use server'

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'
import { requerirRol } from '@/lib/auth'
import { EMPRESA } from '@/lib/empresa'
import { crearStripe, META_APP, PRICE_ID, SIN_STRIPE } from '@/lib/stripe/cliente'
import { suscripcionViva } from '@/lib/stripe/estado'
import { proximoDia12 } from '@/lib/stripe/fechas'
import { sincronizarSuscripcion } from '@/lib/stripe/sincronizar'
import { crearClienteAdmin, SIN_LLAVE_SERVICIO } from '@/lib/supabase/admin'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { EstadoAccion } from '@/lib/acciones'

/**
 * La tarjeta con la que se paga la app.
 *
 * Todo pasa por `direccion()`: la suscripción es asunto de quien firma, nadie
 * más la ve ni la toca. El cliente de servicio se usa sólo para escribir la
 * fila por la RPC, igual que hace el webhook, y sólo después de comprobar
 * quién pide.
 */
async function direccion() {
  const perfil = await requerirRol(['admin'])
  const supabase = await crearClienteServidor()
  const { data: fila } = await supabase
    .from('suscripcion_app')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  return { perfil, fila }
}

export type SesionCheckout = { clientSecret: string; sessionId: string } | { error: string }

/**
 * Abre el checkout incrustado de Stripe para registrar la tarjeta.
 *
 * Hoy no se cobra nada: la suscripción queda anclada al próximo día 12 sin
 * prorrateo, así que el formulario de Stripe dice «$0.00 hoy, luego $X el 12
 * de …» y lo único que hace es guardar la tarjeta.
 *
 * Tres candados contra la suscripción doble: el estado de la fila, la lista
 * de suscripciones del cliente en Stripe (por si el webhook todavía no
 * aterrizó) y la llave de idempotencia, que hace que dos toques seguidos del
 * botón devuelvan la misma sesión.
 */
export async function crearSesionCheckout(): Promise<SesionCheckout> {
  const { perfil, fila } = await direccion()

  const stripe = crearStripe()
  if (!stripe) return { error: SIN_STRIPE }
  if (!PRICE_ID) return { error: 'Falta STRIPE_PRICE_ID en el servidor: no se sabe qué cobrar.' }

  if (fila && suscripcionViva(fila.estado)) {
    return { error: 'Ya hay una suscripción activa. Para cambiar la tarjeta usa el portal.' }
  }

  const cliente = fila?.stripe_customer_id ?? null
  if (cliente) {
    const { data } = await stripe.subscriptions.list({ customer: cliente, status: 'all', limit: 10 })
    const viva = data.find(
      (s) => s.metadata?.app === META_APP && s.status !== 'canceled' && s.status !== 'incomplete_expired',
    )
    if (viva) {
      return { error: 'Stripe ya tiene una suscripción de pie. Toca «Actualizar» para verla aquí.' }
    }
  }

  const ancla = proximoDia12()

  // Los parámetros se arman aparte porque la llave de idempotencia los
  // resume: Stripe devuelve la misma sesión mientras sean iguales (dos toques
  // seguidos del botón) y, si cambian —otro precio, otra versión del código—,
  // la llave cambia con ellos en vez de chocar con la sesión de hace un rato.
  const parametros: Stripe.Checkout.SessionCreateParams = {
    ui_mode: 'embedded_page',
    mode: 'subscription',
    redirect_on_completion: 'never',
    // Etiqueta con la que el dashboard de Stripe agrupa estas sesiones.
    integration_identifier: 'haacopro_mensualidad_qvtmrbxk',
    locale: 'es-419',
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    // Los métodos de pago los decide el dashboard de Stripe; en modo
    // suscripción ya descarta solo los que no se pueden reutilizar (OXXO).
    // `customer` y `customer_email` son excluyentes: con el cliente ya
    // creado se reutiliza, o Stripe abriría otro y el portal vería el
    // equivocado.
    ...(cliente
      ? { customer: cliente, customer_update: { name: 'auto', address: 'auto' } }
      : { customer_email: perfil.correo ?? undefined }),
    billing_address_collection: 'auto',
    subscription_data: {
      billing_cycle_anchor: ancla,
      proration_behavior: 'none',
      description: `Mensualidad HaacoPro · ${EMPRESA.nombre}`,
      metadata: { app: META_APP, perfil_id: perfil.id },
    },
    metadata: { app: META_APP, perfil_id: perfil.id },
  }
  const huella = createHash('sha256').update(JSON.stringify(parametros)).digest('hex').slice(0, 16)

  try {
    const sesion = await stripe.checkout.sessions.create(parametros, {
      idempotencyKey: `checkout-${perfil.id}-${huella}`,
    })

    if (!sesion.client_secret) return { error: 'Stripe no devolvió la sesión del checkout.' }
    return { clientSecret: sesion.client_secret, sessionId: sesion.id }
  } catch (e) {
    console.error('[stripe] no se pudo abrir el checkout', e)
    return { error: 'No se pudo abrir el formulario de Stripe. Inténtalo de nuevo en un momento.' }
  }
}

/**
 * Lo que corre cuando Stripe dice que el checkout terminó: se lee la
 * suscripción recién creada y se guarda, sin esperar al webhook, para que la
 * pantalla cambie en el acto.
 */
export async function confirmarCheckout(sessionId: string): Promise<EstadoAccion> {
  const { perfil } = await direccion()

  const stripe = crearStripe()
  if (!stripe) return { error: SIN_STRIPE }
  const admin = crearClienteAdmin()
  if (!admin) return { error: SIN_LLAVE_SERVICIO }

  try {
    const sesion = await stripe.checkout.sessions.retrieve(sessionId)
    if (sesion.metadata?.perfil_id !== perfil.id) return { error: 'Esa sesión no es tuya.' }
    if (sesion.status !== 'complete' || !sesion.subscription) {
      return { error: 'El registro de la tarjeta no terminó.' }
    }
    const id = typeof sesion.subscription === 'string' ? sesion.subscription : sesion.subscription.id
    await sincronizarSuscripcion(stripe, admin, id)
  } catch (e) {
    console.error('[stripe] no se pudo confirmar el checkout', e)
    return { error: 'La tarjeta quedó en Stripe pero no se pudo leer. Toca «Actualizar».' }
  }

  refrescar()
  return { ok: true }
}

/**
 * «Ya pagué, actualizar»: por si un webhook se perdió, se vuelve a leer la
 * suscripción tal como está en Stripe.
 */
export async function resincronizar(): Promise<EstadoAccion> {
  const { fila } = await direccion()

  const stripe = crearStripe()
  if (!stripe) return { error: SIN_STRIPE }
  const admin = crearClienteAdmin()
  if (!admin) return { error: SIN_LLAVE_SERVICIO }
  if (!fila?.stripe_subscription_id) return { error: 'Todavía no hay suscripción que actualizar.' }

  try {
    await sincronizarSuscripcion(stripe, admin, fila.stripe_subscription_id)
  } catch (e) {
    console.error('[stripe] no se pudo resincronizar', e)
    return { error: 'No se pudo leer la suscripción de Stripe. Inténtalo en un momento.' }
  }

  refrescar()
  return { ok: true }
}

/** El aviso y el candado viven en el layout: se refresca todo el panel. */
function refrescar() {
  revalidatePath('/admin', 'layout')
}
