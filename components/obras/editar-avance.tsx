'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, NumeroCorto, PieDialogo,
} from '@/components/formulario'
import { editarAvance, eliminarAvance } from '@/app/admin/obras/acciones'
import { num } from '@/lib/cotizaciones'
import type { Avance } from '@/types/database'

/**
 * Corregir un avance mal capturado.
 *
 * El porcentaje es lo delicado: cuando la obra no tiene cronograma, de él sale
 * el avance de la OT, y del avance de la OT sale el devengado de la nómina. Un
 * 80 que se tecleó por 8 le paga a la cuadrilla diez veces lo que llevan
 * hecho. Por eso se puede corregir, y por eso el diálogo avisa antes.
 *
 * La foto no se edita: si la foto está mal, el avance se borra y se sube otro.
 */
export function AccionesAvance({
  avance, tieneCronograma,
}: {
  avance: Avance
  /** Con cronograma el porcentaje del avance es sólo informativo. */
  tieneCronograma: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const borrar = () =>
    iniciar(async () => {
      if (!confirm('¿Borrar este avance? Si tenía foto, también se borra.')) return
      await eliminarAvance(avance.obra_id, avance.id)
      router.refresh()
    })

  return (
    <>
      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-700"
          aria-label="Corregir avance"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={borrar}
          disabled={pendiente}
          className="rounded p-1.5 text-tinta-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          aria-label="Borrar avance"
        >
          <Trash2 size={14} />
        </button>
      </span>

      {abierto && (
        <FormularioAvance
          avance={avance}
          tieneCronograma={tieneCronograma}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function FormularioAvance({
  avance, tieneCronograma, onCerrar,
}: {
  avance: Avance
  tieneCronograma: boolean
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [comentario, setComentario] = useState(avance.comentario ?? '')
  const [pct, setPct] = useState(
    avance.porcentaje_avance == null ? '' : String(Number(avance.porcentaje_avance)),
  )

  const antes = avance.porcentaje_avance == null ? null : Number(avance.porcentaje_avance)
  const ahora = pct.trim() === '' ? null : num(pct)
  const baja = !tieneCronograma && antes != null && ahora != null && ahora < antes

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      if (ahora != null && (ahora < 0 || ahora > 100)) {
        return setError('El porcentaje va de 0 a 100.')
      }
      if (!avance.storage_path && !comentario.trim()) {
        return setError('Un avance sin foto necesita al menos una nota.')
      }

      const r = await editarAvance(avance.obra_id, avance.id, {
        comentario,
        porcentaje: ahora,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Corregir avance"
      descripcion="La foto no se cambia. Si la foto está mal, borra el avance y sube otro."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Nota"
          hijo={
            <AreaTexto rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
          }
        />
        <div className="sm:col-span-2">
          <NumeroCorto
            etiqueta="Porcentaje de avance"
            sufijo="%"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="—"
          />
          <p className="mt-1 text-xs text-tinta-400">
            {tieneCronograma
              ? 'Esta obra lleva cronograma: el avance de la OT sale de las tareas, no de aquí.'
              : 'De este porcentaje sale el avance de la OT, y del avance sale el devengado de la nómina.'}
          </p>
        </div>

        {baja && (
          <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 sm:col-span-2">
            Vas a bajar el avance de <strong>{antes}%</strong> a <strong>{ahora}%</strong>. El
            devengado de los contratos de esta obra baja con él, y lo que ya se les pagó puede
            quedar por delante de lo que llevan hecho.
          </p>
        )}

        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
