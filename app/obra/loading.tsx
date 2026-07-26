export default function Cargando() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Cargando">
      <div className="h-6 w-40 rounded-lg bg-tinta-200" />
      <div className="h-4 w-64 max-w-full rounded bg-tinta-100" />

      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-tinta-200 bg-white p-4">
          <div className="h-5 w-48 rounded bg-tinta-200" />
          <div className="mt-2 h-3 w-24 rounded bg-tinta-100" />
          <div className="mt-4 h-2 w-full rounded-full bg-tinta-100" />
          <div className="mt-4 h-12 w-full rounded-xl bg-tinta-100" />
        </div>
      ))}
    </div>
  )
}
