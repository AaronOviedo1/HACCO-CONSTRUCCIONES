'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { SelectorFecha } from '@/components/filtro-fechas'
import { pesos } from '@/lib/format'
import { num, redondear } from '@/lib/cotizaciones'
import { METODO_PAGO_SIN_CAJA, etiquetaSemana } from '@/lib/finanzas'
import { cancelarReciboNomina, editarReciboNomina } from '@/app/admin/finanzas-acciones'
import type {
  MetodoPago, NominaPago, ReciboNomina, VNominaContrato, VRayaSemanal,
} from '@/types/database'

/**
 * Corregir o cancelar un recibo de abono ya emitido.
 *
 * Es el único documento del sistema que se entrega en mano y se firma, así que
 * la pantalla lo dice antes de dejar tocar nada: el papel que ya salió va a
 * decir otra cosa que el sistema, y hay que reponerlo.
 *
 * Corregir mantiene el folio —es el mismo recibo por otro importe—. Cancelar
 * lo deja sin efecto pero no lo borra: el folio se queda en la lista marcado,
 * porque un folio que desaparece es peor que uno que dice por qué se canceló.
 */
export function BotonEditarRecibo({
  recibo, pagos, contratos, rayas, trabajador,
}: {
  recibo: ReciboNomina
  /** Los renglones de este recibo: cada uno abona a una obra o a una semana. */
  pagos: NominaPago[]
  /** Para poner el nombre de la obra de cada renglón de destajo. */
  contratos: VNominaContrato[]
  /** Para poner las fechas de cada renglón de raya semanal. */
  rayas: VRayaSemanal[]
  trabajador: string
}) {
  const [abierto, setAbierto] = useState(false)

  if (recibo.cancelado_en) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-tinta-300 bg-white px-2 py-1 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
        aria-label={`Corregir el recibo ${recibo.folio ?? ''}`}
      >
        <Pencil size={13} />
      </button>

      {abierto && (
        <FormularioRecibo
          recibo={recibo}
          pagos={pagos}
          contratos={contratos}
          rayas={rayas}
          trabajador={trabajador}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function FormularioRecibo({
  recibo, pagos, contratos, rayas, trabajador, onCerrar,
}: {
  recibo: ReciboNomina
  pagos: NominaPago[]
  contratos: VNominaContrato[]
  rayas: VRayaSemanal[]
  trabajador: string
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [fecha, setFecha] = useState(recibo.fecha)
  const [metodo, setMetodo] = useState<MetodoPago>(recibo.metodo)
  const [notas, setNotas] = useState(recibo.notas ?? '')
  const [montos, setMontos] = useState<Record<string, string>>(
    Object.fromEntries(pagos.map((p) => [p.id, String(Number(p.monto))])),
  )

  /*
   * Un renglón abona a una obra o a la raya de una semana. La raya se nombra
   * por sus fechas: «Raya del 7 al 12 de septiembre» le dice más a quien firma
   * que el nombre de la obra a la que se repartió, que es cuenta aparte.
   */
  const conceptoDe = (p: NominaPago) => {
    if (p.raya_id) {
      const r = rayas.find((x) => x.raya_id === p.raya_id)
      return r ? `Raya ${etiquetaSemana(r.semana)}` : 'Raya de la semana'
    }
    return contratos.find((c) => c.contrato_id === p.contrato_id)?.obra ?? 'Obra sin nombre'
  }

  const totalDe = (p: NominaPago) =>
    p.raya_id
      ? Number(rayas.find((x) => x.raya_id === p.raya_id)?.total ?? 0)
      : Number(contratos.find((c) => c.contrato_id === p.contrato_id)?.total ?? 0)

  const subtotal = redondear(pagos.reduce((s, p) => s + num(montos[p.id] ?? ''), 0))
  const total = redondear(subtotal - Number(recibo.deducciones))
  const cubreDeducciones = subtotal >= Number(recibo.deducciones)

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await editarReciboNomina({
        recibo_id: recibo.id,
        fecha,
        metodo,
        pagos: pagos.map((p) => {
          const monto = num(montos[p.id] ?? '')
          const base = totalDe(p)
          return {
            contrato_id: p.contrato_id,
            raya_id: p.raya_id,
            monto,
            porcentaje: base > 0 ? redondear((monto / base) * 100) : null,
          }
        }),
        notas: notas.trim() || null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const cancelar = () =>
    iniciar(async () => {
      setError(null)
      const motivo = prompt(
        `Se va a cancelar el recibo ${recibo.folio ?? ''} de ${trabajador}.\n\n` +
          'Sus abonos se borran, el saldo de los contratos vuelve y los préstamos que ' +
          'descontaba quedan otra vez pendientes.\n\n¿Por qué se cancela?',
      )
      if (motivo === null) return

      const r = await cancelarReciboNomina(recibo.id, motivo.trim() || null)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Recibo ${recibo.folio ?? ''}`}
      descripcion={`${trabajador} · el folio no cambia, sólo lo que dice.`}
    >
      <CuerpoDialogo>
        <p className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200 sm:col-span-2">
          Este recibo ya se entregó firmado. Si lo corriges, el papel que tiene el trabajador va a
          decir otro importe: hay que reimprimirlo y reponerlo.
        </p>

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
              {Object.entries(METODO_PAGO_SIN_CAJA).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-tinta-700">Abono por obra</p>
          <ul className="divide-y divide-tinta-100 overflow-hidden rounded-xl border border-tinta-200">
            {pagos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm text-tinta-900">
                  {conceptoDe(p)}
                </span>
                <Numero
                  value={montos[p.id] ?? ''}
                  onChange={(e) => setMontos((m) => ({ ...m, [p.id]: e.target.value }))}
                  className="max-w-32"
                  aria-label={`Importe abonado a ${conceptoDe(p)}`}
                />
                <span className="text-xs text-tinta-400">era {pesos(p.monto)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-tinta-400">
            Poner un renglón en cero lo quita del recibo. Para agregar una obra que no está aquí,
            cancela el recibo y captúralo de nuevo.
          </p>
        </div>

        <Campo
          etiqueta="Notas del recibo"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />

        <div className="rounded-xl bg-haaco-50 px-4 py-3 sm:col-span-2">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-600">Subtotal</dt>
              <dd className="tabular-nums text-tinta-900">{pesos(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-600">Deducciones aplicadas</dt>
              <dd className="tabular-nums text-red-600">
                {Number(recibo.deducciones) > 0 ? `- ${pesos(recibo.deducciones)}` : pesos(0)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-haaco-200 pt-1.5">
              <dt className="font-semibold text-tinta-900">Total a pagar</dt>
              <dd className="text-lg font-semibold tabular-nums text-haaco-700">
                {cubreDeducciones ? pesos(total) : '—'}
              </dd>
            </div>
          </dl>
          {!cubreDeducciones && (
            <p className="mt-1.5 text-xs text-red-600">
              Los préstamos que descuenta este recibo ({pesos(recibo.deducciones)}) ya no caben en
              el importe corregido. Cancélalo y captúralo de nuevo.
            </p>
          )}
        </div>

        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        <button
          type="button"
          onClick={cancelar}
          disabled={pendiente}
          className="mr-auto rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          Cancelar el recibo
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || subtotal <= 0 || !cubreDeducciones}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar la corrección'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
