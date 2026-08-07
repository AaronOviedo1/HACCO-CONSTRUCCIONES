import { IMAGOTIPO_CAJA, IMAGOTIPO_TRAZO, LOGO_CAJA, LOGO_TRAZO } from '@/lib/marca'

/**
 * La marca de HAACO PRO RECUBRIMIENTOS: los trazos originales del manual, tanto
 * el símbolo como el nombre. Nada está recompuesto con tipografía —el nombre va
 * en Akira Expanded Super Bold y el giro en Circular Std Medium, las dos
 * comerciales—, así que aquí son dibujo.
 *
 * Los dos dibujan con `currentColor`, así que heredan el color del contenedor:
 * sirven igual en verde sobre papel que en blanco sobre el chrome verde.
 */

const PROPORCION = LOGO_CAJA.ancho / LOGO_CAJA.alto
const PROPORCION_IMAGOTIPO = IMAGOTIPO_CAJA.ancho / IMAGOTIPO_CAJA.alto

export function Logo({
  tamano = 36,
  className = '',
}: {
  tamano?: number
  className?: string
}) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_CAJA.ancho} ${LOGO_CAJA.alto}`}
      width={Math.round(tamano * PROPORCION)}
      height={tamano}
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      <path fill="currentColor" d={LOGO_TRAZO} />
    </svg>
  )
}

/**
 * Bloque de marca completo: símbolo y nombre, con la separación del manual.
 * `tono="claro"` lo pone en blanco para usarlo sobre el chrome verde.
 *
 * Va todo del mismo color a propósito: el manual sólo contempla el imagotipo
 * monocromo, en positivo o en negativo (pág. 6).
 */
export function Membrete({
  compacto = false,
  tono = 'oscuro',
}: {
  compacto?: boolean
  tono?: 'oscuro' | 'claro'
}) {
  const alto = compacto ? 30 : 40

  return (
    <svg
      viewBox={`0 0 ${IMAGOTIPO_CAJA.ancho} ${IMAGOTIPO_CAJA.alto}`}
      width={Math.round(alto * PROPORCION_IMAGOTIPO)}
      height={alto}
      className={`shrink-0 ${tono === 'claro' ? 'text-white' : 'text-haaco-900'}`}
      role="img"
      aria-label="HAACO PRO Recubrimientos"
    >
      <path fill="currentColor" d={IMAGOTIPO_TRAZO} />
    </svg>
  )
}
