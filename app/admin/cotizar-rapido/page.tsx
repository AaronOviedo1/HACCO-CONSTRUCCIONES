import { requerirRol } from '@/lib/auth'
import { cargarCatalogos } from '../cotizaciones/datos'
import { CotizadorRapido } from '@/components/cotizaciones/cotizador-rapido'

export const dynamic = 'force-dynamic'

export default async function PaginaCotizarRapido() {
  await requerirRol(['admin', 'administracion'])
  const { clientes, textos } = await cargarCatalogos()

  return <CotizadorRapido clientes={clientes} textos={textos} />
}
