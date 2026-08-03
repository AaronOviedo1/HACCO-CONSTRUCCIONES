import Link from 'next/link'
import { Tarjeta, Etiqueta } from '@/components/ui'
import { fechaHora, pesos, porcentaje } from '@/lib/format'
import { semaforoMaterial } from '@/lib/obras'
import type { DatosObra } from '@/app/admin/obras/datos'

/**
 * El CONCENTRADO tal como lo llevan hoy en la hoja de la OT:
 * COTIZADO / REAL / % renglón por renglón, y la utilidad al final.
 */
export function PanelResumen({ datos }: { datos: DatosObra }) {
  const c = datos.concentrado
  const cotizado = Number(c.cotizado)

  const manoObra = Number(c.mano_obra)
  const manoObraCot = Number(c.mano_obra_cotizada)
  const materialReal = Number(c.material_real)
  const materialCot = Number(c.material_cotizado)
  const viaticos = Number(c.viaticos)
  const viaticosCot = Number(c.viaticos_cotizados)
  const adicionales = Number(c.gastos_adicionales)
  const utilidad = Number(c.utilidad)

  const pct = (n: number) => (cotizado > 0 ? (n / cotizado) * 100 : 0)
  const semaforo = semaforoMaterial(materialCot, materialReal)

  const renglones = [
    { concepto: 'Cotización', cot: cotizado, real: cotizado, tono: 'neutro' as const },
    // El cotizado de mano de obra sale del desglose de herrería; el de
    // viáticos, del campo de la cotización. Cero se enseña como «—».
    { concepto: 'Mano de obra', cot: manoObraCot > 0 ? manoObraCot : null, real: manoObra, tono: 'neutro' as const },
    { concepto: 'Material consumido', cot: materialCot, real: materialReal, tono: 'material' as const },
    { concepto: 'Viáticos', cot: viaticosCot > 0 ? viaticosCot : null, real: viaticos, tono: 'neutro' as const },
    { concepto: 'Gastos adicionales', cot: null, real: adicionales, tono: 'neutro' as const },
  ]

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* min-w-0: la tabla de adentro mide 34rem y sin esto estira la columna
          del grid más allá del ancho del teléfono. */}
      <div className="min-w-0 lg:col-span-2">
        <Tarjeta titulo="Concentrado financiero">
          {/* Teléfono: el mismo concentrado, un renglón por concepto ------- */}
          <ul className="divide-y divide-tinta-100 lg:hidden">
            {renglones.map((r) => (
              <li key={r.concepto} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-tinta-700">
                    <span className="truncate">{r.concepto}</span>
                    {r.tono === 'material' && materialCot > 0 && (
                      <Etiqueta tono={semaforo.tono}>{semaforo.texto}</Etiqueta>
                    )}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-tinta-900">
                    {pesos(r.real)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11.5px] tabular-nums text-tinta-400">
                  Cotizado {r.cot == null ? '—' : pesos(r.cot)} · {porcentaje(pct(r.real), 1)} de lo
                  cotizado
                </p>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2 bg-haaco-50/60 px-4 py-3">
              <span className="font-semibold text-tinta-900">Utilidad</span>
              <span className="text-right">
                <span
                  className={`block text-lg font-semibold tabular-nums ${
                    utilidad < 0 ? 'text-red-600' : 'text-haaco-700'
                  }`}
                >
                  {pesos(utilidad)}
                </span>
                <span
                  className={`block text-[11.5px] tabular-nums ${
                    utilidad < 0 ? 'text-red-600' : 'text-haaco-700'
                  }`}
                >
                  {porcentaje(pct(utilidad), 1)}
                </span>
              </span>
            </li>
          </ul>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr>
                  <th className="border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500">
                    Concepto
                  </th>
                  <th className="border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">
                    Cotizado
                  </th>
                  <th className="border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">
                    Real
                  </th>
                  <th className="w-20 border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {renglones.map((r) => (
                  <tr key={r.concepto} className="hover:bg-tinta-50/50">
                    <td className="border-b border-tinta-100 px-4 py-2.5 text-tinta-700">
                      <span className="flex items-center gap-2">
                        {r.concepto}
                        {r.tono === 'material' && materialCot > 0 && (
                          <Etiqueta tono={semaforo.tono}>{semaforo.texto}</Etiqueta>
                        )}
                      </span>
                    </td>
                    <td className="border-b border-tinta-100 px-4 py-2.5 text-right tabular-nums text-tinta-500">
                      {r.cot == null ? '—' : pesos(r.cot)}
                    </td>
                    <td className="border-b border-tinta-100 px-4 py-2.5 text-right font-medium tabular-nums text-tinta-900">
                      {pesos(r.real)}
                    </td>
                    <td className="border-b border-tinta-100 px-4 py-2.5 text-right tabular-nums text-tinta-500">
                      {porcentaje(pct(r.real), 1)}
                    </td>
                  </tr>
                ))}

                <tr className="bg-haaco-50/60">
                  <td className="px-4 py-3 font-semibold text-tinta-900">Utilidad</td>
                  <td className="px-4 py-3 text-right text-tinta-400">—</td>
                  <td
                    className={`px-4 py-3 text-right text-lg font-semibold tabular-nums ${
                      utilidad < 0 ? 'text-red-600' : 'text-haaco-700'
                    }`}
                  >
                    {pesos(utilidad)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${
                      utilidad < 0 ? 'text-red-600' : 'text-haaco-700'
                    }`}
                  >
                    {porcentaje(pct(utilidad), 1)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="border-t border-tinta-100 bg-tinta-50 px-4 py-2.5 text-xs text-tinta-500">
            Utilidad = cotizado − mano de obra − material − viáticos − gastos adicionales. Los
            porcentajes son sobre lo cotizado.
          </div>
        </Tarjeta>

        {datos.solicitudes.filter((s) => s.estatus === 'pendiente').length > 0 && (
          <Tarjeta titulo="Material que pidió la cuadrilla" className="mt-4">
            <ul className="divide-y divide-tinta-100">
              {datos.solicitudes
                .filter((s) => s.estatus === 'pendiente')
                .map((s) => (
                  <li key={s.id} className="px-4 py-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <Etiqueta tono="ambar">Pendiente de cotizar</Etiqueta>
                      <span className="text-xs text-tinta-400">{fechaHora(s.created_at)}</span>
                    </div>
                    <ul className="space-y-0.5 text-sm text-tinta-700">
                      {(Array.isArray(s.items) ? s.items : []).map(
                        (item: unknown, i: number) => {
                          const it = item as { material?: string; cantidad?: number; unidad?: string }
                          return (
                            <li key={i}>
                              {it.cantidad ?? ''} {it.unidad ?? ''} {it.material ?? ''}
                            </li>
                          )
                        },
                      )}
                    </ul>
                  </li>
                ))}
            </ul>
            <div className="border-t border-tinta-100 px-4 py-2.5">
              <Link
                href={`/admin/obras/${c.obra_id}?t=materiales`}
                className="text-sm font-medium text-haaco-700 hover:underline"
              >
                Atender en Materiales →
              </Link>
            </div>
          </Tarjeta>
        )}
      </div>

      <div className="space-y-4">
        <Tarjeta titulo="En números">
          <dl className="divide-y divide-tinta-100">
            <Dato etiqueta="Contratos de mano de obra" valor={String(c.contratos)} />
            <Dato etiqueta="Avances capturados" valor={String(c.avances)} />
            <Dato
              etiqueta="Último avance"
              valor={c.ultimo_avance ? fechaHora(c.ultimo_avance) : 'Ninguno'}
            />
            <Dato etiqueta="Conceptos" valor={String(datos.conceptos.length)} />
            <Dato
              etiqueta="Tareas pendientes"
              valor={String(datos.tareas.filter((t) => t.estatus !== 'terminada').length)}
            />
            <Dato
              etiqueta="Detalles sin atender"
              valor={String(datos.detalles.filter((d) => !d.atendido).length)}
            />
          </dl>
        </Tarjeta>

        <Tarjeta titulo="Bitácora">
          {datos.bitacora.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tinta-500">Todavía sin movimientos.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-tinta-100 overflow-y-auto">
              {datos.bitacora.slice(0, 20).map((b) => (
                <li key={b.id} className="px-4 py-2.5">
                  <p className="text-sm text-tinta-700">{b.descripcion}</p>
                  <p className="mt-0.5 text-xs text-tinta-400">{fechaHora(b.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-sm text-tinta-600">{etiqueta}</dt>
      <dd className="text-sm font-medium tabular-nums text-tinta-900">{valor}</dd>
    </div>
  )
}
