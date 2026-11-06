'use client'

import { useState } from 'react'
import { FileDown, Share2 } from 'lucide-react'
import { compartirPdf } from '@/lib/compartir'
import { pesos } from '@/lib/format'
import { EMPRESA } from '@/lib/empresa'

/**
 * Lo que se hace con un PDF que es para el cliente: verlo o mandárselo.
 *
 * «Enviar» es `compartirPdf`: en el teléfono abre la hoja del sistema con el
 * archivo listo para el chat, y en la computadora descarga el PDF y abre el
 * chat del cliente con el mensaje escrito. Sin teléfono capturado el botón no
 * se pinta —abriría WhatsApp sin destinatario, que no es enviar nada—.
 *
 * Lo usan el recibo de pago y el estado de cuenta: el mismo par de botones,
 * con su propio PDF y su propio mensaje.
 */
export function BotonesPdfCliente({
  url,
  nombreArchivo,
  titulo,
  mensaje,
  telefono,
  ver,
}: {
  url: string
  nombreArchivo: string
  titulo: string
  mensaje: string
  telefono: string | null | undefined
  /** El texto del botón que abre el PDF. */
  ver: string
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async () => {
    setError(null)
    setEnviando(true)
    try {
      await compartirPdf({ url, nombreArchivo, telefono, titulo, mensaje })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo compartir el PDF.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
      >
        <FileDown size={14} />
        {ver}
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

/**
 * El recibo de un pago. Vive aparte del diálogo de cobranza porque el mismo
 * par aparece al acabar de registrar el pago y al abrir un pago viejo para
 * corregirlo.
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
  return (
    <BotonesPdfCliente
      url={`/api/recibos/${reciboId}/pdf`}
      nombreArchivo={`Recibo de pago ${folio ?? ''} - ${cliente}.pdf`}
      titulo={`Recibo de pago ${folio ?? ''}`}
      mensaje={
        `Buen día, le compartimos su recibo de pago ${folio ?? ''} por ${pesos(monto)}. ` +
        `Gracias por su preferencia. ${EMPRESA.nombre}.`
      }
      telefono={telefono}
      ver="Ver recibo"
    />
  )
}

/**
 * El estado de cuenta de un cliente: todas sus obras pendientes en un PDF.
 */
export function AccionesEstadoCuenta({
  clienteId,
  cliente,
  telefono,
  saldo,
}: {
  clienteId: string
  cliente: string
  telefono: string | null | undefined
  saldo: number
}) {
  return (
    <BotonesPdfCliente
      url={`/api/clientes/${clienteId}/estado-de-cuenta`}
      nombreArchivo={`Estado de cuenta - ${cliente}.pdf`}
      titulo={`Estado de cuenta ${cliente}`}
      mensaje={
        `Buen día, le compartimos su estado de cuenta con las obras pendientes de pago: ` +
        `saldo total de ${pesos(saldo)}. Quedamos atentos. ${EMPRESA.nombre}.`
      }
      telefono={telefono}
      ver="Estado de cuenta"
    />
  )
}
