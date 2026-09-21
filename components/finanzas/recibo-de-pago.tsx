'use client'

import { useState } from 'react'
import { FileDown, Share2 } from 'lucide-react'
import { compartirPdf } from '@/lib/compartir'
import { pesos } from '@/lib/format'
import { EMPRESA } from '@/lib/empresa'

/**
 * Lo que se hace con el recibo de un pago: verlo o mandárselo al cliente.
 *
 * Son los dos botones de siempre y por eso viven aparte del diálogo de
 * cobranza: el mismo par aparece al acabar de registrar el pago y al abrir un
 * pago viejo para corregirlo.
 *
 * «Enviar» es `compartirPdf`: en el teléfono abre la hoja del sistema con el
 * archivo listo para el chat, y en la computadora descarga el PDF y abre el
 * chat del cliente con el mensaje escrito. Sin teléfono capturado el botón no
 * se pinta —abriría WhatsApp sin destinatario, que no es enviar nada—.
 */
export function AccionesReciboPago({
  reciboId,
  folio,
  cliente,
  telefono,
  monto,
}: {
  reciboId: string
  folio: string | null
  cliente: string
  telefono: string | null | undefined
  monto: number
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nombreArchivo = `Recibo de pago ${folio ?? ''} - ${cliente}.pdf`

  const enviar = async () => {
    setError(null)
    setEnviando(true)
    try {
      await compartirPdf({
        url: `/api/recibos/${reciboId}/pdf`,
        nombreArchivo,
        telefono,
        titulo: `Recibo de pago ${folio ?? ''}`,
        mensaje:
          `Buen día, le compartimos su recibo de pago ${folio ?? ''} por ${pesos(monto)}. ` +
          `Gracias por su preferencia. ${EMPRESA.nombre}.`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo compartir el recibo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`/api/recibos/${reciboId}/pdf`}
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
      >
        <FileDown size={14} />
        Ver recibo
      </a>

      {telefono?.trim() ? (
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          title={error ?? undefined}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            error
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-haaco-200 bg-haaco-50 text-haaco-800 hover:bg-haaco-100'
          }`}
        >
          <Share2 size={14} />
          {error ? 'No se pudo' : enviando ? 'Abriendo…' : 'Enviar al cliente'}
        </button>
      ) : (
        <span className="text-xs text-tinta-400" title="Se captura en la ficha del cliente.">
          sin teléfono para enviarlo
        </span>
      )}
    </div>
  )
}
