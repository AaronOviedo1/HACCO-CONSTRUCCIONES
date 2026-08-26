'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { eliminarServicio } from '@/app/admin/servicios/acciones'
import type { VServicio } from '@/types/database'

/**
 * Borrar de verdad, para lo que se capturó por error.
 *
 * Lo que ya se atendió y no se hizo se cancela, que deja rastro; esto es para
 * el renglón duplicado. La confirmación va aquí y no en un `confirm()` del
 * navegador: si alguien marca «no crear más diálogos», los borrados dejan de
 * funcionar sin decir nada.
 */
export function BotonEliminarServicio({ servicio }: { servicio: VServicio }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const borrar = () =>
    iniciar(async () => {
      setError(null)
      const salida = await eliminarServicio(servicio.servicio_id)
      if (!salida.ok) {
        setError(salida.error)
        setConfirmando(false)
        return
      }
      router.push('/admin/servicios')
      router.refresh()
    })

  return (
    <div className="rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-5 shadow-tarjeta">
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm text-tinta-600">
            ¿Eliminar {servicio.folio ?? 'este servicio'}? No queda rastro de él.
          </p>
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            No, conservar
          </button>
          <button
            type="button"
            onClick={borrar}
            disabled={pendiente}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={15} />
            {pendiente ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          <Trash2 size={15} />
          Eliminar el servicio
        </button>
      )}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
