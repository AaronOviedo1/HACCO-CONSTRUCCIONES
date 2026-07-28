'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { X } from 'lucide-react'

/* En el teléfono los campos son más altos y redondos: se llenan con el pulgar. */
const CLASE_CAMPO =
  'w-full rounded-[14px] border border-tinta-300 bg-white px-3.5 py-3 text-tinta-900 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200 disabled:bg-tinta-50 disabled:text-tinta-400 lg:rounded-lg lg:px-3 lg:py-2 lg:text-sm'

export function Campo({
  etiqueta,
  hijo,
  ayuda,
  ancho = 'completo',
}: {
  etiqueta: string
  hijo: ReactNode
  ayuda?: string
  ancho?: 'completo' | 'medio'
}) {
  return (
    <label className={`block ${ancho === 'medio' ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
      <span className="mb-1.5 block text-sm font-medium text-tinta-700">{etiqueta}</span>
      {hijo}
      {ayuda && <span className="mt-1 block text-xs text-tinta-400">{ayuda}</span>}
    </label>
  )
}

export function Entrada(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...resto } = props
  return <input {...resto} className={`${CLASE_CAMPO} ${className}`} />
}

export function Numero(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...resto } = props
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...resto}
      className={`${CLASE_CAMPO} text-right tabular-nums ${className}`}
    />
  )
}

/**
 * Número de dos o tres dígitos con su unidad al lado (porcentajes, días).
 * Un campo de ancho completo para escribir «16» se ve desproporcionado.
 */
export function NumeroCorto({
  etiqueta,
  sufijo,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; sufijo: string }) {
  const { className = '', ...resto } = props
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-tinta-700">{etiqueta}</span>
      <span className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          size={4}
          {...resto}
          className={`w-16 rounded-[14px] border border-tinta-300 bg-white px-2 py-3 text-center tabular-nums text-tinta-900 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200 disabled:bg-tinta-50 disabled:text-tinta-400 lg:rounded-lg lg:py-2 lg:text-sm ${className}`}
        />
        <span className="text-sm text-tinta-500">{sufijo}</span>
      </span>
    </label>
  )
}

export function Seleccion(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', children, ...resto } = props
  return (
    <select {...resto} className={`${CLASE_CAMPO} ${className}`}>
      {children}
    </select>
  )
}

export function AreaTexto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = '', ...resto } = props
  return <textarea {...resto} className={`${CLASE_CAMPO} min-h-20 ${className}`} />
}

/**
 * Opciones en fila: para listas cortas y muy usadas (categoría de gasto, tipo
 * de pago, método). Se tocan directo, sin desplegar nada.
 */
export function Opciones<T extends string>({
  valor,
  opciones,
  onCambio,
  columnas,
}: {
  valor: T
  opciones: [T, string][]
  onCambio: (valor: T) => void
  /** Rejilla fija en vez de flujo libre: útil para dos o cuatro opciones. */
  columnas?: 2 | 3
}) {
  const rejilla = columnas === 2 ? 'grid grid-cols-2' : columnas === 3 ? 'grid grid-cols-3' : 'flex flex-wrap'

  return (
    <div className={`${rejilla} gap-2`}>
      {opciones.map(([clave, texto]) => {
        const activa = valor === clave
        return (
          <button
            key={clave}
            type="button"
            onClick={() => onCambio(clave)}
            aria-pressed={activa}
            className={`min-h-11 rounded-[13px] border px-3.5 text-[14.5px] font-semibold transition ${
              activa
                ? 'border-haaco-700 bg-haaco-700 text-white'
                : 'border-tinta-300 bg-white text-tinta-700 hover:border-haaco-300'
            }`}
          >
            {texto}
          </button>
        )
      })}
    </div>
  )
}

export function Casilla({
  etiqueta,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-tinta-700 sm:col-span-2">
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600"
      />
      {etiqueta}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Diálogo
// ---------------------------------------------------------------------------
export function Dialogo({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
  ancho = 'md',
}: {
  abierto: boolean
  titulo: string
  descripcion?: string
  onCerrar: () => void
  children: ReactNode
  ancho?: 'md' | 'lg' | 'xl'
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden'
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = ''
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  const anchos = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta-950/50 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onCerrar} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl animate-sube sm:animate-none sm:rounded-2xl ${anchos[ancho]}`}
      >
        {/* Asa de la hoja: sólo en el teléfono, donde el gesto es arrastrar. */}
        <span className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-tinta-300 sm:hidden" aria-hidden />

        <div className="flex items-start justify-between gap-4 border-b-[0.5px] border-tinta-150 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold -tracking-[0.3px] text-tinta-900 lg:text-base">
              {titulo}
            </h2>
            {descripcion && <p className="mt-0.5 text-sm text-tinta-500">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tinta-150 text-tinta-600 transition hover:bg-tinta-200 sm:bg-transparent sm:text-tinta-400 sm:hover:bg-tinta-100"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PieDialogo({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t-[0.5px] border-tinta-150 bg-tinta-50 px-5 py-3 pb-seguro [&>*]:flex-1 sm:pb-3 sm:[&>*]:flex-none">
      {children}
    </div>
  )
}

export function CuerpoDialogo({ children }: { children: ReactNode }) {
  return <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2">{children}</div>
}

// ---------------------------------------------------------------------------
// Botones de envío
// ---------------------------------------------------------------------------
export function BotonGuardar({
  children = 'Guardar',
  variante = 'primario',
}: {
  children?: ReactNode
  variante?: 'primario' | 'secundario' | 'peligro'
}) {
  const { pending } = useFormStatus()
  const variantes = {
    primario: 'bg-haaco-700 text-white hover:bg-haaco-900 disabled:bg-haaco-300',
    secundario:
      'border border-tinta-300 bg-white text-tinta-700 hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800',
    peligro: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  } as const

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] px-4 text-base font-semibold transition disabled:cursor-not-allowed sm:min-h-0 sm:w-auto sm:rounded-lg sm:py-2 sm:text-sm sm:font-medium ${variantes[variante]}`}
    >
      {pending ? 'Guardando…' : children}
    </button>
  )
}

export function MensajeError({ mensaje }: { mensaje?: string | null }) {
  if (!mensaje) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200 sm:col-span-2">
      {mensaje}
    </p>
  )
}
