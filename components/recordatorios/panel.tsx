'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CalendarPlus, Check, Plus, Trash2, Undo2 } from 'lucide-react'
import { Campo, Entrada } from '@/components/formulario'
import { SelectorFecha } from '@/components/filtro-fechas'
import { Etiqueta } from '@/components/ui'
import { fecha as formatoFecha } from '@/lib/format'
import { hoyISO } from '@/lib/cotizaciones'
import { enlaceGoogleCalendar } from '@/lib/calendario'
import {
  atenderRecordatorio, eliminarRecordatorio, guardarRecordatorio,
} from '@/app/admin/recordatorios-acciones'
import type { Recordatorio } from '@/types/database'

/**
 * Recordatorios de una cotización.
 *
 * Lo que se pidió en la junta no era escribir más sobre la cotización —las
 * notas internas ya estaban— sino acordarse de hablarle al cliente el jueves.
 * Por eso lo que manda es la fecha, y por eso hay un botón que lo pasa al
 * Google Calendar: ahí es donde a Dirección le suena el teléfono.
 *
 * Se guarda igual aunque no se toque el botón del calendario; el aviso dentro
 * de la app sale del tablero.
 */
export function PanelRecordatorios({
  cotizacionId, titulo, recordatorios,
}: {
  cotizacionId: string
  /** Con qué nombre va al calendario: el folio y el cliente. */
  titulo: string
  recordatorios: Recordatorio[]
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [nota, setNota] = useState('')
  const [cuando, setCuando] = useState(hoyISO())

  const abiertos = recordatorios.filter((r) => !r.atendido_en)
  const atendidos = recordatorios.filter((r) => r.atendido_en)

  const agregar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarRecordatorio({
        cotizacion_id: cotizacionId,
        titulo,
        nota: nota.trim() || null,
        fecha: cuando,
        hora: null,
      })
      if (!r.ok) return setError(r.error)
      setNota('')
      setCuando(hoyISO())
      setAbierto(false)
      router.refresh()
    })

  const atender = (r: Recordatorio) =>
    iniciar(async () => {
      await atenderRecordatorio(r.id, !r.atendido_en, { cotizacion_id: cotizacionId })
      router.refresh()
    })

  const borrar = (r: Recordatorio) =>
    iniciar(async () => {
      await eliminarRecordatorio(r.id, { cotizacion_id: cotizacionId })
      router.refresh()
    })

  return (
    <div className="space-y-2.5">
      {[...abiertos, ...atendidos].map((r) => {
        const vencido = !r.atendido_en && r.fecha < hoyISO()
        return (
          <div
            key={r.id}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
              r.atendido_en
                ? 'border-tinta-200 bg-tinta-50'
                : vencido
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-haaco-200 bg-haaco-50'
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-semibold ${
                    r.atendido_en ? 'text-tinta-400 line-through' : 'text-tinta-900'
                  }`}
                >
                  {formatoFecha(r.fecha)}
                </span>
                {r.atendido_en ? (
                  <Etiqueta tono="gris">Atendido</Etiqueta>
                ) : vencido ? (
                  <Etiqueta tono="ambar">Se pasó la fecha</Etiqueta>
                ) : null}
              </span>
              {r.nota && (
                <p className={`mt-0.5 text-sm ${r.atendido_en ? 'text-tinta-400' : 'text-tinta-700'}`}>
                  {r.nota}
                </p>
              )}
            </span>

            {!r.atendido_en && (
              <a
                href={enlaceGoogleCalendar({
                  titulo: r.titulo,
                  detalle: r.nota,
                  fecha: r.fecha,
                  hora: r.hora,
                })}
                target="_blank"
                rel="noopener"
                title="Agregar a Google Calendar"
                className="shrink-0 rounded p-1.5 text-tinta-400 transition hover:bg-white hover:text-haaco-700"
              >
                <CalendarPlus size={15} />
              </a>
            )}
            <button
              type="button"
              onClick={() => atender(r)}
              disabled={pendiente}
              title={r.atendido_en ? 'Volver a dejarlo pendiente' : 'Ya se atendió'}
              className="shrink-0 rounded p-1.5 text-tinta-400 transition hover:bg-white hover:text-haaco-700 disabled:opacity-50"
            >
              {r.atendido_en ? <Undo2 size={15} /> : <Check size={15} />}
            </button>
            <button
              type="button"
              onClick={() => borrar(r)}
              disabled={pendiente}
              title="Borrar el recordatorio"
              className="shrink-0 rounded p-1.5 text-tinta-400 transition hover:bg-white hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )
      })}

      {abierto ? (
        <div className="space-y-2.5 rounded-xl border border-tinta-200 p-3">
          <Campo
            etiqueta="Recordarme el"
            hijo={<SelectorFecha valor={cuando} onCambio={setCuando} />}
          />
          <Campo
            etiqueta="De qué"
            hijo={
              <Entrada
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Hablarle, quedó de confirmar"
                autoFocus
              />
            }
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-lg border border-tinta-300 bg-white px-3 py-1.5 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={agregar}
              disabled={pendiente}
              className="rounded-lg bg-haaco-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
            >
              {pendiente ? 'Guardando…' : 'Agregar'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-tinta-300 px-2.5 py-1.5 text-xs font-medium text-tinta-600 transition hover:bg-tinta-50"
        >
          <Plus size={14} />
          Agregar recordatorio
        </button>
      )}
    </div>
  )
}
