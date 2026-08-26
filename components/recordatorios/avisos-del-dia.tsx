'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Check } from 'lucide-react'
import { fecha as formatoFecha, horaCorta } from '@/lib/format'
import { hoyISO } from '@/lib/cotizaciones'
import { atenderRecordatorio } from '@/app/admin/recordatorios-acciones'
import type { Recordatorio } from '@/types/database'

/**
 * Lo que toca hoy, arriba del tablero.
 *
 * Es el aviso dentro de la app: la notificación del teléfono la da el push —o
 * el Google Calendar de quien lo agendó ahí—, pero quien abre el sistema en la
 * mañana tiene que verlo sin buscarlo. Se pintan también los que ya se pasaron
 * de fecha: un recordatorio vencido sigue siendo algo que nadie hizo.
 *
 * El botón lo da por atendido en su sitio, sin salir del tablero: si abrirlo
 * cuesta dos pantallas, nadie lo marca y la lista deja de significar nada.
 */
export function AvisosDelDia({ recordatorios }: { recordatorios: Recordatorio[] }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()

  if (recordatorios.length === 0) return null

  const atender = (r: Recordatorio) =>
    iniciar(async () => {
      await atenderRecordatorio(r.id, true, {
        cotizacion_id: r.cotizacion_id,
        obra_id: r.obra_id,
        servicio_id: r.servicio_id,
      })
      router.refresh()
    })

  return (
    <ul className="mt-3.5 space-y-2">
      {recordatorios.map((r) => {
        const vencido = r.fecha < hoyISO()
        // La visita del técnico va primero: es la única que trae hora, y a
        // esa hora alguien tiene que estar en la puerta de un cliente.
        const destino = r.servicio_id
          ? `/admin/servicios/${r.servicio_id}`
          : r.cotizacion_id
            ? `/admin/cotizaciones/${r.cotizacion_id}`
            : r.obra_id
              ? `/admin/obras/${r.obra_id}`
              : null
        const cuando = vencido
          ? ` · era el ${formatoFecha(r.fecha)}`
          : r.hora
            ? ` · hoy a las ${horaCorta(r.hora)}`
            : ' · hoy'

        const cuerpo = (
          <>
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${vencido ? 'bg-amber-500' : 'bg-haaco-600'}`}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-tinta-800">
                {r.nota?.trim() || r.titulo}
              </span>
              <span className="block truncate text-xs text-tinta-400">
                {r.titulo}
                {cuando}
              </span>
            </span>
          </>
        )

        return (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-[14px] border-[0.5px] border-tinta-200 bg-white px-4 py-2.5"
          >
            {destino ? (
              <Link href={destino} prefetch={false} className="flex min-w-0 flex-1 items-center gap-2">
                {cuerpo}
              </Link>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-2">{cuerpo}</span>
            )}
            <button
              type="button"
              onClick={() => atender(r)}
              disabled={pendiente}
              className="shrink-0 rounded-lg border border-tinta-200 px-2.5 py-1 text-xs font-medium text-haaco-700 transition hover:bg-haaco-50 disabled:opacity-50"
            >
              <Check size={13} className="mr-1 inline" />
              Listo
            </button>
          </li>
        )
      })}
    </ul>
  )
}
