import { Esqueleto, EsqueletoBarras, EsqueletoEncabezado, Raya } from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando dinero">
      <EsqueletoEncabezado />
      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white p-3.5 lg:rounded-xl"
          >
            <Raya className="h-3 w-20" />
            <div className="mt-2 h-6 w-24 rounded bg-tinta-200" />
            <Raya className="mt-2.5 h-[7px] w-full rounded-full" />
          </div>
        ))}
        {/* El botón verde de capturar gasto. */}
        <div className="rounded-[18px] bg-haaco-100 p-3.5 lg:rounded-xl">
          <div className="h-6 w-6 rounded-lg bg-haaco-200" />
          <div className="mt-2.5 h-4 w-28 rounded bg-haaco-200" />
          <div className="mt-1.5 h-3 w-20 rounded bg-haaco-200" />
        </div>
      </div>
      <EsqueletoBarras className="mb-3.5" />
      <div className="h-[62px] rounded-[20px] border-[0.5px] border-tinta-200 bg-white lg:rounded-xl" />
    </Esqueleto>
  )
}
