import type Stripe from 'stripe'
import { crearStripe, META_APP } from '@/lib/stripe/cliente'
import { sincronizarSuscripcion } from '@/lib/stripe/sincronizar'
import { crearClienteAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Lo que Stripe cuenta de la suscripción: el cobro del 12 que entró o no
 * entró, la tarjeta que cambiaron desde el portal, la suscripción que se
 * canceló.
 *
 * Entra sin sesión, así que la puerta es la firma de Stripe sobre el cuerpo
 * crudo (`peticion.text()`, nunca `json()` antes, o la firma deja de cuadrar)
 * y la excepción de `proxy.ts` para esta ruta. Cada evento se reduce a lo
 * mismo: «vuelve a leer esta suscripción de Stripe y guárdala», así que da
 * igual en qué orden lleguen o cuántas veces se repitan.
 *
 * Responde 200 a lo que no le toca y a lo repetido; 500 sólo cuando conviene
 * que Stripe reintente (Supabase o Stripe caídos). Lo que no es 2xx se
 * reintenta hasta tres días.
 */
export async function POST(peticion: Request) {
  const stripe = crearStripe()
  const secreto = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secreto) {
    return Response.json(
      { error: 'Faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET en el entorno.' },
      { status: 501 },
    )
  }
  const admin = crearClienteAdmin()
  if (!admin) {
    return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 501 })
  }

  const firma = peticion.headers.get('stripe-signature') ?? ''
  const cuerpo = await peticion.text()

  let evento: Stripe.Event
  try {
    evento = stripe.webhooks.constructEvent(cuerpo, firma, secreto)
  } catch (e) {
    console.warn('[stripe webhook] firma inválida', (e as Error).message)
    return Response.json({ error: 'Firma inválida.' }, { status: 400 })
  }

  try {
    const subscriptionId = await suscripcionDelEvento(stripe, evento)
    if (!subscriptionId) return Response.json({ ok: true, ignorado: evento.type })

    const resultado = await sincronizarSuscripcion(stripe, admin, subscriptionId, {
      id: evento.id,
      tipo: evento.type,
      creado: evento.created,
    })
    return Response.json({ ok: true, resultado })
  } catch (e) {
    console.error('[stripe webhook] no se pudo procesar', evento.type, e)
    return Response.json({ error: 'No se pudo sincronizar.' }, { status: 500 })
  }
}

/**
 * De qué suscripción habla el evento. Null si de ninguna que nos importe.
 *
 * La factura trae el id en dos lugares según la versión de la API con que se
 * mandó el evento: en `parent.subscription_details` (las nuevas) o en
 * `subscription` a secas (las viejas). Se toleran las dos: lo único que
 * depende de la forma del evento es sacar el id, el resto se relee.
 */
async function suscripcionDelEvento(stripe: Stripe, evento: Stripe.Event): Promise<string | null> {
  const objeto = evento.data.object

  if (evento.type === 'checkout.session.completed') {
    const sesion = objeto as Stripe.Checkout.Session
    if (sesion.mode !== 'subscription' || !sesion.subscription) return null
    return id(sesion.subscription)
  }

  if (evento.type.startsWith('customer.subscription.')) {
    return (objeto as Stripe.Subscription).id
  }

  if (evento.type.startsWith('invoice.')) {
    const factura = objeto as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }
    const dentro = factura.parent?.subscription_details?.subscription ?? factura.subscription
    return dentro ? id(dentro) : null
  }

  // El cambio de tarjeta desde el portal llega como cambio del cliente, sin
  // suscripción a la vista: se busca la suya.
  if (evento.type === 'customer.updated' || evento.type === 'payment_method.attached') {
    const cliente =
      evento.type === 'customer.updated'
        ? (objeto as Stripe.Customer).id
        : (objeto as Stripe.PaymentMethod).customer
    if (!cliente) return null
    const { data } = await stripe.subscriptions.list({
      customer: id(cliente),
      status: 'all',
      limit: 10,
    })
    const nuestras = data.filter((s) => s.metadata?.app === META_APP)
    const viva = nuestras.find((s) => s.status !== 'canceled' && s.status !== 'incomplete_expired')
    return (viva ?? nuestras[0])?.id ?? null
  }

  return null
}

function id(valor: string | { id: string }): string {
  return typeof valor === 'string' ? valor : valor.id
}
