import { Esqueleto, EsqueletoEncabezado, EsqueletoIndicadores, EsqueletoTabla } from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando caja chica">
      <EsqueletoEncabezado />
      <EsqueletoIndicadores holgado enMovil={4} />
      {/* Filtro de periodo y botones de entrada y salida. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="h-9 w-44 rounded-lg bg-tinta-150" />
        <div className="ml-auto h-9 w-28 rounded-lg bg-tinta-150" />
        <div className="h-9 w-28 rounded-lg bg-tinta-200" />
      </div>
      <EsqueletoTabla filas={10} columnas={5} />
    </Esqueleto>
  )
}
