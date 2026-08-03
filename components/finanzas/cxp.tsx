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
  abonarCuentaPorPagar, eliminarCuentaPorPagar, guardarCuentaPorPagar,
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
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} />}
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
