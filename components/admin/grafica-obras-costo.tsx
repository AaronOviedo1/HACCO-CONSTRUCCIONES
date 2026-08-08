import Link from 'next/link'
import { pesosCortos } from '@/lib/format'
import { tonoUtilidad } from '@/lib/obras'
import { RUBROS } from '@/components/graficas/paleta'

export type ObraCosto = {
  id: string
  ot: string | null
  nombre: string
  cotizado: number
  manoObra: number
  material: number
  otros: number
  utilidad: number
}

const RENGLONES = [
  { clave: 'manoObra', nombre: 'Mano de obra', color: RUBROS.manoObra },
  { clave: 'material', nombre: 'Material', color: RUBROS.material },
  { clave: 'otros', nombre: 'Viáticos y otros', color: RUBROS.otros },
] as const

const TONOS = {
  verde: 'text-haaco-700',
  ambar: 'text-amber-600',
  rojo: 'text-red-600',
  gris: 'text-tinta-400',
  azul: 'text-sky-700',
} as const

/**
 * Cuánto se ha gastado cada obra de lo que cotizó.
 *
 * Todos estos números ya estaban en la base y en el detalle de cada obra, pero
 * repartidos en una tabla por obra: para saber cuál se está comiendo el
 * presupuesto había que abrirlas una por una. Aquí van todas en la misma
 * escala, así que se comparan de un vistazo, y la marca vertical es lo que se
 * cotizó: la barra que la rebasa ya perdió dinero.
 */
export function GraficaObrasCosto({ obras }: { obras: ObraCosto[] }) {
  if (obras.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-tinta-500">No hay órdenes de trabajo abiertas.</p>
    )
  }

  // Escala común a todas las obras: si cada barra usara la suya, una obra de
  // veinte mil se vería igual de grande que una de trescientos mil. El 4% de
  // holgura es para que la marca de la obra más grande no quede montada en el
  // borde de la pista, donde no se distingue.
  const tope =
    Math.max(1, ...obras.map((o) => Math.max(o.cotizado, o.manoObra + o.material + o.otros))) * 1.04

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
        {RENGLONES.map((r) => (
          <span key={r.clave} className="flex items-center gap-1.5 text-[11px] text-tinta-600">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: r.color }}
              aria-hidden
            />
            {r.nombre}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-tinta-600">
          <span className="h-3.5 w-[2px] shrink-0 rounded-sm bg-tinta-800" aria-hidden />
          Cotizado
        </span>
      </div>

      <ul className="mt-3.5 flex flex-col gap-3.5">
        {obras.map((o) => {
          const erogado = o.manoObra + o.material + o.otros
          const margen = o.cotizado > 0 ? Math.round((o.utilidad / o.cotizado) * 100) : null
          const tono = TONOS[tonoUtilidad(o.utilidad, o.cotizado)]
          return (
            <li key={o.id}>
              <Link href={`/admin/obras/${o.id}`} className="block group">
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    {o.ot && (
                      <span className="shrink-0 font-mono text-[11px] text-haaco-700">{o.ot}</span>
                    )}
                    <span className="truncate text-tinta-700 group-hover:text-tinta-900">
                      {o.nombre}
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${tono}`}>
                    {margen === null ? '—' : `margen ${margen}%`}
                  </span>
                </div>

                <div className="relative h-3.5 overflow-hidden rounded-full bg-tinta-100">
                  {/* Un hueco de 2 px entre rubros: el aire separa mejor que
                      un contorno y no engorda la barra. */}
                  <div className="flex h-full gap-[2px]">
                    {RENGLONES.map((r) => {
                      const v = o[r.clave]
                      if (v <= 0) return null
                      return (
                        <span
                          key={r.clave}
                          className="h-full first:rounded-l-full"
                          style={{ width: `${(v / tope) * 100}%`, background: r.color }}
                          aria-hidden
                        />
                      )
                    })}
                  </div>
                  {/* Hasta aquí llegaba el presupuesto. */}
                  {o.cotizado > 0 && (
                    <span
                      className="absolute inset-y-0 w-[2px] rounded-sm bg-tinta-800"
                      style={{ left: `calc(${Math.min(100, (o.cotizado / tope) * 100)}% - 1px)` }}
                      aria-hidden
                    />
                  )}
                </div>

                <p className="mt-1 text-[11px] tabular-nums text-tinta-400">
                  {pesosCortos(erogado)} erogado de {pesosCortos(o.cotizado)} cotizado
                  {erogado > o.cotizado && o.cotizado > 0 && (
                    <span className="ml-1.5 font-semibold text-red-600">
                      se pasó {pesosCortos(erogado - o.cotizado)}
                    </span>
                  )}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
