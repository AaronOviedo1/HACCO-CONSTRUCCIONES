/**
 * Precios vivos del material.
 *
 * La regla que ordena todo lo de aquí: el sistema nunca dice «precio actual».
 * Dice «último precio pagado, de tal factura, hace tantos días». Un precio de
 * factura trae descuentos negociados y es pasado; presentarlo como si fuera de
 * hoy es lo único que puede hacer que dejen de confiar en la pantalla.
 */

export type Semaforo = 'verde' | 'ambar' | 'rojo'

/** De dónde salió un precio. Espejo del enum `origen_precio` de la base. */
export type Origen = 'factura' | 'llamada' | 'captura' | 'lista'

/** El último precio conocido de un material, tal como lo da v_precios_vigentes. */
export type PrecioVigente = {
  producto_id: string
  /** La fila de `precios_material` de la que salió: distingue el último de los de antes. */
  observacion_id: string
  producto: string
  precio_neto: number
  unidad_catalogo: string | null
  unidad_observada: string | null
  unidad_distinta: boolean
  proveedor_id: string | null
  proveedor: string | null
  proveedor_telefono: string | null
  origen: Origen
  folio_factura: string | null
  fecha: string
  dias: number
  vigencia: number
  semaforo: Semaforo
}

/** De dónde salió el precio, dicho como se diría en voz alta. */
export const ORIGEN_PRECIO: Record<Origen, string> = {
  factura: 'factura',
  llamada: 'por teléfono',
  captura: 'capturado',
  lista: 'lista del proveedor',
}

/** «hoy», «ayer», «hace 12 d». Se lee de un vistazo y ocupa poco. */
export function antiguedad(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} d`
}

/**
 * De dónde salió un precio: «factura A-3312 · FERRECASA».
 *
 * Sin la antigüedad a propósito — la pone quien lo pinta, porque a veces va en
 * su propia columna y repetirla ahí se lee como un error.
 *
 * Pide lo mínimo y no un `PrecioVigente` entero: lo mismo se dice del último
 * precio que de cualquier renglón del historial, y la regla vive en un lugar.
 */
export function procedencia(p: {
  origen: Origen
  folio_factura: string | null
  proveedor: string | null
}): string {
  const de = p.origen === 'factura' && p.folio_factura
    ? `factura ${p.folio_factura}`
    : ORIGEN_PRECIO[p.origen]
  return [de, p.proveedor].filter(Boolean).join(' · ')
}

/** El color del punto. Mismo criterio que la vista, para que no se contradigan. */
export const COLOR_SEMAFORO: Record<Semaforo, string> = {
  verde: 'bg-haaco-600',
  ambar: 'bg-amber-500',
  rojo: 'bg-red-500',
}

/**
 * Si se observó en una unidad distinta a la del catálogo, el precio se enseña
 * pero no se ofrece para rellenar: el PTR se compra por tramo de 6.10 y se
 * cotiza por metro, y meter uno por el otro descuadra una cotización real.
 * La conversión nunca se hace sola.
 */
export const sePuedeUsar = (p: PrecioVigente) => !p.unidad_distinta

/**
 * Minúsculas y sin acentos, igual que normalizar_material() en la base. No
 * pretende igualarla —allá se unifican calibres y medidas—: aquí sólo sirve
 * para cruzar un texto con el catálogo que ya está en pantalla.
 */
export const normalizarMaterial = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
