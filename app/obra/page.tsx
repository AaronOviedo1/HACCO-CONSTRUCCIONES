import Link from 'next/link'
import { Camera, ChevronRight, ClipboardList, MapPin } from 'lucide-react'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha } from '@/lib/format'
import { ESTATUS_OBRA } from '@/lib/obras'
import { Etiqueta } from '@/components/ui'

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
      <h1 className="mb-1 text-xl font-semibold text-tinta-900">Mis obras</h1>
      <p className="mb-5 text-sm text-tinta-500">
        Sube fotos y el avance del día. Lo que registres aquí lo ve Dirección al momento.
      </p>

      {obras.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-tinta-300 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-tinta-700">No tienes obras asignadas</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-tinta-500">
            En cuanto Dirección te abra un contrato de obra, aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {activas.map((obra) => (
              <li key={obra.id}>
                <Link
                  href={`/obra/${obra.id}`}
                  className="block rounded-2xl border border-tinta-200 bg-white p-4 transition active:bg-tinta-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-tinta-900">{obra.nombre}</p>
                      <p className="mt-0.5 font-mono text-xs text-tinta-400">OT {obra.ot_numero}</p>
                    </div>
                    <Etiqueta tono={ESTATUS_OBRA[obra.estatus].tono}>
                      {ESTATUS_OBRA[obra.estatus].texto}
                    </Etiqueta>
                  </div>

                  {obra.domicilio && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-tinta-500">
                      <MapPin size={15} className="mt-0.5 shrink-0" />
                      <span className="truncate">{obra.domicilio}</span>
                    </p>
                  )}

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-tinta-500">Avance</span>
                      <span className="font-semibold tabular-nums text-tinta-800">
                        {Number(obra.avance_pct)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-tinta-100">
                      <div
                        className="h-full rounded-full bg-haaco-500"
                        style={{ width: `${Math.min(100, Number(obra.avance_pct))}%` }}
                      />
                    </div>
                  </div>

                  {obra.fecha_estimada_entrega && (
                    <p className="mt-2.5 text-xs text-tinta-400">
                      Entrega estimada: {fecha(obra.fecha_estimada_entrega)}
                    </p>
                  )}

                  <p className="mt-3 flex items-center justify-between rounded-xl bg-haaco-50 px-3 py-2.5 text-sm font-semibold text-haaco-800">
                    <span className="flex items-center gap-2">
                      <Camera size={17} />
                      Subir avance
                      {perfil.oficio === 'herrero' && (
                        <>
                          <span className="text-haaco-300">·</span>
                          <ClipboardList size={17} />
                          Pedir material
                        </>
                      )}
                    </span>
                    <ChevronRight size={17} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {cerradas.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-medium text-tinta-500">Obras cerradas</h2>
              <ul className="space-y-2">
                {cerradas.map((obra) => (
                  <li key={obra.id}>
                    <Link
                      href={`/obra/${obra.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-tinta-200 bg-white px-4 py-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-tinta-600">{obra.nombre}</span>
                      <span className="shrink-0 font-mono text-xs text-tinta-400">
                        OT {obra.ot_numero}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  )
}
