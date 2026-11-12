import {
  Esqueleto,
  EsqueletoEncabezado,
  EsqueletoGrafica,
  Raya,
} from '@/components/esqueletos'

/**
 * Esqueleto del tablero.
 *
 * La portada vive en el grupo `(inicio)` para que este esqueleto sea sólo
 * suyo: un `loading.tsx` en `app/admin/` envolvía también a todas las demás
 * pantallas, y al abrir cualquiera se asomaba primero la silueta del tablero.
 */
export default function Cargando() {
  return (
    <Esqueleto etiqueta="Cargando tablero">
      <EsqueletoEncabezado />

      <div className="grid gap-3.5 lg:grid-cols-2">
        {/* La tarjeta verde de cobranza. */}
        <div className="rounded-[22px] bg-haaco-100 p-4.5 lg:rounded-xl">
          <div className="flex items-center gap-4">
            <div className="h-[86px] w-[86px] shrink-0 rounded-full border-[9px] border-haaco-200" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-20 rounded bg-haaco-200" />
              <div className="mt-2 h-8 w-32 rounded bg-haaco-200" />
              <div className="mt-2 h-3 w-40 max-w-full rounded bg-haaco-200" />
            </div>
          </div>
          <div className="mt-4 h-11 rounded-[13px] bg-haaco-200/70" />
        </div>

        {/* Ventas del mes contra la meta. */}
        <div className="rounded-[22px] border-[0.5px] border-tinta-200 bg-white p-4.5 shadow-tarjeta lg:rounded-xl">
          <div className="flex items-center gap-4">
            <div className="h-[86px] w-[86px] shrink-0 rounded-full border-[9px] border-tinta-150" />
            <div className="min-w-0 flex-1">
              <Raya className="h-3 w-24" />
              <div className="mt-2 h-8 w-32 rounded bg-tinta-200" />
              <Raya className="mt-2 h-3 w-40 max-w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Los cuatro números del día. */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white p-3.5 lg:rounded-xl"
          >
            <Raya className="h-3 w-20" />
            <div className="mt-2 h-6 w-24 rounded bg-tinta-200" />
            <Raya className="mt-1.5 h-3 w-28 max-w-full" />
          </div>
        ))}
      </div>

      {/* Las gráficas: dos a la par y luego filas de dos tercios y un tercio. */}
      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <EsqueletoGrafica />
        <EsqueletoGrafica className="hidden lg:block" />
      </div>
      <div className="mt-3.5 hidden gap-3.5 lg:grid lg:grid-cols-3">
        <EsqueletoGrafica className="lg:col-span-2" />
        <EsqueletoGrafica />
      </div>
    </Esqueleto>
  )
}
