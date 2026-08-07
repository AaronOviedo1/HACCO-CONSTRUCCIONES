'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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
 *
 * El movimiento es lo que la hace sentir de cristal y no de papel: la cápsula
 * se pasa un poco de su destino y se asienta, se estira mientras viaja, y cada
 * destino se hunde bajo el dedo. Todo con transiciones y `element.animate()`,
 * sin una sola dependencia de animación.
 */

/**
 * Ancho al que aspira cada destino, en rem.
 *
 * Es un techo y no una medida: la pastilla toma este ancho por pestaña
 * mientras quepa, y si no cabe —cinco destinos en un iPhone SE— se reparte lo
 * que haya. Por eso no hay ningún número de píxeles en el posicionamiento de
 * la cápsula: ver `Cápsula`, abajo.
 */
const ANCHO = 4.75

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
 * Pliega las etiquetas mientras se baja y las devuelve al subir.
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

/**
 * Estira la cápsula en la dirección del viaje y le devuelve su forma al llegar.
 *
 * Una transición de CSS no puede ir y volver en un solo tramo, así que el
 * estirón se dispara a mano cuando cambia el destino. `element.animate()` es
 * nativo desde Safari 13.1 y no deja rastro al terminar, que es justo lo que
 * hace falta: la deformación es del viaje, no del estado.
 *
 * El achatamiento vertical conserva el volumen —es lo que vende el efecto de
 * goma— y el estirón se topa a dos destinos, porque más allá se vuelve
 * caricatura en vez de física.
 */
function useEstiron(activa: number) {
  const nodo = useRef<HTMLSpanElement>(null)
  const previa = useRef(activa)

  useEffect(() => {
    const antes = previa.current
    previa.current = activa

    if (!nodo.current || antes < 0 || activa < 0 || antes === activa) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const salto = Math.min(Math.abs(activa - antes), 2)

    nodo.current.animate(
      [
        { transform: 'scaleX(1) scaleY(1)' },
        { transform: `scaleX(${1 + 0.07 * salto}) scaleY(${1 - 0.05 * salto})`, offset: 0.35 },
        { transform: 'scaleX(1) scaleY(1)' },
      ],
      { duration: 420, easing: 'ease-out' },
    )
  }, [activa])

  return nodo
}

export function BarraTabs({ pestanas }: { pestanas: Pestana[] }) {
  const pathname = usePathname()
  const activa = indiceActivo(pathname, pestanas)
  // La ruta reinicia el estado al cambiar de pantalla y relee la preferencia
  // de movimiento por si se cambió desde ajustes.
  const minimizada = useMinimizarAlBajar(pathname)
  const estiron = useEstiron(activa)

  // El `:active` de Safari iOS no se dispara en un enlace si nadie escucha el
  // tacto, así que el hundido se lleva a mano en vez de fiarse de la pseudo.
  const [presionada, setPresionada] = useState(-1)
  const soltar = () => setPresionada(-1)

  return (
    <nav
      // La franja no captura toques: fuera de la pastilla el dedo llega al
      // contenido, que es lo que espera cualquiera de una barra que flota.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      aria-label="Secciones"
    >
      <div
        className="cristal cristal-brillo pointer-events-auto relative origin-bottom rounded-[1.625rem] p-1.5 transition-transform duration-[320ms] ease-suave will-change-transform motion-reduce:transition-none"
        style={{
          // Cuántos destinos hay es lo único que necesita saber el CSS para
          // repartir el ancho y colocar la cápsula. Va como variable y no como
          // clase porque el número cambia por rol —y en obra, hasta por si hay
          // trabajo abierto.
          '--n': String(pestanas.length),
          width: `min(100%, calc(var(--n) * ${ANCHO}rem + 0.75rem))`,
          // Al bajar se encoge un pelo. Nada de bajarle la opacidad: en obra,
          // a pleno sol, es lo que vuelve la barra ilegible.
          transform: minimizada ? 'scale(0.97)' : 'scale(1)',
        } as React.CSSProperties}
      >
        <div className="relative flex w-full">
          {/* La cápsula se desliza en vez de parpadear de un destino a otro.
              Todo el posicionamiento es en porcentaje y no en píxeles: los
              destinos se reparten el ancho a partes iguales, así que la
              cápsula mide un enésimo y `translateX` en porcentaje —que se
              resuelve contra su propio ancho— la deja clavada en su sitio.
              Ni medir el DOM, ni parpadeo en el primer pintado, ni desfase
              cuando cambia el número de pestañas. */}
          {activa >= 0 && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 transition-transform duration-[420ms] ease-capsula motion-reduce:transition-none"
              style={{
                width: 'calc(100% / var(--n))',
                transform: `translateX(${activa * 100}%)`,
              }}
            >
              {/* Tres capas anidadas porque son tres movimientos distintos y
                  cada uno necesita su propio `transform`: arriba el viaje,
                  aquí el estirón que dispara `useEstiron`, y abajo el hundido
                  al tocar la pestaña en la que ya se está. */}
              <span ref={estiron} className="block h-full w-full">
                <span
                  className="block h-full w-full rounded-[1.25rem] bg-haaco-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_2px_6px_-1px_rgb(20_88_54/0.45)] transition-transform motion-reduce:transition-none"
                  style={{
                    transform: presionada === activa ? 'scale(0.94)' : 'scale(1)',
                    transitionDuration: presionada === activa ? '110ms' : '420ms',
                    transitionTimingFunction:
                      presionada === activa ? 'ease-out' : 'var(--ease-toque)',
                  }}
                />
              </span>
            </span>
          )}

          {pestanas.map((p, i) => {
            const esta = i === activa
            return (
              <Link
                key={p.href + p.etiqueta}
                href={p.href}
                aria-current={esta ? 'page' : undefined}
                onPointerDown={() => setPresionada(i)}
                onPointerUp={soltar}
                onPointerCancel={soltar}
                onPointerLeave={soltar}
                // Red de seguridad: si la navegación se lleva el `pointerup`
                // por delante, el destino se quedaría hundido para siempre.
                onClick={soltar}
                className="relative z-10 flex flex-1 basis-0 flex-col items-center justify-center py-2 [touch-action:manipulation]"
                style={{
                  // El color entrante espera a que la cápsula llegue; el que
                  // se apaga se va enseguida. Si ambos cambiaran a la vez, el
                  // icono se pondría blanco sobre el cristal claro y
                  // desaparecería medio recorrido.
                  color: esta ? '#fff' : 'var(--color-tinta-600)',
                  transitionProperty: 'color',
                  transitionDuration: '200ms',
                  transitionDelay: esta ? '130ms' : '0ms',
                }}
              >
                <span
                  className="flex flex-col items-center gap-0.5 transition-transform motion-reduce:transition-none"
                  style={{
                    transform: presionada === i ? 'scale(0.88)' : 'scale(1)',
                    // Entra rápido y seco, sale con rebote: así se siente el
                    // acuse de recibo del dedo y no un desvanecido.
                    transitionDuration: presionada === i ? '110ms' : '420ms',
                    transitionTimingFunction:
                      presionada === i ? 'ease-out' : 'var(--ease-toque)',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d={p.icono}
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <span
                    className="etiqueta-tab"
                    style={{
                      gridTemplateRows: minimizada ? '0fr' : '1fr',
                      opacity: minimizada ? 0 : 1,
                    }}
                  >
                    <span className="block truncate text-[10px] font-medium leading-[1.2]">
                      {p.etiqueta}
                    </span>
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
