'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo } from '@/components/formulario'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { pesos, porcentaje } from '@/lib/format'
import { num } from '@/lib/cotizaciones'
import { semaforoMaterial } from '@/lib/obras'
import { eliminarConcepto, guardarConcepto } from '@/app/admin/obras/acciones'
import type { ObraConcepto } from '@/types/database'
import type { DatosObra } from '@/app/admin/obras/datos'

/**
 * Sub-conceptos con presupuesto propio: "Macetero #2", "Registro #3",
 * "Vista puerta #4" dentro de la misma OT de herrería.
 */
export function PanelConceptos({ datos }: { datos: DatosObra }) {
  const router = useRouter()
  const [editando, setEditando] = useState<ObraConcepto | 'nuevo' | null>(null)
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cerrada = datos.concentrado.estatus === 'cerrada'

  const consumo = new Map<string, number>()
  for (const m of datos.materiales) {
    if (m.origen !== 'real' || !m.concepto_id) continue
    consumo.set(m.concepto_id, (consumo.get(m.concepto_id) ?? 0) + Number(m.total))
  }

  const presupuestoTotal = datos.conceptos.reduce((s, c) => s + Number(c.presupuesto), 0)
  const consumidoTotal = [...consumo.values()].reduce((s, v) => s + v, 0)

  const borrar = (id: string) =>
    iniciar(async () => {
      setError(null)
      if (!confirm('¿Eliminar este concepto? Los materiales quedarán sin concepto asignado.')) return
      const r = await eliminarConcepto(datos.obra.id, id)
      if (!r.ok) return setError(r.error)
      router.refresh()
    })

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      <Tarjeta
        titulo="Conceptos de la obra"
        pie="Una OT se puede subdividir para llevar el presupuesto y el consumo por separado."
      >
        {datos.conceptos.length === 0 ? (
          <EstadoVacio
            titulo="Sin conceptos"
            descripcion="Úsalos cuando la OT tenga piezas independientes: Macetero #2, Registro #3, Vista puerta #4…"
            accion={
              !cerrada ? (
                <button
                  type="button"
                  onClick={() => setEditando('nuevo')}
                  className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
                >
                  <Plus size={16} />
                  Nuevo concepto
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500">
                      Concepto
                    </th>
                    <th className="w-32 border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">
                      Presupuesto
                    </th>
                    <th className="w-32 border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">
                      Consumido
                    </th>
                    <th className="w-40 border-b border-tinta-200 bg-tinta-50/70 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500">
                      Semáforo
                    </th>
                    <th className="w-8 border-b border-tinta-200 bg-tinta-50/70" />
                  </tr>
                </thead>
                <tbody>
                  {datos.conceptos.map((c) => {
                    const gastado = consumo.get(c.id) ?? 0
                    const s = semaforoMaterial(Number(c.presupuesto), gastado)
                    return (
                      <tr key={c.id} className="hover:bg-tinta-50/50">
                        <td className="border-b border-tinta-100 px-4 py-2.5">
                          <button
                            type="button"
                            onClick={() => !cerrada && setEditando(c)}
                            className="text-left font-medium text-tinta-900 hover:text-haaco-700"
                          >
                            {c.nombre}
                          </button>
                        </td>
                        <td className="border-b border-tinta-100 px-4 py-2.5 text-right tabular-nums text-tinta-600">
                          {pesos(c.presupuesto)}
                        </td>
                        <td className="border-b border-tinta-100 px-4 py-2.5 text-right font-medium tabular-nums text-tinta-900">
                          {pesos(gastado)}
                        </td>
                        <td className="border-b border-tinta-100 px-4 py-2.5">
                          <Etiqueta tono={s.tono}>{s.texto}</Etiqueta>
                        </td>
                        <td className="border-b border-tinta-100 px-1 py-2.5">
                          {!cerrada && (
                            <button
                              type="button"
                              onClick={() => borrar(c.id)}
                              disabled={pendiente}
                              className="rounded p-1 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                              aria-label={`Eliminar ${c.nombre}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-tinta-50/60">
                    <td className="px-4 py-2.5 font-semibold text-tinta-900">Total</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-tinta-900">
                      {pesos(presupuestoTotal)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-tinta-900">
                      {pesos(consumidoTotal)}
                    </td>
                    <td className="px-4 py-2.5 text-tinta-500">
                      {presupuestoTotal > 0 &&
                        porcentaje((consumidoTotal / presupuestoTotal) * 100, 0)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            {!cerrada && (
              <div className="border-t border-tinta-100 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setEditando('nuevo')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-tinta-300 px-2.5 py-1.5 text-xs font-medium text-tinta-600 transition hover:bg-tinta-50"
                >
                  <Plus size={14} />
                  Agregar concepto
                </button>
              </div>
            )}
          </>
        )}
      </Tarjeta>

      {editando && (
        <FormularioConcepto
          obraId={datos.obra.id}
          concepto={editando === 'nuevo' ? undefined : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function FormularioConcepto({
  obraId, concepto, onCerrar,
}: {
  obraId: string
  concepto?: ObraConcepto
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(concepto?.nombre ?? '')
  const [presupuesto, setPresupuesto] = useState(String(concepto?.presupuesto ?? ''))

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarConcepto(obraId, {
        id: concepto?.id,
        nombre,
        presupuesto: num(presupuesto),
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={concepto ? 'Editar concepto' : 'Nuevo concepto'}
      descripcion="El presupuesto sirve para comparar contra el material que se le cargue."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Nombre"
          hijo={
            <Entrada
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Macetero #2"
              autoFocus
            />
          }
        />
        <Campo
          etiqueta="Presupuesto"
          ancho="medio"
          hijo={<Numero value={presupuesto} onChange={(e) => setPresupuesto(e.target.value)} placeholder="0.00" />}
        />
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || !nombre.trim()}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
