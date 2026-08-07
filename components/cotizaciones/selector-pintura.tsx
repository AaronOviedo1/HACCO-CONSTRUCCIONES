'use client'

import { pesos } from '@/lib/format'
import {
  NIVELES_PRECIO, pinturasPorMarca, precioPorNivel, type PartidaBorrador,
} from '@/lib/cotizaciones'
import type { NivelPrecio, Producto } from '@/types/database'

/**
 * Qué pintura y a qué precio, sin teclear.
 *
 * Son las dos decisiones de cotizar pintura y hasta ahora se resolvían
 * escribiendo la descripción y acordándose del número. Aquí se tocan: la
 * pintura, agrupada por marca, y una de las tres tarifas con su cifra a la
 * vista. El precio queda editable —el campo de abajo sigue ahí—, y en cuanto
 * alguien lo cambia a mano la tarifa se desmarca: manda el número escrito.
 *
 * Si todavía no hay pinturas con tarifa capturada en el catálogo, esto no se
 * pinta y la cotización se captura como siempre.
 */
export function SelectorPintura({
  productos,
  partida,
  onCambio,
  compacto = false,
  deshabilitado = false,
}: {
  productos: Producto[]
  partida: PartidaBorrador
  onCambio: (parche: Partial<PartidaBorrador>) => void
  /** En el editor de escritorio el bloque va apretado; en el iPad, con dedo. */
  compacto?: boolean
  deshabilitado?: boolean
}) {
  const marcas = pinturasPorMarca(productos)
  if (marcas.length === 0) return null

  const elegida = productos.find((p) => p.id === partida.producto_id)

  const elegirPintura = (p: Producto) => {
    // Se conserva la tarifa que ya estaba puesta si la nueva pintura la tiene;
    // cambiar de marca no debería obligar a volver a decidir el nivel.
    const puesto = partida.nivel_precio as NivelPrecio | undefined
    const monto = puesto ? precioPorNivel(p, puesto) : null
    const tarifa = monto != null ? { nivel: puesto!, monto } : primeraTarifa(p)

    onCambio({
      producto_id: p.id,
      nivel_precio: tarifa?.nivel ?? '',
      precio_unitario: tarifa ? String(tarifa.monto) : partida.precio_unitario,
      descripcion: partida.descripcion.trim() || p.nombre,
    })
  }

  const elegirNivel = (nivel: NivelPrecio) => {
    if (!elegida) return
    const monto = precioPorNivel(elegida, nivel)
    if (monto == null) return
    onCambio({ nivel_precio: nivel, precio_unitario: String(monto) })
  }

  const alto = compacto ? 'min-h-9 px-3 text-[13px]' : 'min-h-12 px-4 text-[15px]'

  return (
    <div className={compacto ? 'space-y-1.5' : 'space-y-2.5'}>
      {marcas.map(({ marca, pinturas }) => (
        <div key={marca}>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-tinta-400">
            {marca}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {pinturas.map((p) => {
              const activa = p.id === partida.producto_id
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={deshabilitado}
                  onClick={() => elegirPintura(p)}
                  aria-pressed={activa}
                  className={`rounded-xl border font-semibold transition disabled:opacity-50 ${alto} ${
                    activa
                      ? 'border-haaco-700 bg-haaco-700 text-white'
                      : 'border-tinta-300 bg-white text-tinta-700 hover:border-haaco-300'
                  }`}
                >
                  {p.nombre}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {elegida && (
        <div className="flex flex-wrap gap-1.5">
          {NIVELES_PRECIO.map(({ valor, corto }) => {
            const monto = precioPorNivel(elegida, valor)
            if (monto == null) return null
            const activo = partida.nivel_precio === valor
            return (
              <button
                key={valor}
                type="button"
                disabled={deshabilitado}
                onClick={() => elegirNivel(valor)}
                aria-pressed={activo}
                className={`rounded-xl border font-semibold transition disabled:opacity-50 ${alto} ${
                  activo
                    ? 'border-haaco-600 bg-haaco-50 text-haaco-900'
                    : 'border-tinta-200 bg-white text-tinta-600 hover:border-haaco-300'
                }`}
              >
                {corto}
                <span className="ml-1.5 font-normal tabular-nums text-tinta-500">
                  {pesos(monto)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** La tarifa más alta que tenga esa pintura, para cuando no hay una elegida. */
function primeraTarifa(p: Producto): { nivel: NivelPrecio; monto: number } | null {
  for (const { valor } of NIVELES_PRECIO) {
    const monto = precioPorNivel(p, valor)
    if (monto != null) return { nivel: valor, monto }
  }
  return null
}
