import {
  Esqueleto,
  EsqueletoBarras,
  EsqueletoEncabezado,
  EsqueletoFila,
  EsqueletoIndicadores,
  EsqueletoMes,
  EsqueletoPestanas,
  EsqueletoTabla,
  EsqueletoTarjeta,
} from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando cuentas por pagar">
      <EsqueletoEncabezado acciones={1} />
      <EsqueletoIndicadores />

      <div className="lg:hidden">
        <EsqueletoBarras className="mb-3.5" />
        <div className="mb-3.5 h-11 rounded-[12px] bg-tinta-150" />
        <EsqueletoMes />
        <EsqueletoTarjeta titulo={false}>
          {[0, 1, 2, 3, 4].map((i) => (
            <EsqueletoFila key={i} />
          ))}
        </EsqueletoTarjeta>
      </div>

      <EsqueletoPestanas n={3} soloEscritorio />
      <EsqueletoTabla filas={10} columnas={7} className="hidden lg:block" />
    </Esqueleto>
  )
}
