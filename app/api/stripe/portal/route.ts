import { requerirRol } from '@/lib/auth'
import { crearStripe, SIN_STRIPE } from '@/lib/stripe/cliente'
import { crearClienteServidor } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * El portal del cliente de Stripe: cambiar la tarjeta, ver los recibos.
 *
 * Es una página de Stripe, no nuestra, así que se abre en otra pestaña; en el
 * iPhone con la app instalada sale como hoja de navegador y al cerrarla se
 * vuelve a donde se estaba. Cada visita crea una sesión nueva del portal: el
 * enlace caduca solo y no hay nada que guardar.
 */
export async function GET(peticion: Request) {
  await requerirRol(['admin'])

  const stripe = crearStripe()
  if (!stripe) return Response.json({ error: SIN_STRIPE }, { status: 501 })

  const supabase = await crearClienteServidor()
  const { data: fila } = await supabase
    .from('suscripcion_app')
    .select('stripe_customer_id')
    .eq('id', true)
    .maybeSingle()

  if (!fila?.stripe_customer_id) {
    return Response.json(
      { error: 'Todavía no hay tarjeta registrada: el portal se abre después del primer registro.' },
      { status: 409 },
    )
  }

  const sesion = await stripe.billingPortal.sessions.create({
    customer: fila.stripe_customer_id,
    return_url: new URL('/admin/suscripcion', peticion.url).toString(),
    locale: 'es-419',
  })

  return Response.redirect(sesion.url, 303)
}
