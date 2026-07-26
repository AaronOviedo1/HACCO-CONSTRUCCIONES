'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Camera, Check, Image as Icono, Send, X } from 'lucide-react'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { registrarAvance } from '@/app/obra/acciones'
import type { TipoAvance } from '@/types/database'

const PASOS_PORCENTAJE = [10, 25, 50, 75, 90, 100]

/**
 * Dos taps: tomar la foto y mandar. El porcentaje es opcional y se elige de
 * botones grandes, no de un campo numérico.
 */
export function CapturarAvance({
  obraId,
  avanceActual,
}: {
  obraId: string
  avanceActual: number
}) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [comentario, setComentario] = useState('')
  const [porcentaje, setPorcentaje] = useState<number | null>(null)
  const [progreso, setProgreso] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const elegir = (f: File | null) => {
    setError(null)
    if (!f) return
    if (f.size > 50 * 1024 * 1024) {
      setError('El archivo pesa más de 50 MB. Intenta con una foto más chica.')
      return
    }
    setArchivo(f)
    setVista(URL.createObjectURL(f))
  }

  const limpiar = () => {
    if (vista) URL.revokeObjectURL(vista)
    setArchivo(null)
    setVista(null)
    setComentario('')
    setPorcentaje(null)
    if (entrada.current) entrada.current.value = ''
  }

  const enviar = () =>
    iniciar(async () => {
      setError(null)
      let ruta: string | null = null
      let tipo: TipoAvance = 'nota'

      if (archivo) {
        setProgreso(true)
        const supabase = crearClienteNavegador()
        const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
        // La carpeta tiene que ser el id de la obra: así lo exige la política.
        ruta = `${obraId}/${nombre}`

        const { error: errorSubida } = await supabase.storage
          .from('avances')
          .upload(ruta, archivo, { contentType: archivo.type, upsert: false })

        setProgreso(false)

        if (errorSubida) {
          setError(`No se pudo subir el archivo: ${errorSubida.message}`)
          return
        }
        tipo = archivo.type.startsWith('video') ? 'video' : 'foto'
      }

      const r = await registrarAvance(obraId, {
        tipo,
        storage_path: ruta,
        comentario,
        porcentaje,
      })

      if (!r.ok) return setError(r.error)

      limpiar()
      setListo(true)
      setTimeout(() => setListo(false), 2500)
      router.refresh()
    })

  const ocupado = pendiente || progreso

  return (
    <section className="rounded-2xl border border-tinta-200 bg-white p-4">
      {listo && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-haaco-50 px-3 py-2.5 text-sm font-medium text-haaco-800">
          <Check size={16} />
          Avance enviado. Dirección ya lo puede ver.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <input
        ref={entrada}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => elegir(e.target.files?.[0] ?? null)}
      />

      {vista ? (
        <div className="relative mb-3">
          {archivo?.type.startsWith('video') ? (
            <video src={vista} controls className="max-h-72 w-full rounded-xl bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vista} alt="Foto del avance" className="max-h-72 w-full rounded-xl object-cover" />
          )}
          <button
            type="button"
            onClick={limpiar}
            className="absolute right-2 top-2 rounded-full bg-tinta-900/70 p-2 text-white"
            aria-label="Quitar foto"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          data-tap
          className="mb-3 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-haaco-300 bg-haaco-50/40 px-4 py-8 text-base font-semibold text-haaco-800 transition active:bg-haaco-100"
        >
          <Camera size={26} />
          Tomar foto o video
        </button>
      )}

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        placeholder="¿Qué se avanzó hoy?"
        className="mb-3 w-full rounded-xl border border-tinta-300 px-3 py-2.5 text-base outline-none focus:border-haaco-500 focus:ring-2 focus:ring-haaco-100"
      />

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-tinta-500">
        Avance de la obra (opcional) · va en {avanceActual}%
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {PASOS_PORCENTAJE.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPorcentaje(porcentaje === p ? null : p)}
            data-tap
            className={`min-w-14 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              porcentaje === p
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-300 bg-white text-tinta-700'
            }`}
          >
            {p}%
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {!vista && (
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            data-tap
            className="flex items-center justify-center gap-2 rounded-2xl border border-tinta-300 bg-white px-4 py-3.5 text-base font-semibold text-tinta-700"
          >
            <Icono size={18} />
            Foto
          </button>
        )}
        <button
          type="button"
          onClick={enviar}
          disabled={ocupado || (!archivo && !comentario.trim())}
          data-tap
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-haaco-700 px-4 py-3.5 text-base font-semibold text-white transition active:bg-haaco-800 disabled:bg-tinta-200 disabled:text-tinta-400"
        >
          <Send size={18} />
          {progreso ? 'Subiendo…' : pendiente ? 'Enviando…' : 'Enviar avance'}
        </button>
      </div>
    </section>
  )
}
