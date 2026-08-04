/**
 * Esqueleto del detalle de obra.
 *
 * Cada cambio de sección vuelve a armar el concentrado completo en el
 * servidor; sin esto la pantalla se quedaba en blanco a medio camino.
 */
export default function Cargando() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="mb-4 rounded-[18px] border-[0.5px] border-tinta-200 bg-white p-4 lg:rounded-xl">
        <div className="h-5 w-48 rounded bg-tinta-200" />
        <div className="mt-2 h-3.5 w-64 max-w-full rounded bg-tinta-100" />
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-tinta-100" />
          ))}
        </div>
      </div>

      <div className="mb-4 h-11 rounded-[12px] bg-tinta-150 lg:mb-5 lg:h-9 lg:w-full" />

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white p-4 lg:rounded-xl">
            <div className="h-4 w-32 rounded bg-tinta-200" />
            <div className="mt-3 h-3.5 w-full rounded bg-tinta-100" />
            <div className="mt-2 h-3.5 w-3/4 rounded bg-tinta-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
