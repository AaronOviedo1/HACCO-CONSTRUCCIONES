/**
 * Mandar un PDF del sistema por WhatsApp.
 *
 * Son dos caminos distintos y ninguno es opcional. En el teléfono y el iPad la
 * hoja de compartir del sistema lleva el archivo directo al chat, que es lo que
 * de verdad se usa en campo. En escritorio esa hoja no trae WhatsApp: ahí lo
 * único que se puede hacer es descargar el PDF y abrir el chat de la persona
 * con el mensaje ya escrito, para que sólo se arrastre el archivo.
 *
 * El teléfono se normaliza a diez dígitos con el 52 de México delante. Sin el
 * «1» de móvil, que WhatsApp dejó de exigir hace años y que sólo rompe enlaces.
 */

/** Diez dígitos mexicanos con lada de país. Vacío si no hay nada que marcar. */
export function telefonoWhatsApp(telefono: string | null | undefined): string {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (digitos.length === 0) return ''
  return digitos.length === 10 ? `52${digitos}` : digitos
}

export async function compartirPdf({
  url,
  nombreArchivo,
  telefono,
  titulo,
  mensaje,
}: {
  /** Ruta del PDF en la app, absoluta o relativa. */
  url: string
  /** Cómo se llama el archivo al descargarlo o adjuntarlo. */
  nombreArchivo: string
  /** A quién se le manda. Sin teléfono se abre WhatsApp Web sin destinatario. */
  telefono: string | null | undefined
  titulo: string
  mensaje: string
}): Promise<void> {
  const respuesta = await fetch(url.startsWith('http') ? url : `${window.location.origin}${url}`)
  if (!respuesta.ok) throw new Error('No se pudo generar el PDF.')

  const blob = await respuesta.blob()
  const archivo = new File([blob], nombreArchivo, { type: 'application/pdf' })

  const esTactil = navigator.maxTouchPoints > 0
  if (esTactil && navigator.canShare?.({ files: [archivo] })) {
    await navigator.share({ files: [archivo], title: titulo, text: mensaje })
    return
  }

  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(enlace.href)

  const numero = telefonoWhatsApp(telefono)
  window.open(
    numero
      ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
      : 'https://web.whatsapp.com',
    '_blank',
  )
}
