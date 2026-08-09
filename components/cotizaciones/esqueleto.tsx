/**
 * Esqueleto del editor de cotización.
 *
 * El editor es la pantalla más pesada de la app y el esqueleto genérico de
 * tabla no se le parecía en nada: el brinco de una forma a otra se sentía como
 * si la pantalla se recargara. Éste copia su planta —encabezado, tarjetas
 * plegadas, columna de totales y barra fija— para que lo único que cambie al
 * llegar el contenido sea el relleno.
 */
export default function EsqueletoCotizacion() {
  return (
    <div className="animate-pulse pb-44 lg:pb-32" aria-busy="true" aria-label="Cargando cotización">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-32 rounded-lg bg-tinta-200" />
            <div className="h-5 w-20 rounded-full bg-tinta-150" />
            <div className="h-5 w-16 rounded-full bg-tinta-150" />
          </div>
          <div className="mt-2 h-4 w-56 max-w-full rounded bg-tinta-100" />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <div className="h-12 flex-1 rounded-[14px] bg-tinta-150 lg:h-9 lg:w-28 lg:flex-none lg:rounded-lg" />
          <div className="h-12 flex-1 rounded-[14px] bg-tinta-150 lg:h-9 lg:w-28 lg:flex-none lg:rounded-lg" />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {/* Tarjetas plegadas: encabezado y línea de resumen, como nacen en
              el teléfono. */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-[18px] border-[0.5px] border-tinta-200 bg-white px-5 py-4 shadow-tarjeta lg:rounded-xl"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="h-4 w-44 rounded bg-tinta-200" />
                <div className="h-4 w-4 rounded bg-tinta-150" />
              </div>
              <div className="mt-2.5 h-3 w-64 max-w-full rounded bg-tinta-100" />
            </div>
          ))}
        </div>

        <aside className="hidden lg:block">
          <div className="rounded-xl border-[0.5px] border-tinta-200 bg-white p-5 shadow-tarjeta">
            <div className="h-4 w-24 rounded bg-tinta-200" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="mt-4 flex items-center justify-between gap-4">
                <div className="h-3.5 w-20 rounded bg-tinta-100" />
                <div className="h-3.5 w-24 rounded bg-tinta-100" />
              </div>
            ))}
            <div className="mt-5 flex items-center justify-between gap-4 border-t-[0.5px] border-tinta-150 pt-4">
              <div className="h-4 w-16 rounded bg-tinta-200" />
              <div className="h-6 w-28 rounded bg-tinta-200" />
            </div>
          </div>
        </aside>
      </div>

      {/* La barra de guardar vive fija sobre las pestañas: si el esqueleto no
          la reserva, el contenido salta al hidratar. Misma planta que la del
          editor: tarjeta de cristal en el teléfono, franja en escritorio. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[var(--alto-tabs)] z-30 px-4 lg:pointer-events-auto lg:bottom-0 lg:border-t-[0.5px] lg:border-tinta-200 lg:bg-white/95 lg:py-3 lg:pl-72 lg:backdrop-blur-xl">
        <div className="pointer-events-auto relative mx-auto max-w-7xl max-lg:cristal max-lg:cristal-brillo max-lg:rounded-[1.625rem] max-lg:px-4 max-lg:py-3">
          <div className="h-12 rounded-[14px] bg-tinta-150 lg:h-9 lg:w-40" />
        </div>
      </div>
    </div>
  )
}
