'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react'
import {
  Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { FiltroRango, SelectorFecha } from '@/components/filtro-fechas'
import { hoyISO, num } from '@/lib/cotizaciones'
import { eliminarMovimientoCaja, guardarMovimientoCaja } from '@/app/admin/finanzas-acciones'
import type { TipoMovimientoCaja } from '@/types/database'

export function BarraCajaChica({
  obras,
}: {
  obras: { id: string; nombre: string; ot_numero: string | null }[]
}) {
  const [tipo, setTipo] = useState<TipoMovimientoCaja | null>(null)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FiltroRango titulo="Periodo de los movimientos" />

        <button
          type="button"
          onClick={() => setTipo('entrada')}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          <ArrowDownToLine size={16} className="text-haaco-600" />
          Entrada
        </button>
        <button
          type="button"
          onClick={() => setTipo('salida')}
          className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
        >
          <ArrowUpFromLine size={16} />
          Salida
        </button>
      </div>

      {tipo && <FormularioMovimiento tipo={tipo} obras={obras} onCerrar={() => setTipo(null)} />}
    </>
  )
}

export function BotonEliminarMovimiento({ id, concepto }: { id: string; concepto: string }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()

  return (
    <button
      type="button"
      onClick={() =>
        iniciar(async () => {
          if (!confirm(`¿Eliminar «${concepto}»?`)) return
          await eliminarMovimientoCaja(id)
          router.refresh()
        })
      }
      disabled={pendiente}
      className="rounded p-1 text-tinta-400 transition hover:bg-red-50 hover:text-red-600"
      aria-label="Eliminar movimiento"
    >
      <Trash2 size={14} />
    </button>
  )
}

function FormularioMovimiento({
  tipo, obras, onCerrar,
}: {
  tipo: TipoMovimientoCaja
  obras: { id: string; nombre: string; ot_numero: string | null }[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [obraId, setObraId] = useState('')

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarMovimientoCaja({
        tipo,
        concepto,
        monto: num(monto),
        fecha,
        obra_id: obraId || null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={tipo === 'entrada' ? 'Entrada a caja chica' : 'Salida de caja chica'}
      descripcion={
        tipo === 'entrada'
          ? 'Reposición del fondo o devolución de efectivo.'
          : 'Gasto pagado en efectivo desde la caja.'
      }
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Concepto"
          hijo={
            <Entrada
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={tipo === 'entrada' ? 'Reposición de fondo' : 'Garrafones'}
              autoFocus
            />
          }
        />
        <Campo
          etiqueta="Monto"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} />}
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<SelectorFecha valor={fecha} onCambio={setFecha} />}
        />
        {tipo === 'salida' && obras.length > 0 && (
          <Campo
            etiqueta="Obra (opcional)"
            hijo={
              <Seleccion value={obraId} onChange={(e) => setObraId(e.target.value)}>
                <option value="">Sin obra</option>
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.ot_numero} · {o.nombre}
                  </option>
                ))}
              </Seleccion>
            }
            ayuda="Sólo es referencia; para que afecte el concentrado captúralo en Gastos."
          />
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
          disabled={pendiente || !concepto.trim() || num(monto) <= 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Registrar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
