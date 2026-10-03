'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Filtros que viven en la URL: así sobreviven a recargar, se pueden compartir
 * y el servidor los lee al pintar la lista. `fijar` cambia uno y deja los
 * demás como estaban (vacío lo quita); `limpiar` los quita todos.
 */
export function useFiltroUrl() {
  const router = useRouter()
  const params = useSearchParams()
  const [, iniciar] = useTransition()

  const fijar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(params.toString())
    if (valor) nuevos.set(clave, valor)
    else nuevos.delete(clave)
    iniciar(() => router.replace(`?${nuevos.toString()}`, { scroll: false }))
  }

  const limpiar = () => iniciar(() => router.replace('?', { scroll: false }))

  return { params, fijar, limpiar }
}
