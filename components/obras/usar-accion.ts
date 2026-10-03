'use client'

import type { TransitionStartFunction } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Cómo corren las acciones de un panel de obra: dentro de la transición del
 * panel —para que sus botones se apaguen mientras tanto—, limpiando el error
 * anterior y refrescando la pantalla si salió bien.
 *
 * La transición y el error se quedan en el panel porque también los usa para
 * pintar; aquí sólo vive la secuencia, que era la misma en contratos,
 * cronograma y cierre.
 */
export function useAccion(iniciar: TransitionStartFunction, setError: (error: string | null) => void) {
  const router = useRouter()

  return (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error ?? 'No se pudo completar la operación.')
      router.refresh()
    })
}
