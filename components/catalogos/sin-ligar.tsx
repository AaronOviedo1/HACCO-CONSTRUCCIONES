'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { MensajeError, Seleccion } from '@/components/formulario'
import { fecha as formatoFecha, pesos } from '@/lib/format'
import { ligarRenglon } from '@/app/admin/catalogo/acciones'

/** Un renglón de factura que no se pudo ligar a ningún material del catálogo. */
export type RenglonHuerfano = {
  id: string
  texto: string
  precio_neto: number | null
  proveedor: string | null
  fecha: string
  folio: string | null
}

/**
 * Los renglones de factura que no se pudieron ligar a un material del catálogo.
 *
 * Es el único trabajo manual de todo esto, y encoge cada semana: al resolver
 * uno el alias queda aprendido —«PTR 1X1 CAL.14 6.10M» ya es el PTR para
 * siempre— y ese texto no vuelve a preguntar. Mientras nadie los resuelva, esas
 * facturas no dejan precio en la ficha del producto.
 *
 * Nunca se adivina por parecido: un ligado mal hecho mete el precio de un
 * fierro en otro, y eso sale más caro que preguntar.
 */
export function SinLigar({
  renglones,
  productos,
}: {
  renglones: RenglonHuerfano[]
  productos: { id: string; nombre: string }[]
}) {
  if (renglones.length === 0) return null

  return (
    <div className="space-y-1.5">
      {renglones.map((r) => (
        <FilaHuerfana key={r.id} renglon={r} productos={productos} />
      ))}
    </div>
  )
}

function FilaHuerfana({
  renglon,
  productos,
}: {
  renglon: RenglonHuerfano
  productos: { id: string; nombre: string }[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [resuelto, setResuelto] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const ligar = (productoId: string | null) => {
    setError(null)
    iniciar(async () => {
      const r = await ligarRenglon(renglon.id, productoId)
      if (!r.ok) return setError(r.error)
      setResuelto(true)
    })
  }

  if (resuelto) return null

  return (
    <div className="rounded-[14px] border-[0.5px] border-tinta-200 bg-white px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          {/* El texto tal como venía en la factura: es lo que hay que reconocer. */}
          <p className="truncate font-medium text-tinta-800">{renglon.texto}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-tinta-400">
            {renglon.precio_neto != null && (
              <span className="tabular-nums">{pesos(renglon.precio_neto)} · </span>
            )}
            {[renglon.proveedor, renglon.folio && `factura ${renglon.folio}`, formatoFecha(renglon.fecha)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="w-56">
            <Seleccion
              defaultValue=""
              disabled={pendiente}
              onChange={(e) => e.target.value && ligar(e.target.value)}
              aria-label="Qué material es"
            >
              <option value="">¿Qué material es?</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Seleccion>
          </div>

          <button
            type="button"
            onClick={() => ligar(null)}
            disabled={pendiente}
            className="whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-medium text-tinta-500 transition hover:bg-tinta-50 hover:text-tinta-700 disabled:opacity-40"
          >
            {pendiente ? <Loader2 size={14} className="animate-spin" /> : 'No es material'}
          </button>
        </div>
      </div>

      <div className="mt-2 empty:mt-0"><MensajeError mensaje={error} /></div>
    </div>
  )
}
