'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { ChevronRight, Pencil } from 'lucide-react'
import {
  Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, PieFormulario,
} from '@/components/formulario'
import { fecha, pesos, pesosCortos } from '@/lib/format'
import { Anillo } from '@/components/movil/piezas'
import { guardarMetaVenta } from '@/app/admin/acciones'
import type { EstadoAccion } from '@/lib/acciones'

/**
 * Lo vendido en el mes contra la meta.
 *
 * «Vendido» es lo aprobado: la cotización que el cliente ya dijo que sí. Lo
 * cotizado a secas ya tiene su propio recuadro y no dice nada de si entró.
 *
 * La meta se edita aquí mismo con el lápiz —va a cambiar y no tiene por qué
 * pasar por el código—, y de ahí sale la frase de cuánto falta, que es lo que
 * Dirección quería ver de un vistazo.
 */
/** Un renglón de lo que suma «Vendido»: una cotización o una reparación. */
export type PartidaVendida = {
  clave: string
  tipo: 'cotizacion' | 'reparacion'
  folio: string | null
  cliente: string | null
  concepto: string | null
  /** El día en que el cliente aprobó: es el que manda en qué mes cae. */
  fechaVenta: string | null
  /** El día en que se hizo el papel, para ver las viejas aprobadas ahora. */
  fechaCotizacion: string | null
  estatus: string | null
  /** Con IVA, igual que en la cotización. */
  total: number
}

export function VentasDelMes({
  vendido,
  meta,
  etiqueta,
  mes,
  partidas,
}: {
  vendido: number
  meta: number
  /** El mes en palabras, para que la tarjeta diga de cuándo habla. */
  etiqueta: string
  /** `aaaa-mm`, para marcar las cotizaciones hechas en otro mes. */
  mes: string
  partidas: PartidaVendida[]
}) {
  const [editando, setEditando] = useState(false)
  const [desglose, setDesglose] = useState(false)
  const pct = meta > 0 ? Math.round((vendido / meta) * 100) : 0
  const falta = Math.max(0, meta - vendido)

  return (
    <section className="rounded-[22px] border-[0.5px] border-tinta-200 bg-white p-4.5 shadow-tarjeta lg:rounded-xl">
      <button
        type="button"
        onClick={() => setDesglose(true)}
        aria-label={`Ver qué suma lo vendido en ${etiqueta}`}
        className="-m-1.5 flex w-[calc(100%+0.75rem)] items-center gap-4 rounded-2xl p-1.5 text-left transition active:bg-tinta-50 lg:hover:bg-haaco-50/40"
      >
        <Anillo pct={pct} tamano={86} grosor={9} color="var(--color-haaco-700)">
          <span className="text-[19px] font-bold -tracking-[0.5px] text-tinta-900">{pct}%</span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.08em] text-tinta-400">
            de la meta
          </span>
        </Anillo>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.09em] text-tinta-500">
            Vendido en {etiqueta}
          </div>
          <div className="mt-0.5 text-3xl font-bold -tracking-[1px] tabular-nums text-haaco-800">
            {pesosCortos(vendido)}
          </div>
          <div className="mt-1 text-xs leading-snug text-tinta-500">
            {meta <= 0
              ? 'Pon tu meta del mes para ver cuánto falta'
              : falta > 0
                ? `Faltan ${pesosCortos(falta)} para los ${pesosCortos(meta)}`
                : `Meta de ${pesosCortos(meta)} cumplida`}
          </div>
          <div className="mt-1.5 text-xs font-semibold text-haaco-700">
            Ver qué suma · {partidas.length} {partidas.length === 1 ? 'venta' : 'ventas'}
          </div>
        </div>
        <ChevronRight size={18} className="ml-auto shrink-0 text-tinta-400" />
      </button>

      <button
        type="button"
        onClick={() => setEditando(true)}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[13px] bg-tinta-100 text-[15px] font-semibold text-tinta-700 transition active:bg-tinta-150 lg:min-h-9 lg:text-sm"
      >
        <Pencil size={15} />
        Cambiar la meta
      </button>

      {editando && <DialogoMeta meta={meta} onCerrar={() => setEditando(false)} />}
      {desglose && (
        <DialogoDesglose
          etiqueta={etiqueta}
          mes={mes}
          partidas={partidas}
          vendido={vendido}
          onCerrar={() => setDesglose(false)}
        />
      )}
    </section>
  )
}

function DialogoMeta({ meta, onCerrar }: { meta: number; onCerrar: () => void }) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(guardarMetaVenta, {})
  const atendido = useRef<EstadoAccion | null>(null)

  useEffect(() => {
    if (!estado.ok || atendido.current === estado) return
    atendido.current = estado
    onCerrar()
  }, [estado, onCerrar])

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Meta de venta del mes"
      descripcion="Lo mínimo que quieres vender al mes. Se compara contra lo aprobado."
    >
      <form action={accion} className="flex min-h-0 flex-1 flex-col">
        <CuerpoDialogo>
          <Campo
            etiqueta="Meta mensual"
            ancho="medio"
            hijo={<Numero name="meta" defaultValue={meta || ''} placeholder="530000" autoFocus />}
            ayuda={meta > 0 ? `Hoy está en ${pesos(meta)}` : undefined}
          />
          <MensajeError mensaje={estado.error} />
        </CuerpoDialogo>
        <PieFormulario onCerrar={onCerrar} />
      </form>
    </Dialogo>
  )
}

