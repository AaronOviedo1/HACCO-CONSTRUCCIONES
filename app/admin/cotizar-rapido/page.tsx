import { requerirRol } from '@/lib/auth'
import { cargarCatalogos, sugerenciasSinEsperar } from '../cotizaciones/datos'
import { CotizadorRapido } from '@/components/cotizaciones/cotizador-rapido'

export const dynamic = 'force-dynamic'

export default async function PaginaCotizarRapido() {
  await requerirRol(['admin', 'administracion'])
  const { clientes, textos, productos, terminosPorDefecto } = await cargarCatalogos()

  // Sin `await`: la promesa cruza al cotizador y se resuelve allá. En sitio
  // importa: la pantalla tiene que salir antes de que el cliente termine de
  // señalar.
  const sugerencias = sugerenciasSinEsperar()

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
