import {
  Esqueleto,
  EsqueletoEncabezado,
  EsqueletoIndicadores,
  EsqueletoPestanas,
  EsqueletoQuincenas,
} from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando pagos fijos">
      <EsqueletoEncabezado />
      <EsqueletoPestanas n={2} className="mb-5" />
      <EsqueletoIndicadores holgado enMovil={4} />
      <EsqueletoQuincenas />
    </Esqueleto>
  )
}
