import {
  Esqueleto,
  EsqueletoEncabezado,
  EsqueletoFiltros,
  EsqueletoIndicadores,
  EsqueletoMes,
  EsqueletoTabla,
  EsqueletoTarjetas,
} from '@/components/esqueletos'

/**
 * La lista vive en el grupo `(lista)` para que este esqueleto sea sólo suyo.
 * En `app/admin/servicios/` envolvería también a las fichas hijas, y al abrir una se
 * asomaría primero la silueta de la lista.
 */
export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando servicios">
      <EsqueletoEncabezado acciones={1} accionesEnMovil={false} />
      <EsqueletoIndicadores enMovil={4} />
      <EsqueletoFiltros chips={4} apilado />
      <div className="lg:hidden">
        <EsqueletoMes />
        <EsqueletoTarjetas n={3} />
      </div>
      <EsqueletoTabla filas={10} columnas={7} className="hidden lg:block" />
    </Esqueleto>
  )
}
