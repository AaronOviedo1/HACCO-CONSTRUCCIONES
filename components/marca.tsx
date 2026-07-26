/**
 * Logotipo provisional de HaacoPro.
 * Cuando llegue el logo definitivo se sustituye sólo este componente.
 */
export function Logo({ tamano = 36 }: { tamano?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-haaco-700 font-bold text-white"
      style={{ width: tamano, height: tamano, fontSize: tamano * 0.42 }}
      aria-hidden
    >
      HP
    </span>
  )
}

export function Membrete({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo tamano={compacto ? 32 : 40} />
      <div className="leading-tight">
        <div className={`font-semibold tracking-tight text-tinta-900 ${compacto ? 'text-base' : 'text-lg'}`}>
          Haaco<span className="text-haaco-600">Pro</span>
        </div>
        {!compacto && (
          <div className="text-[11px] uppercase tracking-wider text-tinta-500">
            Recubrimientos y herrería
          </div>
        )}
      </div>
    </div>
  )
}
