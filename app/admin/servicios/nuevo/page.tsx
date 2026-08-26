import { requerirRol } from '@/lib/auth'
import { cargarCatalogosServicio } from '@/app/admin/servicios/datos'
import { EncabezadoPagina } from '@/components/ui'
import { CabeceraDetalle } from '@/components/movil/piezas'
import { FormularioServicio } from '@/components/servicios/formulario-servicio'

export const dynamic = 'force-dynamic'

export default async function PaginaNuevoServicio() {
  await requerirRol(['admin', 'administracion'])
  const { clientes, tecnicos } = await cargarCatalogosServicio()

  return (
    <>
      <CabeceraDetalle titulo="Agendar visita" volverA="/admin/servicios" />
      <EncabezadoPagina
        titulo="Agendar visita"
        descripcion="El día y la hora en que puede ir el técnico. Lo demás se anota después."
      />
      <FormularioServicio clientes={clientes} tecnicos={tecnicos} />
    </>
  )
}
