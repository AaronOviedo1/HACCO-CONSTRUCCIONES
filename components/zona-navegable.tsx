'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  createContext,
  useContext,
  useOptimistic,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
  type TransitionStartFunction,
} from 'react'

/**
 * Pestañas y filtros que responden al toque.
 *
 * Las pestañas de las pantallas (`?t=`, `?v=`) y los filtros sólo cambian los
 * search params, y en esta versión de Next eso no vuelve a mostrar el
 * `loading.tsx`: el límite de Suspense lleva por llave el segmento *sin* los
 * search params (`layout-router.js`). La navegación corre en una transición, así
 * que la pantalla vieja se queda quieta, sin ninguna señal, hasta que llega la
 * nueva. En el iPad eso son varios segundos en los que nadie sabe si el toque
 * contó.
 *
 * Esta zona lleva esas transiciones ella misma para saber cuándo están en
 * curso:
 * - al cambiar de **pestaña**, la pestaña tocada se marca de inmediato y el
 *   contenido se cambia por su esqueleto;
 * - al cambiar un **filtro**, la lista se atenúa sin desaparecer. Con el
 *   buscador, un esqueleto parpadearía con cada letra.
 *
 * Fuera de una zona, `EnlacePestana` es un `<Link>` cualquiera y los filtros
 * usan su propia transición, así que nada se rompe si una pantalla no la monta.
 */

export type TipoNavegacion = 'pestana' | 'filtro'

type Destino = { href: string; tipo: TipoNavegacion }

type Zona = {
  navegar: (href: string, tipo: TipoNavegacion) => void
  /** Para los filtros que arman su URL y llaman a `router.replace` ellos mismos. */
  iniciarFiltro: TransitionStartFunction
  /** El enlace que se está abriendo, mientras se abre, y de qué tipo es. */
  destino: Destino | null
  pestanaPendiente: boolean
  filtroPendiente: boolean
}

const ContextoZona = createContext<Zona | null>(null)

export function useZonaNavegable() {
  return useContext(ContextoZona)
}

export function ZonaNavegable({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [pestanaPendiente, iniciarPestana] = useTransition()
  const [filtroPendiente, iniciarFiltro] = useTransition()
  // Vuelve sola a `null` en cuanto termina la transición que la fijó.
  const [destino, fijarDestino] = useOptimistic<Destino | null>(null)

  const navegar = (href: string, tipo: TipoNavegacion) => {
    const iniciar = tipo === 'pestana' ? iniciarPestana : iniciarFiltro
    iniciar(() => {
      fijarDestino({ href, tipo })
      router.push(href, { scroll: false })
    })
  }

  return (
    <ContextoZona.Provider
      value={{ navegar, iniciarFiltro, destino, pestanaPendiente, filtroPendiente }}
    >
      {children}
    </ContextoZona.Provider>
  )
}

/**
 * La transición de un filtro: la de la zona si la hay, para que la lista se
 * atenúe, o una propia si el filtro vive fuera de una zona.
 */
export function useTransicionFiltro(): [boolean, TransitionStartFunction] {
  const zona = useZonaNavegable()
  const [pendiente, iniciar] = useTransition()
  return zona ? [zona.filtroPendiente, zona.iniciarFiltro] : [pendiente, iniciar]
}

/** ¿Es un clic que el navegador debe atender por su cuenta (pestaña nueva, etc.)? */
export function esClicEspecial(e: MouseEvent) {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
}

/**
 * El destino que se acaba de tocar en un menú, mientras la ruta llega.
 *
 * La barra lateral y la de pestañas marcan la opción activa según la ruta, así
 * que la marca se movía hasta que la pantalla nueva ya estaba puesta. Con esto
 * se mueve al tocar, a la par del esqueleto. Se olvida sola en cuanto la ruta
 * cambia. Los toques que no cambian de ruta (la misma pantalla, un `#ancla`) no
 * cuentan, porque si no la marca se quedaría pegada.
 */
export function useDestinoTocado() {
  const pathname = usePathname()
  const [tocado, setTocado] = useState<{ href: string; desde: string } | null>(null)

  const destino = tocado && tocado.desde === pathname ? tocado.href : null

  const tocar = (href: string, e: MouseEvent) => {
    if (esClicEspecial(e)) return
    if (new URL(href, window.location.href).pathname === pathname) return
    setTocado({ href, desde: pathname })
  }

  return { destino, tocar }
}

/**
 * Pestaña o chip que navega dentro de la zona.
 *
 * Sigue siendo un `<Link>`: conserva el prefetch, el clic con ⌘ y el «abrir en
 * otra pestaña». Las clases van como cadenas y no como función porque las
 * pantallas que la usan son componentes de servidor.
 */
export function EnlacePestana({
  href,
  activo,
  tipo = 'pestana',
  clase = '',
  claseActiva = '',
  claseInactiva = '',
  onClick,
  children,
  ...resto
}: {
  href: string
  activo: boolean
  tipo?: TipoNavegacion
  clase?: string
  claseActiva?: string
  claseInactiva?: string
  onClick?: () => void
  children: ReactNode
  'aria-current'?: 'page' | undefined
}) {
  const zona = useZonaNavegable()
  // Mientras se abre, la marcada es la tocada y no la de la URL. Sólo entre
  // enlaces del mismo tipo: tocar una pestaña no desmarca los chips de filtro
  // que la pantalla tenga aparte (nómina tiene las dos filas).
  const destino = zona?.destino
  const marcada = destino && destino.tipo === tipo ? destino.href === href : activo

  return (
    <Link
      href={href}
      scroll={false}
      aria-current={resto['aria-current'] ?? (marcada ? 'page' : undefined)}
      onClick={(e) => {
        onClick?.()
        if (!zona || esClicEspecial(e)) return
        e.preventDefault()
        zona.navegar(href, tipo)
      }}
      className={`${clase} ${marcada ? claseActiva : claseInactiva}`}
    >
      {children}
    </Link>
  )
}

/**
 * La parte de la pantalla que cambia con la pestaña o el filtro.
 *
 * Con una pestaña en camino se ve `esqueleto`; si no se pasó, se atenúa igual
 * que con un filtro. El contenido viejo se queda montado pero escondido: si la
 * navegación se interrumpe, no se pierde lo que estuviera a medio escribir.
 */
export function ContenidoPestana({
  esqueleto,
  className = '',
  children,
}: {
  esqueleto?: ReactNode
  className?: string
  children: ReactNode
}) {
  const zona = useZonaNavegable()
  const conEsqueleto = Boolean(zona?.pestanaPendiente && esqueleto)
  const atenuado = Boolean(zona && !conEsqueleto && (zona.filtroPendiente || zona.pestanaPendiente))

  return (
    <>
      {conEsqueleto && esqueleto}
      <div
        hidden={conEsqueleto}
        aria-busy={atenuado || undefined}
        // Se atenúa con 120 ms de retraso para que un filtro rápido no deje
        // parpadeo; al volver, el contenido nuevo aparece sin esperar.
        className={`transition-opacity ${
          atenuado ? 'pointer-events-none opacity-55 delay-[120ms] duration-200' : 'duration-150'
        } ${className}`}
      >
        {children}
      </div>
    </>
  )
}
