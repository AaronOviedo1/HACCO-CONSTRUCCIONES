import { LOGO_CAJA, LOGO_TRAZO } from '@/lib/marca'

/**
 * Imagotipo de HAACO PRO RECUBRIMIENTOS: el vector ORIGINAL del manual de
 * marca (un solo path relleno), no una reconstrucción.
 *
 * Dibuja con `currentColor`, así que hereda el color del contenedor: sirve
 * igual en verde sobre papel que en blanco sobre el chrome verde.
 */

const PROPORCION = LOGO_CAJA.ancho / LOGO_CAJA.alto

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
 * Bloque de marca completo.
 * `tono="claro"` invierte los colores para usarlo sobre el chrome verde.
 */
export function Membrete({
  compacto = false,
  tono = 'oscuro',
}: {
  compacto?: boolean
  tono?: 'oscuro' | 'claro'
}) {
  const claro = tono === 'claro'

  return (
    <div className="flex items-center gap-2.5">
      <Logo
        tamano={compacto ? 30 : 40}
        className={claro ? 'text-white' : 'text-haaco-900'}
      />
      <div className="leading-none">
        <div className="flex items-center gap-1">
          <span
            className={`tipo-display font-extrabold tracking-tight ${
              compacto ? 'text-[15px]' : 'text-xl'
            } ${claro ? 'text-white' : 'text-haaco-900'}`}
          >
            HAACO
          </span>
          <span
            className={`tipo-display font-extrabold [clip-path:polygon(0_0,100%_0,100%_58%,90%_100%,0_100%)] ${
              compacto ? 'px-1 pt-[3px] pb-[2px] text-[11px]' : 'px-1.5 pt-1 pb-0.5 text-sm'
            } ${claro ? 'bg-white text-haaco-900' : 'bg-haaco-900 text-white'}`}
          >
            PRO
          </span>
        </div>
        <div
          className={`mt-1 uppercase ${
            compacto
              ? 'text-[7px] tracking-[0.28em]'
              : 'text-[9px] tracking-[0.34em]'
          } ${claro ? 'text-haaco-200' : 'text-tinta-500'}`}
        >
          Recubrimientos
        </div>
      </div>
    </div>
  )
}
