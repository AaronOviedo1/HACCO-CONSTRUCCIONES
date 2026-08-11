'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { ArrowRight, Check, Loader2, X } from 'lucide-react'
import { MensajeError } from '@/components/formulario'
import { fecha as formatoFecha, pesos } from '@/lib/format'
import { ORIGEN_PRECIO } from '@/lib/precios'
import { aceptarPropuesta, rechazarPropuesta } from '@/app/admin/precios/acciones'
import type { PropuestaPendiente } from '@/app/admin/precios/datos'
import type { OrigenPrecio } from '@/types/database'

/**
 * Los precios que el sistema dedujo solo y esperan visto bueno.
 *
 * Aquí no llega lo que ella tecleó por teléfono —eso entra directo—: sólo lo
 * que salió de leer una factura. Aceptar cambia el catálogo; rechazar deja el
 * catálogo como estaba y además marca ese precio como revisado, para que no
 * vuelva a salir vencido mañana.
 */
export function BandejaPropuestas({ propuestas }: { propuestas: PropuestaPendiente[] }) {
  if (propuestas.length === 0) {
    return (
      <p className="text-sm text-tinta-500">
        Nada por revisar. Aquí caen los precios que salen de las facturas cuando difieren de
        lo que dice el catálogo.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {propuestas.map((p) => (
        <FilaPropuesta key={p.id} propuesta={p} />
      ))}
    </div>
  )
}

function FilaPropuesta({ propuesta }: { propuesta: PropuestaPendiente }) {
  const [error, setError] = useState<string | null>(null)
  const [resuelta, setResuelta] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const resolver = (accion: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null)
    iniciar(async () => {
      const r = await accion()
      if (!r.ok) return setError(r.error ?? 'No se pudo guardar.')
      setResuelta(true)
    })
  }

  if (resuelta) return null

  const sube = (propuesta.variacion_pct ?? 0) > 0

  return (
    <div className="rounded-[14px] border-[0.5px] border-tinta-200 bg-white px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-tinta-800">{propuesta.producto}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight text-tinta-400">
            <span className="tabular-nums">
              {propuesta.neto_actual != null ? pesos(propuesta.neto_actual) : 'sin precio'}
            </span>
            <ArrowRight size={11} className="shrink-0" />
            <span className="font-semibold tabular-nums text-tinta-700">
              {pesos(propuesta.neto_nuevo)}
            </span>
            {propuesta.unidad && <span>por {propuesta.unidad}</span>}
            {propuesta.variacion_pct != null && (
              <span className={`font-semibold tabular-nums ${sube ? 'text-red-600' : 'text-haaco-700'}`}>
                {sube ? '+' : ''}{propuesta.variacion_pct}%
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-tinta-400">
            {/* De dónde salió: sin esto, un disparate no se puede cachar. */}
            {propuesta.gasto_id ? (
              <Link
                href={`/admin/gastos?q=${encodeURIComponent(propuesta.folio ?? propuesta.producto)}`}
                className="underline-offset-2 hover:text-haaco-700 hover:underline"
              >
                {propuesta.folio ? `factura ${propuesta.folio}` : ORIGEN_PRECIO[propuesta.origen as OrigenPrecio]}
              </Link>
            ) : (
              ORIGEN_PRECIO[propuesta.origen as OrigenPrecio]
            )}
            {propuesta.proveedor && ` · ${propuesta.proveedor}`}
            {` · ${formatoFecha(propuesta.fecha)}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => resolver(() => rechazarPropuesta(propuesta.id))}
            disabled={pendiente}
            className="flex h-11 items-center gap-1.5 rounded-lg border border-tinta-200 px-3 text-sm font-medium text-tinta-600 transition hover:bg-tinta-50 disabled:opacity-40 lg:h-9"
          >
            <X size={15} />
            Dejar como está
          </button>
          <button
            type="button"
            onClick={() => resolver(() => aceptarPropuesta(propuesta.id))}
            disabled={pendiente}
            className="flex h-11 items-center gap-1.5 rounded-lg bg-haaco-700 px-3 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:opacity-40 lg:h-9"
          >
            {pendiente ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Actualizar
          </button>
        </div>
      </div>

      <div className="mt-2 empty:mt-0"><MensajeError mensaje={error} /></div>
    </div>
  )
}
