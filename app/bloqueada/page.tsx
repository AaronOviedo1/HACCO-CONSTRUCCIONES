import type { Viewport } from 'next'
import { Membrete } from '@/components/marca'
import { BotonSalir } from '@/components/movil/menu'
import { cerrarSesion } from '@/app/login/acciones'
import { requerirPerfil } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const viewport: Viewport = { themeColor: '#ffffff' }

/**
 * Lo que ve la cuadrilla y la oficina cuando la mensualidad de la app lleva
 * una semana sin pagarse. Fuera de /admin y /obra a propósito: aquí no hay
 * menú al que ir. Dirección no llega: a ella el proxy la manda a la pantalla
 * de suscripción, que es donde se arregla.
 */
export default async function PaginaBloqueada() {
  await requerirPerfil()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center">
          <Membrete />
        </div>
        <h1 className="mt-8 text-2xl font-bold -tracking-[0.5px] text-tinta-900">
          La app está en pausa
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-tinta-600">
          Hay un pago de la aplicación pendiente. Avísale a Dirección: en cuanto se pague, todo
          vuelve a abrirse solo.
        </p>
        <div className="mt-8">
          <BotonSalir cerrarSesion={cerrarSesion} />
        </div>
      </div>
    </main>
  )
}
