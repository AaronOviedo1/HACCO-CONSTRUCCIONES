import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Piezas de la pantalla «Más»: la tarjeta de quién eres y las listas de
 * destinos que no caben en la barra de pestañas.
 */

function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function TarjetaPerfil({
  nombre,
  rol,
  detalle,
}: {
  nombre: string
  rol: string
  detalle?: string | null
}) {
  return (
    <div className="mb-4 flex items-center gap-3.5 rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta lg:rounded-xl">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-haaco-700 text-xl font-bold text-white">
        {iniciales(nombre)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold -tracking-[0.3px]">{nombre}</p>
        <p className="mt-0.5 text-[13px] text-tinta-500">{rol}</p>
        {detalle && <p className="mt-px truncate text-xs text-tinta-400">{detalle}</p>}
      </div>
    </div>
  )
}

export function GrupoMenu({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 px-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-tinta-400">
        {titulo}
      </h2>
      <div className="overflow-hidden rounded-[20px] border-[0.5px] border-tinta-200 bg-white shadow-tarjeta lg:rounded-xl">
        {children}
      </div>
    </section>
  )
}

export function OpcionMenu({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-[52px] items-center gap-3 border-b-[0.5px] border-tinta-100 px-4 text-[15.5px] transition last:border-b-0 active:bg-tinta-50"
    >
      <span className="flex-1">{children}</span>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden>
        <path
          d="M1 1l6 6-6 6"
          stroke="var(--color-tinta-300)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  )
}

export function BotonSalir({ cerrarSesion }: { cerrarSesion: () => Promise<void> }) {
  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className="min-h-[52px] w-full rounded-[18px] border-[0.5px] border-tinta-200 bg-white text-base font-semibold text-red-600 shadow-tarjeta transition active:bg-tinta-50 lg:rounded-xl"
      >
        Cerrar sesión
      </button>
    </form>
  )
}
