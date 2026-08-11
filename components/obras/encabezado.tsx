'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ChevronLeft, Pause, Play, Truck } from 'lucide-react'
import { Etiqueta } from '@/components/ui'
import { BotonReabrir } from '@/components/obras/reabrir'
import { BotonEditarObra } from '@/components/obras/editar-obra'
import { fecha, fechaHora, pesos } from '@/lib/format'
import { ESTATUS_OBRA } from '@/lib/obras'
import { actualizarObra, entregarObra } from '@/app/admin/obras/acciones'
import type { EstatusObra, Obra, VCobranza, VObraConcentrado } from '@/types/database'

export function EncabezadoObra({
  concentrado,
  obra,
  cobranza,
  esAdmin,
}: {
  concentrado: VObraConcentrado
  obra: Obra
  cobranza: VCobranza | null
  /** Reabrir una OT cerrada es sólo de Dirección. */
  esAdmin: boolean
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
        className="mb-2 inline-flex min-h-11 items-center gap-0.5 text-[17px] font-medium text-haaco-700 transition lg:mb-3 lg:min-h-0 lg:text-sm lg:text-tinta-500 lg:hover:text-tinta-800"
      >
        <ChevronLeft size={20} className="lg:hidden" />
        <ChevronLeft size={15} className="hidden lg:block" />
        Obras
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[26px] font-bold leading-tight -tracking-[0.7px] text-tinta-900 lg:text-2xl lg:font-semibold lg:leading-normal lg:tracking-tight">
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

        {cerrada ? (
          esAdmin && (
            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
              <BotonReabrir
                obraId={obra.id}
                otNumero={concentrado.ot_numero}
                cotizacionFolio={concentrado.cotizacion_folio}
                cerradaEl={concentrado.fecha_cierre}
                variante="encabezado"
              />
            </div>
          )
        ) : (
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
            <BotonEditarObra obra={obra} />
            {concentrado.estatus === 'pausada' ? (
              <button
                type="button"
                onClick={() => cambiar('en_obra')}
                disabled={pendiente}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-3 text-[15.5px] font-semibold text-white transition hover:bg-haaco-800 disabled:opacity-50 lg:min-h-0 lg:flex-none lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium"
              >
                <Play size={15} />
                Reanudar
              </button>
            ) : concentrado.estatus === 'agendada' ? (
              <button
                type="button"
                onClick={() => cambiar('en_obra')}
                disabled={pendiente}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-3 text-[15.5px] font-semibold text-white transition hover:bg-haaco-800 disabled:opacity-50 lg:min-h-0 lg:flex-none lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium"
              >
                <Play size={15} />
                Arrancar obra
              </button>
            ) : (
              <button
                type="button"
                onClick={() => cambiar('pausada')}
                disabled={pendiente}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-[0.5px] border-tinta-300 bg-white px-3 text-[15.5px] font-semibold text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50 lg:min-h-0 lg:flex-none lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium"
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
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-[0.5px] border-tinta-300 bg-white px-3 text-[15.5px] font-semibold text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50 lg:min-h-0 lg:flex-none lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium"
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
        <div className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white px-4 py-3.5 shadow-tarjeta lg:rounded-xl lg:py-3">
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

        <div className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white px-4 py-3.5 shadow-tarjeta lg:rounded-xl lg:py-3">
          <p className="text-xs text-tinta-500">Cobrado al cliente</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-tinta-900">
            {pesos(cobranza?.cobrado ?? 0)}
          </p>
          <p className="text-xs text-tinta-400">de {pesos(cobranza?.cotizado ?? 0)} de la cotización</p>
        </div>

        <div className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white px-4 py-3.5 shadow-tarjeta lg:rounded-xl lg:py-3">
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
