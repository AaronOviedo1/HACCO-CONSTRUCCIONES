'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { Check, ChevronDown, ListFilter } from 'lucide-react'
import { Dialogo } from '@/components/formulario'

/**
 * Selector de una sola línea para el teléfono.
 *
 * Los filtros en chips envueltos se comían dos y tres renglones antes de que
 * empezara el contenido. Aquí sólo se ve el que está puesto; el resto vive en
 * una hoja que sube desde abajo, donde además caben los conteos de cada opción
 * —que en la fila de chips había que ir descubriendo uno por uno—.
 *
 * En pantalla grande no aparece: ahí sobra ancho y mandan los chips y los
 * `select` de siempre.
 */

export type OpcionSelector = {
  clave: string
  titulo: string
  /** Modo navegación. Si falta, se usa `onElegir`. */
  href?: string
  /** Conteo a la derecha; se omite en cero. */
  badge?: number
  tonoBadge?: 'neutro' | 'ambar'
}

export function SelectorMovil({
  etiqueta,
  titulo,
  opciones,
  activa,
  onElegir,
  className = '',
  icono,
}: {
  /** Nombre accesible del control: «Filtro», «Sección». No se pinta. */
  etiqueta: string
  /** Encabezado de la hoja: «Filtrar obras», «Ir a». */
  titulo: string
  opciones: OpcionSelector[]
  activa: string
  /** Modo acción: si se pasa, se ignoran los `href`. */
  onElegir?: (clave: string) => void
  className?: string
  /** Sustituye el embudo del disparador. */
  icono?: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const puesta = opciones.find((o) => o.clave === activa)

  return (
    <div className={`lg:hidden ${className}`}>
      {/* El valor puesto se explica solo, así que el prefijo va de icono y de
          nombre accesible: en 390 px cada palabra de más se cobra caro. */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`${etiqueta}: ${puesta?.titulo ?? '—'}`}
        className="flex min-h-11 w-full items-center gap-1.5 rounded-[12px] border-[0.5px] border-tinta-300 bg-white px-3 text-left text-[15px] transition active:bg-tinta-50"
      >
        <span className="shrink-0 text-tinta-400" aria-hidden>
          {icono ?? <ListFilter size={16} />}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-tinta-800">
          {puesta?.titulo ?? '—'}
        </span>
        {puesta?.badge ? <Insignia n={puesta.badge} tono={puesta.tonoBadge} /> : null}
        <ChevronDown size={15} className="shrink-0 text-tinta-400" aria-hidden />
      </button>

      <Dialogo abierto={abierto} titulo={titulo} onCerrar={() => setAbierto(false)}>
        <ul className="max-h-[60dvh] overflow-y-auto px-2 py-2 pb-seguro">
          {opciones.map((o) => {
            const es = o.clave === activa
            const cuerpo = (
              <>
                <span className="min-w-0 flex-1 truncate">{o.titulo}</span>
                {o.badge ? <Insignia n={o.badge} tono={o.tonoBadge} /> : null}
                {es ? (
                  <Check size={18} className="shrink-0 text-haaco-700" aria-hidden />
                ) : (
                  <span className="w-[18px] shrink-0" aria-hidden />
                )}
              </>
            )

            const clases = `flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3 text-[15.5px] transition active:bg-tinta-100 ${
              es ? 'bg-haaco-50 font-semibold text-haaco-800' : 'text-tinta-800'
            }`

            return (
              <li key={o.clave}>
                {onElegir || !o.href ? (
                  <button
                    type="button"
                    onClick={() => {
                      onElegir?.(o.clave)
                      setAbierto(false)
                    }}
                    aria-pressed={es}
                    className={clases}
                  >
                    {cuerpo}
                  </button>
                ) : (
                  <Link
                    href={o.href}
                    scroll={false}
                    onClick={() => setAbierto(false)}
                    aria-current={es ? 'page' : undefined}
                    className={clases}
                  >
                    {cuerpo}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </Dialogo>
    </div>
  )
}

function Insignia({ n, tono = 'neutro' }: { n: number; tono?: 'neutro' | 'ambar' }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
        tono === 'ambar' ? 'bg-amber-100 text-amber-700' : 'bg-tinta-100 text-tinta-500'
      }`}
    >
      {n}
    </span>
  )
}
