'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Renglones de tabla que se tocan enteros.
 *
 * Esto era un enlace estirado: `<tr class="relative">` y dentro el folio con
 * `after:absolute after:inset-0`, un área invisible que cubría la fila para
 * poder tocarla por cualquier celda. En escritorio funcionaba; en el iPad se
 * comía la pantalla.
 *
 * El motivo es que posicionar un `<tr>` es terreno gris del CSS. Cuando el
 * navegador no honra ese `relative` —iPadOS no lo hace—, el área invisible deja
 * de medirse contra la fila y pasa a medirse contra el viewport: cada renglón
 * tapa la pantalla completa, se apilan todos y gana el último en pintarse. De
 * ahí que cualquier toque abriera siempre la misma cotización, la de abajo de
 * la lista, incluso tocando la barra lateral —que es `sticky` sin `z-index`, o
 * sea que queda por debajo de cualquier cosa posicionada que venga después—.
 *
 * Aquí no hay nada posicionado y por tanto nada que se pueda desbordar: el
 * `<tr>` escucha el toque y se lo pasa al ancla que ya lleva dentro. Como la
 * navegación sigue siendo la de un `<Link>` de verdad, el punto de «abriendo»
 * —que se cuelga del estado del enlace— se enciende igual aunque el dedo caiga
 * en la última columna.
 */

/**
 * Lo que se defiende solo. Si el toque cae en uno de estos, la fila no se mete:
 * el botón de pago, el lápiz de editar o el folio hacen lo suyo.
 *
 * Antes esto se resolvía poniéndole `relative` a cada control para que se
 * levantara por encima del área estirada, y había que acordarse cada vez. Se
 * puede añadir un control nuevo a un renglón sin tocar nada.
 */
const PROPIOS = 'a, button, input, select, textarea, label, summary, [role="button"]'

function useFilaTocable(alActivar?: () => void) {
  const fila = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    const nodo = fila.current
    if (!nodo) return

    const alTocar = (evento: MouseEvent) => {
      // Clic con modificador o con otro botón: abrir en pestaña nueva, menú
      // contextual. Eso se hace sobre el folio, que sigue siendo un ancla.
      if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) {
        return
      }

      const propio = (evento.target as Element | null)?.closest?.(PROPIOS)
      if (propio && nodo.contains(propio)) return

      if (alActivar) return alActivar()

      // Vuelve a entrar aquí con el ancla como objetivo y sale por la guarda de
      // arriba: ni bucle ni navegación doble.
      nodo.querySelector<HTMLAnchorElement>('a[data-enlace-fila]')?.click()
    }

    /*
     * Escucha en el nodo y no con el `onClick` de React, que registra todo en
     * la raíz del árbol: iOS decide si un elemento «que no es interactivo»
     * llega a generar un click mirando si tiene manejador propio.
     */
    nodo.addEventListener('click', alTocar)
    return () => nodo.removeEventListener('click', alTocar)
  }, [alActivar])

  return fila
}

/** El toque en cualquier celda dispara el enlace marcado con `data-enlace-fila`. */
export function FilaEnlace({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const fila = useFilaTocable()

  return (
    <tr ref={fila} className={`cursor-pointer hover:bg-tinta-50/60 ${className}`}>
      {children}
    </tr>
  )
}

/** Igual, pero el toque llama a una función: renglones cuya ficha es un diálogo. */
export function FilaAccion({
  children,
  alActivar,
  className = '',
}: {
  children: ReactNode
  alActivar: () => void
  className?: string
}) {
  const fila = useFilaTocable(alActivar)

  return (
    <tr ref={fila} className={`cursor-pointer hover:bg-tinta-50/60 ${className}`}>
      {children}
    </tr>
  )
}
