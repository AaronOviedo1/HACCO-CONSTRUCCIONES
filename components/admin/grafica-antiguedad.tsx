import { pesosCortos } from '@/lib/format'
import { MORA } from '@/components/graficas/paleta'

/** Del más sano al más rancio, en el mismo orden que devuelve `antiguedadCobranza`. */
const COLORES = [MORA.alDia, MORA.reciente, MORA.media, MORA.vieja]

/**
 * Cuánto lleva callado cada cliente que debe.
 *
 * El total por cobrar ya está arriba en el tablero, pero un total no distingue
 * entre un anticipo que se firmó antier y una obra entregada en abril que nadie
 * ha liquidado. Esto reparte ese mismo dinero por antigüedad: es la gráfica que
 * dice a quién hay que hablarle hoy.
 *
 * Las cifras van escritas junto a cada barra a propósito. Los naranjas claros
 * no alcanzan el contraste mínimo contra el papel, así que el monto no puede
 * depender del color para leerse.
 */
export function GraficaAntiguedad({
  tramos,
}: {
  tramos: { clave: string; etiqueta: string; monto: number; cuentas: number }[]
}) {
  const total = tramos.reduce((s, t) => s + t.monto, 0)
  const enMora = tramos.slice(1).reduce((s, t) => s + t.monto, 0)
  const tope = Math.max(1, ...tramos.map((t) => t.monto))
  const pctMora = total > 0 ? Math.round((enMora / total) * 100) : 0

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-tinta-500">No hay saldos por cobrar.</p>
  }

  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold -tracking-[0.5px] text-tinta-900">
          {pesosCortos(enMora)}
        </span>
        <span className="text-[11px] leading-snug text-tinta-500">
          con más de 30 días
          <br />
          {pctMora}% de lo que falta por cobrar
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {tramos.map((t, i) => (
          <li key={t.clave}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate text-tinta-700">{t.etiqueta}</span>
              <span className="shrink-0 font-semibold tabular-nums text-tinta-900">
                {pesosCortos(t.monto)}
                <span className="ml-1.5 font-normal text-tinta-400">
                  {t.cuentas} {t.cuentas === 1 ? 'obra' : 'obras'}
                </span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-tinta-100" aria-hidden>
              <div
                className="h-full rounded-full"
                style={{ width: `${(t.monto / tope) * 100}%`, background: COLORES[i] }}
              />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
