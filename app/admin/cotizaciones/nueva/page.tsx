import { requerirRol } from '@/lib/auth'
import { borradorVacio } from '@/lib/cotizaciones'
import { EditorCotizacion } from '@/components/cotizaciones/editor'
import { cargarCatalogos } from '../datos'

export const dynamic = 'force-dynamic'

export default async function NuevaCotizacion() {
  await requerirRol(['admin', 'administracion'])
  const { clientes, textos, productos, sugerencias } = await cargarCatalogos()

  // La descripción del trabajo arranca vacía: cada obra lleva sus propios
  // pasos y es más rápido agregarlos de la biblioteca que borrar los que sobran.
  const inicial = {
    ...borradorVacio('pintura'),
    items: [{ descripcion: '', m2: '', precio_unitario: '' }],
  }

  return (
    <EditorCotizacion
      key="nueva"
      cotizacionId={null}
      folio={null}
      estatus="borrador"
      inicial={inicial}
      clientes={clientes}
      textos={textos}
      productos={productos}
      obras={[]}
      sugerencias={sugerencias}
    />
  )
}
