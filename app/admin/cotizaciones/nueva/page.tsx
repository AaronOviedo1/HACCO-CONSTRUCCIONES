import { requerirRol } from '@/lib/auth'
import { borradorVacio } from '@/lib/cotizaciones'
import { EditorCotizacion } from '@/components/cotizaciones/editor'
import { cargarCatalogos } from '../datos'

export const dynamic = 'force-dynamic'

export default async function NuevaCotizacion() {
  await requerirRol(['admin', 'administracion'])
  const { clientes, textos, productos } = await cargarCatalogos()

  // Los pasos del proceso vienen preseleccionados: casi siempre son los mismos
  // y se quitan más rápido de lo que se agregan.
  const inicial = {
    ...borradorVacio('pintura'),
    procesos: textos
      .slice(0, 5)
      .map((t) => ({ texto_proceso_id: t.id, contenido: t.contenido })),
    items: [{ descripcion: '', m2: '', precio_unitario: '' }],
  }

  return (
    <EditorCotizacion
      cotizacionId={null}
      folio={null}
      estatus="borrador"
      inicial={inicial}
      clientes={clientes}
      textos={textos}
      productos={productos}
      obras={0}
    />
  )
}
