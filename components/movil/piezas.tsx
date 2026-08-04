import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Piezas de la interfaz de teléfono.
 *
 * Todas son componentes de servidor: la pantalla se arma con los datos ya
 * resueltos y el teléfono sólo pinta. Cada pieza se esconde o se adapta en
 * `lg:` para no estorbar a la vista de escritorio, que sigue siendo de tablas.
 */

/** Paleta de las gráficas: el verde de marca abriendo hacia el claro. */
export const PALETA = ['#145836', '#1b6f42', '#2d8a56', '#4ea474', '#7fc19b', '#aedac0']

// ---------------------------------------------------------------------------
// Cabecera de pantalla apilada (detalle)
// ---------------------------------------------------------------------------
export function CabeceraDetalle({ titulo, volverA }: { titulo: string; volverA: string }) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-2 flex items-center gap-0.5 border-b-[0.5px] border-tinta-300/70 bg-tinta-50/90 px-2 pb-1.5 pt-2 backdrop-blur-xl lg:hidden">
      <Link
        href={volverA}
        className="flex min-h-11 items-center gap-0.5 px-2 text-[17px] font-medium text-haaco-700"
      >
        <svg width="11" height="18" viewBox="0 0 11 18" fill="none" aria-hidden>
          <path
            d="M9 1.5 2 9l7 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Atrás
      </Link>
      <span className="flex-1 truncate pr-16 text-center text-base font-semibold -tracking-[0.2px]">
        {titulo}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Anillo de porcentaje
