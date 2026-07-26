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
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta-900">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-tinta-500">{descripcion}</p>}
      </div>
      {acciones && <div className="flex items-center gap-2">{acciones}</div>}
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
      className={`overflow-hidden rounded-xl border border-tinta-200 bg-white shadow-[0_1px_2px_rgba(16,70,44,0.04)] ${className}`}
    >
      {titulo && (
        <div className="border-b border-tinta-100 px-4 py-3 text-sm font-semibold text-tinta-800 sm:px-5">
          {titulo}
        </div>
      )}
      {children}
      {pie && <div className="border-t border-tinta-100 bg-tinta-50 px-4 py-2 text-xs text-tinta-500 sm:px-5">{pie}</div>}
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
}: {
  etiqueta: string
  valor: string
  nota?: string
  tono?: 'neutro' | 'verde' | 'ambar' | 'rojo'
  href?: string
}) {
  const tonos = {
    neutro: 'text-tinta-900',
    verde: 'text-haaco-600',
    ambar: 'text-amber-600',
    rojo: 'text-red-600',
  } as const

  const contenido = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-tinta-500">{etiqueta}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${tonos[tono]}`}>{valor}</div>
      {nota && <div className="mt-1 text-xs text-tinta-400">{nota}</div>}
    </>
  )

  const clases =
    'block rounded-xl border border-tinta-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,70,44,0.04)]'

  return href ? (
    <Link href={href} className={`${clases} transition hover:border-haaco-300 hover:bg-haaco-50/40`}>
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
  verde: 'bg-haaco-100 text-haaco-800 ring-haaco-200',
  gris: 'bg-tinta-100 text-tinta-700 ring-tinta-200',
  ambar: 'bg-amber-100 text-amber-800 ring-amber-200',
  rojo: 'bg-red-100 text-red-800 ring-red-200',
  azul: 'bg-sky-100 text-sky-800 ring-sky-200',
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONOS_ETIQUETA[tono]}`}
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
      className={`whitespace-nowrap border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-tinta-500 ${
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
    primario: 'bg-haaco-700 text-white hover:bg-haaco-800 disabled:bg-haaco-300',
    secundario: 'border border-tinta-300 bg-white text-tinta-700 hover:bg-tinta-50',
    discreto: 'text-tinta-500 hover:bg-tinta-100 hover:text-tinta-800',
  } as const

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${variantes[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
