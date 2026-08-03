'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { X } from 'lucide-react'
import { BuscadorTabla } from '@/components/buscador'
import { FiltroRango } from '@/components/filtro-fechas'

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
  'rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm text-tinta-700 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200'

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

  const hayFiltros = ['estatus', 'tipo', 'cliente', 'desde', 'hasta', 'q'].some((k) => params.get(k))
  const estatusActual = params.get('estatus') ?? ''

  return (
    <div className="mb-3.5 flex flex-col gap-2.5 lg:mb-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-2">
      <BuscadorTabla marcador="Folio, cliente u obra…" />

      {/* Teléfono: el estatus se toca, no se despliega; y se ven todos los
          botones a la vez, sin tener que correr la fila de lado. */}
      <div className="flex flex-wrap gap-1.5 lg:hidden">
        {ESTATUS.map((o) => (
          <button
            key={o.valor}
            type="button"
            onClick={() => fijar('estatus', o.valor)}
            className={`min-h-9 whitespace-nowrap rounded-full border-[0.5px] px-3.5 text-[13.5px] font-medium transition ${
              estatusActual === o.valor
                ? 'border-haaco-700 bg-haaco-700 text-white'
                : 'border-tinta-200 bg-white text-tinta-600'
            }`}
          >
            {o.valor === '' ? 'Todas' : o.texto}
          </button>
        ))}
      </div>

      <select
        className={`${CLASE} hidden lg:block`}
        value={estatusActual}
        onChange={(e) => fijar('estatus', e.target.value)}
      >
        {ESTATUS.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>

      <select
        className={`${CLASE} hidden lg:block`}
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
        className={`${CLASE} hidden max-w-48 lg:block`}
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

      <FiltroRango titulo="Fecha de la cotización" />

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
