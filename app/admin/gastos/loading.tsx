import {
  Esqueleto,
  EsqueletoEncabezado,
  EsqueletoFila,
  EsqueletoIndicadores,
  EsqueletoMes,
  EsqueletoTabla,
  EsqueletoTarjeta,
  Raya,
} from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando gastos">
      <EsqueletoEncabezado acciones={1} />
      <EsqueletoIndicadores />
      {/* FiltrosGastos: periodo, obra, categoría. */}
      <div className="mb-3.5 flex flex-wrap gap-2 lg:mb-4">
        <div className="h-10 w-40 rounded-xl bg-tinta-150 lg:h-9 lg:rounded-lg" />
        <div className="h-10 w-32 rounded-xl bg-tinta-150 lg:h-9 lg:rounded-lg" />
        <div className="h-10 w-32 rounded-xl bg-tinta-150 lg:h-9 lg:rounded-lg" />
      </div>

      <div className="lg:hidden">
        <EsqueletoMes />
        <EsqueletoTarjeta titulo={false}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <EsqueletoFila key={i} />
          ))}
        </EsqueletoTarjeta>
      </div>

      <div className="hidden gap-4 lg:grid xl:grid-cols-4">
        <EsqueletoTabla filas={10} columnas={6} className="xl:col-span-3" />
        <EsqueletoTarjeta>
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between gap-3">
                <Raya className="h-3.5 w-24" />
                <Raya className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </EsqueletoTarjeta>
      </div>
    </Esqueleto>
  )
}
