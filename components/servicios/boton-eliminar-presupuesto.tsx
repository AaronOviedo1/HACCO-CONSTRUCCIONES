'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { eliminarPresupuesto } from '@/app/admin/servicios/acciones'
import type { VServicio } from '@/types/database'

/**
 * Tirar el presupuesto y volver a empezar.
 *
 * Corregirlo es para los precios; esto es para el presupuesto que no debió
 * existir. Antes no había manera: el editor exige al menos una partida, así
 * que lo único que se podía hacer era dejar un renglón de mentiras.
 *
 * La confirmación va aquí dentro y no en un `confirm()` del navegador: al
 * tercer aviso seguido los navegadores ofrecen «impedir que esta página cree
 * diálogos», y si alguien acepta, los borrados dejan de funcionar en silencio.
 */
export function BotonEliminarPresupuesto({ servicio }: { servicio: VServicio }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const borrar = () =>
    iniciar(async () => {
      setError(null)
      const salida = await eliminarPresupuesto(servicio.servicio_id)
      if (!salida.ok) {
        setError(salida.error)
        setConfirmando(false)
        return
      }
      setConfirmando(false)
      router.refresh()
    })

  if (confirmando) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-tinta-600">
          ¿Borrar el presupuesto? El servicio regresa a diagnóstico y las partidas se pierden.
        </p>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="inline-flex min-h-11 items-center rounded-[14px] border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 lg:min-h-0 lg:rounded-lg lg:py-2"
        >
          No, conservar
        </button>
        <button
          type="button"
          onClick={borrar}
          disabled={pendiente}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[14px] bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50 lg:min-h-0 lg:rounded-lg lg:py-2"
        >
          <Trash2 size={15} />
          {pendiente ? 'Borrando…' : 'Sí, borrar'}
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[14px] px-3 text-sm font-medium text-red-700 transition hover:bg-red-50 lg:min-h-0 lg:rounded-lg lg:py-2"
      >
        <Trash2 size={15} />
        Eliminar presupuesto
      </button>
      {error && (
        <p role="alert" className="mt-2 w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </>
  )
}
