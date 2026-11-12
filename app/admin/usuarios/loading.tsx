import { Esqueleto, EsqueletoEncabezado, EsqueletoFiltros, EsqueletoLista } from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando usuarios">
      <EsqueletoEncabezado acciones={1} />
      <EsqueletoFiltros chips={2} />
      <EsqueletoLista filas={8} filasTabla={10} />
    </Esqueleto>
  )
}
