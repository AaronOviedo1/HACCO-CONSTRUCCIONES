import { Check } from 'lucide-react'
import { PASOS_SERVICIO, pasoActual } from '@/lib/servicios'
import type { EstatusServicio } from '@/types/database'

/**
 * El avance de la reparación, de la cita al cobro.
 *
 * Es la pregunta que se hace al abrir la pantalla —«¿en qué va esto?»— y la
 * respuesta tiene que caber en una mirada, sin leer renglones. Los servicios
 * rechazados y cancelados no tienen barra: se salieron del camino, y pintar
 * cinco pasos apagados diría que siguen en curso.
 */
export function AvanceServicio({
  estatus,
  cerrado = false,
}: {
  estatus: EstatusServicio
  /** Reparado y sin deber nada: el último paso también se palomea. */
  cerrado?: boolean
}) {
  if (estatus === 'rechazado' || estatus === 'cancelado') {
    return (
      <p className="rounded-[16px] bg-tinta-100 px-4 py-3 text-sm text-tinta-600">
        {estatus === 'rechazado'
          ? 'El cliente no aceptó el presupuesto. Queda el registro de que se atendió.'
          : 'La visita no se hizo. Queda el registro de que se agendó.'}
      </p>
    )
  }

  // Con todo hecho y pagado no hay «paso actual»: se palomea la fila entera.
  // Dejar el último con anillo hacía ver como pendiente algo que ya cerró.
  const actual = cerrado ? PASOS_SERVICIO.length : pasoActual(estatus)

  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1">
      {PASOS_SERVICIO.map((paso, i) => {
        const hecho = i < actual
        const aqui = i === actual

        return (
          <li key={paso.estatus} className="flex min-w-0 flex-1 items-center gap-1">
            <span className="flex min-w-0 flex-col items-center gap-1">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  hecho
                    ? 'bg-haaco-600 text-white'
                    : aqui
                      ? 'bg-haaco-100 text-haaco-800 ring-2 ring-haaco-500'
                      : 'bg-tinta-150 text-tinta-400'
                }`}
              >
                {hecho ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[11px] ${
                  aqui ? 'font-semibold text-tinta-900' : 'text-tinta-500'
                }`}
              >
                {paso.texto}
              </span>
            </span>
            {i < PASOS_SERVICIO.length - 1 && (
              <span
                className={`mb-4 h-[2px] flex-1 rounded-full ${hecho ? 'bg-haaco-500' : 'bg-tinta-150'}`}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Un dato de la ficha: la etiqueta chiquita arriba y el valor abajo. */
export function DatoFicha({
  etiqueta,
  children,
  tono,
}: {
  etiqueta: string
  children: React.ReactNode
  tono?: 'verde' | 'ambar'
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.06em] text-tinta-400">{etiqueta}</dt>
      <dd
        className={`mt-0.5 text-sm ${
          tono === 'verde'
            ? 'font-semibold text-haaco-700'
            : tono === 'ambar'
              ? 'font-semibold text-amber-700'
              : 'text-tinta-800'
        }`}
      >
        {children}
      </dd>
    </div>
  )
}
