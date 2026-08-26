'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus, Send, Trash2 } from 'lucide-react'
import {
  Casilla, Dialogo, Entrada, MensajeError, Numero, NumeroCorto, PieDialogo, Seleccion,
} from '@/components/formulario'
import { UNIDADES_PARTIDA, num, redondear } from '@/lib/cotizaciones'
import { pesos } from '@/lib/format'
import { guardarPresupuesto } from '@/app/admin/servicios/acciones'
import type { ServicioItem, VServicio } from '@/types/database'

type Renglon = { descripcion: string; cantidad: string; unidad: string; precio: string }

const VACIO: Renglon = { descripcion: '', cantidad: '1', unidad: 'pza', precio: '' }

/**
 * El presupuesto de la reparación.
 *
 * Se parece al bloque de partidas del cotizador pero no lo reutiliza: aquel
 * vive dentro del documento de cotización, con sus procesos, su línea de
 * calidad y su desglose de herrería. Aquí son tres renglones y un total; nada
 * de eso aplica a cambiar un motor.
 *
 * El descuento tampoco existe: una reparación no se descuenta, se cotiza más
 * barata. El IVA no se captura: si el cliente pide factura son los 16 de
 * siempre, como en las cotizaciones.
 */
export function EditorPresupuesto({
  servicio,
  items,
}: {
  servicio: VServicio
  items: ServicioItem[]
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const inicial: Renglon[] =
    items.length > 0
      ? items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: String(i.cantidad),
          unidad: i.unidad ?? 'pza',
          precio: String(i.precio_unitario),
        }))
      : [{ ...VACIO }]

  const [renglones, setRenglones] = useState<Renglon[]>(inicial)
  const [factura, setFactura] = useState(servicio.requiere_factura)
  const [vigencia, setVigencia] = useState(String(servicio.vigencia_dias))
  const [garantia, setGarantia] = useState(String(servicio.garantia_dias))
  const [cuota, setCuota] = useState(String(servicio.cuota_visita))

  const tocar = (i: number, parche: Partial<Renglon>) =>
    setRenglones((antes) => antes.map((r, j) => (i === j ? { ...r, ...parche } : r)))

  const trabajo = redondear(
    renglones.reduce((suma, r) => suma + (num(r.cantidad) || 1) * num(r.precio), 0),
  )
  // Si el cliente acepta, paga el trabajo y la visita; si dice que no, sólo la
  // visita. Aquí se enseña el caso de que acepte, que es el del papel.
  const subtotal = redondear(trabajo + num(cuota))
  const iva = factura ? redondear(subtotal * 0.16) : 0
  const total = redondear(subtotal + iva)

  const abrir = () => {
    setRenglones(inicial)
    setFactura(servicio.requiere_factura)
    setVigencia(String(servicio.vigencia_dias))
    setGarantia(String(servicio.garantia_dias))
    setCuota(String(servicio.cuota_visita))
    setError(null)
    setAbierto(true)
  }

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const salida = await guardarPresupuesto(servicio.servicio_id, {
        items: renglones.map((r) => ({
          descripcion: r.descripcion,
          cantidad: num(r.cantidad) || 1,
          unidad: r.unidad || null,
          precio_unitario: num(r.precio),
        })),
        requiere_factura: factura,
        vigencia_dias: num(vigencia) || 15,
        garantia_dias: num(garantia) || 30,
        cuota_visita: num(cuota),
      })

      if (!salida.ok) {
        setError(salida.error)
        return
      }
      setAbierto(false)
      router.refresh()
    })

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-5 text-[15px] font-semibold transition lg:min-h-0 lg:rounded-lg lg:px-4 lg:py-2 lg:text-sm ${
          items.length > 0
            ? 'border border-tinta-300 bg-white text-tinta-700 hover:border-haaco-300 hover:bg-haaco-50'
            : 'bg-haaco-700 text-white hover:bg-haaco-800'
        }`}
      >
        <Send size={16} />
        {items.length > 0 ? 'Corregir presupuesto' : 'Armar presupuesto'}
      </button>

      <Dialogo
        abierto={abierto}
        titulo="Presupuesto de la reparación"
        descripcion="Lo que se le pasa al cliente. Sale en el PDF tal como quede aquí."
        onCerrar={() => setAbierto(false)}
        ancho="xl"
      >
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-3">
            {renglones.map((r, i) => (
              <div
                key={i}
                className="grid gap-2 rounded-[16px] border-[0.5px] border-tinta-200 bg-tinta-50/60 p-3 lg:grid-cols-[minmax(0,1fr)_5rem_7rem_7rem_auto] lg:items-end lg:gap-2.5"
              >
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-tinta-600">Concepto</span>
                  <Entrada
                    value={r.descripcion}
                    onChange={(e) => tocar(i, { descripcion: e.target.value })}
                    placeholder="Motor Merik 511 / Mano de obra"
                    disabled={pendiente}
                  />
                </label>

                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-tinta-600">Cant.</span>
                  <Numero
                    value={r.cantidad}
                    onChange={(e) => tocar(i, { cantidad: e.target.value })}
                    disabled={pendiente}
                  />
                </label>

                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-tinta-600">Unidad</span>
                  <Seleccion
                    value={r.unidad}
                    onChange={(e) => tocar(i, { unidad: e.target.value })}
                    disabled={pendiente}
                  >
                    {UNIDADES_PARTIDA.filter((u) => u.valor).map((u) => (
                      <option key={u.valor} value={u.valor}>
                        {u.texto}
                      </option>
                    ))}
                  </Seleccion>
                </label>

                <label className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-tinta-600">Precio</span>
                  <Numero
                    value={r.precio}
                    onChange={(e) => tocar(i, { precio: e.target.value })}
                    placeholder="0.00"
                    disabled={pendiente}
                  />
                </label>

                <span className="flex items-center justify-between gap-2 lg:justify-end">
                  <span className="text-sm font-semibold tabular-nums text-tinta-800 lg:min-w-24 lg:text-right">
                    {pesos((num(r.cantidad) || 1) * num(r.precio))}
                  </span>
                  {renglones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRenglones((antes) => antes.filter((_, j) => j !== i))}
                      disabled={pendiente}
                      className="rounded-lg p-2 text-tinta-400 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Quitar ${r.descripcion || 'la partida'}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRenglones((antes) => [...antes, { ...VACIO }])}
            disabled={pendiente}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-tinta-300 px-3 py-2 text-sm font-medium text-tinta-600 transition hover:border-haaco-400 hover:text-haaco-700"
          >
            <Plus size={15} />
            Otra partida
          </button>

          <div className="mt-5 grid gap-4 border-t-[0.5px] border-tinta-150 pt-4 lg:grid-cols-2">
            <div className="space-y-3">
              <Casilla
                etiqueta="El cliente pide factura (IVA del 16%)"
                checked={factura}
                onChange={(e) => setFactura(e.target.checked)}
                disabled={pendiente}
              />
              <div className="flex flex-wrap gap-4">
                <NumeroCorto
                  etiqueta="Vigencia"
                  sufijo="días"
                  value={vigencia}
                  onChange={(e) => setVigencia(e.target.value)}
                  disabled={pendiente}
                />
                <NumeroCorto
                  etiqueta="Garantía"
                  sufijo="días"
                  value={garantia}
                  onChange={(e) => setGarantia(e.target.value)}
                  disabled={pendiente}
                />
                {/* Se puede dejar en cero: hay trabajos donde, si el cliente
                    acepta, la visita se le absorbe. */}
                <NumeroCorto
                  etiqueta="Visita"
                  sufijo="pesos"
                  value={cuota}
                  onChange={(e) => setCuota(e.target.value)}
                  disabled={pendiente}
                />
              </div>
            </div>

            <dl className="space-y-1.5 rounded-[16px] bg-tinta-50 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-tinta-600">La reparación</dt>
                <dd className="tabular-nums">{pesos(trabajo)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-tinta-600">La visita</dt>
                <dd className="tabular-nums">{pesos(num(cuota))}</dd>
              </div>
              <div className="flex justify-between border-t-[0.5px] border-tinta-200 pt-1.5">
                <dt className="text-tinta-600">Subtotal</dt>
                <dd className="tabular-nums">{pesos(subtotal)}</dd>
              </div>
              {factura && (
                <div className="flex justify-between">
                  <dt className="text-tinta-600">IVA 16%</dt>
                  <dd className="tabular-nums">{pesos(iva)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t-[0.5px] border-tinta-200 pt-1.5 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums text-haaco-800">{pesos(total)}</dd>
              </div>
            </dl>
          </div>

          <MensajeError mensaje={error} />
        </div>

        <PieDialogo>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={pendiente}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-5 text-[15px] font-semibold text-white transition hover:bg-haaco-800 disabled:bg-haaco-300 lg:min-h-0 lg:rounded-lg lg:px-4 lg:py-2 lg:text-sm"
          >
            {pendiente ? 'Guardando…' : 'Guardar presupuesto'}
          </button>
        </PieDialogo>
      </Dialogo>
    </>
  )
}
