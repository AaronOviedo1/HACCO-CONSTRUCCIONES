'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { HandCoins, Wallet } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { Etiqueta } from '@/components/ui'
import { SelectorFecha } from '@/components/filtro-fechas'
import { montoEnLetra, pesos, porcentaje } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import { METODO_PAGO, TIPO_DEDUCCION } from '@/lib/finanzas'
import { guardarDeduccion, pagarNomina } from '@/app/admin/finanzas-acciones'
import type {
  Deduccion, MetodoPago, TipoDeduccion, VNominaContrato, VPrenomina,
} from '@/types/database'

export function PanelNomina({
  contratos, prenomina, deducciones,
}: {
  contratos: VNominaContrato[]
  prenomina: VPrenomina[]
  deducciones: Deduccion[]
  mes: string
}) {
  const [pagando, setPagando] = useState(false)
  const [prestando, setPrestando] = useState(false)

  return (
    <div className="ml-auto flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setPrestando(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
      >
        <HandCoins size={16} />
        Registrar préstamo
      </button>
      <button
        type="button"
        onClick={() => setPagando(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
      >
        <Wallet size={16} />
        Pagar nómina
      </button>

      {pagando && (
        <DialogoPago
          contratos={contratos}
          prenomina={prenomina}
          deducciones={deducciones.filter((d) => !d.saldado)}
          onCerrar={() => setPagando(false)}
        />
      )}

      {prestando && (
        <DialogoPrestamo prenomina={prenomina} onCerrar={() => setPrestando(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function DialogoPago({
  contratos, prenomina, deducciones, onCerrar,
}: {
  contratos: VNominaContrato[]
  prenomina: VPrenomina[]
  deducciones: Deduccion[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [trabajadorId, setTrabajadorId] = useState(prenomina[0]?.trabajador_id ?? '')
  const [fecha, setFecha] = useState(hoyISO())
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [notas, setNotas] = useState('')
  const [montos, setMontos] = useState<Record<string, string>>({})
  const [elegidas, setElegidas] = useState<string[]>([])

  const suyos = contratos.filter((c) => c.trabajador_id === trabajadorId)
  const susDeducciones = deducciones.filter((d) => d.trabajador_id === trabajadorId)
  // Lo que se le sigue debiendo a este trabajador antes de capturar el abono.
  const suSaldo = redondear(suyos.reduce((s, c) => s + Number(c.por_pagar), 0))

  // Sin useMemo: el compilador de React ya memoiza esto solo, y hacerlo a mano
  // le impedía optimizar el componente completo.
  const totales = (() => {
    const subtotal = suyos.reduce((s, c) => s + num(montos[c.contrato_id] ?? ''), 0)
    const descuento = susDeducciones
      .filter((d) => elegidas.includes(d.id))
      .reduce((s, d) => s + Number(d.monto), 0)
    return { subtotal: redondear(subtotal), descuento, total: redondear(subtotal - descuento) }
  })()

  const cambiarTrabajador = (id: string) => {
    setTrabajadorId(id)
    setMontos({})
    setElegidas([])
  }

  /** Precarga lo que se le puede pagar hoy según el avance de cada obra. */
  const sugerir = () => {
    const nuevos: Record<string, string> = {}
    for (const c of suyos) {
      if (Number(c.disponible) > 0) nuevos[c.contrato_id] = String(Number(c.disponible))
    }
    setMontos(nuevos)
    setElegidas(susDeducciones.map((d) => d.id))
  }

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await pagarNomina({
        trabajador_id: trabajadorId,
        fecha,
        metodo,
        pagos: suyos.map((c) => {
          const monto = num(montos[c.contrato_id] ?? '')
          return {
            contrato_id: c.contrato_id,
            monto,
            // El % del recibo representa sólo lo de este pago, no el acumulado.
            porcentaje: Number(c.total) > 0 ? redondear((monto / Number(c.total)) * 100) : null,
          }
        }),
        deducciones: elegidas,
        notas: notas.trim() || null,
      })

      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
      window.open(`/api/recibos-nomina/${r.datos!.reciboId}/pdf`, '_blank')
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo="Abono a mano de obra"
      descripcion="Un recibo puede cubrir varias obras del mismo trabajador."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Trabajador"
          hijo={
            <Seleccion value={trabajadorId} onChange={(e) => cambiarTrabajador(e.target.value)}>
              {prenomina.map((p) => (
                <option key={p.trabajador_id} value={p.trabajador_id}>
                  {p.trabajador}
                  {p.es_externo ? ' (externo)' : ''} · disponible {pesos(p.disponible)} · pendiente{' '}
                  {pesos(p.pendiente)}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<SelectorFecha valor={fecha} onCambio={setFecha} />}
        />
        <Campo
          etiqueta="Método"
          ancho="medio"
          hijo={
            <Seleccion value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {Object.entries(METODO_PAGO).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />

        <div className="sm:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-tinta-700">
              Abono por obra
              {suSaldo > 0 && (
                <span className="ml-2 font-normal text-tinta-500">
                  se le deben <strong className="text-tinta-700">{pesos(suSaldo)}</strong>
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={sugerir}
              className="text-xs font-medium text-haaco-700 hover:underline"
            >
              Sugerir según avance
            </button>
          </div>

          {suyos.length === 0 ? (
            <p className="rounded-lg bg-tinta-50 px-3 py-3 text-sm text-tinta-500">
              Este trabajador no tiene contratos activos.
            </p>
          ) : (
            <ul className="divide-y divide-tinta-100 overflow-hidden rounded-xl border border-tinta-200">
              {suyos.map((c) => {
                const monto = num(montos[c.contrato_id] ?? '')
                const excede = monto > Number(c.por_pagar)
                return (
                  <li key={c.contrato_id} className="px-3 py-2.5">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-tinta-900">{c.obra}</span>
                      <span className="text-xs text-tinta-500">
                        avance {Number(c.avance_pct)}% · devengado {pesos(c.devengado)} · pagado{' '}
                        {pesos(c.pagado)} · por pagar{' '}
                        <strong className="text-tinta-700">{pesos(c.por_pagar)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Numero
                        value={montos[c.contrato_id] ?? ''}
                        onChange={(e) =>
                          setMontos((m) => ({ ...m, [c.contrato_id]: e.target.value }))
                        }
                        placeholder="0.00"
                        className="max-w-36"
                      />
                      <span className="text-xs text-tinta-500">
                        de {pesos(c.total)} · disponible{' '}
                        <strong className="text-haaco-700">{pesos(c.disponible)}</strong>
                        {monto > 0 && !excede && (
                          <> · quedan {pesos(redondear(Number(c.por_pagar) - monto))}</>
                        )}
                      </span>
                      {monto > 0 && (
                        <Etiqueta tono={excede ? 'rojo' : 'gris'}>
                          {porcentaje(Number(c.total) > 0 ? (monto / Number(c.total)) * 100 : 0, 0)}
                        </Etiqueta>
                      )}
                    </div>
                    {excede && (
                      <p className="mt-1 text-xs text-red-600">
                        Rebasa lo que falta del contrato ({pesos(c.por_pagar)}).
                      </p>
                    )}
                    {monto > Number(c.disponible) && !excede && (
                      <p className="mt-1 text-xs text-amber-700">
                        Va por delante del avance reportado ({pesos(c.disponible)} devengado sin
                        pagar).
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {susDeducciones.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-tinta-700">Deducciones a aplicar</p>
            <ul className="space-y-1">
              {susDeducciones.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-tinta-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={elegidas.includes(d.id)}
                      onChange={() =>
                        setElegidas((l) =>
                          l.includes(d.id) ? l.filter((x) => x !== d.id) : [...l, d.id],
                        )
                      }
                      className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600"
                    />
                    <span className="flex-1 capitalize text-tinta-700">{d.tipo}</span>
                    {d.notas && <span className="text-xs text-tinta-400">{d.notas}</span>}
                    <span className="font-medium tabular-nums text-red-600">- {pesos(d.monto)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Campo
          etiqueta="Notas del recibo"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />

        <div className="rounded-xl bg-haaco-50 px-4 py-3 sm:col-span-2">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-600">Subtotal</dt>
              <dd className="tabular-nums text-tinta-900">{pesos(totales.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-600">Deducciones</dt>
              <dd className="tabular-nums text-red-600">
                {totales.descuento > 0 ? `- ${pesos(totales.descuento)}` : pesos(0)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-haaco-200 pt-1.5">
              <dt className="font-semibold text-tinta-900">Total a pagar</dt>
              <dd className="text-lg font-semibold tabular-nums text-haaco-700">
                {pesos(totales.total)}
              </dd>
            </div>
            {/* Se resta el subtotal, no el total: las deducciones bajan el
                efectivo que se entrega, no lo que se le debe del contrato. */}
            <div className="flex justify-between border-t border-haaco-200 pt-1.5">
              <dt className="text-tinta-600">Le quedará pendiente</dt>
              <dd className="font-medium tabular-nums text-tinta-900">
                {pesos(redondear(suSaldo - totales.subtotal))}
              </dd>
            </div>
          </dl>
          {totales.descuento > 0 && (
            <p className="mt-1.5 text-xs text-tinta-500">
              Las deducciones bajan el efectivo que se le entrega, no lo que se le debe del contrato.
            </p>
          )}
          {totales.total > 0 && (
            <p className="mt-1.5 text-xs uppercase text-tinta-500">{montoEnLetra(totales.total)}</p>
          )}
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
          disabled={pendiente || totales.subtotal <= 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Registrando…' : 'Pagar y generar recibo'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
function DialogoPrestamo({
  prenomina, onCerrar,
}: {
  prenomina: VPrenomina[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [trabajadorId, setTrabajadorId] = useState(prenomina[0]?.trabajador_id ?? '')
  const [tipo, setTipo] = useState<TipoDeduccion>('prestamo')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [notas, setNotas] = useState('')

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarDeduccion({
        trabajador_id: trabajadorId,
        tipo,
        monto: num(monto),
        fecha,
        notas: notas.trim() || null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Préstamo o adelanto"
      descripcion="Queda pendiente hasta que se aplique como deducción en un recibo de abono."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Trabajador"
          hijo={
            <Seleccion value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}>
              {prenomina.map((p) => (
                <option key={p.trabajador_id} value={p.trabajador_id}>
                  {p.trabajador}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Tipo"
          ancho="medio"
          hijo={
            <Seleccion value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeduccion)}>
              {Object.entries(TIPO_DEDUCCION).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Monto"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />}
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<SelectorFecha valor={fecha} onCambio={setFecha} />}
        />
        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
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
          disabled={pendiente || num(monto) <= 0 || !trabajadorId}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Registrar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
