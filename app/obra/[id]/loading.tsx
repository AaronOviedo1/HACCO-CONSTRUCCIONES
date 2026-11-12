import { Esqueleto, Raya } from '@/components/esqueletos'

/** Esqueleto de la obra del oficial: cabecera, avance, captura y cronograma. */
export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando obra">
      {/* La cabecera fija de «Atrás». */}
      <div className="-mx-4 mb-2 flex min-h-[52px] items-center border-b-[0.5px] border-tinta-300/70 px-4 lg:hidden">
        <div className="h-5 w-16 rounded bg-tinta-150" />
      </div>

      <header className="px-0.5 pt-2">
        <div className="h-8 w-56 max-w-full rounded-lg bg-tinta-200" />
        <Raya className="mt-2.5 h-3 w-20" />
        <Raya className="mt-3 h-3.5 w-64 max-w-full" />
      </header>

      <section className="mt-4 flex items-center gap-4 rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta">
        <div className="h-[100px] w-[100px] shrink-0 rounded-full border-[11px] border-tinta-150" />
        <div className="min-w-0 flex-1">
          <Raya className="h-3 w-24" />
          <div className="mt-1.5 h-4 w-28 rounded bg-tinta-200" />
          <Raya className="mt-4 h-3 w-14" />
          <div className="mt-1.5 h-4 w-32 rounded bg-tinta-150" />
        </div>
      </section>

      <div className="mt-4 h-[54px] rounded-[18px] bg-haaco-100" />

      <section className="mt-4 rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta">
        <div className="mb-3 h-4 w-28 rounded bg-tinta-200" />
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between gap-2.5">
              <Raya className="h-3.5 w-40" />
              <Raya className="h-3 w-16" />
            </div>
          ))}
        </div>
      </section>
    </Esqueleto>
  )
}
