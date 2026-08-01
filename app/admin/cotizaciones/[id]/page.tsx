import { requerirRol } from '@/lib/auth'
import { EditorCotizacion } from '@/components/cotizaciones/editor'
import { cargarCatalogos, cargarCotizacion } from '../datos'

export const dynamic = 'force-dynamic'

export default async function PaginaCotizacion({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params

  const [{ cotizacion, borrador, obras }, { clientes, textos, productos, sugerencias }] =
    await Promise.all([cargarCotizacion(id), cargarCatalogos()])

  return (
    <EditorCotizacion
      cotizacionId={cotizacion.id}
      folio={cotizacion.folio}
      estatus={cotizacion.estatus}
      inicial={borrador}
      clientes={clientes}
      textos={textos}
      productos={productos}
      obras={obras}
      sugerencias={sugerencias}
    />
  )
}
