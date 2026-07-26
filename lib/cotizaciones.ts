import { REGLAS } from '@/lib/empresa'
import type {
  DocumentoCotizacionSql, EstatusCotizacion, MaterialSql, RubroMaterial, TipoCotizacion,
} from '@/types/database'

// ---------------------------------------------------------------------------
// El editor guarda los números como texto para que el usuario pueda borrar el
// campo sin pelearse con un NaN. Todo el cálculo pasa por aquí.
// ---------------------------------------------------------------------------
export function num(valor: string | number | null | undefined): number {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0
  const n = Number(String(valor ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export const redondear = (n: number) => Math.round(n * 100) / 100

export type PartidaBorrador = {
  descripcion: string
  m2: string
  precio_unitario: string
}

export type MaterialBorrador = {
  rubro: RubroMaterial
  material: string
  piezas: string
  costo: string
}

export type ConceptoBorrador = {
  concepto: string
  mano_obra: string
  gastos_indirectos_pct: string
  utilidad_pct: string
  materiales: MaterialBorrador[]
}

export type ProcesoBorrador = {
  texto_proceso_id: string | null
  contenido: string
}

export type BorradorCotizacion = {
  cliente_id: string
  nombre_obra: string
  domicilio_obra: string
  tipo: TipoCotizacion
  requiere_factura: boolean
  anticipo_pct: string
  iva_pct: string
  vigencia_dias: string
  linea_calidad: string
  notas: string
  fecha: string
  procesos: ProcesoBorrador[]
  items: PartidaBorrador[]
  desglose: ConceptoBorrador[]
  materiales: MaterialBorrador[]
}

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

/** Importe de una partida: si no lleva m² se toma el precio unitario tal cual. */
export function importePartida(partida: PartidaBorrador): number {
  const m2 = partida.m2.trim() === '' ? 1 : num(partida.m2)
  return redondear(m2 * num(partida.precio_unitario))
}

export const totalMaterial = (m: MaterialBorrador) => redondear(num(m.piezas) * num(m.costo))

export function sumaMateriales(materiales: MaterialBorrador[], rubro?: RubroMaterial): number {
  return redondear(
    materiales
      .filter((m) => !rubro || m.rubro === rubro)
      .reduce((s, m) => s + totalMaterial(m), 0),
  )
}

/** Costo directo + indirectos de un concepto de herrería. */
export function costoConcepto(concepto: ConceptoBorrador): number {
  const directo =
    sumaMateriales(concepto.materiales, 'herreria') +
    sumaMateriales(concepto.materiales, 'pintura') +
    sumaMateriales(concepto.materiales, 'otro') +
    num(concepto.mano_obra)
  return redondear(directo * (1 + num(concepto.gastos_indirectos_pct) / 100))
}

/** Precio de venta del concepto, ya con el margen de utilidad. */
export function precioConcepto(concepto: ConceptoBorrador): number {
  return redondear(costoConcepto(concepto) * (1 + num(concepto.utilidad_pct) / 100))
}

export function totalesCotizacion(borrador: BorradorCotizacion) {
  const partidas = borrador.items.reduce((s, i) => s + importePartida(i), 0)
  const conceptos = borrador.desglose.reduce((s, c) => s + precioConcepto(c), 0)
  const subtotal = redondear(partidas + conceptos)
  const iva = redondear(subtotal * (num(borrador.iva_pct) / 100))
  const total = redondear(subtotal + iva)
  const anticipo = redondear(total * (num(borrador.anticipo_pct) / 100))

  const costoDirecto = borrador.desglose.reduce((s, c) => s + costoConcepto(c), 0)
  const utilidadHerreria = redondear(conceptos - costoDirecto)

  return { partidas, conceptos, subtotal, iva, total, anticipo, costoDirecto, utilidadHerreria }
}

// ---------------------------------------------------------------------------
// Borrador ⇄ payload de la función guardar_cotizacion
// ---------------------------------------------------------------------------
export function borradorVacio(tipo: TipoCotizacion = 'pintura'): BorradorCotizacion {
  return {
    cliente_id: '',
    nombre_obra: '',
    domicilio_obra: '',
    tipo,
    requiere_factura: false,
    anticipo_pct: String(
      tipo === 'herreria' ? REGLAS.anticipoHerreriaPct : REGLAS.anticipoPinturaPct,
    ),
    iva_pct: String(REGLAS.ivaPct),
    vigencia_dias: String(REGLAS.vigenciaCotizacionDias),
    linea_calidad: LINEA_CALIDAD,
    notas: '',
    fecha: hoyISO(),
    procesos: [],
    items: [],
    desglose: [],
    materiales: [],
  }
}

export function conceptoVacio(): ConceptoBorrador {
  return {
    concepto: '',
    mano_obra: '',
    gastos_indirectos_pct: String(REGLAS.gastosIndirectosPct),
    utilidad_pct: String(REGLAS.utilidadHerreriaPct),
    materiales: [],
  }
}

export function aPayload(borrador: BorradorCotizacion): DocumentoCotizacionSql {
  const material = (m: MaterialBorrador, orden: number): MaterialSql => ({
    rubro: m.rubro,
    material: m.material.trim(),
    piezas: num(m.piezas) || 1,
    costo: num(m.costo),
    orden,
  })

  return {
    cliente_id: borrador.cliente_id,
    nombre_obra: borrador.nombre_obra.trim() || null,
    domicilio_obra: borrador.domicilio_obra.trim() || null,
    tipo: borrador.tipo,
    requiere_factura: borrador.requiere_factura,
    anticipo_pct: num(borrador.anticipo_pct),
    iva_pct: num(borrador.iva_pct),
    vigencia_dias: num(borrador.vigencia_dias) || 30,
    linea_calidad: borrador.linea_calidad.trim() || null,
    notas: borrador.notas.trim() || null,
    fecha: borrador.fecha,
    procesos: borrador.procesos
      .filter((p) => p.contenido.trim())
      .map((p, orden) => ({
        texto_proceso_id: p.texto_proceso_id,
        contenido: p.contenido.trim(),
        orden,
      })),
    items: borrador.items
      .filter((i) => i.descripcion.trim())
      .map((i) => ({
        descripcion: i.descripcion.trim(),
        m2: i.m2.trim() === '' ? null : num(i.m2),
        precio_unitario: num(i.precio_unitario),
      })),
    desglose: borrador.desglose
      .filter((c) => c.concepto.trim())
      .map((c) => ({
        concepto: c.concepto.trim(),
        mano_obra: num(c.mano_obra),
        gastos_indirectos_pct: num(c.gastos_indirectos_pct),
        utilidad_pct: num(c.utilidad_pct),
        materiales: c.materiales.filter((m) => m.material.trim()).map(material),
      })),
    materiales: borrador.materiales.filter((m) => m.material.trim()).map(material),
  }
}

/** Qué falta para poder guardar. Vacío = listo. */
export function validar(borrador: BorradorCotizacion): string[] {
  const faltas: string[] = []
  if (!borrador.cliente_id) faltas.push('Falta elegir el cliente.')

  const conPartidas = borrador.items.some((i) => i.descripcion.trim())
  const conConceptos = borrador.desglose.some((c) => c.concepto.trim())
  if (!conPartidas && !conConceptos) {
    faltas.push('Agrega al menos una partida o un concepto de herrería.')
  }
  if (totalesCotizacion(borrador).subtotal <= 0) {
    faltas.push('El subtotal es cero: revisa los precios unitarios.')
  }
  return faltas
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------
export const ESTATUS_COTIZACION: Record<
  EstatusCotizacion,
  { texto: string; tono: 'gris' | 'azul' | 'verde' | 'ambar' | 'rojo' }
> = {
  borrador: { texto: 'Borrador', tono: 'gris' },
  enviada: { texto: 'Enviada', tono: 'azul' },
  aprobada: { texto: 'Aprobada', tono: 'verde' },
  rechazada: { texto: 'Rechazada', tono: 'rojo' },
  terminada: { texto: 'Terminada', tono: 'verde' },
}

export const TIPO_COTIZACION: Record<TipoCotizacion, string> = {
  pintura: 'Pintura',
  herreria: 'Herrería',
  mixta: 'Mixta',
}

export const LINEA_CALIDAD =
  'Se utilizarán productos de la más alta calidad en el mercado, garantizando la durabilidad y el acabado del trabajo.'

/** Fecha de hoy en formato ISO, respetando el día local de Hermosillo. */
export function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Notas al pie del PDF, tal como salen hoy en la carta. */
export function notasCotizacion(anticipoPct: number, vigenciaDias: number): string[] {
  return [
    '*Precios más IVA',
    `*Anticipo ${Math.round(anticipoPct)}% para iniciar trabajo, resto al finalizar`,
    '*Trabajo Garantizado.',
    `*Vigencia de cotización ${vigenciaDias} días`,
  ]
}
