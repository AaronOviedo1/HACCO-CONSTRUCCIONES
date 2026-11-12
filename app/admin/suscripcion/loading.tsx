import { Esqueleto, EsqueletoEncabezado, EsqueletoTarjeta, Raya } from '@/components/esqueletos'

export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando suscripción">
      <EsqueletoEncabezado />
      <EsqueletoTarjeta>
        <div className="space-y-4 px-4 py-5 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 shrink-0 rounded-xl bg-haaco-50" />
            <div className="min-w-0 flex-1">
              <div className="h-5 w-36 rounded bg-tinta-200" />
              <Raya className="mt-2 h-3.5 w-full max-w-md" />
              <Raya className="mt-1.5 h-3.5 w-3/4 max-w-sm" />
            </div>
          </div>
          <div className="h-56 rounded-xl bg-tinta-100" />
        </div>
      </EsqueletoTarjeta>
    </Esqueleto>
  )
}
