'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ChevronLeft, Pause, Play, Truck } from 'lucide-react'
import { Etiqueta } from '@/components/ui'
import { fecha, fechaHora, pesos } from '@/lib/format'
import { ESTATUS_OBRA } from '@/lib/obras'
import { actualizarObra, entregarObra } from '@/app/admin/obras/acciones'
import type { EstatusObra, Obra, VCobranza, VObraConcentrado } from '@/types/database'

export function EncabezadoObra({
  concentrado,
  obra,
  cobranza,
}: {
  concentrado: VObraConcentrado
  obra: Obra
  cobranza: VCobranza | null
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cerrada = concentrado.estatus === 'cerrada'

  const cambiar = (estatus: EstatusObra) =>
    iniciar(async () => {
      setError(null)
      const r = await actualizarObra(obra.id, { estatus })
      if (!r.ok) return setError(r.error)
      router.refresh()
    })

  const entregar = () =>
    iniciar(async () => {
      setError(null)
      const r = await entregarObra(obra.id, new Date().toISOString().slice(0, 10))
      if (!r.ok) return setError(r.error)
      router.refresh()
    })

  return (
    <header className="mb-5">
      <Link
        href="/admin/obras"
        className="mb-3 inline-flex items-center gap-1 text-sm text-tinta-500 transition hover:text-tinta-800"
      >
        <ChevronLeft size={15} />
        Obras
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-tinta-900">
              {concentrado.nombre}
            </h1>
            <Etiqueta tono={ESTATUS_OBRA[concentrado.estatus].tono}>
              {ESTATUS_OBRA[concentrado.estatus].texto}
            </Etiqueta>
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-tinta-500">
            <span className="font-mono text-xs">OT {concentrado.ot_numero}</span>
            <Link
              href={`/admin/cotizaciones/${concentrado.cotizacion_id}`}
              className="font-mono text-xs text-haaco-700 hover:underline"
            >
              {concentrado.cotizacion_folio}
            </Link>
            <span>{concentrado.cliente}</span>
            {concentrado.domicilio && <span className="truncate">{concentrado.domicilio}</span>}
          </p>

          <p className="mt-1 text-xs text-tinta-400">
            Apertura {fecha(concentrado.fecha_apertura)} · Última actualización{' '}
            {fechaHora(concentrado.fecha_ultima_actualizacion)}
            {concentrado.fecha_cierre
              ? ` · Cerrada ${fecha(concentrado.fecha_cierre)}`
              : concentrado.fecha_estimada_entrega
                ? ` · Entrega estimada ${fecha(concentrado.fecha_estimada_entrega)}`
                : ''}
          </p>
        </div>

        {!cerrada && (
          <div className="flex flex-wrap items-center gap-2">
            {concentrado.estatus === 'pausada' ? (
              <button
                type="button"
                onClick={() => cambiar('en_obra')}
                disabled={pendiente}
                className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:opacity-50"
              >
                <Play size={15} />
                Reanudar
              </button>
            ) : concentrado.estatus === 'agendada' ? (
              <button
                type="button"
                onClick={() => cambiar('en_obra')}
                disabled={pendiente}
                className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:opacity-50"
              >
                <Play size={15} />
                Arrancar obra
              </button>
            ) : (
              <button
                type="button"
                onClick={() => cambiar('pausada')}
                disabled={pendiente}
                className="inline-flex items-center gap-2 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50"
              >
                <Pause size={15} />
                Pausar
              </button>
            )}

            {concentrado.estatus === 'en_obra' && (
              <button
                type="button"
                onClick={entregar}
                disabled={pendiente}
                className="inline-flex items-center gap-2 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50"
              >
                <Truck size={15} />
                Entregar
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {/* Barra de avance y saldo del cliente */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-tinta-200 bg-white px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-tinta-500">Avance de obra</span>
            <span className="font-semibold tabular-nums text-tinta-900">
              {Number(concentrado.avance_pct)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-tinta-100">
            <div
              className="h-full rounded-full bg-haaco-500 transition-[width]"
              style={{ width: `${Math.min(100, Number(concentrado.avance_pct))}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-tinta-200 bg-white px-4 py-3">
          <p className="text-xs text-tinta-500">Cobrado al cliente</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-tinta-900">
            {pesos(cobranza?.cobrado ?? 0)}
          </p>
          <p className="text-xs text-tinta-400">de {pesos(cobranza?.cotizado ?? 0)} de la cotización</p>
        </div>

        <div className="rounded-xl border border-tinta-200 bg-white px-4 py-3">
          <p className="text-xs text-tinta-500">Saldo por cobrar</p>
          <p
            className={`mt-0.5 text-lg font-semibold tabular-nums ${
              Number(cobranza?.saldo ?? 0) > 0 ? 'text-amber-600' : 'text-haaco-700'
            }`}
          >
            {pesos(cobranza?.saldo ?? 0)}
          </p>
          <p className="text-xs text-tinta-400">
            {Number(cobranza?.saldo ?? 0) > 0
              ? `${Number(cobranza?.pct_pendiente ?? 0)}% pendiente`
              : 'Liquidada'}
          </p>
        </div>
      </div>
    </header>
  )
}
