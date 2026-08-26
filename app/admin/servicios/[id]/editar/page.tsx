import { requerirRol } from '@/lib/auth'
import { cargarCatalogosServicio, cargarServicio } from '@/app/admin/servicios/datos'
import { EncabezadoPagina } from '@/components/ui'
import { CabeceraDetalle } from '@/components/movil/piezas'
import { FormularioServicio } from '@/components/servicios/formulario-servicio'
import { BotonEliminarServicio } from '@/components/servicios/boton-eliminar'

export const dynamic = 'force-dynamic'

export default async function PaginaEditarServicio({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params

  const [{ servicio }, { clientes, tecnicos }] = await Promise.all([
    cargarServicio(id),
    cargarCatalogosServicio(),
  ])

  return (
    <>
      <CabeceraDetalle titulo="Corregir la cita" volverA={`/admin/servicios/${id}`} />
      <EncabezadoPagina
        titulo={`Corregir ${servicio.folio ?? 'la cita'}`}
        descripcion="Mover el día o la hora reacomoda el aviso; no se duplica."
      />
      <FormularioServicio servicio={servicio} clientes={clientes} tecnicos={tecnicos} />

      <div className="mt-4">
        <BotonEliminarServicio servicio={servicio} />
      </div>
    </>
  )
}
