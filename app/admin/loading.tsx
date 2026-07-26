/** Esqueleto mientras el servidor arma la pantalla. */
export default function Cargando() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="mb-6">
        <div className="h-7 w-56 rounded-lg bg-tinta-200" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-tinta-100" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-tinta-200 bg-white px-4 py-3.5">
            <div className="h-3 w-24 rounded bg-tinta-100" />
            <div className="mt-2 h-7 w-28 rounded bg-tinta-200" />
            <div className="mt-2 h-3 w-20 rounded bg-tinta-100" />
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-tinta-200 bg-white">
        <div className="h-11 border-b border-tinta-100 bg-tinta-50" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-tinta-100 px-4 py-3">
            <div className="h-4 w-20 rounded bg-tinta-100" />
            <div className="h-4 flex-1 rounded bg-tinta-100" />
            <div className="h-4 w-24 rounded bg-tinta-100" />
            <div className="h-4 w-16 rounded bg-tinta-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
