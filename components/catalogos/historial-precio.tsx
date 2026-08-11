'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { fecha as formatoFecha, pesos } from '@/lib/format'
import { antiguedad, COLOR_SEMAFORO, procedencia } from '@/lib/precios'
import { historialDePrecio, type HistorialPrecio } from '@/app/admin/catalogo/acciones'

/**
 * Lo que se ha pagado por este material, dentro de su propia ficha.
 *
 * La regla de la casa se respeta aquí igual que en el cotizador: el sistema
 * nunca dice «precio actual». Dice «se pagó tanto, en tal factura, hace tantos
 * días». Lo que el catálogo tiene arriba en «Costo unitario» es lo que se usa
 * para cotizar; esto de acá es de dónde salió ese número y qué había antes.
 *
 * Se pide al abrir la ficha —el diálogo se monta sólo al abrirlo, ver
 * `BotonEditar`— y no viaja con la tabla: enseñar el historial de un producto
 * no justifica traer el de los quinientos.
 */
export function HistorialPrecioProducto({ productoId }: { productoId: string }) {
  const [datos, setDatos] = useState<HistorialPrecio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    let vigente = true
    historialDePrecio(productoId).then((r) => {
      if (!vigente) return
      if (r.ok) setDatos(r.datos ?? { ultimo: null, ultimoPor: null, anteriores: [] })
      else setError(r.error)
    })
    return () => {
      vigente = false
    }
  }, [productoId])

  return (
    <div className="rounded-xl bg-tinta-50/70 px-4 py-3.5 sm:col-span-2">
      <p className="text-sm font-medium text-tinta-800">Historial del precio</p>

      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : !datos ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-tinta-400">
          <Loader2 size={13} className="animate-spin" />
          Buscando…
        </p>
      ) : !datos.ultimo ? (
        <p className="mt-1 text-xs leading-relaxed text-tinta-500">
          Todavía no se ha registrado ningún precio de este material. Se llenan solos con cada
          factura de compra, y con lo que corrijas aquí arriba.
        </p>
      ) : (
        <>
          {/* El último, con su punto de color: verde recién sabido, rojo viejo. */}
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${COLOR_SEMAFORO[datos.ultimo.semaforo]}`}
              />
              <span className="text-base font-semibold tabular-nums text-tinta-900">
                {pesos(datos.ultimo.precio_neto)}
              </span>
            </span>
            <span className="text-xs text-tinta-500">
              por {datos.ultimo.unidad_observada ?? datos.ultimo.unidad_catalogo}
            </span>
            <span className="text-xs text-tinta-500">
              {[procedencia(datos.ultimo), antiguedad(datos.ultimo.dias), datos.ultimoPor]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </p>

          {datos.ultimo.unidad_distinta && (
            // Se pagó por tramo y el catálogo va por metro (o al revés). Se
            // enseña, pero nadie convierte solo.
            <p className="mt-1 text-[11px] leading-tight text-amber-700">
              Ojo: se pagó por {datos.ultimo.unidad_observada} y el catálogo va por{' '}
              {datos.ultimo.unidad_catalogo}. No es el mismo número.
            </p>
          )}

          {datos.anteriores.length > 0 &&
            (abierto ? (
              <ul className="mt-2.5 divide-y divide-tinta-200/70 border-t border-tinta-200/70">
                {datos.anteriores.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5 text-xs"
                  >
                    <span className="w-20 shrink-0 text-tinta-400">{formatoFecha(o.fecha)}</span>
                    <span className="font-medium tabular-nums text-tinta-700">
                      {pesos(o.precio_neto)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-tinta-500">
                      {[procedencia(o), o.registrado_por].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type="button"
                onClick={() => setAbierto(true)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-haaco-700 transition hover:text-haaco-800"
              >
                <ChevronDown size={13} />
                Ver {datos.anteriores.length === 1 ? 'el anterior' : `los ${datos.anteriores.length} anteriores`}
              </button>
            ))}
        </>
      )}
    </div>
  )
}
