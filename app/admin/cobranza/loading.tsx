import {
  Esqueleto,
  EsqueletoEncabezado,
  EsqueletoFiltros,
  EsqueletoIndicadores,
  EsqueletoMes,
  EsqueletoPestanas,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando cobranza">
      <EsqueletoEncabezado />
      <EsqueletoIndicadores />
      {/* Teléfono: buscador y chips; escritorio: buscador y luego pestañas. */}
      <EsqueletoFiltros chips={2} chipsEnEscritorio={false} />
      <EsqueletoPestanas n={4} soloEscritorio />

      <div className="lg:hidden">
        <EsqueletoMes />
        <EsqueletoTarjetas n={3} />
      </div>
      <EsqueletoTabla filas={10} columnas={7} className="hidden lg:block" />
    </Esqueleto>
  )
}
