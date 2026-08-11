'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { AreaTexto } from '@/components/formulario'
import { fechaHora } from '@/lib/format'
import { anotarEnBitacora, eliminarNotaBitacora } from '@/app/admin/obras/acciones'
import type { BitacoraObra } from '@/types/database'

/**
 * Un renglón de la bitácora, corregible cuando es una nota escrita a mano.
 *
 * Se corrige en su propio sitio, sin diálogo: una nota es un párrafo, y abrir
 * una ventana para arreglar una palabra es más trabajo del que ahorra. El
 * renglón se vuelve campo de texto y regresa a renglón al guardar.
 *
 * Los movimientos que anota el sistema —una obra que cambió de estatus, un
 * avance que entró— son el historial de lo que pasó: se leen, no se editan.
 */
export function RenglonBitacora({
  obraId, entrada, editable,
}: {
  obraId: string
  entrada: BitacoraObra
  editable: boolean
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(entrada.descripcion)
  const [pendiente, iniciar] = useTransition()

  const guardar = () =>
    iniciar(async () => {
      if (!texto.trim()) return
      await anotarEnBitacora(obraId, texto, entrada.id)
      setEditando(false)
      router.refresh()
    })

  const borrar = () =>
    iniciar(async () => {
      if (!confirm('¿Borrar esta nota de la bitácora?')) return
      await eliminarNotaBitacora(obraId, entrada.id)
      router.refresh()
    })

  if (editando) {
    return (
      <li className="flex items-start gap-1.5 bg-tinta-50/60 px-4 py-2.5">
        <AreaTexto
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="!text-sm"
          autoFocus
        />
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || !texto.trim()}
          className="shrink-0 rounded p-2 text-haaco-700 transition hover:bg-haaco-50 disabled:opacity-40"
          aria-label="Guardar la nota"
        >
          <Check size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            setTexto(entrada.descripcion)
            setEditando(false)
          }}
          className="shrink-0 rounded p-2 text-tinta-400 transition hover:bg-tinta-100"
          aria-label="Dejarla como estaba"
        >
          <X size={16} />
        </button>
      </li>
    )
  }

  return (
    <li className="group flex items-start gap-2 px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <p className="text-sm text-tinta-700">{entrada.descripcion}</p>
        <p className="mt-0.5 text-xs text-tinta-400">
          {fechaHora(entrada.created_at)} · {entrada.tipo}
        </p>
      </span>

      {editable && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-700"
            aria-label="Corregir la nota"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={borrar}
            disabled={pendiente}
            className="rounded p-1.5 text-tinta-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label="Borrar la nota"
          >
            <Trash2 size={13} />
          </button>
        </span>
      )}
    </li>
  )
}
