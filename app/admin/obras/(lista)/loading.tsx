import {
  Esqueleto,
  EsqueletoBuscador,
  EsqueletoChips,
  EsqueletoEncabezado,
  EsqueletoIndicadores,
  EsqueletoMes,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from '@/components/esqueletos'

/**
 * La lista vive en el grupo `(lista)` para que este esqueleto sea sólo suyo.
 * En `app/admin/obras/` envolvería también a las fichas hijas, y al abrir una se
 * asomaría primero la silueta de la lista.
 */
export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando obras">
      <EsqueletoEncabezado />
      <EsqueletoIndicadores enMovil={3} rejilla="grid-cols-[0.72fr_1fr_1fr] lg:grid-cols-4" />
      <div className="mb-3.5 flex items-center gap-2 lg:mb-4 lg:flex-wrap lg:gap-3">
        <EsqueletoBuscador className="min-w-0 flex-1 lg:flex-none" />
        {/* Teléfono: el selector de un renglón; escritorio: los chips. */}
        <div className="h-11 w-32 shrink-0 rounded-[12px] bg-tinta-150 lg:hidden" />
        <EsqueletoChips n={5} className="hidden lg:flex" />
      </div>

      <div className="lg:hidden">
        <EsqueletoMes />
        <EsqueletoTarjetas n={3} />
      </div>
      <EsqueletoTabla filas={10} columnas={7} className="hidden lg:block" />
    </Esqueleto>
  )
}
