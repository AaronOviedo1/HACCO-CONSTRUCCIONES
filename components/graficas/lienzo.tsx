'use client'

import type { ReactNode } from 'react'
import { CHROME } from './paleta'
import { etiquetaEscala } from './escala'

/**
 * Las piezas repetidas de una gráfica de columnas.
 *
 * Todas las gráficas del tablero comparten el mismo trato: un viewBox ancho
 * —para que en escritorio el trazo se dibuje casi 1:1 y el texto no se infle,
 * y en el teléfono simplemente se encoja—, una rejilla que se queda atrás y
 * una zona de toque por columna que es mucho más grande que la barra. Sin eso
 * último la gráfica no se puede usar con el pulgar.
 */

/** Medidas base: cambiarlas aquí las cambia en todo el tablero. */
export const ANCHO = 620
export const ALTO = 190
/** Lo que se reserva a la izquierda del trazo para las cifras del eje. */
export const CANAL = 58

/**
 * El lienzo de una gráfica de columnas: el dibujo y las cifras del eje.
 *
 * El reparto de trabajo es el punto fino. El SVG se escala con el ancho de la
 * tarjeta —lo que hace que crezca también a lo alto—, así que las cifras del
 * eje no pueden ir dentro: encogerían con él y en el teléfono quedarían en
 * cinco píxeles, ilegibles. Pero puestas al lado en una columna de altura fija
 * se despegan de sus líneas en cuanto la tarjeta cambia de ancho.
 *
 * La salida es un contenedor con la misma proporción que el viewBox: el SVG lo
 * llena y las cifras se posicionan encima en porcentaje. Así la posición
 * escala y el tamaño de letra no.
 *
 * `arriba` y `abajo` son el aire para los rótulos que se escriben fuera del
 * área de trazado: el total de la columna, el balance del mes.
 */
export function Lienzo({
  marcas,
  etiqueta,
  alto = ALTO,
  arriba = 14,
  abajo = 4,
  children,
}: {
  marcas: number[]
  /** Descripción para quien no ve el dibujo. */
  etiqueta: string
  alto?: number
  arriba?: number
  abajo?: number
  children: ReactNode
}) {
  const vbAncho = ANCHO + CANAL + 5
  const vbAlto = alto + arriba + abajo
  const paso = alto / Math.max(1, marcas.length - 1)

  return (
    <div
      className="relative mt-3 w-full"
      style={{ aspectRatio: `${vbAncho} / ${vbAlto}` }}
    >
      <svg
        viewBox={`${-CANAL} ${-arriba} ${vbAncho} ${vbAlto}`}
        className="absolute inset-0 block h-full w-full overflow-visible"
        role="img"
        aria-label={etiqueta}
      >
        {children}
      </svg>
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {marcas.map((v, i) => (
          <span
            key={i}
            className="absolute -translate-y-1/2 text-right text-[9.5px] tabular-nums text-tinta-400"
            style={{
              top: `${((arriba + paso * i) / vbAlto) * 100}%`,
              left: 0,
              width: `${((CANAL - 8) / vbAncho) * 100}%`,
            }}
          >
            {etiquetaEscala(v)}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Sangría que cuadra lo que va debajo del lienzo con la primera columna. */
export const SANGRIA_CANAL = `${(CANAL / (ANCHO + CANAL + 5)) * 100}%`

/**
 * Las líneas horizontales de fondo. Sólidas y de un solo paso de gris: si se
 * puntean, se leen como si marcaran un umbral que nadie puso.
 */
export function Rejilla({
  marcas,
  ancho = ANCHO,
  alto = ALTO,
  cero,
}: {
  marcas: number[]
  ancho?: number
  alto?: number
  /** Altura del cero, si la gráfica lo cruza; se pinta más marcada. */
  cero?: number
}) {
  const paso = alto / Math.max(1, marcas.length - 1)
  return (
    <>
      {marcas.map((v, i) => (
        <line
          key={i}
          x1="0"
          y1={paso * i}
          x2={ancho}
          y2={paso * i}
          stroke={CHROME.rejilla}
          strokeWidth="1"
        />
      ))}
      <line
        x1="0"
        y1={cero ?? alto}
        x2={ancho}
        y2={cero ?? alto}
        stroke={CHROME.eje}
        strokeWidth="1"
      />
    </>
  )
}

/**
 * Franjas invisibles, una por columna: dan una zona cómoda para señalar el
 * periodo con el ratón o con el dedo, muchísimo más ancha que la barra.
 */
export function ZonasDeToque({
  n,
  ancho = ANCHO,
  alto = ALTO,
  desdeY = -6,
  onActivo,
}: {
  n: number
  ancho?: number
  alto?: number
  desdeY?: number
  onActivo: (i: number) => void
}) {
  const slot = ancho / Math.max(1, n)
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={i * slot}
          y={desdeY}
          width={slot}
          height={alto - desdeY + 6}
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => onActivo(i)}
          onClick={() => onActivo(i)}
          onTouchStart={() => onActivo(i)}
        />
      ))}
    </>
  )
}

/**
 * Las etiquetas de abajo, como botones: en el teléfono son la forma de elegir
 * un periodo sin atinarle a la barra.
 */
export function EtiquetasX({
  etiquetas,
  activo,
  onElegir,
}: {
  etiquetas: string[]
  activo: number
  onElegir: (i: number) => void
}) {
  return (
    <div className="mt-0.5 flex" style={{ paddingLeft: SANGRIA_CANAL }}>
      {etiquetas.map((e, i) => (
        <button
          key={`${e}-${i}`}
          type="button"
          onClick={() => onElegir(i)}
          className={`flex-1 text-center text-[10.5px] capitalize transition ${
            i === activo ? 'font-semibold text-tinta-800' : 'text-tinta-400'
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
