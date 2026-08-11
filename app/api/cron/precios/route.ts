import { crearClienteAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * La ronda de precios de la mañana.
 *
 * No sale a buscar precios a ningún lado —los proveedores de acero no los
 * publican—: lo que hace es mirar qué materiales se cotizan seguido y llevan
 * demasiado sin que nadie sepa a cómo están, y dejar esa lista corta hecha para
 * cuando ella llegue. En vez de llamar por cuarenta, llama por doce.
 *
 * Corre sin sesión, así que no hay RLS que lo cubra: la puerta es el
 * CRON_SECRET y la lógica vive en una RPC `security definer` estrecha.
 *
 * Ojo con `proxy.ts`: si no dejara pasar /api/cron, esta petición sin cookie se
 * iría redirigida al login, respondería 307 y Vercel la pintaría verde. La
 * excepción está puesta allá.
 */
export async function GET(peticion: Request) {
  // Sin la variable no se puede distinguir a Vercel de cualquiera: no se corre.
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'Falta CRON_SECRET en el entorno.' }, { status: 501 })
  }
  if (peticion.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const supabase = crearClienteAdmin()
  if (!supabase) {
    return Response.json(
      { error: 'Falta SUPABASE_SERVICE_ROLE_KEY: sin ella la ronda no puede correr sola.' },
      { status: 501 },
    )
  }

  const { data, error } = await supabase.rpc('ronda_precios_del_dia', { p_fecha: null })
  if (error) {
    console.error('[cron precios] no se pudo armar la ronda', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, precios_por_confirmar: data ?? 0 })
}
