import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { EncabezadoPagina } from '@/components/ui'
import { TarjetaObraMovil } from '@/components/obras/tarjeta-movil'

export const dynamic = 'force-dynamic'

export default async function MisObras() {
  const perfil = await requerirRol(['cuadrilla'])
  const supabase = await crearClienteServidor()

  // RLS ya limita el resultado a las obras donde este oficial tiene contrato.
  const { data } = await supabase
    .from('obras')
    .select('id, ot_numero, nombre, domicilio, estatus, avance_pct, fecha_estimada_entrega')
    .order('fecha_apertura', { ascending: false })

  const obras = data ?? []
  const activas = obras.filter((o) => o.estatus !== 'cerrada')
  const cerradas = obras.filter((o) => o.estatus === 'cerrada')

  return (
    <>
      <EncabezadoPagina
        titulo="Mis obras"
        descripcion="Sube fotos y el avance del día. Lo que registres aquí lo ve Dirección al momento."
      />

      {obras.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-tinta-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-tinta-700">No tienes obras asignadas</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-tinta-500">
            En cuanto Dirección te abra un contrato de obra, aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {activas.map((obra) => (
              <TarjetaObraMovil
                key={obra.id}
                href={`/obra/${obra.id}`}
                nombre={obra.nombre}
                ot={obra.ot_numero}
                domicilio={obra.domicilio}
                estatus={obra.estatus}
                avance={Number(obra.avance_pct)}
                accion={{
                  texto: perfil.oficio === 'herrero' ? 'Subir avance o pedir material' : 'Subir avance',
                  href: `/obra/${obra.id}#subir`,
                }}
              />
            ))}
          </div>

          {cerradas.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 px-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-tinta-400">
                Obras cerradas
              </h2>
              <div className="overflow-hidden rounded-[20px] border-[0.5px] border-tinta-200 bg-white shadow-tarjeta">
                {cerradas.map((obra) => (
                  <Link
                    key={obra.id}
                    href={`/obra/${obra.id}`}
                    className="flex min-h-[52px] items-center justify-between gap-3 border-b-[0.5px] border-tinta-100 px-4 text-sm transition last:border-b-0 active:bg-tinta-50"
                  >
                    <span className="min-w-0 truncate text-tinta-600">{obra.nombre}</span>
                    <span className="shrink-0 font-mono text-xs text-tinta-400">
                      OT {obra.ot_numero}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
