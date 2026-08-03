'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { PackageOpen, Plus, Trash2 } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { EntradaSugerencias } from '@/components/entrada-sugerencias'
import { EstadoVacio, Etiqueta, Indicador, Tarjeta } from '@/components/ui'
import { pesos, porcentaje } from '@/lib/format'
import { num } from '@/lib/cotizaciones'
import { semaforoMaterial } from '@/lib/obras'
import {
  cambiarEstatusSolicitud, eliminarMaterial, guardarMaterial, salidaDeTaller,
} from '@/app/admin/obras/acciones'
import type { OrigenMaterial } from '@/types/database'
import type { DatosObra } from '@/app/admin/obras/datos'

export function PanelMateriales({ datos }: { datos: DatosObra }) {
  const router = useRouter()
  const [nuevo, setNuevo] = useState<OrigenMaterial | null>(null)
  const [taller, setTaller] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cerrada = datos.concentrado.estatus === 'cerrada'
  const cotizados = datos.materiales.filter((m) => m.origen === 'cotizado')
  const reales = datos.materiales.filter((m) => m.origen === 'real')

  const totalCot = cotizados.reduce((s, m) => s + Number(m.total), 0)
  const totalReal = reales.reduce((s, m) => s + Number(m.total), 0)
  const semaforo = semaforoMaterial(totalCot, totalReal)
  const diferencia = totalCot - totalReal

  const nombreConcepto = new Map(datos.conceptos.map((c) => [c.id, c.nombre]))

  const borrar = (id: string) =>
    iniciar(async () => {
      setError(null)
      const r = await eliminarMaterial(datos.obra.id, id)
      if (!r.ok) return setError(r.error)
      router.refresh()
    })

  const solicitudesPendientes = datos.solicitudes.filter((s) => s.estatus !== 'comprada')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Presupuestado" valor={pesos(totalCot)} nota={`${cotizados.length} renglones`} />
        <Indicador etiqueta="Consumido" valor={pesos(totalReal)} nota={`${reales.length} renglones`} />
        <Indicador
          etiqueta="Diferencia"
          valor={pesos(Math.abs(diferencia))}
          nota={diferencia >= 0 ? 'por debajo del presupuesto' : 'rebasado'}
          tono={diferencia >= 0 ? 'verde' : 'rojo'}
        />
        <Indicador
          etiqueta="Consumo"
          valor={totalCot > 0 ? porcentaje(semaforo.pct, 0) : '—'}
          nota={semaforo.texto}
          tono={semaforo.tono === 'verde' ? 'verde' : semaforo.tono === 'rojo' ? 'rojo' : 'ambar'}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {solicitudesPendientes.length > 0 && (
        <Tarjeta titulo="Material que pidió la cuadrilla">
          <ul className="divide-y divide-tinta-100">
            {solicitudesPendientes.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <Etiqueta tono={s.estatus === 'pendiente' ? 'ambar' : 'azul'}>
                    {s.estatus === 'pendiente' ? 'Pendiente de cotizar' : 'Cotizada'}
                  </Etiqueta>
                  <div className="flex gap-1.5">
                    {s.estatus === 'pendiente' && (
                      <button
                        type="button"
                        onClick={() =>
                          iniciar(async () => {
                            await cambiarEstatusSolicitud(datos.obra.id, s.id, 'cotizada', null)
                            router.refresh()
                          })
                        }
                        disabled={pendiente}
                        className="rounded-lg border border-tinta-300 bg-white px-2.5 py-1 text-xs font-medium text-tinta-700 hover:bg-tinta-50"
                      >
                        Marcar cotizada
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        iniciar(async () => {
                          await cambiarEstatusSolicitud(datos.obra.id, s.id, 'comprada', null)
                          router.refresh()
                        })
                      }
                      disabled={pendiente}
                      className="rounded-lg bg-haaco-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-haaco-800"
                    >
                      Marcar comprada
                    </button>
                  </div>
                </div>
                <ul className="space-y-0.5 text-sm text-tinta-700">
                  {(Array.isArray(s.items) ? s.items : []).map((item: unknown, i: number) => {
                    const it = item as { material?: string; cantidad?: number; unidad?: string; notas?: string }
                    return (
                      <li key={i}>
                        {it.cantidad ?? ''} {it.unidad ?? ''} · {it.material ?? ''}
                        {it.notas && <span className="text-tinta-400"> — {it.notas}</span>}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <TablaMateriales
          titulo="Cotizado"
          descripcion="Lo que se presupuestó al aprobar la cotización."
          filas={cotizados}
          total={totalCot}
          nombreConcepto={nombreConcepto}
          cerrada={cerrada}
          onAgregar={() => setNuevo('cotizado')}
          onBorrar={borrar}
        />

        <TablaMateriales
          titulo="Real"
          descripcion="Lo que de verdad se consumió, con folio de factura o TALLER."
          filas={reales}
          total={totalReal}
          nombreConcepto={nombreConcepto}
          cerrada={cerrada}
          onAgregar={() => setNuevo('real')}
          onBorrar={borrar}
          accionExtra={
            !cerrada ? (
              <button
                type="button"
                onClick={() => setTaller(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
              >
                <PackageOpen size={14} />
                Salida de taller
              </button>
            ) : undefined
          }
        />
      </div>

      {nuevo && (
        <FormularioMaterial
          obraId={datos.obra.id}
          origen={nuevo}
          conceptos={datos.conceptos}
          sugerencias={datos.sugerenciasMateriales}
          onCerrar={() => setNuevo(null)}
        />
      )}

      {taller && (
        <FormularioSalidaTaller
          obraId={datos.obra.id}
          insumos={datos.insumos}
          conceptos={datos.conceptos}
          onCerrar={() => setTaller(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function TablaMateriales({
  titulo, descripcion, filas, total, nombreConcepto, cerrada, onAgregar, onBorrar, accionExtra,
}: {
  titulo: string
  descripcion: string
  filas: DatosObra['materiales']
  total: number
  nombreConcepto: Map<string, string>
  cerrada: boolean
  onAgregar: () => void
  onBorrar: (id: string) => void
  accionExtra?: React.ReactNode
}) {
  return (
    <Tarjeta
      titulo={
        <span className="flex items-center justify-between gap-2">
          <span>{titulo}</span>
          <span className="tabular-nums text-haaco-700">{pesos(total)}</span>
        </span>
      }
      pie={descripcion}
    >
      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin renglones" />
      ) : (
        <>
        {/* Teléfono: el material y su total; piezas y costo, debajo ------- */}
        <ul className="divide-y divide-tinta-100 lg:hidden">
          {filas.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] text-tinta-800">
                  {m.material}
                  {m.concepto_id && (
                    <span className="text-tinta-400"> · {nombreConcepto.get(m.concepto_id)}</span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] tabular-nums text-tinta-400">
                  {Number(m.piezas)} × {pesos(m.costo)}
                  {m.es_taller ? (
                    <Etiqueta tono="azul">TALLER</Etiqueta>
                  ) : m.folio_factura ? (
                    <span className="font-mono">· {m.folio_factura}</span>
                  ) : null}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-tinta-900">
                {pesos(m.total)}
              </span>
              {!cerrada && (
                <button
                  type="button"
                  onClick={() => onBorrar(m.id)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-tinta-400"
                  aria-label={`Quitar ${m.material}`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr>
                <th className="border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500">
                  Material
                </th>
                <th className="w-16 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">
                  Pzas
                </th>
                <th className="w-24 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">
                  Costo
                </th>
                <th className="w-28 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">
                  Total
                </th>
                <th className="w-24 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500">
                  Folio
                </th>
                <th className="w-8 border-b border-tinta-200 bg-tinta-50/70" />
              </tr>
            </thead>
            <tbody>
              {filas.map((m) => (
                <tr key={m.id} className="hover:bg-tinta-50/50">
                  <td className="border-b border-tinta-100 px-3 py-2 text-tinta-700">
                    {m.material}
                    {m.concepto_id && (
                      <span className="ml-1.5 text-xs text-tinta-400">
                        {nombreConcepto.get(m.concepto_id)}
                      </span>
                    )}
                  </td>
                  <td className="border-b border-tinta-100 px-3 py-2 text-right tabular-nums text-tinta-600">
                    {Number(m.piezas)}
                  </td>
                  <td className="border-b border-tinta-100 px-3 py-2 text-right tabular-nums text-tinta-600">
                    {pesos(m.costo)}
                  </td>
                  <td className="border-b border-tinta-100 px-3 py-2 text-right font-medium tabular-nums text-tinta-900">
                    {pesos(m.total)}
                  </td>
                  <td className="border-b border-tinta-100 px-3 py-2">
                    {m.es_taller ? (
                      <Etiqueta tono="azul">TALLER</Etiqueta>
                    ) : m.folio_factura ? (
                      <span className="font-mono text-xs text-tinta-500">{m.folio_factura}</span>
                    ) : (
                      <span className="text-tinta-300">—</span>
                    )}
                  </td>
                  <td className="border-b border-tinta-100 px-1 py-2">
                    {!cerrada && (
                      <button
                        type="button"
                        onClick={() => onBorrar(m.id)}
                        className="rounded p-1 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Quitar renglón"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {!cerrada && (
        <div className="flex flex-wrap gap-2 border-t border-tinta-100 px-4 py-2.5">
          <button
            type="button"
            onClick={onAgregar}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-tinta-300 px-2.5 py-1.5 text-xs font-medium text-tinta-600 transition hover:bg-tinta-50"
          >
            <Plus size={14} />
            Agregar renglón
          </button>
          {accionExtra}
        </div>
      )}
    </Tarjeta>
  )
}

// ---------------------------------------------------------------------------
function FormularioMaterial({
  obraId, origen, conceptos, sugerencias, onCerrar,
}: {
  obraId: string
  origen: OrigenMaterial
  conceptos: DatosObra['conceptos']
  sugerencias: DatosObra['sugerenciasMateriales']
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [material, setMaterial] = useState('')
  const [piezas, setPiezas] = useState('1')
  const [costo, setCosto] = useState('')
  const [folio, setFolio] = useState('')
  const [conceptoId, setConceptoId] = useState('')

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarMaterial(obraId, {
        origen,
        concepto_id: conceptoId || null,
        material,
        piezas: num(piezas),
        costo: num(costo),
        folio_factura: folio.trim() || null,
        es_taller: false,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={origen === 'cotizado' ? 'Material presupuestado' : 'Material consumido'}
      descripcion={
        origen === 'cotizado'
          ? 'Lo que se calculó al cotizar.'
          : 'Lo que se compró con factura. Si salió del taller usa «Salida de taller».'
      }
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Material"
          hijo={
            <EntradaSugerencias
              valor={material}
              onCambio={setMaterial}
              onElegir={(s) => {
                setMaterial(s.texto)
                if (s.monto) setCosto(String(s.monto))
              }}
              sugerencias={sugerencias}
              placeholder="Cubeta Rivinol 7 blanco"
              autoFocus
            />
          }
        />
        <Campo etiqueta="Piezas" ancho="medio" hijo={<Numero value={piezas} onChange={(e) => setPiezas(e.target.value)} />} />
        <Campo
          etiqueta="Costo unitario"
          ancho="medio"
          hijo={<Numero value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="0.00" />}
        />
        {origen === 'real' && (
          <Campo
            etiqueta="Folio de factura"
            ancho="medio"
            hijo={<Entrada value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="PN14741" />}
          />
        )}
        {conceptos.length > 0 && (
          <Campo
            etiqueta="Concepto"
            ancho="medio"
            hijo={
              <Seleccion value={conceptoId} onChange={(e) => setConceptoId(e.target.value)}>
                <option value="">Toda la obra</option>
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Seleccion>
            }
          />
        )}
        <div className="rounded-lg bg-tinta-50 px-3 py-2 text-sm sm:col-span-2">
          Total del renglón:{' '}
          <strong className="tabular-nums text-tinta-900">{pesos(num(piezas) * num(costo))}</strong>
        </div>
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
          disabled={pendiente || !material.trim()}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Agregar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
function FormularioSalidaTaller({
  obraId, insumos, conceptos, onCerrar,
}: {
  obraId: string
  insumos: DatosObra['insumos']
  conceptos: DatosObra['conceptos']
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [conceptoId, setConceptoId] = useState('')
  const [notas, setNotas] = useState('')

  const insumo = insumos.find((i) => i.producto_id === productoId)

  const sacar = () =>
    iniciar(async () => {
      setError(null)
      const r = await salidaDeTaller(obraId, productoId, num(cantidad), conceptoId || null, notas.trim() || null)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Salida del taller"
      descripcion="Descuenta la existencia del kardex y anota el material con folio TALLER."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Insumo"
          hijo={
            <Seleccion value={productoId} onChange={(e) => setProductoId(e.target.value)} autoFocus>
              <option value="">Elegir insumo…</option>
              {insumos.map((i) => (
                <option key={i.producto_id} value={i.producto_id} disabled={Number(i.existencia) <= 0}>
                  {i.nombre} · {Number(i.existencia)} {i.unidad}
                </option>
              ))}
            </Seleccion>
          }
          ayuda={
            insumo
              ? `Existencia: ${Number(insumo.existencia)} ${insumo.unidad} · costo ${pesos(insumo.costo)}`
              : undefined
          }
        />
        <Campo
          etiqueta="Cantidad"
          ancho="medio"
          hijo={<Numero value={cantidad} onChange={(e) => setCantidad(e.target.value)} />}
        />
        {conceptos.length > 0 && (
          <Campo
            etiqueta="Concepto"
            ancho="medio"
            hijo={
              <Seleccion value={conceptoId} onChange={(e) => setConceptoId(e.target.value)}>
                <option value="">Toda la obra</option>
                {conceptos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Seleccion>
            }
          />
        )}
        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />
        {insumo && (
          <div className="rounded-lg bg-tinta-50 px-3 py-2 text-sm sm:col-span-2">
            Se cargará a la obra:{' '}
            <strong className="tabular-nums text-tinta-900">
              {pesos(num(cantidad) * Number(insumo.costo))}
            </strong>
            <span className="ml-2 text-tinta-500">
              y quedarán {Number(insumo.existencia) - num(cantidad)} {insumo.unidad} en taller
            </span>
          </div>
        )}
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
          onClick={sacar}
          disabled={pendiente || !productoId || num(cantidad) <= 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Registrando…' : 'Registrar salida'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

