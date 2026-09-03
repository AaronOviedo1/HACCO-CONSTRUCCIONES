import { requerirRol } from '@/lib/auth'
import { cargarCatalogos, cargarSugerencias } from '../cotizaciones/datos'
import { CotizadorRapido } from '@/components/cotizaciones/cotizador-rapido'

export const dynamic = 'force-dynamic'

export default async function PaginaCotizarRapido() {
  await requerirRol(['admin', 'administracion'])
  const { clientes, textos, productos, terminosPorDefecto } = await cargarCatalogos()

  // Sin `await`: la promesa cruza al cotizador y se resuelve allá. El `catch`
  // va aquí para que un fallo no viaje como rechazo suelto. En sitio importa:
  // la pantalla tiene que salir antes de que el cliente termine de señalar.
  const sugerencias = cargarSugerencias().catch(() => ({
    partidas: [],
    materiales: [],
    procesos: [],
  }))

  return (
    <CotizadorRapido
      clientes={clientes}
      textos={textos}
      productos={productos}
      terminosPorDefecto={terminosPorDefecto}
      sugerencias={sugerencias}
    />
  )
}
