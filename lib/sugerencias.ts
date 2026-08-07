import type { Sugerencia } from '@/lib/cotizaciones'

/**
 * Agrupa textos repetidos y se queda con los más usados y su último monto.
 * Alimenta los autocompletados de partidas y materiales con lo ya capturado
 * (el Excel migrado incluido).
 */
export function masComunes(
  filas: { texto: string | null; monto: number | null }[],
  tope: number,
): Sugerencia[] {
  const mapa = new Map<string, Sugerencia>()
  for (const fila of filas) {
    const texto = (fila.texto ?? '').trim()
    if (!texto) continue
    const clave = texto.toLowerCase()
    const previa = mapa.get(clave)
    if (previa) {
      previa.veces += 1
      if (fila.monto) previa.monto = fila.monto
    } else {
      mapa.set(clave, { texto, veces: 1, monto: fila.monto })
    }
  }
  return [...mapa.values()].sort((a, b) => b.veces - a.veces).slice(0, tope)
}

/**
 * Lo que de verdad se pagó por una pieza del catálogo.
 *
 * Todo lo que compra el taller se compra con IVA, así que el precio que hay que
 * proponer al capturar material o un gasto es el neto, no el costo pelón. El
 * `??` cubre a los productos viejos que se dieron de alta sin desglose.
 */
export const precioPagado = (p: { costo: number; precio_neto?: number | null }) =>
  p.precio_neto ?? p.costo

/** Mezcla sugerencias con el catálogo de productos, sin duplicar nombres. */
export function conCatalogo(
  sugerencias: Sugerencia[],
  productos: { nombre: string; costo: number; precio_neto?: number | null }[],
): Sugerencia[] {
  const mapa = new Map<string, Sugerencia>()
  for (const s of sugerencias) mapa.set(s.texto.toLowerCase(), { ...s })
  for (const p of productos) {
    const clave = p.nombre.toLowerCase()
    const previa = mapa.get(clave)
    if (!previa) mapa.set(clave, { texto: p.nombre, veces: 0, monto: precioPagado(p) })
    else if (!previa.monto) previa.monto = precioPagado(p)
  }
  return [...mapa.values()]
}
