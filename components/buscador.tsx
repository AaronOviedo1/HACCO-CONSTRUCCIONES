'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'

/**
 * Buscador que escribe en la URL: así el resultado se puede compartir,
 * recargar y regresar con el botón atrás sin perder el filtro.
 */
export function BuscadorTabla({
  marcador = 'Buscar…',
  parametro = 'q',
}: {
  marcador?: string
  parametro?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [valor, setValor] = useState(params.get(parametro) ?? '')
  const [, iniciarTransicion] = useTransition()

  useEffect(() => {
    const t = setTimeout(() => {
      const nuevos = new URLSearchParams(params.toString())
      if (valor.trim()) nuevos.set(parametro, valor.trim())
      else nuevos.delete(parametro)
      if (nuevos.toString() === params.toString()) return
      iniciarTransicion(() => router.replace(`?${nuevos.toString()}`, { scroll: false }))
    }, 250)
    return () => clearTimeout(t)
  }, [valor, params, parametro, router])

  return (
    <div className="relative max-w-sm">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-400" />
      <input
        type="search"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder={marcador}
        className="w-full rounded-lg border border-tinta-300 bg-white py-2 pl-9 pr-9 text-sm text-tinta-900 outline-none transition focus:border-haaco-500 focus:ring-2 focus:ring-haaco-100"
      />
      {valor && (
        <button
          type="button"
          onClick={() => setValor('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-tinta-400 hover:bg-tinta-100"
          aria-label="Limpiar"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
