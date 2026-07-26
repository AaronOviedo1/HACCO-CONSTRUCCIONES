'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { X } from 'lucide-react'

const CLASE_CAMPO =
  'w-full rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm text-tinta-900 outline-none transition focus:border-haaco-500 focus:ring-2 focus:ring-haaco-100 disabled:bg-tinta-50 disabled:text-tinta-400'

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

export function Casilla({
  etiqueta,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-tinta-700 sm:col-span-2">
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-500"
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta-900/40 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onCerrar} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${anchos[ancho]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-tinta-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-tinta-900">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-sm text-tinta-500">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="-mr-1.5 rounded-lg p-1.5 text-tinta-400 hover:bg-tinta-100 hover:text-tinta-700"
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
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-tinta-100 bg-tinta-50 px-5 py-3">
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
    primario: 'bg-haaco-700 text-white hover:bg-haaco-800 disabled:bg-haaco-300',
    secundario: 'border border-tinta-300 bg-white text-tinta-700 hover:bg-tinta-50',
    peligro: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  } as const

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${variantes[variante]}`}
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
