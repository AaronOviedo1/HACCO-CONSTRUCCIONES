import type { ReactNode } from 'react'

/**
 * Piezas para armar el esqueleto de cada pantalla.
 *
 * Un esqueleto genérico para toda la app hacía que la pantalla brincara de una
 * forma a otra al llegar los datos, y eso se siente como recarga, no como
 * avance. Estas piezas copian las medidas de las de verdad (`EncabezadoPagina`,
 * `Indicador`, `Tarjeta`, `FilaLista`, la tabla) para que cada `loading.tsx`
 * repita la planta de su pantalla y lo único que cambie sea el relleno.
 *
 * Si una medida cambia en `components/ui.tsx` o en `components/movil/piezas.tsx`,
 * se cambia también aquí.
 */

const CAJA = 'border-[0.5px] border-tinta-200 bg-white shadow-tarjeta'

/** Raya gris del tamaño de un renglón de texto. */
export function Raya({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-tinta-100 ${className}`} />
}

/** Contenedor de todo esqueleto: pulsa y avisa al lector de pantalla. */
export function Esqueleto({
  children,
  etiqueta = 'Cargando',
  className = '',
}: {
  children: ReactNode
  etiqueta?: string
  className?: string
}) {
  return (
    <div className={`animate-pulse ${className}`} aria-busy="true" aria-label={etiqueta}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Encabezado de pantalla
// ---------------------------------------------------------------------------
export function EsqueletoEncabezado({
  acciones = 0,
  accionesEnMovil = true,
  descripcion = true,
}: {
  /** Cuántos botones lleva a la derecha. */
  acciones?: number
  /** Algunas pantallas esconden el botón en el teléfono y lo mandan abajo. */
  accionesEnMovil?: boolean
  descripcion?: boolean
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-6 lg:gap-4">
      <div className="min-w-0">
        <div className="h-[35px] w-52 rounded-lg bg-tinta-200 lg:h-8 lg:w-56" />
        {descripcion && <Raya className="mt-2 h-4 w-72 max-w-full lg:mt-1.5 lg:w-96" />}
      </div>
      {acciones > 0 && (
        <div
          className={`w-full items-center gap-2 lg:flex lg:w-auto ${accionesEnMovil ? 'flex' : 'hidden'}`}
        >
          {Array.from({ length: acciones }, (_, i) => (
            <div
              key={i}
              className="h-[46px] flex-1 rounded-xl bg-tinta-150 lg:h-9 lg:w-32 lg:flex-none lg:rounded-lg"
            />
          ))}
        </div>
      )}
    </header>
  )
}

// ---------------------------------------------------------------------------
// Indicadores (KPIs)
// ---------------------------------------------------------------------------
function CajaIndicador({ className = '' }: { className?: string }) {
  return (
    <div className={`min-w-0 rounded-[18px] px-3.5 py-3.5 lg:rounded-xl lg:px-4 ${CAJA} ${className}`}>
      <Raya className="h-3 w-20 max-w-full lg:h-3.5 lg:w-24" />
      <div className="mt-2 h-6 w-24 max-w-full rounded bg-tinta-200 lg:h-7 lg:w-28" />
      <Raya className="mt-1.5 h-3 w-16 max-w-full" />
    </div>
  )
}

export function EsqueletoIndicadores({
  n = 4,
  enMovil = 2,
  holgado = false,
  rejilla,
}: {
  n?: number
  /** Cuántos se ven en el teléfono; el resto sólo en escritorio. */
  enMovil?: number
  /** Las pantallas viejas usan `mb-5 gap-3` también en el teléfono. */
  holgado?: boolean
  /** Columnas, si no son las de siempre (`grid-cols-2` y `lg:grid-cols-4`). */
  rejilla?: string
}) {
  const columnas = rejilla ?? `grid-cols-2 ${n === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`
  return (
    <div
      className={`grid ${columnas} ${holgado ? 'mb-5 gap-3' : 'mb-3.5 gap-2.5 lg:mb-5 lg:gap-3'}`}
    >
      {Array.from({ length: n }, (_, i) => (
        <CajaIndicador key={i} className={i >= enMovil ? 'hidden lg:block' : ''} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pestañas, chips y buscador
// ---------------------------------------------------------------------------
const ANCHOS = ['w-24', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20', 'w-28', 'w-20', 'w-24']

/** El `<nav>` de pestañas de escritorio (`rounded-lg px-3 py-2 text-sm`). */
export function EsqueletoPestanas({
  n,
  soloEscritorio = false,
  className = 'mb-4',
}: {
  n: number
  soloEscritorio?: boolean
  className?: string
}) {
  return (
    <div
      className={`${soloEscritorio ? 'hidden lg:flex' : 'flex'} flex-wrap items-center gap-1.5 ${className}`}
    >
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className={`h-9 rounded-lg ${i === 0 ? 'bg-tinta-200' : 'bg-tinta-150'} ${ANCHOS[i % ANCHOS.length]}`}
        />
      ))}
    </div>
  )
}

/** Los chips de `ChipsFiltro` (`min-h-9 rounded-full`). */
export function EsqueletoChips({ n, className = 'mb-4' }: { n: number; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className={`h-9 rounded-full lg:rounded-lg ${i === 0 ? 'bg-tinta-200' : 'bg-tinta-150'} ${ANCHOS[i % ANCHOS.length]}`}
        />
      ))}
    </div>
  )
}

/** `BuscadorTabla`: alto y redondo en el teléfono, compacto en escritorio. */
export function EsqueletoBuscador({ className = 'mb-3' }: { className?: string }) {
  return (
    <div
      className={`h-12 w-full rounded-2xl bg-tinta-150 lg:h-9 lg:max-w-sm lg:rounded-lg ${className}`}
    />
  )
}

/**
 * La fila de filtros de las listas: buscador y chips.
 *
 * - `apilado`: en el teléfono los chips van debajo del buscador (clientes,
 *   servicios); si no, comparten renglón y los chips se encogen.
 * - `chipsEnEscritorio`: en algunas pantallas los chips sólo existen en el
 *   teléfono y en escritorio los sustituyen las pestañas.
 */
export function EsqueletoFiltros({
  chips = 0,
  apilado = false,
  chipsEnEscritorio = true,
}: {
  chips?: number
  apilado?: boolean
  chipsEnEscritorio?: boolean
}) {
  return (
    <div
      className={`mb-3.5 flex gap-2.5 lg:mb-4 lg:flex-row lg:items-center lg:gap-3 ${
        apilado ? 'flex-col' : 'items-center gap-2'
      }`}
    >
      <EsqueletoBuscador className={apilado ? '' : 'min-w-0 flex-1 lg:flex-none'} />
      {chips > 0 && (
        <EsqueletoChips
          n={chips}
          className={`${apilado ? '' : 'shrink-0'} ${chipsEnEscritorio ? '' : 'lg:hidden'}`}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------------

/** Un renglón de `FilaLista`: dos líneas a la izquierda y un monto a la derecha. */
export function EsqueletoFila() {
  return (
    <div className="flex items-center justify-between gap-2.5 border-b-[0.5px] border-tinta-100 px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="h-4 w-40 max-w-full rounded bg-tinta-150" />
        <Raya className="mt-1.5 h-3 w-24" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="h-4 w-20 rounded bg-tinta-150" />
        <Raya className="h-3 w-12" />
      </div>
    </div>
  )
}

/** Tabla de escritorio dentro de su `Tarjeta`, con la cabecera verde de `Th`. */
export function EsqueletoTabla({
  filas = 8,
  columnas = 5,
  titulo = false,
  className = '',
}: {
  filas?: number
  columnas?: number
  titulo?: boolean
  className?: string
}) {
  return (
    <div className={`overflow-hidden rounded-[20px] lg:rounded-xl ${CAJA} ${className}`}>
      {titulo && (
        <div className="border-b-[0.5px] border-tinta-150 px-4 py-3 sm:px-5">
          <div className="h-4 w-36 rounded bg-tinta-200" />
        </div>
      )}
      <div className="flex h-[37px] items-center gap-6 border-b border-haaco-200 bg-haaco-50 px-4">
        {Array.from({ length: columnas }, (_, i) => (
          <div key={i} className={`h-3 rounded bg-haaco-100 ${i === 1 ? 'flex-1' : 'w-16'}`} />
        ))}
      </div>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex h-[41px] items-center gap-6 border-b border-tinta-100 px-4 last:border-b-0">
          {Array.from({ length: columnas }, (_, j) => (
            <Raya key={j} className={`h-3.5 ${j === 1 ? 'flex-1' : j === 0 ? 'w-16' : 'w-20'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * La lista de casi todas las pantallas: renglones dentro de una tarjeta en el
 * teléfono y tabla en escritorio.
 */
export function EsqueletoLista({
  filas = 6,
  filasTabla = 8,
  columnas = 5,
  titulo = false,
}: {
  filas?: number
  filasTabla?: number
  columnas?: number
  titulo?: boolean
}) {
  return (
    <>
      <div className={`overflow-hidden rounded-[20px] lg:hidden ${CAJA}`}>
        {titulo && (
          <div className="border-b-[0.5px] border-tinta-150 px-4 py-3">
            <div className="h-4 w-28 rounded bg-tinta-200" />
          </div>
        )}
        {Array.from({ length: filas }, (_, i) => (
          <EsqueletoFila key={i} />
        ))}
      </div>
      <EsqueletoTabla filas={filasTabla} columnas={columnas} titulo={titulo} className="hidden lg:block" />
    </>
  )
}

/** Tarjetas sueltas del teléfono (obras, servicios), una sobre otra. */
export function EsqueletoTarjetas({ n = 3, className = '' }: { n?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`rounded-[20px] px-4 pb-3.5 pt-4 ${CAJA}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="h-[18px] w-44 max-w-full rounded bg-tinta-200" />
              <Raya className="mt-2 h-3 w-28" />
            </div>
            <div className="h-5 w-16 rounded-full bg-tinta-150" />
          </div>
          <Raya className="mt-4 h-1.5 w-full rounded-full" />
          <div className="mt-3 flex justify-between">
            <Raya className="h-3 w-24" />
            <Raya className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Encabezado de mes plegado, como en las listas agrupadas por mes. */
export function EsqueletoMes() {
  return (
    <div className="mb-2 mt-1 flex items-center justify-between px-1">
      <div className="h-4 w-28 rounded bg-tinta-200" />
      <Raya className="h-3.5 w-20" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta con cuerpo libre y gráficas
// ---------------------------------------------------------------------------
export function EsqueletoTarjeta({
  titulo = true,
  className = '',
  children,
}: {
  titulo?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={`overflow-hidden rounded-[20px] lg:rounded-xl ${CAJA} ${className}`}>
      {titulo && (
        <div className="border-b-[0.5px] border-tinta-150 px-4 py-3 sm:px-5">
          <div className="h-4 w-36 rounded bg-tinta-200" />
        </div>
      )}
      {children}
    </div>
  )
}

/** Gráfica en su tarjeta, con la proporción del lienzo de 620×190. */
export function EsqueletoGrafica({ className = '' }: { className?: string }) {
  return (
    <EsqueletoTarjeta className={className}>
      <div className="p-4 sm:p-5">
        <div className="aspect-[620/190] w-full rounded-lg bg-tinta-100" />
      </div>
    </EsqueletoTarjeta>
  )
}

/** `BarrasSemanas`: la tarjeta de barras del teléfono. */
export function EsqueletoBarras({ className = '' }: { className?: string }) {
  const altos = ['h-10', 'h-16', 'h-12', 'h-20', 'h-14', 'h-8']
  return (
    <EsqueletoTarjeta className={className}>
      <div className="flex h-24 items-end gap-2 px-4 py-3">
        {altos.map((alto, i) => (
          <div key={i} className={`flex-1 rounded-t-md bg-tinta-100 ${alto}`} />
        ))}
      </div>
    </EsqueletoTarjeta>
  )
}

// ---------------------------------------------------------------------------
// Pantallas de menú («Más», «Perfil»)
// ---------------------------------------------------------------------------
export function EsqueletoMenu({ grupos = [4, 3] }: { grupos?: number[] }) {
  return (
    <>
      <div className={`mb-4 flex items-center gap-3.5 rounded-[20px] p-4 lg:rounded-xl ${CAJA}`}>
        <div className="h-14 w-14 shrink-0 rounded-2xl bg-tinta-200" />
        <div className="min-w-0 flex-1">
          <div className="h-[18px] w-40 rounded bg-tinta-200" />
          <Raya className="mt-2 h-3.5 w-28" />
        </div>
      </div>
      {grupos.map((n, g) => (
        <div key={g} className="mb-4">
          <Raya className="mb-2 ml-1.5 h-3 w-24" />
          <div className={`overflow-hidden rounded-[20px] lg:rounded-xl ${CAJA}`}>
            {Array.from({ length: n }, (_, i) => (
              <div
                key={i}
                className="flex min-h-[52px] items-center justify-between gap-3 border-b-[0.5px] border-tinta-100 px-4 last:border-b-0"
              >
                <div className="h-4 w-36 rounded bg-tinta-150" />
                <Raya className="h-3.5 w-2" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="min-h-[52px] rounded-[18px] bg-tinta-150" />
    </>
  )
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------
export function EsqueletoFormulario({ campos = 6 }: { campos?: number }) {
  return (
    <EsqueletoTarjeta titulo={false}>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        {Array.from({ length: campos }, (_, i) => (
          <div key={i} className={i === 0 ? 'sm:col-span-2' : ''}>
            <Raya className="h-3.5 w-24" />
            <div className="mt-2 h-11 rounded-xl bg-tinta-100 lg:h-10 lg:rounded-lg" />
          </div>
        ))}
        <div className="sm:col-span-2">
          <Raya className="h-3.5 w-24" />
          <div className="mt-2 h-24 rounded-xl bg-tinta-100 lg:rounded-lg" />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t-[0.5px] border-tinta-150 px-4 py-3 sm:px-5">
        <div className="h-[46px] flex-1 rounded-xl bg-tinta-150 lg:h-9 lg:w-28 lg:flex-none lg:rounded-lg" />
        <div className="h-[46px] flex-1 rounded-xl bg-tinta-200 lg:h-9 lg:w-32 lg:flex-none lg:rounded-lg" />
      </div>
    </EsqueletoTarjeta>
  )
}

// ---------------------------------------------------------------------------
// Cuerpos de pestaña
//
// Lo que cambia al pasar de una pestaña a otra sin salir de la pantalla. Los
// usa el `loading.tsx` de la pantalla y también su `ContenidoPestana`, para
// que la entrada y el cambio de pestaña se vean igual.
// ---------------------------------------------------------------------------

/** Pagos fijos: la barra del mes y las tarjetas de cada quincena con su resumen. */
export function EsqueletoQuincenas() {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="h-9 w-40 rounded-lg bg-tinta-150" />
        <div className="ml-auto h-9 w-36 rounded-lg bg-tinta-200" />
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        <div className="min-w-0 space-y-4 xl:col-span-3">
          {[0, 1].map((q) => (
            <EsqueletoTarjeta key={q}>
              {[0, 1, 2, 3].map((i) => (
                <EsqueletoFila key={i} />
              ))}
            </EsqueletoTarjeta>
          ))}
        </div>
        <EsqueletoTarjeta className="min-w-0">
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="flex justify-between gap-3">
                  <Raya className="h-3.5 w-20" />
                  <Raya className="h-3.5 w-16" />
                </div>
                <Raya className="mt-1.5 h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </EsqueletoTarjeta>
      </div>
    </>
  )
}

/** Detalle de obra: las tarjetas de una sección. */
export function EsqueletoSeccionObra() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`rounded-[18px] p-4 lg:rounded-xl ${CAJA}`}
        >
          <div className="h-4 w-32 rounded bg-tinta-200" />
          <Raya className="mt-3 h-3.5 w-full" />
          <Raya className="mt-2 h-3.5 w-3/4" />
        </div>
      ))}
    </div>
  )
}
