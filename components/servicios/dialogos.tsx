'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { CalendarPlus, CheckCircle2, ClipboardList, Undo2, Wrench, X } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, PieDialogo,
} from '@/components/formulario'
import { SelectorFecha } from '@/components/filtro-fechas'
import { hoyISO } from '@/lib/cotizaciones'
import { fecha as formatoFecha, pesos } from '@/lib/format'
import { proximoPreventivo } from '@/lib/servicios'
import {
  agendarPreventivo, cancelarServicio, guardarDiagnostico, marcarReparado, regresarServicio,
  resolverServicio,
} from '@/app/admin/servicios/acciones'
import type { EstatusServicio, VServicio } from '@/types/database'

/** El botón de la etapa: grande, porque es lo único que hay que hacer ahora. */
function BotonEtapa({
  onClick,
  children,
  tono = 'primario',
  disabled,
}: {
  onClick: () => void
  children: ReactNode
  tono?: 'primario' | 'secundario' | 'peligro'
  disabled?: boolean
}) {
  const tonos = {
    primario: 'bg-haaco-700 text-white hover:bg-haaco-800 disabled:bg-haaco-300',
    secundario:
      'border border-tinta-300 bg-white text-tinta-700 hover:border-haaco-300 hover:bg-haaco-50',
    peligro: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  } as const

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-5 text-[15px] font-semibold transition disabled:cursor-not-allowed lg:min-h-0 lg:rounded-lg lg:px-4 lg:py-2 lg:text-sm ${tonos[tono]}`}
    >
      {children}
    </button>
  )
}

/** Lo que encontró el técnico. Es lo que después justifica el precio. */
export function DialogoDiagnostico({
  servicio,
  etiqueta,
}: {
  servicio: VServicio
  etiqueta?: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState(servicio.diagnostico ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const salida = await guardarDiagnostico(servicio.servicio_id, texto)
      if (!salida.ok) {
        setError(salida.error)
        return
      }
      setAbierto(false)
      router.refresh()
    })

  return (
    <>
      <BotonEtapa
        onClick={() => setAbierto(true)}
        tono={servicio.diagnostico ? 'secundario' : 'primario'}
      >
        <ClipboardList size={16} />
        {etiqueta ?? (servicio.diagnostico ? 'Corregir diagnóstico' : 'Capturar diagnóstico')}
      </BotonEtapa>

      <Dialogo
        abierto={abierto}
        titulo="Diagnóstico"
        descripcion="Qué encontró el técnico. Va impreso en el presupuesto."
        onCerrar={() => setAbierto(false)}
      >
        <CuerpoDialogo>
          <Campo
            etiqueta="Qué tiene el portón"
            hijo={
              <AreaTexto
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={5}
                placeholder="El motor no abre; la tarjeta está quemada y la cadena viene floja."
                disabled={pendiente}
              />
            }
            ayuda="Escríbelo como se lo explicarías al cliente: es lo que va a leer."
          />
          <MensajeError mensaje={error} />
        </CuerpoDialogo>
        <PieDialogo>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            Cancelar
          </button>
          <BotonEtapa onClick={guardar} disabled={pendiente}>
            {pendiente ? 'Guardando…' : 'Guardar diagnóstico'}
          </BotonEtapa>
        </PieDialogo>
      </Dialogo>
    </>
  )
}

/** El sí o el no del cliente. Aquí nace la venta. */
export function AccionesResolucion({ servicio }: { servicio: VServicio }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState<'si' | 'no' | null>(null)
  const [fecha, setFecha] = useState(hoyISO())
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const resolver = (aprobado: boolean) =>
    iniciar(async () => {
      setError(null)
      const salida = await resolverServicio(servicio.servicio_id, aprobado, fecha)
      if (!salida.ok) {
        setError(salida.error)
        return
      }
      setAbierto(null)
      router.refresh()
    })

  return (
    <>
      <BotonEtapa onClick={() => setAbierto('si')}>
        <CheckCircle2 size={16} />
        El cliente aprobó
      </BotonEtapa>
      <BotonEtapa onClick={() => setAbierto('no')} tono="secundario">
        <X size={16} />
        Dijo que no
      </BotonEtapa>

      <Dialogo
        abierto={abierto !== null}
        titulo={abierto === 'no' ? 'El cliente no aceptó' : 'El cliente aprobó'}
        descripcion={
          abierto === 'no'
            ? Number(servicio.cuota_visita) > 0
              ? `Queda el registro, y la visita de ${pesos(servicio.cuota_visita)} sigue por cobrar.`
              : 'Queda el registro de que se presupuestó y no se cerró.'
            : 'Desde este día la reparación cuenta como vendida y entra al por cobrar.'
        }
        onCerrar={() => setAbierto(null)}
      >
        <CuerpoDialogo>
          <Campo
            etiqueta="¿Qué día contestó?"
            hijo={
              <span className="block">
                <SelectorFecha valor={fecha} onCambio={setFecha} disabled={pendiente} titulo="Día" />
              </span>
            }
            ayuda="Lo vendido se cuenta en el mes en que el cliente dijo que sí."
          />
          <MensajeError mensaje={error} />
        </CuerpoDialogo>
        <PieDialogo>
          <button
            type="button"
            onClick={() => setAbierto(null)}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            Cancelar
          </button>
          <BotonEtapa
            onClick={() => resolver(abierto === 'si')}
            tono={abierto === 'no' ? 'peligro' : 'primario'}
            disabled={pendiente}
          >
            {pendiente ? 'Guardando…' : abierto === 'no' ? 'Marcar rechazado' : 'Confirmar'}
          </BotonEtapa>
        </PieDialogo>
      </Dialogo>
    </>
  )
}

/** La reparación quedó. */
export function DialogoReparado({ servicio }: { servicio: VServicio }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(servicio.fecha_reparacion ?? hoyISO())
  const [notas, setNotas] = useState(servicio.notas ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const salida = await marcarReparado(servicio.servicio_id, fecha, notas)
      if (!salida.ok) {
        setError(salida.error)
        return
      }
      setAbierto(false)
      router.refresh()
    })

  return (
    <>
      <BotonEtapa onClick={() => setAbierto(true)}>
        <Wrench size={16} />
        Marcar reparado
      </BotonEtapa>

      <Dialogo
        abierto={abierto}
        titulo="La reparación quedó"
        descripcion="Después de esto, lo que falta es cobrar."
        onCerrar={() => setAbierto(false)}
      >
        <CuerpoDialogo>
          <Campo
            etiqueta="¿Qué día quedó?"
            hijo={
              <span className="block">
                <SelectorFecha valor={fecha} onCambio={setFecha} disabled={pendiente} titulo="Día" />
              </span>
            }
          />
          <Campo
            etiqueta="Notas del trabajo"
            hijo={
              <AreaTexto
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Qué se cambió, qué quedó pendiente, qué se le dijo al cliente…"
                disabled={pendiente}
              />
            }
          />
          <MensajeError mensaje={error} />
        </CuerpoDialogo>
        <PieDialogo>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            Cancelar
          </button>
          <BotonEtapa onClick={guardar} disabled={pendiente}>
            {pendiente ? 'Guardando…' : 'Marcar reparado'}
          </BotonEtapa>
        </PieDialogo>
      </Dialogo>
    </>
  )
}

/**
 * Deshacer el último paso y cancelar.
 *
 * Un botón grande que avanza el flujo se toca por error, y sin manera de
 * regresar el único camino sería borrar el servicio y capturarlo otra vez.
 */
export function AccionesSecundarias({ servicio }: { servicio: VServicio }) {
  const router = useRouter()
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const ANTERIOR: Partial<Record<EstatusServicio, { estatus: EstatusServicio; texto: string }>> = {
    diagnostico:   { estatus: 'agendado',      texto: 'Volver a agendado' },
    presupuestado: { estatus: 'diagnostico',   texto: 'Volver a diagnóstico' },
    aprobado:      { estatus: 'presupuestado', texto: 'Deshacer la aprobación' },
    rechazado:     { estatus: 'presupuestado', texto: 'Deshacer el rechazo' },
    reparado:      { estatus: 'aprobado',      texto: 'Deshacer la reparación' },
    cancelado:     { estatus: 'agendado',      texto: 'Reabrir el servicio' },
  }

  const atras = ANTERIOR[servicio.estatus]
  const cobrado = Number(servicio.cobrado) > 0

  const regresar = () =>
    iniciar(async () => {
      if (!atras) return
      setError(null)
      const salida = await regresarServicio(servicio.servicio_id, atras.estatus)
      if (!salida.ok) {
        setError(salida.error)
        return
      }
      router.refresh()
    })

  const cancelar = () =>
    iniciar(async () => {
      setError(null)
      const salida = await cancelarServicio(servicio.servicio_id, motivo || null)
      if (!salida.ok) {
        setError(salida.error)
        return
      }
      setCancelando(false)
      router.refresh()
    })

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {atras && (
          <button
            type="button"
            onClick={regresar}
            disabled={pendiente}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-tinta-500 transition hover:bg-tinta-100 hover:text-tinta-800 disabled:opacity-50"
          >
            <Undo2 size={15} />
            {atras.texto}
          </button>
        )}
        {/* Cancelar sólo mientras no haya dinero de por medio: un servicio
            cobrado se corrige quitando el cobro, no escondiéndolo. */}
        {servicio.estatus !== 'cancelado' && servicio.estatus !== 'reparado' && !cobrado && (
          <button
            type="button"
            onClick={() => setCancelando(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            <X size={15} />
            Cancelar el servicio
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Dialogo
        abierto={cancelando}
        titulo="Cancelar el servicio"
        descripcion="No se borra: queda el registro de que se agendó y no se hizo."
        onCerrar={() => setCancelando(false)}
      >
        <CuerpoDialogo>
          <Campo
            etiqueta="¿Por qué no se hizo?"
            hijo={
              <AreaTexto
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="No estaba nadie, el cliente ya lo arregló, no contestó…"
                disabled={pendiente}
              />
            }
          />
        </CuerpoDialogo>
        <PieDialogo>
          <button
            type="button"
            onClick={() => setCancelando(false)}
            className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
          >
            No, conservar
          </button>
          <BotonEtapa onClick={cancelar} tono="peligro" disabled={pendiente}>
            {pendiente ? 'Cancelando…' : 'Sí, cancelar'}
          </BotonEtapa>
        </PieDialogo>
      </Dialogo>
    </>
  )
}

/**
 * Ofrecer el preventivo que sigue.
 *
 * Nadie llama para pedir un mantenimiento: se ofrece, y el único momento en
 * que alguien se acuerda es cuando acaba de quedar el trabajo. Por eso el
 * botón vive aquí y trae la fecha ya calculada.
 */
export function BotonPreventivo({
  servicio,
  yaAgendado,
}: {
  servicio: VServicio
  /** El folio del preventivo que ya salió de este servicio, si lo hay. */
  yaAgendado: string | null
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cuando = proximoPreventivo(servicio.fecha_reparacion ?? servicio.fecha_visita)

  if (yaAgendado) {
    return (
      <p className="text-sm text-tinta-500">
        El preventivo de este portón ya está agendado: {yaAgendado}.
      </p>
    )
  }

  const agendar = () =>
    iniciar(async () => {
      setError(null)
      const salida = await agendarPreventivo(servicio.servicio_id)
      if (!salida.ok) {
        setError(salida.error)
        return
      }
      router.push(`/admin/servicios/${salida.datos!.id}`)
      router.refresh()
    })

  return (
    <>
      <BotonEtapa onClick={agendar} tono="secundario" disabled={pendiente}>
        <CalendarPlus size={16} />
        {pendiente
          ? 'Agendando…'
          : `Agendar el preventivo (${formatoFecha(cuando)})`}
      </BotonEtapa>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </>
  )
}
