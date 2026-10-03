import { requerirRol } from '@/lib/auth'
import { EditorCotizacion } from '@/components/cotizaciones/editor'
import { cargarCatalogos, cargarCotizacion, sugerenciasSinEsperar } from '../datos'

export const dynamic = 'force-dynamic'

export default async function PaginaCotizacion({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params

  // Sin `await`: la promesa cruza al editor y se resuelve allá.
  const sugerencias = sugerenciasSinEsperar()

  const [
    { cotizacion, borrador, obras, recordatorios },
    { clientes, textos, productos, precios, terminosPorDefecto },
  ] = await Promise.all([
    cargarCotizacion(id),
    cargarCatalogos(),
  ])

  return (
    <EditorCotizacion
      key={cotizacion.id}
      cotizacionId={cotizacion.id}
      folio={cotizacion.folio}
      estatus={cotizacion.estatus}
      inicial={borrador}
      clientes={clientes}
      textos={textos}
      productos={productos}
      precios={precios}
      obras={obras}
      recordatorios={recordatorios}
      terminosPorDefecto={terminosPorDefecto}
      sugerencias={sugerencias}
    />
  )
}
