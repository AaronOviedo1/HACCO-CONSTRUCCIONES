'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { Pestana } from '@/lib/nav'

/**
 * Barra de pestañas del teléfono.
 *
 * Sustituye a la barra lateral cuando la app se usa en la calle: cinco destinos
 * como máximo, todos a un pulgar de distancia y en el mismo orden mental que el
 * negocio (qué hay, en qué obra, qué cotizo, cuánto dinero). En iPad y
 * escritorio desaparece: ahí manda la barra lateral.
 *
 * Va como pastilla flotante y no como franja pegada al borde: así el contenido
 * se ve correr por debajo y la barra se puede quitar de en medio al leer, que
 * es lo que hacen las apps del teléfono desde iOS 26.
 */

/** Ancho de cada destino. Es constante a propósito: ver `Capsula`. */
const ANCHO = 52

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

/**
 * Encoge la pastilla mientras se baja y la devuelve entera al subir.
 *
 * El umbral no es para ahorrar trabajo sino para tener histéresis: `anterior`
 * sólo avanza cuando el gesto pasa de doce píxeles, así el temblor del pulgar
 * sobre una lista larga no la hace parpadear. Cerca del tope se queda siempre
 * entera, porque el rebote de iOS entrega desplazamientos hacia abajo que el
 * dedo nunca hizo.
 */
function useMinimizarAlBajar(reinicio: unknown, umbral = 12) {
  const [minimizada, setMinimizada] = useState(false)

  useEffect(() => {
    setMinimizada(false)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let anterior = window.scrollY
    let pedido = 0

    const evaluar = () => {
      pedido = 0
      const y = window.scrollY
      const delta = y - anterior
      if (Math.abs(delta) < umbral) return
      anterior = y
      setMinimizada(y > 64 && delta > 0)
    }

    // Pasivo y a un cálculo por cuadro: en Safari un listener de scroll que no
    // lo sea bloquea el desplazamiento mientras corre.
    const alScroll = () => {
      if (!pedido) pedido = requestAnimationFrame(evaluar)
    }

    window.addEventListener('scroll', alScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', alScroll)
      if (pedido) cancelAnimationFrame(pedido)
    }
  }, [reinicio, umbral])

  return minimizada
}

export function BarraTabs({ pestanas }: { pestanas: Pestana[] }) {
  const pathname = usePathname()
  const activa = indiceActivo(pathname, pestanas)
  // La ruta reinicia el estado al cambiar de pantalla y relee la preferencia
  // de movimiento por si se cambió desde ajustes.
  const minimizada = useMinimizarAlBajar(pathname)

  return (
    <nav
      // La franja no captura toques: fuera de la pastilla el dedo llega al
      // contenido, que es lo que espera cualquiera de una barra que flota.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      aria-label="Secciones"
    >
      <div
        className="pointer-events-auto relative flex origin-bottom items-center rounded-full border-[0.5px] border-tinta-200/80 bg-white/70 p-1.5 shadow-[0_10px_34px_rgba(7,12,20,0.16)] backdrop-blur-2xl backdrop-saturate-[1.8] transition-[transform,opacity] duration-300 ease-out will-change-transform motion-reduce:transition-none"
        style={{
          transform: minimizada ? 'scale(0.84)' : 'scale(1)',
          opacity: minimizada ? 0.78 : 1,
        }}
      >
        {/* La cápsula se desliza en vez de parpadear de un destino a otro.
            Como todos los destinos miden lo mismo —para eso se quitaron las
            etiquetas—, su posición es una multiplicación y no hace falta medir
            el DOM: ni parpadeo en el primer pintado, ni desfase cuando cambia
            el número de pestañas por rol. */}
        {activa >= 0 && (
          <span
            aria-hidden
            className="absolute left-1.5 top-1.5 h-11 rounded-full bg-haaco-700 transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ width: ANCHO, transform: `translateX(${activa * ANCHO}px)` }}
          />
        )}

        {pestanas.map((p, i) => {
          const esta = i === activa
          return (
            <Link
              key={p.href + p.etiqueta}
              href={p.href}
              // Sin texto visible, el nombre del destino vive aquí.
              aria-label={p.etiqueta}
              aria-current={esta ? 'page' : undefined}
              className="relative z-10 flex h-11 items-center justify-center"
              style={{ width: ANCHO }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d={p.icono}
                  stroke={esta ? '#fff' : 'var(--color-tinta-500)'}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
