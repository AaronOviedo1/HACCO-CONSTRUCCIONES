import type { CategoriaGasto, MetodoPago } from '@/types/database'

/** Lo que la foto de un comprobante puede llenar del formulario de gasto. */
export type LecturaTicket = {
  descripcion: string | null
  piezas: number | null
  monto: number | null
  metodo: MetodoPago | null
  categoria: CategoriaGasto | null
  folio: string | null
  fecha: string | null
  proveedor_id: string | null
  /** Frase corta cuando la foto salió mal o no es un comprobante. */
  aviso: string | null
}

/** Lado largo al que se reduce la foto: más allá de esto el modelo no lee mejor. */
const LADO = 1568

/**
 * Deja la foto lista para viajar.
 *
 * Una foto de teléfono son 4 o 6 MB y tarda en subir con la señal de la obra;
 * reducida a 1568 px pesa una fracción y se lee igual de bien. Los PDF van tal
 * cual, y si el navegador no puede abrir el formato (HEIC viejo, por ejemplo)
 * se manda el original y que decida el servidor.
 */
export async function prepararTicket(archivo: File): Promise<Blob> {
  if (archivo.type === 'application/pdf') return archivo

  try {
    // Las fotos verticales traen la rotación en los metadatos: sin esto llegan
    // acostadas y el modelo lee mucho peor.
    const mapa = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    const escala = Math.min(1, LADO / Math.max(mapa.width, mapa.height))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(mapa.width * escala)
    lienzo.height = Math.round(mapa.height * escala)

    const pincel = lienzo.getContext('2d')
    if (!pincel) return archivo
    pincel.drawImage(mapa, 0, 0, lienzo.width, lienzo.height)
    mapa.close()

    const jpeg = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, 'image/jpeg', 0.82),
    )
    return jpeg ?? archivo
  } catch {
    return archivo
  }
}
