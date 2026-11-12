import {
  Esqueleto,
  EsqueletoChips,
  EsqueletoEncabezado,
  EsqueletoFila,
  EsqueletoIndicadores,
  EsqueletoMes,
  EsqueletoTabla,
  EsqueletoTarjeta,
} from '@/components/esqueletos'

/**
 * La lista vive en el grupo `(lista)` para que este esqueleto sea sólo suyo.
 * En `app/admin/cotizaciones/` envolvería también a las fichas hijas, y al abrir una se
 * asomaría primero la silueta de la lista.
 */
export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando cotizaciones">
      <EsqueletoEncabezado acciones={1} accionesEnMovil={false} />
      <EsqueletoIndicadores enMovil={4} />
      <EsqueletoChips n={2} className="mb-3.5 lg:mb-4" />
      {/* FiltrosCotizaciones: cliente y periodo. */}
      <div className="mb-3.5 flex flex-wrap gap-2 lg:mb-4">
        <div className="h-11 w-full rounded-xl bg-tinta-150 lg:h-9 lg:w-64 lg:rounded-lg" />
        <div className="hidden h-9 w-44 rounded-lg bg-tinta-150 lg:block" />
      </div>

      <div className="lg:hidden">
        <EsqueletoMes />
        <EsqueletoTarjeta titulo={false}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <EsqueletoFila key={i} />
          ))}
        </EsqueletoTarjeta>
      </div>
      <EsqueletoTabla filas={10} columnas={7} className="hidden lg:block" />
    </Esqueleto>
  )
}
