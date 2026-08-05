'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { COOKIE_MESES } from '@/lib/preferencias'

/**
 * Meses que se pliegan, como las hojas del Excel.
 *
 * Las listas largas —cotizaciones, cobranza, gastos— arrastran todo el año y
 * hay que bajar media pantalla para llegar a lo de esta semana. Aquí cada mes
 * es un `<tbody>` que se abre y se cierra: el mes en curso arranca abierto y
 * los anteriores cerrados, y lo que se deja plegado se recuerda.
 *
 * Se resolvió con varios `<tbody>` y no con `<details>` porque `<details>` no
 * es hijo válido de una tabla: el navegador lo saca del DOM de la tabla y se
 * llevaría los renglones con él. Varios `<tbody>` sí son HTML válido y no
 * alteran el reparto de anchos ni el `border-collapse`.
 *
 * Lo plegado llega ya resuelto desde el servidor —lo lee de la cookie con
 * `mesesPlegados()`—, así que la lista se pinta encogida desde el primer byte
 * y no da el salto de aparecer completa y cerrarse un instante después.
 */

type Contexto = {
  plegado: (mes: string) => boolean
  alternar: (mes: string) => void
}

const ContextoMeses = createContext<Contexto | null>(null)

/** Un año: el plegado es una preferencia de lectura, no un dato que caduque. */
const VIGENCIA_COOKIE = 60 * 60 * 24 * 365

