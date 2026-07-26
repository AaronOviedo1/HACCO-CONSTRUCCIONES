'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo } from '@/components/formulario'
import { pesos } from '@/lib/format'
import { num, redondear } from '@/lib/cotizaciones'
import { aprobarCotizacion } from '@/app/admin/cotizaciones/acciones'
import type { ResultadoAprobacion } from '@/types/database'

type OrdenBorrador = { nombre: string; monto: string; fecha_estimada_entrega: string }

/**
 * Se monta sólo cuando el usuario pulsa «Aprobar»: así el estado inicial toma
 * los valores que hay en pantalla en ese momento, sin efectos de sincronía.
 */
export function DialogoAprobar({
  onCerrar, cotizacionId, folio, nombreObra, domicilio, total, subtotal,
  anticipoPct, hayCambiosSinGuardar, onGuardarPrimero,
}: {
  onCerrar: () => void
  cotizacionId: string
  folio: string | null
  nombreObra: string
  domicilio: string
  total: number
  subtotal: number
  anticipoPct: number
  hayCambiosSinGuardar: boolean
  onGuardarPrimero: () => Promise<string | null>
}) {
  const router = useRouter()
  const [ordenes, setOrdenes] = useState<OrdenBorrador[]>([
    { nombre: nombreObra, monto: String(subtotal), fecha_estimada_entrega: '' },
  ])
  const [anticipo, setAnticipo] = useState(String(anticipoPct))
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoAprobacion | null>(null)
  const [pendiente, iniciar] = useTransition()

  const repartido = ordenes.reduce((s, o) => s + num(o.monto), 0)
  const descuadre = redondear(subtotal - repartido)
  const anticipoEsperado = redondear(total * (num(anticipo) / 100))

  const agregar = () => {
    setOrdenes((lista) => {
      const parte = redondear(subtotal / (lista.length + 1))
      return [
        ...lista.map((o) => ({ ...o, monto: String(parte) })),
        { nombre: '', monto: String(redondear(subtotal - parte * lista.length)), fecha_estimada_entrega: '' },
      ]
    })
  }

  const confirmar = () =>
    iniciar(async () => {
      setError(null)
      if (hayCambiosSinGuardar) {
        const id = await onGuardarPrimero()
        if (!id) {
          setError('Primero hay que guardar los cambios pendientes.')
          return
        }
      }

      const r = await aprobarCotizacion(
        cotizacionId,
        ordenes.map((o) => ({
          nombre: o.nombre,
          domicilio: domicilio || null,
          monto: num(o.monto),
          fecha_estimada_entrega: o.fecha_estimada_entrega || null,
        })),
        num(anticipo),
      )

      if (!r.ok) return setError(r.error)
      setResultado(r.datos!)
      router.refresh()
    })

  // -------------------------------------------------------------------------
  if (resultado) {
    return (
      <Dialogo abierto onCerrar={onCerrar} titulo={`${resultado.folio} aprobada`} ancho="lg">
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="mb-5 flex items-center gap-3 rounded-xl bg-haaco-50 px-4 py-3 text-haaco-800 ring-1 ring-haaco-200">
            <Check size={20} className="shrink-0" />
            <p className="text-sm font-medium">
              Se abrieron {resultado.obras.length}{' '}
              {resultado.obras.length === 1 ? 'orden de trabajo' : 'órdenes de trabajo'}.
            </p>
          </div>

          <ul className="mb-5 divide-y divide-tinta-100 overflow-hidden rounded-xl border border-tinta-200">
            {resultado.obras.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-tinta-900">{o.nombre}</span>
                <span className="font-mono text-xs text-tinta-500">OT {o.ot_numero}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-600">Anticipo por cobrar</dt>
              <dd className="font-semibold tabular-nums text-haaco-700">
                {pesos(resultado.anticipo_esperado)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-tinta-500">
            El material presupuestado ya se copió a la primera OT como material{' '}
            <strong>cotizado</strong>, para comparar contra lo que realmente se gaste.
          </p>
        </div>

        <PieDialogo>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
          >
            Listo
          </button>
        </PieDialogo>
      </Dialogo>
    )
  }

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={`Aprobar ${folio ?? 'cotización'}`}
      descripcion="Una cotización puede abrir varias órdenes de trabajo, por ejemplo Interior y Exterior."
      ancho="lg"
    >
      <CuerpoDialogo>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-tinta-700">Órdenes de trabajo</p>
          <div className="space-y-2">
            {ordenes.map((orden, i) => (
              <div key={i} className="grid grid-cols-12 gap-1.5">
                <div className="col-span-5">
                  <Entrada
                    value={orden.nombre}
                    onChange={(e) =>
                      setOrdenes((l) => l.map((o, j) => (j === i ? { ...o, nombre: e.target.value } : o)))
                    }
                    placeholder={i === 0 ? 'Exterior' : 'Interior'}
                  />
                </div>
                <div className="col-span-3">
                  <Numero
                    value={orden.monto}
                    onChange={(e) =>
                      setOrdenes((l) => l.map((o, j) => (j === i ? { ...o, monto: e.target.value } : o)))
                    }
                    placeholder="monto"
                  />
                </div>
                <div className="col-span-3">
                  <Entrada
                    type="date"
                    value={orden.fecha_estimada_entrega}
                    onChange={(e) =>
                      setOrdenes((l) =>
                        l.map((o, j) => (j === i ? { ...o, fecha_estimada_entrega: e.target.value } : o)),
                      )
                    }
                  />
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  {ordenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setOrdenes((l) => l.filter((_, j) => j !== i))}
                      className="rounded p-1 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Quitar orden"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={agregar}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-haaco-700 hover:underline"
          >
            <Plus size={14} />
            Agregar otra OT
          </button>

          {descuadre !== 0 && (
            <p className="mt-2 text-xs text-amber-700">
              El reparto suma {pesos(repartido)} y el subtotal es {pesos(subtotal)}:{' '}
              {descuadre > 0 ? `faltan ${pesos(descuadre)}` : `sobran ${pesos(-descuadre)}`}. Puedes
              continuar, pero la utilidad por OT saldrá descuadrada.
            </p>
          )}
        </div>

        <Campo
          etiqueta="Anticipo %"
          ancho="medio"
          hijo={<Numero value={anticipo} onChange={(e) => setAnticipo(e.target.value)} />}
          ayuda="50% pintura · 60% herrería"
        />
        <div className="flex flex-col justify-end sm:col-span-1">
          <p className="text-sm text-tinta-500">Anticipo por cobrar</p>
          <p className="text-xl font-semibold tabular-nums text-haaco-700">{pesos(anticipoEsperado)}</p>
          <p className="text-xs text-tinta-400">sobre el total de {pesos(total)}</p>
        </div>

        {hayCambiosSinGuardar && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200 sm:col-span-2">
            Hay cambios sin guardar: se guardarán antes de aprobar.
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
          onClick={confirmar}
          disabled={pendiente || ordenes.some((o) => !o.nombre.trim())}
          className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          <Check size={16} />
          {pendiente ? 'Aprobando…' : 'Aprobar y abrir OTs'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
