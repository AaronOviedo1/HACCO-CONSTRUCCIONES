import {
  Esqueleto,
  EsqueletoEncabezado,
  EsqueletoIndicadores,
  EsqueletoLista,
  EsqueletoPestanas,
  EsqueletoTarjeta,
  Raya,
} from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando nómina">
      <EsqueletoEncabezado />

      {/* Teléfono: lo que se paga esta semana y sus barras. */}
      <div className="mb-3.5 lg:hidden">
        <div className="rounded-[20px] bg-haaco-100 p-4.5">
          <div className="h-3 w-32 rounded bg-haaco-200" />
          <div className="mt-2 h-8 w-36 rounded bg-haaco-200" />
          <div className="mt-2 h-3 w-48 max-w-full rounded bg-haaco-200" />
        </div>
        <EsqueletoTarjeta titulo={false} className="mt-3.5">
          <div className="space-y-3.5 px-3.5 py-4">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <Raya className="h-3.5 w-32" />
                <Raya className="mt-2 h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </EsqueletoTarjeta>
      </div>

      <EsqueletoIndicadores enMovil={3} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <EsqueletoPestanas n={4} soloEscritorio className="" />
        <div className="h-9 w-40 rounded-lg bg-tinta-150" />
      </div>
      <EsqueletoLista filas={6} filasTabla={10} columnas={6} />
    </Esqueleto>
  )
}
