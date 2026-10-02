import 'server-only'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { META_APP } from '@/lib/stripe/cliente'
import type { Database, EstadoSuscripcionApp } from '@/types/database'

export type ResultadoSincronizacion = 'aplicado' | 'repetido' | 'ajeno'

/** Lo que identifica al evento de Stripe que provocó la sincronización. */
export type EventoStripe = { id: string; tipo: string; creado: number }

const ESTADOS: readonly EstadoSuscripcionApp[] = [
  'sin_tarjeta', 'incomplete', 'incomplete_expired', 'trialing',
  'active', 'past_due', 'canceled', 'unpaid', 'paused',
]

/** Un estado que Stripe se invente mañana no tumba el webhook. */
function estadoLocal(estado: string): EstadoSuscripcionApp {
  return (ESTADOS as readonly string[]).includes(estado)
    ? (estado as EstadoSuscripcionApp)
    : 'incomplete'
}

const iso = (segundos: number | null | undefined) =>
  segundos ? new Date(segundos * 1000).toISOString() : null

/**
 * Lleva a la fila local lo que Stripe sabe de la suscripción.
 *
 * Es la única función que escribe `suscripcion_app`, y lo hace releyendo la
 * suscripción completa de Stripe en vez de confiar en el objeto que viene en
 * el evento: los eventos llegan en el orden que les da la gana —un
 * `subscription.updated` antes del `created`— y así da igual cuál llegue
 * primero o cuál se repita. La usan el webhook, la confirmación del checkout
 * y el botón de «actualizar».
 *
 * Devuelve `'ajeno'` si la suscripción no es de esta app (otra suscripción de
 * la misma cuenta de Stripe, un `stripe trigger` de prueba): la fila única no
 * se deja tocar por lo que no lleve la marca.
 */
export async function sincronizarSuscripcion(
  stripe: Stripe,
  admin: SupabaseClient<Database>,
  subscriptionId: string,
  evento?: EventoStripe,
): Promise<ResultadoSincronizacion> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: [
      'default_payment_method',
      'customer.invoice_settings.default_payment_method',
      'latest_invoice',
    ],
  })

  if (sub.metadata?.app !== META_APP) return 'ajeno'

  const cliente = typeof sub.customer === 'string' ? null : sub.customer
  const clienteVivo = cliente && !cliente.deleted ? cliente : null

  // La tarjeta de la suscripción o, si no tiene propia, la del cliente: es la
  // que Stripe va a intentar el 12.
  const metodo =
    objeto(sub.default_payment_method) ??
    objeto(clienteVivo?.invoice_settings?.default_payment_method ?? null)
  const tarjeta = metodo?.card ?? null

  const estado = estadoLocal(sub.status)
  const item = sub.items.data[0]
  const terminada =
    estado === 'canceled' || estado === 'incomplete_expired' || sub.cancel_at_period_end

  const datos: Record<string, unknown> = {
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    estado,
    periodo_actual_fin: iso(item?.current_period_end),
    proximo_cobro: terminada ? null : iso(item?.current_period_end),
    cancela_al_fin_periodo: sub.cancel_at_period_end,
    monto_centavos: item?.price.unit_amount ?? null,
    moneda: item?.price.currency ?? null,
    tarjeta_marca: tarjeta?.brand ?? null,
    tarjeta_ultimos4: tarjeta?.last4 ?? null,
  }

  const factura = objeto(sub.latest_invoice)
  if (factura) {
    if (factura.status === 'paid') {
      // La factura de $0 con que nace la suscripción no cuenta como pago.
      if (factura.amount_paid > 0) {
        datos.ultimo_pago_en = iso(factura.status_transitions.paid_at)
      }
      datos.impago_desde = null
      datos.factura_pendiente_url = null
    } else if (factura.status === 'open') {
      if (factura.attempt_count > 0) datos.ultimo_fallo_en = new Date().toISOString()
      if (estado === 'past_due' || estado === 'unpaid') {
        datos.impago_desde = iso(factura.created)
        datos.factura_pendiente_url = factura.hosted_invoice_url ?? null
      }
    }
  }

  const { data, error } = await admin.rpc('registrar_suscripcion_app', {
    p_datos: datos,
    p_evento_id: evento?.id ?? null,
    p_tipo: evento?.tipo ?? null,
    p_creado: evento ? iso(evento.creado) : null,
  })
  if (error) throw new Error(`No se pudo guardar la suscripción: ${error.message}`)
  if (!data) return 'repetido'

  // Los correos de Stripe —el recibo, el aviso de que la tarjeta falló— salen
  // en el idioma del cliente. Se fija una vez y no se vuelve a tocar.
  if (clienteVivo && !clienteVivo.preferred_locales?.length) {
    await stripe.customers
      .update(clienteVivo.id, { preferred_locales: ['es-419'] })
      .catch((e) => console.error('[stripe] no se pudo fijar el idioma del cliente', e))
  }

  return 'aplicado'
}

/** Un campo expandible de Stripe: el objeto si vino expandido, null si es sólo el id. */
function objeto<T extends { id: string }>(valor: string | T | null | undefined): T | null {
  return valor && typeof valor !== 'string' ? valor : null
}
