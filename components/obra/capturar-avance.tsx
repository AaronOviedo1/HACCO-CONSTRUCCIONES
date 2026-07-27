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
    <section className="rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta">
      {listo && (
        <p className="mb-3 flex items-center gap-2.5 rounded-[14px] border-[0.5px] border-haaco-200 bg-haaco-50 p-3 text-[14.5px] font-semibold text-haaco-800">
          <Check size={18} />
          Avance enviado. Dirección ya lo puede ver.
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 rounded-[14px] bg-red-50 px-3 py-2.5 text-sm text-red-700">
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
        <div className="relative mb-3.5">
          {archivo?.type.startsWith('video') ? (
            <video src={vista} controls className="max-h-72 w-full rounded-[16px] bg-black object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vista} alt="Foto del avance" className="max-h-72 w-full rounded-[16px] object-cover" />
          )}
          <button
            type="button"
            onClick={limpiar}
            className="absolute right-2 top-2 rounded-full bg-tinta-950/70 p-2 text-white"
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
          className="mb-4 flex min-h-[88px] w-full items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-haaco-300 bg-haaco-50/50 px-4 text-[17px] font-semibold text-haaco-800 transition active:bg-haaco-100"
        >
          <Camera size={26} />
          Tomar foto o video
        </button>
      )}

      <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-tinta-500">
        ¿Qué se avanzó hoy?
      </p>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={3}
        placeholder="Terminamos el sellado de la fachada norte…"
        className="mb-4 w-full resize-none rounded-[14px] border border-tinta-300 p-3.5 leading-relaxed outline-none focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200"
      />

      <p className="mb-2.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-tinta-500">
        Avance de la obra · va en {avanceActual}%
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {PASOS_PORCENTAJE.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPorcentaje(porcentaje === p ? null : p)}
            aria-pressed={porcentaje === p}
            data-tap
            className={`min-h-12 min-w-[62px] rounded-[14px] border px-3 text-base font-bold tabular-nums transition ${
              porcentaje === p
                ? 'border-haaco-700 bg-haaco-700 text-white'
                : 'border-tinta-300 bg-white text-tinta-700'
            }`}
          >
            {p}%
          </button>
        ))}
      </div>

      <div className="flex gap-2.5">
        {!vista && (
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            data-tap
            className="flex min-h-14 items-center justify-center gap-2 rounded-[18px] border-[0.5px] border-tinta-300 bg-white px-4 text-base font-semibold text-tinta-700"
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
          className="flex min-h-14 flex-1 items-center justify-center gap-2.5 rounded-[18px] bg-haaco-700 px-4 text-[17.5px] font-semibold text-white shadow-verde transition active:bg-haaco-800 disabled:bg-tinta-200 disabled:text-tinta-400 disabled:shadow-none"
        >
          <Send size={19} />
          {progreso ? 'Subiendo…' : pendiente ? 'Enviando…' : 'Enviar avance'}
        </button>
      </div>
    </section>
  )
}
