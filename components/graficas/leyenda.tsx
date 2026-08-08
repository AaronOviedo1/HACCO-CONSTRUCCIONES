import type { ReactNode } from 'react'
import { pesosCortos } from '@/lib/format'

/**
 * El renglón que va encima de cada gráfica.
 *
 * Con dos o más series la leyenda no es opcional: es lo que impide que la
 * identidad de cada tramo dependa nada más del color. Y como el tablero se
 * mira de reojo, la leyenda además canta la cifra del periodo señalado: dos
 * columnas sueltas no dicen cuánto.
 */
export function Leyenda({
  periodo,
  series,
  extra,
}: {
  /** El mes o la semana que se está mirando; va en versalitas a la izquierda. */
  periodo?: string
  series: { nombre: string; color: string; valor: number }[]
  /** Un dato más que se cuelga al final: el balance, la tasa de cierre… */
  extra?: ReactNode
}) {
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
      {periodo && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-tinta-400">
          {periodo}
        </span>
      )}
      {series.map((s) => (
        <span key={s.nombre} className="flex items-center gap-1.5 text-[11px] text-tinta-600">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: s.color }}
            aria-hidden
          />
          {s.nombre}
          <strong className="font-semibold tabular-nums text-tinta-900">
            {pesosCortos(s.valor)}
          </strong>
        </span>
      ))}
      {extra}
    </div>
  )
}
