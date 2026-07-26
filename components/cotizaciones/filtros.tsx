'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { X } from 'lucide-react'
import { BuscadorTabla } from '@/components/buscador'

const ESTATUS = [
  { valor: '', texto: 'Todos los estatus' },
  { valor: 'borrador', texto: 'Borrador' },
  { valor: 'enviada', texto: 'Enviada' },
  { valor: 'aprobada', texto: 'Aprobada' },
  { valor: 'rechazada', texto: 'Rechazada' },
  { valor: 'terminada', texto: 'Terminada' },
]

const TIPOS = [
  { valor: '', texto: 'Todos los tipos' },
  { valor: 'pintura', texto: 'Pintura' },
  { valor: 'herreria', texto: 'Herrería' },
  { valor: 'mixta', texto: 'Mixta' },
]

const CLASE =
  'rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm text-tinta-700 outline-none transition focus:border-haaco-500 focus:ring-2 focus:ring-haaco-100'

export function FiltrosCotizaciones({
  clientes,
}: {
  clientes: { id: string; nombre: string }[]
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

  const hayFiltros = ['estatus', 'tipo', 'cliente', 'mes', 'q'].some((k) => params.get(k))

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <BuscadorTabla marcador="Folio, cliente u obra…" />

      <select
        className={CLASE}
        value={params.get('estatus') ?? ''}
        onChange={(e) => fijar('estatus', e.target.value)}
      >
        {ESTATUS.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>

      <select
        className={CLASE}
        value={params.get('tipo') ?? ''}
        onChange={(e) => fijar('tipo', e.target.value)}
      >
        {TIPOS.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>

      <select
        className={`${CLASE} max-w-48`}
        value={params.get('cliente') ?? ''}
        onChange={(e) => fijar('cliente', e.target.value)}
      >
        <option value="">Todos los clientes</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      <input
        type="month"
        className={CLASE}
        value={params.get('mes') ?? ''}
        onChange={(e) => fijar('mes', e.target.value)}
        aria-label="Mes"
      />

      {hayFiltros && (
        <button
          type="button"
          onClick={() => iniciar(() => router.replace('?', { scroll: false }))}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-tinta-500 transition hover:bg-tinta-100"
        >
          <X size={14} />
          Limpiar
        </button>
      )}
    </div>
  )
}
