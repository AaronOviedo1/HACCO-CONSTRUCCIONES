'use client'

import { useState, useTransition } from 'react'
import { Download, FileText, Share2 } from 'lucide-react'
import { compartirPdf } from '@/lib/compartir'
import { EMPRESA } from '@/lib/empresa'
import { pesos } from '@/lib/format'
import type { VServicio } from '@/types/database'

/** Abrir, descargar y mandar el presupuesto. Lo mismo que hace la cotización. */
export function AccionesPdf({ servicio }: { servicio: VServicio }) {
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const url = `/api/servicios/${servicio.servicio_id}/pdf`
  const nombre = `Presupuesto ${servicio.folio ?? ''} - ${servicio.cliente}.pdf`

  const compartir = () =>
    iniciar(async () => {
      setError(null)
      try {
        await compartirPdf({
          url,
          nombreArchivo: nombre,
          telefono: servicio.cliente_telefono,
          titulo: `Presupuesto ${servicio.folio ?? ''}`,
          mensaje:
            `Buen día. Le comparto el presupuesto ${servicio.folio ?? ''} por ` +
            `${pesos(servicio.cotizado)} para ${servicio.descripcion.toLowerCase()}. ` +
            `Quedo al pendiente. — ${EMPRESA.nombre}`,
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo compartir el presupuesto.')
      }
    })

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 lg:min-h-0 lg:rounded-lg lg:py-2"
        >
          <FileText size={16} />
          Ver el PDF
        </a>
        <a
          href={`${url}?descargar`}
          className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 lg:min-h-0 lg:rounded-lg lg:py-2"
        >
          <Download size={16} />
          Descargar
        </a>
        <button
          type="button"
          onClick={compartir}
          disabled={pendiente}
          className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-tinta-300 bg-white px-4 text-sm font-medium text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 disabled:opacity-50 lg:min-h-0 lg:rounded-lg lg:py-2"
        >
          <Share2 size={16} />
          {pendiente ? 'Preparando…' : 'Mandar por WhatsApp'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </>
  )
}
