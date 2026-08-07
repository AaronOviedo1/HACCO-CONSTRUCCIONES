'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, PieFormulario,
} from '@/components/formulario'
import { Anillo } from '@/components/movil/piezas'
import { pesos, pesosCortos } from '@/lib/format'
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
export function VentasDelMes({
  vendido,
  meta,
  etiqueta,
}: {
  vendido: number
  meta: number
  /** El mes en palabras, para que la tarjeta diga de cuándo habla. */
  etiqueta: string
}) {
  const [editando, setEditando] = useState(false)
  const pct = meta > 0 ? Math.round((vendido / meta) * 100) : 0
  const falta = Math.max(0, meta - vendido)

  return (
    <section className="rounded-[22px] border-[0.5px] border-tinta-200 bg-white p-4.5 shadow-tarjeta lg:rounded-xl">
      <div className="flex items-center gap-4">
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
        </div>
      </div>

      <button
        type="button"
        onClick={() => setEditando(true)}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[13px] bg-tinta-100 text-[15px] font-semibold text-tinta-700 transition active:bg-tinta-150 lg:min-h-9 lg:text-sm"
      >
        <Pencil size={15} />
        Cambiar la meta
      </button>

      {editando && <DialogoMeta meta={meta} onCerrar={() => setEditando(false)} />}
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
