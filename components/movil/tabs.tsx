'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Pestana } from '@/lib/nav'

/**
 * Barra de pestañas del teléfono.
 *
 * Sustituye a la barra lateral cuando la app se usa en la calle: cinco destinos
 * como máximo, todos a un pulgar de distancia y en el mismo orden mental que el
 * negocio (qué hay, en qué obra, qué cotizo, cuánto dinero). En iPad y
 * escritorio desaparece: ahí manda la barra lateral.
 */

/** Gana la pestaña cuya coincidencia con la ruta sea más específica. */
function indiceActivo(pathname: string, pestanas: Pestana[]) {
  let ganadora = -1
  let mejor = 0

  pestanas.forEach((p, i) => {
    const puntaje =
      pathname === p.href
        ? Infinity
        : Math.max(
            0,
            ...(p.prefijos ?? [])
              .filter((raiz) => pathname === raiz || pathname.startsWith(`${raiz}/`))
              .map((raiz) => raiz.length),
          )

    if (puntaje > mejor) {
      mejor = puntaje
      ganadora = i
    }
  })

  return ganadora
}

export function BarraTabs({ pestanas }: { pestanas: Pestana[] }) {
  const pathname = usePathname()
  const activa = indiceActivo(pathname, pestanas)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-start justify-around border-t-[0.5px] border-tinta-300/70 bg-white/90 px-1.5 pt-2.5 backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))' }}
      aria-label="Secciones"
    >
      {pestanas.map((p, i) => {
        const esta = i === activa
        return (
          <Link
            key={p.href + p.etiqueta}
            href={p.href}
            aria-current={esta ? 'page' : undefined}
            className="flex min-h-12 flex-1 flex-col items-center gap-[3px] py-0.5"
          >
            <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d={p.icono}
                stroke={esta ? 'var(--color-haaco-700)' : 'var(--color-tinta-400)'}
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className={`text-[10.5px] -tracking-[0.1px] ${
                esta ? 'font-semibold text-haaco-700' : 'font-medium text-tinta-400'
              }`}
            >
              {p.etiqueta}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
