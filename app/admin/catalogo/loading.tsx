import {
  Esqueleto,
  EsqueletoBuscador,
  EsqueletoEncabezado,
  EsqueletoLista,
  EsqueletoPestanas,
} from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando catálogo">
      <EsqueletoEncabezado acciones={1} />
      <EsqueletoPestanas n={4} className="mb-5" />
      <EsqueletoBuscador className="mb-4" />
      <EsqueletoLista filas={8} filasTabla={10} columnas={6} />
    </Esqueleto>
  )
}
