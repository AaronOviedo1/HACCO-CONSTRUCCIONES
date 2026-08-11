'use client'

import { SelectorFecha } from '@/components/filtro-fechas'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Banknote, Pencil, Plus } from 'lucide-react'
import {
  AreaTexto, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo,
  Seleccion,
} from '@/components/formulario'
import { fecha, pesos } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import {
  abonarCuentaPorPagar, abonarLoteCuentasPorPagar, eliminarCuentaPorPagar, guardarCuentaPorPagar,
} from '@/app/admin/finanzas-acciones'
import type { Proveedor, VCuentaPorPagar } from '@/types/database'

export function BotonNuevaCxp({ proveedores }: { proveedores: Proveedor[] }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
      >
        <Plus size={16} />
        Nueva factura
      </button>
      {abierto && <FormularioCxp proveedores={proveedores} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

export function AccionesCxp({
  cuenta,
  proveedores,
}: {
  cuenta: VCuentaPorPagar
  proveedores: Proveedor[]
}) {
  const [abonando, setAbonando] = useState(false)
  const [editando, setEditando] = useState(false)
  const puedeAbonar = !cuenta.cancelada && Number(cuenta.saldo) > 0

  return (
    <div className="flex items-center justify-end gap-1">
      {puedeAbonar && (
        <button
          type="button"
          onClick={() => setAbonando(true)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-haaco-300 bg-haaco-50 px-2.5 py-1.5 text-xs font-semibold text-haaco-800 transition hover:bg-haaco-100"
        >
          <Banknote size={14} />
          Registrar pago
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="rounded-lg p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
        aria-label="Editar factura"
      >
        <Pencil size={14} />
      </button>

      {abonando && <DialogoAbono cuenta={cuenta} onCerrar={() => setAbonando(false)} />}
      {editando && (
        <FormularioCxp cuenta={cuenta} proveedores={proveedores} onCerrar={() => setEditando(false)} />
      )}
    </div>
  )
}

/** Botón de pago para el renglón del teléfono: abre el mismo diálogo. */
export function BotonPagoMovil({ cuenta }: { cuenta: VCuentaPorPagar }) {
  const [abonando, setAbonando] = useState(false)
  if (cuenta.cancelada || Number(cuenta.saldo) <= 0) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setAbonando(true)}
        data-tap
        className="flex h-11 w-11 items-center justify-center rounded-[14px] border-[0.5px] border-haaco-300 bg-haaco-50 text-haaco-700 transition active:bg-haaco-100"
        aria-label={`Registrar pago a ${cuenta.proveedor}`}
      >
        <Banknote size={18} />
      </button>
      {abonando && <DialogoAbono cuenta={cuenta} onCerrar={() => setAbonando(false)} />}
    </>
  )
}

/**
 * Liquidar de un jalón todo lo que se le debe al proveedor filtrado.
 *
 * Es el sustituto de las casillas de escritorio: en 390 px una columna de
 * checkboxes se come el renglón y pelea con el toque para pagar una sola.
 */
export function BotonPagarProveedor({ cuentas }: { cuentas: VCuentaPorPagar[] }) {
  const [abierto, setAbierto] = useState(false)
  if (cuentas.length === 0) return null

  const total = cuentas.reduce((s, c) => s + Number(c.saldo), 0)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        data-tap
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-4 text-[15px] font-semibold text-white transition active:bg-haaco-800"
      >
        <Banknote size={18} />
        Pagar las {cuentas.length} · {pesos(total)}
      </button>
      {abierto && <DialogoPagoLote cuentas={cuentas} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

/** Filtro por proveedor que sí existe en el teléfono (las tarjetas laterales no). */
export function FiltroProveedorCxp({
  proveedores, valor, vista,
}: {
  proveedores: Pick<Proveedor, 'id' | 'nombre'>[]
  valor: string
  vista: string
}) {
  const router = useRouter()
  return (
    <Seleccion
      value={valor}
      onChange={(e) =>
        router.replace(
          `/admin/cuentas-por-pagar?t=${vista}${e.target.value ? `&proveedor=${e.target.value}` : ''}`,
        )
      }
      aria-label="Filtrar por proveedor"
    >
      <option value="">Todos los proveedores</option>
      {proveedores.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </Seleccion>
  )
}

// ---------------------------------------------------------------------------
function DialogoAbono({ cuenta, onCerrar }: { cuenta: VCuentaPorPagar; onCerrar: () => void }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [monto, setMonto] = useState(String(Number(cuenta.saldo)))
  const [fechaPago, setFechaPago] = useState(hoyISO())

  const saldoDespues = redondear(Number(cuenta.saldo) - num(monto))

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await abonarCuentaPorPagar(cuenta.id, num(monto), fechaPago)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Pago a ${cuenta.proveedor}`}
      descripcion={`Factura ${cuenta.folio_factura} · vence ${fecha(cuenta.vencimiento)}`}
    >
      <CuerpoDialogo>
        <dl className="grid grid-cols-3 gap-3 rounded-xl bg-tinta-50 px-4 py-3 text-sm sm:col-span-2">
          <div>
            <dt className="text-xs text-tinta-500">Importe</dt>
            <dd className="tabular-nums text-tinta-900">{pesos(cuenta.monto)}</dd>
          </div>
          <div>
            <dt className="text-xs text-tinta-500">Ya pagado</dt>
            <dd className="tabular-nums text-tinta-900">{pesos(cuenta.monto_pagado)}</dd>
          </div>
          <div>
            <dt className="text-xs text-tinta-500">Saldo</dt>
            <dd className="font-semibold tabular-nums text-haaco-700">{pesos(cuenta.saldo)}</dd>
          </div>
        </dl>

        <Campo
          etiqueta="Monto del pago"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />}
          ayuda="Puede ser parcial."
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<SelectorFecha valor={fechaPago} onCambio={setFechaPago} />}
        />

        {num(monto) > 0 && (
          <p className="rounded-lg bg-tinta-50 px-3 py-2 text-sm text-tinta-700 sm:col-span-2">
            {saldoDespues <= 0 ? (
              <>
                Con este pago la factura queda <strong className="text-haaco-700">liquidada</strong>.
              </>
            ) : (
              <>
                Queda un saldo de <strong className="text-amber-700">{pesos(saldoDespues)}</strong>.
              </>
            )}
          </p>
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
          onClick={guardar}
          disabled={pendiente || num(monto) <= 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Registrando…' : 'Registrar pago'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

/**
 * Pagar de una sola vez todas las facturas seleccionadas de un proveedor.
 *
 * Cada renglón trae su monto editable prellenado con el saldo: casi siempre se
 * liquida todo, pero a veces se abona a medias en una y completo en las demás.
 * O entran todas o no entra ninguna.
 */
export function DialogoPagoLote({
  cuentas,
  onCerrar,
}: {
  cuentas: VCuentaPorPagar[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fechaPago, setFechaPago] = useState(hoyISO())
  const [montos, setMontos] = useState<Record<string, string>>(() =>
    Object.fromEntries(cuentas.map((c) => [c.id, String(Number(c.saldo))])),
  )

  const proveedor = cuentas[0]?.proveedor ?? 'Proveedor'
  const total = redondear(cuentas.reduce((s, c) => s + num(montos[c.id] ?? ''), 0))
  const saldoTotal = redondear(cuentas.reduce((s, c) => s + Number(c.saldo), 0))
  const excedidas = cuentas.filter((c) => num(montos[c.id] ?? '') > Number(c.saldo))
  const liquidan = cuentas.filter(
    (c) => num(montos[c.id] ?? '') > 0 && num(montos[c.id] ?? '') >= Number(c.saldo),
  ).length

  const pagar = () =>
    iniciar(async () => {
      setError(null)
      const r = await abonarLoteCuentasPorPagar(
        cuentas
          .map((c) => ({ id: c.id, monto: num(montos[c.id] ?? '') }))
          .filter((p) => p.monto > 0),
        fechaPago,
      )
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo={`Pago a ${proveedor}`}
      descripcion={`${cuentas.length} facturas · saldo total ${pesos(saldoTotal)}`}
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Fecha del pago"
          ancho="medio"
          hijo={<SelectorFecha valor={fechaPago} onCambio={setFechaPago} />}
        />

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-tinta-700">Facturas</p>
          <ul className="divide-y divide-tinta-100 overflow-hidden rounded-xl border border-tinta-200">
            {cuentas.map((c) => {
              const monto = num(montos[c.id] ?? '')
              const excede = monto > Number(c.saldo)
              return (
                <li key={c.id} className="px-3 py-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs text-tinta-900">{c.folio_factura}</span>
                    <span className="text-xs text-tinta-500">
                      vence {fecha(c.vencimiento)} · saldo {pesos(c.saldo)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Numero
                      value={montos[c.id] ?? ''}
                      onChange={(e) => setMontos((m) => ({ ...m, [c.id]: e.target.value }))}
                      placeholder="0.00"
                      className="max-w-36"
                    />
                    {monto > 0 && !excede && (
                      <span className="text-xs text-tinta-500">
                        {monto >= Number(c.saldo) ? (
                          <strong className="text-haaco-700">queda liquidada</strong>
                        ) : (
                          <>quedarían {pesos(redondear(Number(c.saldo) - monto))}</>
                        )}
                      </span>
                    )}
                  </div>
                  {excede && (
                    <p className="mt-1 text-xs text-red-600">
                      Rebasa el saldo de la factura ({pesos(c.saldo)}).
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="rounded-xl bg-haaco-50 px-4 py-3 sm:col-span-2">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-600">Facturas que se liquidan</dt>
              <dd className="tabular-nums text-tinta-900">
                {liquidan} de {cuentas.length}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-600">Queda pendiente con {proveedor}</dt>
              <dd className="tabular-nums text-tinta-900">{pesos(redondear(saldoTotal - total))}</dd>
            </div>
            <div className="flex justify-between border-t border-haaco-200 pt-1.5">
              <dt className="font-semibold text-tinta-900">Total a pagar</dt>
              <dd className="text-lg font-semibold tabular-nums text-haaco-700">{pesos(total)}</dd>
            </div>
          </dl>
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
          onClick={pagar}
          disabled={pendiente || total <= 0 || excedidas.length > 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Registrando…' : `Pagar ${pesos(total)}`}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
function FormularioCxp({
  cuenta, proveedores, onCerrar,
}: {
  cuenta?: VCuentaPorPagar
  proveedores: Proveedor[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [proveedorId, setProveedorId] = useState(cuenta?.proveedor_id ?? '')
  const [folio, setFolio] = useState(cuenta?.folio_factura ?? '')
  const [monto, setMonto] = useState(String(cuenta?.monto ?? ''))
  const [fechaFactura, setFechaFactura] = useState(cuenta?.fecha_factura ?? hoyISO())
  const [dias, setDias] = useState(String(cuenta?.dias_credito ?? ''))
  const [cancelada, setCancelada] = useState(cuenta?.cancelada ?? false)
  const [notas, setNotas] = useState(cuenta?.notas ?? '')

  const proveedor = proveedores.find((p) => p.id === proveedorId)
  // El importe de una factura armada con gastos sale de la suma de sus
  // conceptos: se recalcula cada vez que uno se corrige o se borra, así que
  // teclearlo aquí duraría hasta la siguiente corrección y sin avisar.
  const importeDeGastos = Boolean(cuenta?.automatica && cuenta.gastos > 0)

  const elegirProveedor = (id: string) => {
    setProveedorId(id)
    // Al elegir proveedor se traen sus días de crédito, salvo que ya se hayan tocado.
    if (!cuenta) {
      const p = proveedores.find((x) => x.id === id)
      if (p) setDias(String(p.dias_credito_default))
    }
  }

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarCuentaPorPagar({
        id: cuenta?.id,
        proveedor_id: proveedorId,
        folio_factura: folio,
        monto: num(monto),
        fecha_factura: fechaFactura,
        dias_credito: num(dias),
        cancelada,
        notas: notas.trim() || null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const borrar = () =>
    iniciar(async () => {
      if (!cuenta) return
      if (!confirm(`¿Eliminar la factura ${cuenta.folio_factura}?`)) return
      const r = await eliminarCuentaPorPagar(cuenta.id)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={cuenta ? 'Editar factura' : 'Nueva cuenta por pagar'}
      descripcion="El vencimiento sale de la fecha de factura más los días de crédito."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Proveedor"
          hijo={
            <Seleccion value={proveedorId} onChange={(e) => elegirProveedor(e.target.value)}>
              <option value="">Elegir proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.dias_credito_default} días
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Folio de factura"
          ancho="medio"
          hijo={<Entrada value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="9182" />}
        />
        <Campo
          etiqueta="Importe"
          ancho="medio"
          hijo={
            <Numero
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              readOnly={importeDeGastos}
              className={importeDeGastos ? 'bg-tinta-50 text-tinta-500' : ''}
            />
          }
          ayuda={
            importeDeGastos
              ? `Sale de los ${cuenta?.gastos} conceptos capturados de esta factura; corrígelos en Gastos.`
              : undefined
          }
        />
        <Campo
          etiqueta="Fecha de factura"
          ancho="medio"
          hijo={
            <SelectorFecha valor={fechaFactura} onCambio={setFechaFactura} />
          }
        />
        <Campo
          etiqueta="Días de crédito"
          ancho="medio"
          hijo={<Numero value={dias} onChange={(e) => setDias(e.target.value)} />}
          ayuda={proveedor ? `${proveedor.nombre} usa ${proveedor.dias_credito_default} días` : undefined}
        />
        <Casilla
          etiqueta="Factura cancelada"
          checked={cancelada}
          onChange={(e) => setCancelada(e.target.checked)}
        />
        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        {cuenta && (
          <button
            type="button"
            onClick={borrar}
            className="mr-auto rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            Eliminar
          </button>
        )}
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
          disabled={pendiente || !proveedorId || !folio.trim()}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
