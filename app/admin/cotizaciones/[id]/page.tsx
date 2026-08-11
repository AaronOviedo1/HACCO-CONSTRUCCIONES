import { requerirRol } from '@/lib/auth'
import { EditorCotizacion } from '@/components/cotizaciones/editor'
import { cargarCatalogos, cargarCotizacion, cargarSugerencias } from '../datos'

export const dynamic = 'force-dynamic'

export default async function PaginaCotizacion({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params

  // Sin `await`: la promesa cruza al editor y se resuelve allá. El `catch` va
  // aquí para que un fallo no viaje como rechazo suelto.
  const sugerencias = cargarSugerencias().catch(() => ({
    partidas: [],
    materiales: [],
    procesos: [],
  }))

  const [
    { cotizacion, borrador, obras, recordatorios },
    { clientes, textos, productos, precios },
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
      sugerencias={sugerencias}
    />
  )
}
