'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { X } from 'lucide-react'
import { BuscadorTabla } from '@/components/buscador'
import { CATEGORIA_GASTO, METODO_PAGO } from '@/lib/finanzas'

/* En el teléfono los filtros se acomodan en rejilla; en escritorio, en fila. */
const CLASE =
  'w-full min-h-11 rounded-[12px] border-[0.5px] border-tinta-300 bg-white px-3 text-tinta-700 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200 lg:min-h-0 lg:w-auto lg:rounded-lg lg:py-2 lg:text-sm'

export function FiltrosGastos({
  obras,
  mes,
}: {
  obras: { id: string; nombre: string; ot_numero: string | null }[]
  mes: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [, iniciar] = useTransition()

  const fijar = (clave: string, valor: string) => {
    const nuevos = new URLSearchParams(params.toString())
    if (valor) nuevos.set(clave, valor)
    else nuevos.delete(clave)
    iniciar(() => router.replace(`?${nuevos.toString()}`, { scroll: false }))
  }

  const hayFiltros = ['obra', 'categoria', 'metodo', 'q'].some((k) => params.get(k))

  return (
    <div className="mb-3.5 grid grid-cols-2 gap-2 lg:mb-4 lg:flex lg:flex-wrap lg:items-center">
      <div className="col-span-2 lg:contents">
        <BuscadorTabla marcador="Descripción, folio, proveedor…" />
      </div>

      <input
        type="month"
        className={CLASE}
        value={mes}
        onChange={(e) => fijar('mes', e.target.value)}
        aria-label="Mes"
      />

      <select className={`${CLASE} lg:max-w-52`} value={params.get('obra') ?? ''} onChange={(e) => fijar('obra', e.target.value)}>
        <option value="">Todas las obras</option>
        <option value="general">Sólo gasto general</option>
        {obras.map((o) => (
          <option key={o.id} value={o.id}>
            {o.ot_numero} · {o.nombre}
          </option>
        ))}
      </select>

      <select
        className={CLASE}
        value={params.get('categoria') ?? ''}
        onChange={(e) => fijar('categoria', e.target.value)}
      >
        <option value="">Todas las categorías</option>
        {Object.entries(CATEGORIA_GASTO).map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>

      <select
        className={CLASE}
        value={params.get('metodo') ?? ''}
        onChange={(e) => fijar('metodo', e.target.value)}
      >
        <option value="">Todos los métodos</option>
        {Object.entries(METODO_PAGO).map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>

      {hayFiltros && (
        <button
          type="button"
          onClick={() => iniciar(() => router.replace(`?mes=${mes}`, { scroll: false }))}
          className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-tinta-500 transition hover:bg-tinta-100 lg:col-span-1 lg:min-h-0 lg:py-2"
        >
          <X size={14} />
          Limpiar
        </button>
      )}
    </div>
  )
}