// ---------------------------------------------------------------------------
export function Anillo({
  pct,
  tamano = 100,
  grosor = 11,
  color = 'var(--color-haaco-500)',
  pista = 'var(--color-tinta-150)',
  children,
}: {
  pct: number
  tamano?: number
  grosor?: number
  color?: string
  pista?: string
  children: ReactNode
}) {
  const r = tamano / 2 - grosor / 2 - 1
  const circunferencia = 2 * Math.PI * r
  const avance = (Math.min(100, Math.max(0, pct)) / 100) * circunferencia

  return (
    <div className="relative shrink-0" style={{ width: tamano, height: tamano }}>
      <svg
        width={tamano}
        height={tamano}
        viewBox={`0 0 ${tamano} ${tamano}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke={pista} strokeWidth={grosor} />
        {/* En cero no se dibuja: la punta redonda dejaría un punto suelto. */}
        {avance > 0 && (
          <circle
            cx={tamano / 2}
            cy={tamano / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={grosor}
            strokeLinecap="round"
            strokeDasharray={`${avance.toFixed(1)} ${circunferencia.toFixed(1)}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barra de progreso
// ---------------------------------------------------------------------------
export function BarraProgreso({
  pct,
  color = 'linear-gradient(90deg,#2d8a56,#145836)',
  alto = 9,
  pista = 'var(--color-tinta-150)',
}: {
  pct: number
  color?: string
  alto?: number
  pista?: string
}) {
  return (
    <div
      className="overflow-hidden rounded-full"
      style={{ height: alto, background: pista }}
      aria-hidden
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tile: dato grande con enlace
// ---------------------------------------------------------------------------
export type TonoTile = 'neutro' | 'verde' | 'ambar' | 'rojo'

export const CLASES_TILE =
  'block rounded-[18px] border-[0.5px] border-tinta-200 bg-white p-3.5 text-left lg:rounded-xl'

/** El contenido del tile, aparte para que lo reusen el enlace y el botón. */
export function CuerpoTile({
  etiqueta,
  valor,
  nota,
  tono = 'neutro',
  children,
}: {
  etiqueta: string
  valor?: string
  nota?: ReactNode
  tono?: TonoTile
  children?: ReactNode
}) {
  const tonos = {
    neutro: 'text-tinta-900',
    verde: 'text-haaco-600',
    ambar: 'text-amber-600',
    rojo: 'text-red-600',
  } as const

  return (
    <>
      <div className="text-[10.5px] font-semibold uppercase leading-tight tracking-[0.07em] text-tinta-500">
        {etiqueta}
      </div>
      {valor && (
        <div className={`mt-1.5 text-[22px] font-bold -tracking-[0.6px] tabular-nums ${tonos[tono]}`}>
          {valor}
        </div>
      )}
      {nota && <div className="mt-1 text-[11px] leading-snug text-tinta-400">{nota}</div>}
      {children}
    </>
  )
}

export function Tile({
  etiqueta,
  valor,
  nota,
  href,
  tono = 'neutro',
  children,
}: {
  etiqueta: string
  valor?: string
  nota?: ReactNode
  href?: string
  tono?: TonoTile
  children?: ReactNode
}) {
  const cuerpo = (
    <CuerpoTile etiqueta={etiqueta} valor={valor} nota={nota} tono={tono}>
      {children}
    </CuerpoTile>
  )

  return href ? (
    <Link href={href} className={`${CLASES_TILE} transition active:bg-tinta-50 lg:hover:border-haaco-300`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={CLASES_TILE}>{cuerpo}</div>
  )
}

// ---------------------------------------------------------------------------
// Chips de filtro (carrusel horizontal)
// ---------------------------------------------------------------------------
export function ChipsFiltro({
  opciones,
  className = '',
}: {
  opciones: { titulo: string; href: string; activo: boolean }[]
  className?: string
}) {
  return (
    // Envuelven en varios renglones en vez de correrse a lo ancho: los filtros
    // que no se ven no se usan, y en el teléfono nadie descubre un carril que
    // se desplaza de lado.
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {opciones.map((o) => (
        <Link
          key={o.titulo}
          href={o.href}
          // Sólo cambia el filtro: la lista se queda donde el pulgar la dejó.
          scroll={false}
          className={`flex min-h-9 items-center whitespace-nowrap rounded-full border-[0.5px] px-3.5 text-[13.5px] font-medium transition lg:rounded-lg ${
            o.activo
              ? 'border-haaco-700 bg-haaco-700 text-white'
              : 'border-tinta-200 bg-white text-tinta-600'
          }`}
        >
          {o.titulo}
        </Link>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Botón de acción principal (full width, pulgar)
// ---------------------------------------------------------------------------
export function BotonGrande({
  href,
  children,
  icono,
  variante = 'primario',
  className = '',
}: {
  href: string
  children: ReactNode
  icono?: ReactNode
  variante?: 'primario' | 'secundario'
  className?: string
}) {
  const variantes = {
    primario: 'border-0 bg-haaco-700 text-white shadow-verde',
    secundario: 'border-[0.5px] border-tinta-300 bg-white text-tinta-700',
  } as const

  return (
    <Link
      href={href}
      className={`flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-[18px] text-[17px] font-semibold transition active:opacity-90 ${variantes[variante]} ${className}`}
    >
      {icono}
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Aviso de confirmación
// ---------------------------------------------------------------------------
export function AvisoLogrado({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 rounded-[14px] border-[0.5px] border-haaco-200 bg-haaco-50 p-3 text-[14.5px] font-semibold text-haaco-800">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
        <path
          d="M5 13l4.5 4.5L19 7"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Donut de composición
// ---------------------------------------------------------------------------
export function Donut({
  partes,
  centro,
  pie,
}: {
  partes: { n: string; v: number }[]
  centro: string
  pie: string
}) {
  const total = partes.reduce((s, p) => s + p.v, 0)
  const r = 46
  const circunferencia = 2 * Math.PI * r
  const fracciones = partes.map((p) => (total > 0 ? p.v / total : 0))

  const segmentos = partes.map((p, i) => {
    // Cada arco arranca donde terminó la suma de los anteriores.
    const inicio = fracciones.slice(0, i).reduce((s, f) => s + f, 0)
    return {
      ...p,
      color: PALETA[i % PALETA.length],
      dash: `${Math.max(0, fracciones[i] * circunferencia - 1.5).toFixed(1)} ${circunferencia.toFixed(1)}`,
      offset: (-inicio * circunferencia).toFixed(1),
      pct: `${Math.round(fracciones[i] * 100)}%`,
    }
  })

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-28 w-28 shrink-0">
        <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90" aria-hidden>
          {segmentos.map((s) => (
            <circle
              key={s.n}
              cx="56"
              cy="56"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className="text-[15px] font-bold -tracking-[0.4px]">{centro}</span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.07em] text-tinta-400">{pie}</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {segmentos.map((s) => (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-xs text-tinta-700">{s.n}</span>
            <span className="text-[11.5px] font-semibold tabular-nums text-tinta-600">{s.pct}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Barras de vencimientos por semana
// ---------------------------------------------------------------------------
export function BarrasSemanas({
  semanas,
}: {
  semanas: { etiqueta: string; monto: number; texto: string }[]
}) {
  const tope = Math.max(1, ...semanas.map((s) => s.monto))

  return (
    <>
      <div className="flex h-24 items-end justify-between gap-2.5">
        {semanas.map((s) => (
          <div key={s.etiqueta} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold tabular-nums text-tinta-600">{s.texto}</span>
            <div
              className="w-full rounded-t-lg"
              style={{
                height: `${Math.max(3, (s.monto / tope) * 76)}px`,
                background:
                  s.monto > 20000 ? '#dc2626' : s.monto > 0 ? 'var(--color-haaco-500)' : 'var(--color-tinta-200)',
              }}
              aria-hidden
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between">
        {semanas.map((s) => (
          <span key={s.etiqueta} className="flex-1 text-center text-[10.5px] text-tinta-400">
            {s.etiqueta}
          </span>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Lista de renglones dentro de una tarjeta
// ---------------------------------------------------------------------------
export function FilaLista({
  href,
  principal,
  secundario,
  derecha,
  accion,
}: {
  href?: string
  principal: ReactNode
  secundario?: ReactNode
  derecha: ReactNode
  /** Botón al final del renglón —editar, mover—; no se combina con href. */
  accion?: ReactNode
}) {
  const cuerpo = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-medium text-tinta-900">{principal}</span>
        {secundario && (
          <span className="mt-0.5 block truncate text-[11.5px] text-tinta-400">{secundario}</span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-[3px]">{derecha}</span>
      {accion && <span className="flex shrink-0 items-center">{accion}</span>}
    </>
  )

  const clases =
    'flex w-full items-center justify-between gap-2.5 border-b-[0.5px] border-tinta-100 px-4 py-3 text-left last:border-b-0'

  return href ? (
    <Link href={href} className={`${clases} transition active:bg-tinta-50`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clases}>{cuerpo}</div>
  )
}

/** Enlace de cierre de una tarjeta-lista: «Ver todo →». */
export function PieTarjeta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-[46px] items-center px-4 text-[14.5px] font-semibold text-haaco-700"
    >
      {children}
    </Link>
  )
}
