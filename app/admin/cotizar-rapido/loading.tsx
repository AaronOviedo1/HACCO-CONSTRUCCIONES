import { Esqueleto, Raya } from '@/components/esqueletos'

/** Esqueleto del primer paso de cotizar rápido: elegir al cliente. */
export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando cotizador" className="pb-40">
      <header className="mb-5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="h-8 w-48 rounded-lg bg-tinta-200 lg:h-7" />
            <Raya className="h-3 w-16" />
          </div>
          <Raya className="mt-2 h-4 w-56 max-w-full" />
        </div>
      </header>

      <div className="mb-4 h-[58px] rounded-2xl bg-tinta-150" />

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="h-[68px] rounded-[18px] border-2 border-dashed border-haaco-200 bg-haaco-50/50" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white px-5 py-5"
          >
            <div className="h-4 w-40 max-w-full rounded bg-tinta-200" />
            <Raya className="mt-2 h-3.5 w-52 max-w-full" />
          </div>
        ))}
      </div>
    </Esqueleto>
  )
}
