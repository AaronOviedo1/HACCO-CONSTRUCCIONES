'use client'

import { useLinkStatus } from 'next/link'

/**
 * Acuse de recibo del toque mientras la pantalla siguiente carga.
 *
 * Abrir una cotización son nueve consultas y el `loading.tsx` del segmento no
 * alcanza a pintarse: el layout de admin resuelve la sesión con datos de
 * runtime y, sin Cache Components, eso bloquea la navegación —está en la ficha
 * de `loading.js` de esta versión de Next—. Resultado en el iPad: se toca un
 * renglón, la tabla se queda igual varios segundos y nadie sabe si registró.
 *
 * Quien lo usa vuelve a tocar, y ahí empieza el problema: si el segundo toque
 * cae en algo que no navega —plegar un mes, regresarse— la navegación anterior
 * sigue viva y al resolverse se lleva a la pantalla por delante, que es la
 * cotización tocada primero. Con el toque acusado ya no hay segundo toque.
 *
 * `useLinkStatus` sólo funciona dentro de un `<Link>`, y la ficha de Next
 * advierte que un indicador que ocupa sitio al aparecer empuja el renglón: por
 * eso todos reservan su espacio desde el principio y sólo se encienden.
 */

/**
 * Punto que se enciende junto al folio en las tablas de escritorio.
 *
 * Tarda 120 ms en aparecer para que una navegación rápida no dé un parpadeo.
 */
export function PuntoAbriendo() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden
      className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle ${
        pending ? 'pista-abriendo' : 'invisible'
      }`}
    />
  )
}

/**
 * El folio de la lista del teléfono, que se vuelve reloj de arena al tocarlo.
 *
 * Aquí el renglón entero es el enlace y el cuadro del folio es su ancla
 * visual, así que el aviso va dentro: mismo tamaño, ningún salto, y se ve a la
 * distancia a la que se sostiene un iPad.
 */
export function FolioAbriendo({ folio }: { folio: string | null }) {
  const { pending } = useLinkStatus()

  if (!pending) return <>{folio ?? '—'}</>

  return (
    <>
      <span className="sr-only">Abriendo…</span>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-girar">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.6" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </>
  )
}
