'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Unlock } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, PieDialogo,
} from '@/components/formulario'
import { fecha } from '@/lib/format'
import { reabrirObra } from '@/app/admin/obras/acciones'

/**
 * Volver a abrir una OT cerrada.
 *
 * Vive en dos lugares —el encabezado y el panel de cierre— porque son los dos
 * sitios donde uno se da cuenta de que la cerró de más: al abrir la obra y ver
 * que no se puede tocar nada, y al bajar a la pestaña de cierre buscando cómo
 * deshacerlo.
 *
 * Pide el motivo en vez de un `confirm()`: queda en la bitácora, que es el
 * único rastro de por qué una obra entregada volvió a estar viva.
 */
export function BotonReabrir({
  obraId,
  otNumero,
  cotizacionFolio,
  cerradaEl,
  variante,
}: {
  obraId: string
  otNumero: string | null
  cotizacionFolio: string | null
  cerradaEl: string | null
  variante: 'encabezado' | 'panel'
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={
          variante === 'encabezado'
            ? 'inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-[0.5px] border-tinta-300 bg-white px-3 text-[15.5px] font-semibold text-tinta-700 transition hover:bg-tinta-50 lg:min-h-0 lg:flex-none lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium'
            : 'inline-flex items-center gap-2 rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50'
        }
      >
        <Unlock size={15} />
        Reabrir OT
      </button>

      {abierto && (
        <DialogoReabrir
          obraId={obraId}
          otNumero={otNumero}
          cotizacionFolio={cotizacionFolio}
          cerradaEl={cerradaEl}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function DialogoReabrir({
  obraId, otNumero, cotizacionFolio, cerradaEl, onCerrar,
}: {
  obraId: string
  otNumero: string | null
  cotizacionFolio: string | null
  cerradaEl: string | null
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  const reabrir = () =>
    iniciar(async () => {
      setError(null)
      const r = await reabrirObra(obraId, motivo)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Reabrir la OT ${otNumero ?? ''}`.trim()}
      descripcion={
        cerradaEl
          ? `Se cerró el ${fecha(cerradaEl)}. Vuelve a quedar en obra y se puede capturar avance otra vez.`
          : 'Vuelve a quedar en obra y se puede capturar avance otra vez.'
      }
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="¿Por qué se reabre?"
          hijo={
            <AreaTexto
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Trabajo adicional en la fachada; se cerró antes de capturar el último avance…"
              autoFocus
            />
          }
          ayuda="Queda en la bitácora de la obra."
        />

        <div className="rounded-xl bg-tinta-50 px-4 py-3 text-sm text-tinta-600 sm:col-span-2">
          <p className="mb-1.5 font-medium text-tinta-900">Al reabrir:</p>
          <ul className="space-y-1 text-[13px]">
            <li>· La OT vuelve a <strong>En obra</strong> y se puede editar todo otra vez.</li>
            <li>
              · Los contratos de mano de obra que cerró este cierre vuelven a estar activos y
              reaparecen en Nómina con lo que se les deba.
            </li>
            {cotizacionFolio && (
              <li>
                · La cotización <span className="font-mono text-xs">{cotizacionFolio}</span> regresa
                de terminada a <strong>aprobada</strong>.
              </li>
            )}
            <li className="text-amber-700">
              · Los pagarés cancelados <strong>no</strong> se reactivan: la herramienta ya regresó
              al taller. Si vuelve a salir, hay que emitir un pagaré nuevo.
            </li>
          </ul>
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
          onClick={reabrir}
          disabled={pendiente || !motivo.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          <Unlock size={15} />
          {pendiente ? 'Reabriendo…' : 'Reabrir OT'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
