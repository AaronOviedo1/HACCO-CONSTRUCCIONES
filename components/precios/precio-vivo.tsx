'use client'

import { pesos } from '@/lib/format'
import {
  antiguedad,
  COLOR_SEMAFORO,
  procedencia,
  sePuedeUsar,
  type PrecioVigente,
} from '@/lib/precios'

/**
 * El último precio pagado de un material, debajo de su campo.
 *
 * Va como una línea y no como una columna: la fila de material ya trae doce
 * columnas y en el teléfono va apretada.
 *
 * Tocarla llena el costo. Ése toque —y no la llamada— es el ahorro: el precio
 * ya estaba en la casa, en la factura de la semana pasada.
 */
export function PrecioVivo({
  precio,
  onUsar,
  onPreguntar,
}: {
  precio: PrecioVigente
  onUsar: (monto: number) => void
  /** Mete el material a la ronda de hoy sin salir de la cotización. */
  onPreguntar?: () => void
}) {
  const usable = sePuedeUsar(precio)

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-0.5 text-[11px] leading-tight text-tinta-400">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR_SEMAFORO[precio.semaforo]}`} />

      {usable ? (
        <button
          type="button"
          onClick={() => onUsar(precio.precio_neto)}
          className="font-semibold tabular-nums text-tinta-600 underline-offset-2 hover:text-haaco-700 hover:underline"
        >
          {pesos(precio.precio_neto)}
        </button>
      ) : (
        // Se observó por metro y el catálogo va por tramo (o al revés). Se
        // enseña, pero no se ofrece: la conversión nunca se hace sola.
        <span className="tabular-nums text-amber-700">
          {pesos(precio.precio_neto)} por {precio.unidad_observada}
        </span>
      )}

      <span className="min-w-0 truncate">
        {procedencia(precio)} · {antiguedad(precio.dias)}
      </span>

      {precio.semaforo === 'rojo' && onPreguntar && (
        <button
          type="button"
          onClick={onPreguntar}
          className="font-medium text-haaco-700 underline-offset-2 hover:underline"
        >
          Preguntar hoy
        </button>
      )}
    </p>
  )
}
