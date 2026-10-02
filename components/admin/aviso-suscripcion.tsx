import Link from 'next/link'
import { AlertTriangle, CreditCard } from 'lucide-react'
import { fechaLarga } from '@/lib/format'
import { conImpago } from '@/lib/stripe/estado'
import { stripeConfigurado } from '@/lib/stripe/cliente'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { BloqueoApp, RolUsuario } from '@/types/database'

/**
 * La franja que avisa a Dirección de la mensualidad.
 *
 * Roja en todo el panel cuando el cobro del 12 no entró, con la fecha en que
 * la app se pondría en pausa; discreta y sólo en el tablero mientras no haya
 * tarjeta registrada. A los demás roles no les sale nada: la suscripción no
 * es asunto suyo, y la consulta ni se hace.
 */
export async function AvisoSuscripcion({
  rol,
  modo,
}: {
  rol: RolUsuario
  /**
   * `impago` va en el layout y sale en todo el panel; `invitacion` va sólo en
   * el tablero. Cada sitio pide el suyo para que en el tablero no salgan dos.
   */
  modo: 'impago' | 'invitacion'
}) {
  if (rol !== 'admin' || !stripeConfigurado()) return null

  const supabase = await crearClienteServidor()
  const [{ data: fila }, { data: bloqueo }] = await Promise.all([
    supabase.from('suscripcion_app').select('estado, impago_desde').eq('id', true).maybeSingle(),
    supabase.rpc('bloqueo_app'),
  ])
  if (!fila) return null
  const candado: BloqueoApp | undefined = bloqueo?.[0]

  if (modo === 'impago' && conImpago(fila.estado)) {
    const fecha = candado?.bloquea_el ? fechaLarga(candado.bloquea_el) : null
    return (
      <Link
        href="/admin/suscripcion"
        className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 transition hover:bg-red-100 lg:rounded-xl"
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">No se pudo cobrar la mensualidad de la app.</strong>{' '}
          {candado?.bloqueada
            ? 'La app está en pausa hasta que se pague.'
            : fecha
              ? `Si el ${fecha} sigue sin pagarse, la app se pone en pausa.`
              : 'Revisa la tarjeta antes de que la app se ponga en pausa.'}{' '}
          <span className="underline">Ver cómo pagar</span>
        </span>
      </Link>
    )
  }

  if (modo === 'invitacion' && fila.estado === 'sin_tarjeta') {
    return (
      <Link
        href="/admin/suscripcion"
        className="mb-4 flex items-start gap-3 rounded-2xl border border-haaco-200 bg-haaco-50 px-4 py-3 text-sm text-haaco-900 transition hover:bg-haaco-100 lg:rounded-xl"
      >
        <CreditCard size={18} className="mt-0.5 shrink-0 text-haaco-700" aria-hidden />
        <span>
          Registra la tarjeta y la mensualidad de la app se cobra sola cada día 12.{' '}
          <span className="underline">Registrar tarjeta</span>
        </span>
      </Link>
    )
  }

  return null
}
