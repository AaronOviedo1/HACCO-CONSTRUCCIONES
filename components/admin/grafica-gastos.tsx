'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pesos, pesosCortos } from '@/lib/format'

export type MesDeGastos = {
  /** aaaa-mm, para armar el enlace a la página de gastos. */
  clave: string
  /** «julio de 2026», como se lee. */
  etiqueta: string
  /** Categorías ya ordenadas de mayor a menor, con la cola en «Otros». */
  categorias: { n: string; v: number }[]
}

/**
 * Gastos por categoría con el mes a elección.
 *
 * Barras horizontales de un solo tono —la longitud ya dice cuánto— con su
 * cifra al lado, y flechas para caminar los meses sin salir del tablero.
 */
export function GraficaGastos({ meses }: { meses: MesDeGastos[] }) {
  const [indice, setIndice] = useState(meses.length - 1)

  const mes = meses[indice]
  const total = mes?.categorias.reduce((s, c) => s + c.v, 0) ?? 0
  const anterior = meses[indice - 1]
  const totalAnterior = anterior?.categorias.reduce((s, c) => s + c.v, 0) ?? 0
  const delta = totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : null
  const tope = Math.max(1, ...(mes?.categorias.map((c) => c.v) ?? [1]))

  const [anio, numMes] = (mes?.clave ?? '').split('-').map(Number)
  const ultimoDia = anio ? new Date(anio, numMes, 0).getDate() : 28

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIndice((i) => Math.max(0, i - 1))}
          disabled={indice === 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-tinta-500 transition hover:bg-tinta-100 disabled:opacity-30"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-tinta-400">
            {mes?.etiqueta}
          </p>
          <p className="text-2xl font-bold -tracking-[0.5px] tabular-nums text-tinta-900">
            {pesosCortos(total)}
          </p>
          {delta !== null && (
            <p className={`text-[11px] tabular-nums ${delta > 0 ? 'text-red-600' : 'text-haaco-700'}`}>
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs mes anterior
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIndice((i) => Math.min(meses.length - 1, i + 1))}
          disabled={indice >= meses.length - 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-tinta-500 transition hover:bg-tinta-100 disabled:opacity-30"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {!mes || mes.categorias.length === 0 ? (
        <p className="py-8 text-center text-sm text-tinta-500">Sin gastos ese mes.</p>
      ) : (
        <ul className="mt-3.5 flex flex-col gap-2.5">
          {mes.categorias.map((c) => (
            <li key={c.n} title={`${c.n}: ${pesos(c.v)}`}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate text-tinta-700">{c.n}</span>
                <span className="shrink-0 font-semibold tabular-nums text-tinta-900">
                  {pesosCortos(c.v)}
                  <span className="ml-1.5 font-normal text-tinta-400">
                    {total > 0 ? Math.round((c.v / total) * 100) : 0}%
                  </span>
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-tinta-100" aria-hidden>
                <div
                  className="h-full rounded-full bg-haaco-500 transition-[width] duration-300"
                  style={{ width: `${(c.v / tope) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {mes && (
        <Link
          href={`/admin/gastos?desde=${mes.clave}-01&hasta=${mes.clave}-${String(ultimoDia).padStart(2, '0')}`}
          className="mt-3.5 block text-sm font-medium text-haaco-700 hover:underline"
        >
          Ver los gastos de {mes.etiqueta} →
        </Link>
      )}
    </>
  )
}
