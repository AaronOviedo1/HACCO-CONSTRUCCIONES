'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { compartirPdf } from '@/lib/compartir'
import { pesos } from '@/lib/format'

/**
 * El recibo de abono, al chat del trabajador.
 *
 * Hasta ahora el recibo se imprimía o se le enseñaba en la pantalla. Es el
 * mismo PDF que ya se genera; lo único que faltaba era el teléfono y un botón.
 * Sin teléfono capturado no se pinta un botón que no va a funcionar: se dice
 * qué falta y dónde se arregla.
 */
export function EnviarRecibo({
  reciboId,
  folio,
  trabajador,
  telefono,
  total,
}: {
  reciboId: string
  folio: string | null
  trabajador: string
  telefono: string | null
  total: number
}) {
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!telefono?.trim()) {
    return (
      <span
        className="text-xs text-tinta-400"
        title={`${trabajador} no tiene teléfono capturado. Se agrega en Usuarios.`}
      >
        sin teléfono
      </span>
    )
  }

  const enviar = async () => {
    setError(null)
    setEnviando(true)
    try {
      await compartirPdf({
        url: `/api/recibos-nomina/${reciboId}/pdf`,
        nombreArchivo: `Recibo ${folio ?? ''} - ${trabajador}.pdf`,
        telefono,
        titulo: `Recibo ${folio ?? ''}`,
        mensaje: `Buen día ${trabajador}, le comparto su recibo de abono ${folio ?? ''} por ${pesos(total)} de HAACO PRO RECUBRIMIENTOS.`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo compartir el recibo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <button
      type="button"
      onClick={enviar}
      disabled={enviando}
      title={error ?? undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
        error
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-tinta-300 bg-white text-tinta-700 hover:bg-tinta-50'
      }`}
    >
      <Share2 size={13} />
      {error ? 'No se pudo' : enviando ? 'Abriendo…' : 'WhatsApp'}
    </button>
  )
}
