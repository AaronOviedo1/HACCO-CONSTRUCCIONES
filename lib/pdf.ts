import 'server-only'
import { createElement, type ComponentType, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'

/**
 * Envoltura común de los documentos: renderiza el componente y arma la
 * respuesta HTTP. `?descargar` fuerza la descarga en vez de abrirlo en el visor.
 */
export async function responderPdf<P extends object>(
  Componente: ComponentType<P>,
  props: P,
  nombreArchivo: string,
  peticion: Request,
): Promise<Response> {
  const documento = createElement(Componente, props) as unknown as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(documento)

  const descargar = new URL(peticion.url).searchParams.has('descargar')
  const archivo = nombreArchivo.replace(/[/\\]/g, '-')

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="${archivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}
