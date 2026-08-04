'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { X } from 'lucide-react'
import { BuscadorTabla } from '@/components/buscador'
import { FiltroRango } from '@/components/filtro-fechas'
import { SelectorMovil } from '@/components/movil/selector-movil'

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

      {/* Teléfono: estatus, fecha y limpiar caben en un solo renglón. En
          escritorio `lg:contents` deshace el envoltorio y todo vuelve a la
          fila de siempre, con los tres desplegables. */}
      <div className="flex items-center gap-2 lg:contents">
        <SelectorMovil
          etiqueta="Estatus"
          titulo="Filtrar cotizaciones"
          activa={estatusActual}
          className="min-w-0 flex-1"
          onElegir={(v) => fijar('estatus', v)}
          opciones={ESTATUS.map((o) => ({
            clave: o.valor,
            titulo: o.valor === '' ? 'Todas' : o.texto,
          }))}
        />

        <FiltroRango titulo="Fecha de la cotización" />

        {hayFiltros && (
          <button
            type="button"
            onClick={() => iniciar(() => router.replace('?', { scroll: false }))}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-sm font-medium text-tinta-500 transition hover:bg-tinta-100 lg:min-h-0 lg:rounded-lg lg:py-2"
          >
            <X size={14} />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        )}
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

    </div>
  )
}