/**
 * Renglón por renglón lo que suma la tarjeta, para que el número se pueda
 * comprobar a mano. Las reglas van arriba porque es justo donde la cuenta
 * manual se desvía: se cuenta por fecha de aprobación (no de cotización), con
 * IVA, y entran también las reparaciones.
 */
function DialogoDesglose({
  etiqueta,
  mes,
  partidas,
  vendido,
  onCerrar,
}: {
  etiqueta: string
  mes: string
  partidas: PartidaVendida[]
  vendido: number
  onCerrar: () => void
}) {
  const cotizaciones = partidas.filter((p) => p.tipo === 'cotizacion')
  const reparaciones = partidas.filter((p) => p.tipo === 'reparacion')
  const sumar = (l: PartidaVendida[]) => l.reduce((s, p) => s + p.total, 0)
  const deOtroMes = cotizaciones.filter(
    (p) => p.fechaCotizacion && !p.fechaCotizacion.startsWith(mes),
  ).length

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Vendido en ${etiqueta}`}
      descripcion="Lo que suma la tarjeta, renglón por renglón."
      ancho="lg"
    >
      <div className="max-h-[65dvh] overflow-y-auto px-5 py-4">
        <ul className="space-y-1 rounded-xl bg-tinta-50 px-3.5 py-3 text-xs leading-relaxed text-tinta-600">
          <li>• Cuentan las cotizaciones <b>aprobadas</b> y <b>terminadas</b>.</li>
          <li>
            • Caen en el mes en que el cliente <b>aprobó</b>, no en el que se hizo la
            cotización.
          </li>
          <li>• Los montos van <b>con IVA</b> (el total de la cotización).</li>
          <li>• Se suman también las <b>reparaciones de portones</b> aprobadas en el mes.</li>
        </ul>

        {partidas.length === 0 ? (
          <p className="py-10 text-center text-sm text-tinta-500">
            Todavía no hay ventas aprobadas este mes.
          </p>
        ) : (
          <>
            <Grupo titulo="Cotizaciones" partidas={cotizaciones} mes={mes} />
            <Grupo titulo="Reparaciones" partidas={reparaciones} mes={mes} />

            <dl className="mt-4 space-y-1 border-t border-tinta-200 pt-3 text-sm">
              <div className="flex justify-between text-tinta-500">
                <dt>Cotizaciones ({cotizaciones.length})</dt>
                <dd className="tabular-nums">{pesos(sumar(cotizaciones))}</dd>
              </div>
              {reparaciones.length > 0 && (
                <div className="flex justify-between text-tinta-500">
                  <dt>Reparaciones ({reparaciones.length})</dt>
                  <dd className="tabular-nums">{pesos(sumar(reparaciones))}</dd>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-haaco-800">
                <dt>Total vendido</dt>
                <dd className="tabular-nums">{pesos(vendido)}</dd>
              </div>
            </dl>
            {deOtroMes > 0 && (
              <p className="mt-2 text-xs text-tinta-500">
                {deOtroMes === 1
                  ? '1 cotización se hizo en otro mes'
                  : `${deOtroMes} cotizaciones se hicieron en otro mes`}{' '}
                y se aprobó este; por eso no aparece en «Cotizado este mes».
              </p>
            )}
          </>
        )}
      </div>
    </Dialogo>
  )
}

function Grupo({
  titulo,
  partidas,
  mes,
}: {
  titulo: string
  partidas: PartidaVendida[]
  mes: string
}) {
  if (partidas.length === 0) return null
  return (
    <section className="mt-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-tinta-500">
        {titulo}
      </h3>
      <ul className="mt-1 divide-y divide-tinta-100">
        {partidas.map((p) => {
          const otroMes = p.fechaCotizacion && !p.fechaCotizacion.startsWith(mes)
          return (
            <li key={p.clave} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-tinta-900">
                  <span className="font-mono text-xs text-haaco-700">{p.folio ?? '—'}</span>{' '}
                  {p.cliente ?? '—'}
                </div>
                {p.concepto && (
                  <div className="truncate text-xs text-tinta-500">{p.concepto}</div>
                )}
                <div className="text-xs text-tinta-400">
                  Aprobada {fecha(p.fechaVenta)}
                  {otroMes && ` · cotizada ${fecha(p.fechaCotizacion)}`}
                  {p.estatus && ` · ${p.estatus}`}
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold tabular-nums text-tinta-900">
                {pesos(p.total)}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
