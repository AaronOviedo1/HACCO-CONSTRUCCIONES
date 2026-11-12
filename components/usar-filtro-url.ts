'use client'

import { useTransicionFiltro } from '@/components/zona-navegable'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Filtros que viven en la URL: así sobreviven a recargar, se pueden compartir
 * y el servidor los lee al pintar la lista. `fijar` cambia uno y deja los
 * demás como estaban (vacío lo quita); `limpiar` los quita todos.
 */
export function useFiltroUrl() {
  const router = useRouter()
  const params = useSearchParams()
  const [, iniciar] = useTransicionFiltro()

  const fijar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(params.toString())
    if (valor) nuevos.set(clave, valor)
    else nuevos.delete(clave)
    iniciar(() => router.replace(`?${nuevos.toString()}`, { scroll: false }))
  }

  const limpiar = () => iniciar(() => router.replace('?', { scroll: false }))

  return { params, fijar, limpiar }
}