function guardar(lista: string, meses: string[]) {
  if (typeof document === 'undefined') return
  try {
    const previa = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${COOKIE_MESES}=`))
      ?.slice(COOKIE_MESES.length + 1)

    const guardado: Record<string, string[]> = previa
      ? JSON.parse(decodeURIComponent(previa))
      : {}
    guardado[lista] = meses

    document.cookie = `${COOKIE_MESES}=${encodeURIComponent(
      JSON.stringify(guardado),
    )}; path=/; max-age=${VIGENCIA_COOKIE}; samesite=lax`
  } catch {
    // Si la cookie no se puede escribir, al menos se pliega en esta sesión.
  }
}

export function MesesPlegables({
  lista,
  plegados: iniciales,
  children,
}: {
  /** Clave con la que se recuerda el plegado. Una por tabla, no por página. */
  lista: string
  /** Lo que ya venía plegado, resuelto en el servidor con `mesesPlegados()`. */
  plegados: string[]
  children: ReactNode
}) {
  const [plegados, setPlegados] = useState<Set<string>>(() => new Set(iniciales))

  const alternar = (mes: string) =>
    setPlegados((antes) => {
      const nuevos = new Set(antes)
      if (nuevos.has(mes)) nuevos.delete(mes)
      else nuevos.add(mes)
      guardar(lista, [...nuevos])
      return nuevos
    })

  return (
    <ContextoMeses.Provider value={{ plegado: (mes) => plegados.has(mes), alternar }}>
      {children}
    </ContextoMeses.Provider>
  )
}

/** Fuera de un `MesesPlegables` todo se ve abierto y nada es interactivo. */
function useMes(mes: string) {
  const ctx = useContext(ContextoMeses)
  return {
    plegado: ctx?.plegado(mes) ?? false,
    alternar: ctx ? () => ctx.alternar(mes) : undefined,
  }
}

/**
 * Un mes dentro de una tabla: sustituye al `<Fragment>` que envolvía la
 * `FilaMes` y sus renglones.
 */
export function CuerpoMes({
  mes,
  columnas,
  etiqueta,
  detalle,
  children,
}: {
  mes: string
  columnas: number
  etiqueta: string
  detalle?: ReactNode
  children: ReactNode
}) {
  const { plegado, alternar } = useMes(mes)

  return (
    <tbody>
      <FilaMes
        columnas={columnas}
        etiqueta={etiqueta}
        detalle={detalle}
        plegado={plegado}
        alPlegar={alternar}
      />
      {!plegado && children}
    </tbody>
  )
}

/** El mismo mes plegable, en las listas del teléfono. */
export function SeccionMes({
  mes,
  etiqueta,
  detalle,
  enTarjeta = false,
  children,
}: {
  mes: string
  etiqueta: string
  detalle?: ReactNode
  enTarjeta?: boolean
  children: ReactNode
}) {
  const { plegado, alternar } = useMes(mes)

  return (
    <>
      <TituloMes
        etiqueta={etiqueta}
        detalle={detalle}
        enTarjeta={enTarjeta}
        plegado={plegado}
        alPlegar={alternar}
      />
      {!plegado && children}
    </>
  )
}

// ---------------------------------------------------------------------------
// Los separadores viven aquí y no en ui.tsx porque ahora llevan estado.
// ---------------------------------------------------------------------------
const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** Renglón que abre el bloque de un mes dentro de una tabla. */
export function FilaMes({
  etiqueta,
  detalle,
  columnas,
  plegado,
  alPlegar,
}: {
  /** "agosto de 2026" — se capitaliza sola. */
  etiqueta: string
  /** Conteo y subtotal del mes, a la derecha. */
  detalle?: ReactNode
  /** Cuántas columnas tiene la tabla, para estirar el renglón completo. */
  columnas: number
  plegado?: boolean
  /** Sin esto el renglón se pinta igual que siempre, sin ser interactivo. */
  alPlegar?: () => void
}) {
  const contenido = (
    <span className="flex items-baseline justify-between gap-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-tinta-600">
        {alPlegar && (
          <ChevronDown
            size={13}
            aria-hidden
            className={`shrink-0 transition-transform ${plegado ? '-rotate-90' : ''}`}
          />
        )}
        {capitalizar(etiqueta)}
      </span>
      {detalle && <span className="text-[11px] tabular-nums text-tinta-400">{detalle}</span>}
    </span>
  )

  return (
    <tr>
      <td colSpan={columnas} className="border-b border-tinta-100 bg-tinta-50/80 p-0">
        {alPlegar ? (
          <button
            type="button"
            onClick={alPlegar}
            aria-expanded={!plegado}
            className="block w-full px-4 py-2 text-left transition hover:bg-tinta-100/70"
          >
            {contenido}
          </button>
        ) : (
          <span className="block px-4 py-2">{contenido}</span>
        )}
      </td>
    </tr>
  )
}

/**
 * El mismo separador para las listas del teléfono. Con `enTarjeta` se pinta
 * como banda dentro de la tarjeta-lista; sin ella es un título suelto entre
 * tarjetas apiladas.
 */
export function TituloMes({
  etiqueta,
  detalle,
  enTarjeta = false,
  plegado,
  alPlegar,
}: {
  etiqueta: string
  detalle?: ReactNode
  enTarjeta?: boolean
  plegado?: boolean
  alPlegar?: () => void
}) {
  const contenido = (
    <>
      <span
        className={`flex items-center gap-1.5 font-semibold text-tinta-600 ${
          enTarjeta ? 'text-xs' : 'text-[13px]'
        }`}
      >
        {alPlegar && (
          <ChevronDown
            size={13}
            aria-hidden
            className={`shrink-0 transition-transform ${plegado ? '-rotate-90' : ''}`}
          />
        )}
        {capitalizar(etiqueta)}
      </span>
      {detalle && (
        <span
          className={`tabular-nums text-tinta-400 ${enTarjeta ? 'text-[11px]' : 'text-[11.5px]'}`}
        >
          {detalle}
        </span>
      )}
    </>
  )

  const clases = enTarjeta
    ? 'flex w-full items-baseline justify-between gap-3 border-b-[0.5px] border-tinta-100 bg-tinta-50/80 px-4 py-2 text-left'
    : 'mt-1 flex w-full items-baseline justify-between gap-3 px-1 py-1 text-left first:mt-0'

  return alPlegar ? (
    <button type="button" onClick={alPlegar} aria-expanded={!plegado} className={clases}>
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}
