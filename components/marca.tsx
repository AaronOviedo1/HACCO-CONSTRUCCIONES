/**
 * Imagotipo de HAACO PRO RECUBRIMIENTOS, reconstruido en vectores a partir del
 * manual de marca: la «H» formada por astas rayadas, los dos travesaños curvos
 * y la base en perspectiva.
 *
 * Dibuja con `currentColor`, así que hereda el color del contenedor: sirve
 * igual en verde sobre papel que en blanco sobre el chrome verde.
 */

const PROPORCION = 96 / 116

export function Logo({
  tamano = 36,
  className = '',
}: {
  tamano?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 96 116"
      width={Math.round(tamano * PROPORCION)}
      height={tamano}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {/* Asta izquierda */}
      <path d="M13 12V110" />
      <path d="M19.5 6V109.5" />
      <path d="M26 4V108.5" />
      <path d="M32.5 8V107" />
      {/* Travesaños */}
      <path d="M13 66C28 61 46 57 62 55" />
      <path d="M13 77C28 72 46 68 62 66" />
      {/* Asta derecha */}
      <path d="M62 4V98" />
      <path d="M68.5 30V95" />
      <path d="M75 36V92.5" />
      <path d="M81.5 44V89.5" />
      {/* Base en perspectiva */}
      <path d="M13 110C36 108 68 100 92 84" />
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
