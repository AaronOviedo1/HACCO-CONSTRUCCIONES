import {
  Esqueleto,
  EsqueletoBuscador,
  EsqueletoEncabezado,
  EsqueletoIndicadores,
  EsqueletoLista,
  EsqueletoPestanas,
} from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando herramientas">
      <EsqueletoEncabezado acciones={1} />
      <EsqueletoIndicadores holgado enMovil={4} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <EsqueletoBuscador className="" />
        <EsqueletoPestanas n={4} className="" />
      </div>
      <EsqueletoLista filas={8} filasTabla={10} columnas={6} />
    </Esqueleto>
  )
}
