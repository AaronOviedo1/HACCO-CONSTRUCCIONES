'use client'

import { useState } from 'react'
import { pesosCortos } from '@/lib/format'

/**
 * Ingresos contra egresos, mes a mes.
 *
 * Ingresos = lo cobrado a clientes; egresos = gastos más nómina pagada. Al
 * tocar un mes las cifras del encabezado cambian a ese mes y el balance se
 * pinta según el signo. Verde y azul: par validado para daltonismo.
 */
export function GraficaFlujo({
  meses,
}: {
  meses: { m: string; entra: number; sale: number }[]
}) {
  const [activo, setActivo] = useState(meses.length - 1)

  // ViewBox ancho: en escritorio se dibuja casi 1:1 y en el teléfono se encoge.
  const ancho = 620
  const alto = 190
  const tope = Math.max(1, ...meses.flatMap((x) => [x.entra, x.sale])) * 1.08
  const slot = ancho / Math.max(1, meses.length)
  const barra = Math.min(30, (slot - 26) / 2)

  const mes = meses[activo] ?? meses[meses.length - 1]
  const balance = (mes?.entra ?? 0) - (mes?.sale ?? 0)

  /** Barra con las esquinas de arriba redondeadas y la base plana. */
  const trazoBarra = (x: number, v: number) => {
    const h = Math.max(2, (v / tope) * alto)
    const y = alto - h
    const r = Math.min(5, h / 2, barra / 2)
    return `M${x} ${alto} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + barra - r} ${y} Q${x + barra} ${y} ${x + barra} ${y + r} L${x + barra} ${alto} Z`
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-tinta-400">
          {mes?.m}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-tinta-600">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#2d8a56]" aria-hidden />
          Ingresos
          <strong className="font-semibold tabular-nums text-tinta-900">
            {pesosCortos(mes?.entra ?? 0)}
          </strong>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-tinta-600">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#075985]" aria-hidden />
          Egresos
          <strong className="font-semibold tabular-nums text-tinta-900">
            {pesosCortos(mes?.sale ?? 0)}
          </strong>
        </span>
        <span className="text-[11px] text-tinta-600">
          Balance{' '}
          <strong
            className={`font-semibold tabular-nums ${
              balance < 0 ? 'text-red-600' : 'text-haaco-700'
            }`}
          >
            {balance < 0 ? '−' : '+'}
            {pesosCortos(Math.abs(balance))}
          </strong>
        </span>
      </div>

      <svg
        viewBox={`0 -6 ${ancho} ${alto + 26}`}
        className="mt-3 block w-full overflow-visible"
        role="img"
        aria-label={`Ingresos contra egresos en los últimos ${meses.length} meses`}
      >
        <line x1="0" y1={alto} x2={ancho} y2={alto} stroke="var(--color-tinta-200)" strokeWidth="1" />

        {meses.map((x, i) => {
          const centro = i * slot + slot / 2
          const esActivo = i === activo
          return (
            <g key={x.m + i} opacity={esActivo ? 1 : 0.55}>
              <path d={trazoBarra(centro - barra - 1, x.entra)} fill="#2d8a56" />
              <path d={trazoBarra(centro + 1, x.sale)} fill="#075985" />
              <text
                x={centro}
                y={alto + 17}
                textAnchor="middle"
                className="fill-tinta-400 text-[11px] capitalize"
                style={{ fontWeight: esActivo ? 600 : 400 }}
              >
                {x.m}
              </text>
              {/* Zona de toque del mes completo */}
              <rect
                x={i * slot}
                y="-6"
                width={slot}
                height={alto + 26}
                fill="transparent"
                onMouseEnter={() => setActivo(i)}
                onClick={() => setActivo(i)}
              />
            </g>
          )
        })}
      </svg>
    </>
  )
}
