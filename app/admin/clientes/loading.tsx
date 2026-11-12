import { Esqueleto, EsqueletoEncabezado, EsqueletoFiltros, EsqueletoLista } from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando clientes">
      <EsqueletoEncabezado acciones={1} />
      <EsqueletoFiltros chips={3} apilado />
      <EsqueletoLista filas={8} filasTabla={10} />
    </Esqueleto>
  )
}
