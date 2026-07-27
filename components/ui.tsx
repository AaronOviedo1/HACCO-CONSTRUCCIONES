import Link from 'next/link'
import type { ReactNode } from 'react'

// ---------------------------------------------------------------------------
// Encabezado de pantalla
// ---------------------------------------------------------------------------
export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string
  descripcion?: string
  acciones?: ReactNode
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-6 lg:gap-4">
      <div className="min-w-0">
        {/* Teléfono: título de portada, como en iOS. Escritorio: el display de marca. */}
        <h1 className="text-[32px] font-bold leading-[1.1] -tracking-[0.8px] text-tinta-900 lg:tipo-display lg:text-2xl lg:font-extrabold lg:tracking-tight lg:text-haaco-900">
          {titulo}
        </h1>
        {descripcion && (
          <p className="mt-1.5 text-sm leading-[1.45] text-tinta-500 text-pretty lg:mt-1">
            {descripcion}
          </p>
        )}
      </div>
      {acciones && <div className="flex w-full items-center gap-2 lg:w-auto">{acciones}</div>}
    </header>
  )
}

// ---------------------------------------------------------------------------
// Tarjeta
// ---------------------------------------------------------------------------
export function Tarjeta({
  titulo,
  pie,
  children,
  className = '',
}: {
  titulo?: ReactNode
  pie?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`overflow-hidden rounded-[20px] border-[0.5px] border-tinta-200 bg-white shadow-tarjeta lg:rounded-xl ${className}`}
    >
      {titulo && (
        <div className="border-b-[0.5px] border-tinta-150 px-4 py-3 text-[14.5px] font-semibold text-tinta-900 sm:px-5 lg:text-sm lg:text-tinta-800">
          {titulo}
        </div>
      )}
      {children}
      {pie && (
        <div className="border-t-[0.5px] border-tinta-150 bg-tinta-50 px-4 py-2 text-xs text-tinta-500 sm:px-5">
          {pie}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Indicador numérico
// ---------------------------------------------------------------------------
export function Indicador({
  etiqueta,
  valor,
  nota,
  tono = 'neutro',
  href,
  className = '',
}: {
  etiqueta: string
  valor: string
  nota?: string
  tono?: 'neutro' | 'verde' | 'ambar' | 'rojo'
  href?: string
  className?: string
}) {
  const tonos = {
    neutro: 'text-tinta-900',
    verde: 'text-haaco-700',
    ambar: 'text-amber-600',
    rojo: 'text-red-600',
  } as const

  const contenido = (
    <>
      <div className="text-[10.5px] font-semibold uppercase leading-tight tracking-[0.07em] text-tinta-500 lg:text-xs lg:font-medium lg:tracking-wide">
        {etiqueta}
      </div>
      <div
        className={`mt-1.5 text-[22px] font-bold -tracking-[0.6px] tabular-nums lg:tipo-display lg:text-2xl lg:font-extrabold lg:tracking-normal ${tonos[tono]}`}
      >
        {valor}
      </div>
      {nota && <div className="mt-1 text-[11px] leading-snug text-tinta-400 lg:text-xs">{nota}</div>}
    </>
  )

  const clases =
    `block rounded-[18px] border-[0.5px] border-tinta-200 bg-white px-3.5 py-3.5 shadow-tarjeta lg:rounded-xl lg:px-4 ${className}`

  return href ? (
    <Link href={href} className={`${clases} transition active:bg-tinta-50 lg:hover:border-haaco-400 lg:hover:bg-haaco-50`}>
      {contenido}
    </Link>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}

// ---------------------------------------------------------------------------
// Etiqueta de estado
// ---------------------------------------------------------------------------
const TONOS_ETIQUETA = {
  verde: 'bg-haaco-100 text-haaco-800',
  gris: 'bg-tinta-150 text-tinta-700',
  ambar: 'bg-amber-100 text-amber-800',
  rojo: 'bg-red-100 text-red-800',
  azul: 'bg-sky-100 text-sky-800',
} as const

export type TonoEtiqueta = keyof typeof TONOS_ETIQUETA

export function Etiqueta({
  children,
  tono = 'gris',
}: {
  children: ReactNode
  tono?: TonoEtiqueta
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-semibold lg:text-xs ${TONOS_ETIQUETA[tono]}`}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Tabla
// ---------------------------------------------------------------------------
export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Th({
  children,
  numerico = false,
}: {
  children: ReactNode
  numerico?: boolean
}) {
  return (
    <th
      className={`whitespace-nowrap border-b border-haaco-200 bg-haaco-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-haaco-700 ${
        numerico ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  numerico = false,
  className = '',
}: {
  children: ReactNode
  numerico?: boolean
  className?: string
}) {
  return (
    <td
      className={`border-b border-tinta-100 px-4 py-2.5 text-tinta-700 ${
        numerico ? 'text-right tabular-nums' : ''
      } ${className}`}
    >
      {children}
    </td>
  )
}

// ---------------------------------------------------------------------------
// Estados vacíos y módulos por construir
// ---------------------------------------------------------------------------
export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion?: string
  accion?: ReactNode
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-tinta-700">{titulo}</p>
      {descripcion && <p className="mx-auto mt-1 max-w-md text-sm text-tinta-500">{descripcion}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  )
}

export function ModuloPendiente({
  titulo,
  descripcion,
  incluye,
}: {
  titulo: string
  descripcion: string
  incluye: string[]
}) {
  return (
    <>
      <EncabezadoPagina titulo={titulo} descripcion={descripcion} />
      <Tarjeta>
        <div className="px-5 py-6">
          <Etiqueta tono="ambar">Módulo por construir</Etiqueta>
          <p className="mt-4 text-sm text-tinta-600">
            La base de datos de este módulo ya está creada y protegida con RLS. Falta la
            interfaz, que incluirá:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-tinta-600">
            {incluye.map((punto) => (
              <li key={punto} className="flex gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-haaco-500" />
                <span>{punto}</span>
              </li>
            ))}
          </ul>
        </div>
      </Tarjeta>
    </>
  )
}

// ---------------------------------------------------------------------------
// Botón
// ---------------------------------------------------------------------------
export function Boton({
  children,
  variante = 'primario',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'secundario' | 'discreto'
}) {
  const variantes = {
    primario: 'bg-haaco-700 text-white hover:bg-haaco-900 disabled:bg-haaco-300',
    secundario:
      'border border-tinta-300 bg-white text-tinta-700 hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800',
    discreto: 'text-tinta-500 hover:bg-haaco-50 hover:text-haaco-800',
  } as const

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition disabled:cursor-not-allowed lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium ${variantes[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
