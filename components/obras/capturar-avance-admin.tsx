'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Camera, Send, X } from 'lucide-react'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { registrarAvanceAdmin } from '@/app/admin/obras/acciones'
import type { TipoAvance } from '@/types/database'

const PASOS_PORCENTAJE = [10, 25, 50, 75, 90, 100]

/**
 * Versión de escritorio de la captura de avance, para cuando Dirección o
 * Administración van a la obra. Va al mismo feed que los de la cuadrilla.
 */
export function CapturarAvanceAdmin({
  obraId,
  tieneCronograma,
}: {
  obraId: string
  tieneCronograma: boolean
}) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [comentario, setComentario] = useState('')
  const [porcentaje, setPorcentaje] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
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
        const supabase = crearClienteNavegador()
        const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
        // La carpeta tiene que ser el id de la obra: así lo exige la política.
        ruta = `${obraId}/${nombre}`

        const { error: errorSubida } = await supabase.storage
          .from('avances')
          .upload(ruta, archivo, { contentType: archivo.type, upsert: false })

        if (errorSubida) {
          setError(`No se pudo subir el archivo: ${errorSubida.message}`)
          return
        }
        tipo = archivo.type.startsWith('video') ? 'video' : 'foto'
      }

      const r = await registrarAvanceAdmin(obraId, {
        tipo,
        storage_path: ruta,
        comentario,
        porcentaje,
      })

      if (!r.ok) return setError(r.error)

      limpiar()
      router.refresh()
    })

  return (
    <div className="p-4">
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <input
        ref={entrada}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => elegir(e.target.files?.[0] ?? null)}
      />

      {vista && (
        <div className="relative mb-3 inline-block">
          {archivo?.type.startsWith('video') ? (
            <video src={vista} controls className="max-h-48 rounded-xl bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vista} alt="Foto del avance" className="max-h-48 rounded-xl object-cover" />
          )}
          <button
            type="button"
            onClick={limpiar}
            className="absolute right-2 top-2 rounded-full bg-tinta-950/70 p-1.5 text-white"
            aria-label="Quitar foto"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        placeholder="Fuimos a la obra: va bien el fondeado del interior…"
        className="w-full resize-none rounded-lg border border-tinta-300 p-3 text-sm outline-none focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {PASOS_PORCENTAJE.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPorcentaje(porcentaje === p ? null : p)}
            aria-pressed={porcentaje === p}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition ${
              porcentaje === p
                ? 'border-haaco-700 bg-haaco-700 text-white'
                : 'border-tinta-300 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {p}%
          </button>
        ))}
        {tieneCronograma && (
          <span className="ml-1 text-xs text-tinta-400">
            El % global lo dicta el cronograma; esto queda como referencia.
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {!vista && (
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            <Camera size={15} />
            Foto
          </button>
        )}
        <button
          type="button"
          onClick={enviar}
          disabled={pendiente || (!archivo && !comentario.trim())}
          className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          <Send size={15} />
          {pendiente ? 'Enviando…' : 'Registrar avance'}
        </button>
      </div>
    </div>
  )
}
