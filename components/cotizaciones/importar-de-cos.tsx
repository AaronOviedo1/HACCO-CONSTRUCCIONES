'use client'

import { useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import type { LecturaCos } from '@/lib/importar-cos'

/**
 * La zona donde se suelta el PDF de una cotización de COS.
 *
 * Sirve igual para arrastrar —en el escritorio— que para tocar y elegir el
 * archivo —en el teléfono—. Manda el PDF a /api/cotizaciones/importar y
 * entrega la lectura hacia arriba; armar el borrador es cosa del editor, que
 * es quien tiene la lista de clientes y los términos de la casa.
 */
export function ImportarDeCos({
  onLeida,
}: {
  onLeida: (lectura: LecturaCos, avisos: string[]) => void
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [encima, setEncima] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leer = async (archivo: File | undefined) => {
    if (!archivo || leyendo) return
    if (archivo.type !== 'application/pdf') {
      setError('Tiene que ser el PDF de la cotización de COS.')
      return
    }
    setError(null)
    setLeyendo(true)
    try {
      const cuerpo = new FormData()
      cuerpo.append('archivo', archivo, archivo.name)
      const r = await fetch('/api/cotizaciones/importar', { method: 'POST', body: cuerpo })
      const datos = await r.json().catch(() => ({}))
      if (!r.ok || !datos.lectura) {
        setError(datos.error ?? 'No se pudo leer la cotización; inténtalo otra vez.')
        return
      }
      onLeida(datos.lectura as LecturaCos, (datos.avisos as string[]) ?? [])
    } catch {
      setError('No se pudo leer la cotización; revisa la conexión e inténtalo otra vez.')
    } finally {
      setLeyendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="mb-5">
      <button
        type="button"
        disabled={leyendo}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!leyendo) setEncima(true)
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault()
          setEncima(false)
          leer(e.dataTransfer.files[0])
        }}
        className={`flex w-full items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-4 text-left transition ${
          encima
            ? 'border-haaco-500 bg-haaco-50'
            : 'border-tinta-200 bg-white hover:border-haaco-300 hover:bg-haaco-50/40'
        } disabled:cursor-wait`}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-haaco-50 text-haaco-700">
          {leyendo ? <Loader2 size={20} className="animate-spin" /> : <FileUp size={20} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-tinta-900">
            {leyendo ? (
              'Leyendo la cotización de COS…'
            ) : (
              <>
                {/* En el teléfono no hay qué arrastrar: se toca y se elige. */}
                <span className="lg:hidden">¿Viene de COS? Toca para elegir su PDF</span>
                <span className="hidden lg:inline">¿Viene de COS? Suelta aquí su PDF</span>
              </>
            )}
          </span>
          <span className="block text-sm text-tinta-500">
            {leyendo
              ? 'Puede tardar uno o dos minutos: se copian todas las partidas.'
              : 'Se arma la cotización con sus partidas y precios; la revisas antes de guardar.'}
          </span>
        </span>
      </button>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => leer(e.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
    </div>
  )
}
