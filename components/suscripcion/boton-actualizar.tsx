'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { MensajeError } from '@/components/formulario'
import { resincronizar } from '@/app/admin/suscripcion/acciones'
import type { EstadoAccion } from '@/lib/acciones'

function Boton({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl border border-tinta-300 bg-white px-4 py-2.5 text-[15px] font-semibold text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800 disabled:cursor-not-allowed disabled:opacity-60 lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium"
    >
      {pending ? 'Actualizando…' : children}
    </button>
  )
}

/**
 * «Ya pagué, actualizar»: vuelve a leer la suscripción de Stripe. Para cuando
 * se pagó desde el enlace de la factura y el webhook todavía no llega, o para
 * la duda de si de verdad entró.
 */
export function BotonActualizar({ children = 'Actualizar' }: { children?: string }) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(
    async () => resincronizar(),
    {},
  )
  return (
    <form action={accion} className="space-y-2">
      <Boton>{children}</Boton>
      <MensajeError mensaje={estado.error} />
    </form>
  )
}
