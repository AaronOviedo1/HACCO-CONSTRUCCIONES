import {
  Esqueleto,
  EsqueletoEncabezado,
  EsqueletoIndicadores,
  EsqueletoLista,
  EsqueletoTarjeta,
  Raya,
} from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando reporte">
      <EsqueletoEncabezado />
      {/* BarraReportes: mes, secciones y exportar. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="h-9 w-40 rounded-lg bg-tinta-150" />
        <div className="hidden h-9 w-72 rounded-lg bg-tinta-100 lg:block" />
        <div className="ml-auto h-9 w-24 rounded-lg bg-tinta-150" />
        <div className="h-9 w-24 rounded-lg bg-tinta-200" />
      </div>

      <div className="space-y-5">
        <section>
          <div className="mb-3 h-6 w-48 rounded bg-tinta-200" />
          <EsqueletoIndicadores holgado enMovil={4} />
          <div className="grid gap-4 lg:grid-cols-3">
            <EsqueletoTarjeta className="lg:col-span-2">
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <Raya className="h-3.5 w-40" />
                    <Raya className="h-3.5 w-20" />
                  </div>
                ))}
              </div>
            </EsqueletoTarjeta>
            <EsqueletoTarjeta>
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between gap-3">
                    <Raya className="h-3.5 w-24" />
                    <Raya className="h-3.5 w-16" />
                  </div>
                ))}
              </div>
            </EsqueletoTarjeta>
          </div>
        </section>

        <section>
          <div className="mb-3 h-6 w-40 rounded bg-tinta-200" />
          <EsqueletoLista filas={5} filasTabla={8} columnas={7} />
        </section>
      </div>
    </Esqueleto>
  )
}
