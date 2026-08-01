'use client'

import { useState } from 'react'
import { pesosCortos } from '@/lib/format'

/**
 * Cotizado contra aprobado, mes a mes.
 *
 * La gráfica siempre canta una cifra: al abrir muestra el mes más reciente y
 * al pasar el dedo o el ratón por cualquier mes cambia a ese. Sin eso, dos
 * líneas sueltas no dicen cuánto.
 */
export function GraficaMeses({
  meses,
}: {
  meses: { m: string; cotizado: number; aprobado: number }[]
}) {
  const [activo, setActivo] = useState(meses.length - 1)

  // El viewBox es ancho para que en pantallas grandes el trazo se dibuje casi
  // 1:1 y el texto no se infle; en el teléfono simplemente se encoge.
  const ancho = 620
  const alto = 190
  const tope = Math.max(1, ...meses.map((x) => x.cotizado)) * 1.12
  const paso = meses.length > 1 ? ancho / (meses.length - 1) : ancho

  const puntos = meses.map((x, i) => ({
    ...x,
    x: i * paso,
    y: alto - (x.cotizado / tope) * alto,
    y2: alto - (x.aprobado / tope) * alto,
  }))

  const trazo = (clave: 'y' | 'y2') =>
    puntos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p[clave].toFixed(1)}`).join(' ')

  const mes = puntos[activo] ?? puntos[puntos.length - 1]
  // Tres marcas bastan para dar escala sin ensuciar el dibujo.
  const marcas = [tope, tope / 2, 0]

  return (
    <>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-tinta-400">
          {mes?.m}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-tinta-600">
          <span className="h-[3px] w-3.5 rounded-sm bg-haaco-700" aria-hidden />
          Cotizado
          <strong className="font-semibold tabular-nums text-tinta-900">
            {pesosCortos(mes?.cotizado ?? 0)}
          </strong>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-tinta-600">
          <span className="h-[3px] w-3.5 rounded-sm bg-haaco-300" aria-hidden />
          Aprobado
          <strong className="font-semibold tabular-nums text-tinta-900">
            {pesosCortos(mes?.aprobado ?? 0)}
          </strong>
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        {/* Escala: el tope y la mitad, redondeados a miles. */}
        <div
          className="flex w-9 shrink-0 flex-col justify-between py-[2px] text-right text-[9.5px] tabular-nums text-tinta-400"
          style={{ height: alto + 4 }}
          aria-hidden
        >
          {marcas.map((v) => (
            <span key={v}>{v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`}</span>
          ))}
        </div>

        <svg
          viewBox={`-4 -8 ${ancho + 9} ${alto + 28}`}
          className="block min-w-0 flex-1 overflow-visible"
          role="img"
          aria-label={`Cotizado contra aprobado en los últimos ${meses.length} meses`}
        >
          {marcas.map((v, i) => (
            <line
              key={v}
              x1="0"
              y1={(alto / (marcas.length - 1)) * i}
              x2={ancho}
              y2={(alto / (marcas.length - 1)) * i}
              stroke={i === marcas.length - 1 ? 'var(--color-tinta-200)' : 'var(--color-tinta-100)'}
              strokeWidth="1"
            />
          ))}

          <path d={`${trazo('y')} L${ancho} ${alto} L0 ${alto} Z`} fill="var(--color-haaco-50)" />
          <path
            d={trazo('y')}
            fill="none"
            stroke="var(--color-haaco-700)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={trazo('y2')}
            fill="none"
            stroke="var(--color-haaco-300)"
            strokeWidth="2.2"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Guía del mes elegido */}
          {mes && (
            <line
              x1={mes.x}
              y1="-4"
              x2={mes.x}
              y2={alto}
              stroke="var(--color-tinta-300)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {puntos.map((p, i) => (
            <circle
              key={p.m}
              cx={p.x}
              cy={p.y}
              r={i === activo ? '4.6' : '3.4'}
              fill="#fff"
              stroke="var(--color-haaco-700)"
              strokeWidth="2.2"
            />
          ))}

          {/* Franjas invisibles: dan una zona cómoda para señalar cada mes. */}
          {puntos.map((p, i) => (
            <rect
              key={`zona-${p.m}`}
              x={p.x - paso / 2}
              y="-6"
              width={paso}
              height={alto + 12}
              fill="transparent"
              onMouseEnter={() => setActivo(i)}
              onTouchStart={() => setActivo(i)}
              className="cursor-pointer"
            />
          ))}
        </svg>
      </div>

      <div className="mt-1.5 flex justify-between pl-11">
        {puntos.map((p, i) => (
          <button
            key={p.m}
            type="button"
            onClick={() => setActivo(i)}
            className={`text-[10.5px] capitalize transition ${
              i === activo ? 'font-semibold text-tinta-800' : 'text-tinta-400'
            }`}
          >
            {p.m}
          </button>
        ))}
      </div>
    </>
  )
}
