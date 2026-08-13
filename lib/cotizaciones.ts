import { REGLAS } from '@/lib/empresa'
import type {
  DocumentoCotizacionSql, EstatusCotizacion, MaterialSql, NivelPrecio, Producto, RubroMaterial,
  TipoCotizacion,
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
  /** La cantidad. Se llama m2 por historia; vacío se toma como 1. */
  m2: string
  /** Unidad de la cantidad. Vacío = metros cuadrados. */
  unidad: string
  precio_unitario: string
  /** La pintura elegida, si el precio salió del catálogo. */
  producto_id?: string | null
  /** Con qué tarifa. Vacío = el precio se tecleó a mano. */
  nivel_precio?: string
}

/** Unidades que se pueden elegir por partida. La primera es la de siempre. */
export const UNIDADES_PARTIDA: { valor: string; texto: string; abrevia: string }[] = [
  { valor: '',        texto: 'm²',       abrevia: 'm²' },
  { valor: 'pza',     texto: 'Pieza',    abrevia: 'pza' },
  { valor: 'ml',      texto: 'Metro lineal', abrevia: 'ml' },
  { valor: 'lote',    texto: 'Lote',     abrevia: 'lote' },
  { valor: 'servicio', texto: 'Servicio', abrevia: 'serv' },
]

/** Cómo se escribe la unidad de una partida en la carta al cliente. */
export const abreviaUnidad = (unidad: string | null | undefined) =>
  UNIDADES_PARTIDA.find((u) => u.valor === (unidad ?? ''))?.abrevia ?? unidad ?? 'm²'

export type MaterialBorrador = {
  rubro: RubroMaterial
  material: string
  piezas: string
  costo: string
  /**
   * El producto del catálogo, cuando el material se eligió de una sugerencia.
   * Es lo que permite recordar a qué precio se compró después: sin esto el
   * material es sólo texto y no se puede cruzar con nada.
   */
  producto_id?: string | null
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

/**
 * Texto que ya se ha usado en cotizaciones anteriores (las del Excel migrado
 * incluidas), con su precio o costo más reciente para rellenar el campo.
 */
export type Sugerencia = {
  texto: string
  veces: number
  monto: number | null
  /** Presentes cuando la sugerencia viene del catálogo de productos. */
  producto_id?: string | null
  proveedor_id?: string | null
}

export type SugerenciasCotizacion = {
  partidas: Sugerencia[]
  materiales: Sugerencia[]
  procesos: string[]
}

export type BorradorCotizacion = {
  cliente_id: string
  nombre_obra: string
  domicilio_obra: string
  tipo: TipoCotizacion
  requiere_factura: boolean
  anticipo_pct: string
  iva_pct: string
  /** Descuento comercial sobre el subtotal, antes de IVA. */
  descuento_pct: string
  vigencia_dias: string
  /** Viáticos presupuestados: no salen en el PDF, van al concentrado de la OT. */
  viaticos: string
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

/** Importe de una partida: si no lleva cantidad se toma el precio tal cual. */
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

/** Precio de venta del concepto: la utilidad es un % del precio, no del costo. */
export function precioConcepto(concepto: ConceptoBorrador): number {
  const factor = 1 - num(concepto.utilidad_pct) / 100
  if (factor <= 0) return 0 // con utilidad ≥ 100% no existe precio que la deje
  return redondear(costoConcepto(concepto) / factor)
}

export function totalesCotizacion(borrador: BorradorCotizacion) {
  const partidas = borrador.items.reduce((s, i) => s + importePartida(i), 0)
  const conceptos = borrador.desglose.reduce((s, c) => s + precioConcepto(c), 0)
  const subtotal = redondear(partidas + conceptos)

  const descuentoPct = num(borrador.descuento_pct)
  const descuento = redondear(subtotal * (descuentoPct / 100))
  const base = redondear(subtotal - descuento)
  const iva = redondear(base * (num(borrador.iva_pct) / 100))

  // El total se calcula de un tirón, con un solo redondeo, para que cuadre al
  // centavo con la columna generada de la base de datos. Descuento, base e IVA
  // son cifras de presentación: encadenar sus redondeos podría desviar un peso.
  const total = redondear(subtotal * (1 - descuentoPct / 100) * (1 + num(borrador.iva_pct) / 100))
  const anticipo = redondear(total * (num(borrador.anticipo_pct) / 100))

  const costoDirecto = borrador.desglose.reduce((s, c) => s + costoConcepto(c), 0)
  const utilidadHerreria = redondear(conceptos - costoDirecto)

  return {
    partidas, conceptos, subtotal, descuento, base, iva, total, anticipo,
    costoDirecto, utilidadHerreria,
  }
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
    anticipo_pct: String(anticipoPorTipo(tipo)),
    // El IVA no se captura: si el cliente pide factura son los 16 de siempre.
    iva_pct: '0',
    descuento_pct: '0',
    vigencia_dias: String(REGLAS.vigenciaCotizacionDias),
    viaticos: '',
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
    producto_id: m.producto_id || null,
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
    descuento_pct: num(borrador.descuento_pct),
    vigencia_dias: num(borrador.vigencia_dias) || 30,
    viaticos: num(borrador.viaticos),
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
        unidad: i.unidad.trim() || null,
        precio_unitario: num(i.precio_unitario),
        producto_id: i.producto_id || null,
        nivel_precio: (i.nivel_precio || null) as NivelPrecio | null,
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
  // Enviada es lo que pasó; seguimiento es dónde está. Con doscientas al año
  // todas enviadas, esta es la que dice cuáles siguen vivas.
  seguimiento: { texto: 'En seguimiento', tono: 'ambar' },
  aprobada: { texto: 'Aprobada', tono: 'verde' },
  rechazada: { texto: 'Rechazada', tono: 'rojo' },
  terminada: { texto: 'Terminada', tono: 'verde' },
}

/**
 * Los cinco tipos de trabajo, con lo que cada uno arrastra: el anticipo que se
 * pide de costumbre, qué bloques del editor tiene sentido enseñar y en qué se
 * mide la partida. Es la única lista: el selector del editor, el del cotizador
 * rápido y el filtro del listado salen todos de aquí.
 *
 * Pintura e imper se cotizan m² × precio; herrería y otros se cobran por pieza
 * y el cálculo del precio es interno, así que al cliente sólo le llega la
 * cantidad y el importe.
 */
export type BloqueCotizacion = 'partidas' | 'herreria'

export const TIPOS_COTIZACION: readonly {
  valor: TipoCotizacion
  texto: string
  nota: string
  anticipoPct: number
  unidad: string | null
  bloques: readonly BloqueCotizacion[]
}[] = [
  { valor: 'pintura',  texto: 'Pintura',  nota: 'Anticipo 50%',       anticipoPct: REGLAS.anticipoPinturaPct,  unidad: null,  bloques: ['partidas'] },
  { valor: 'imper',    texto: 'Imper',    nota: 'Anticipo 50%',       anticipoPct: REGLAS.anticipoPinturaPct,  unidad: null,  bloques: ['partidas'] },
  { valor: 'herreria', texto: 'Herrería', nota: 'Anticipo 60%',       anticipoPct: REGLAS.anticipoHerreriaPct, unidad: 'pza', bloques: ['herreria'] },
  { valor: 'otros',    texto: 'Otros',    nota: 'Por cantidad',       anticipoPct: REGLAS.anticipoPinturaPct,  unidad: 'pza', bloques: ['partidas'] },
  { valor: 'mixta',    texto: 'Mixta',    nota: 'Pintura + herrería', anticipoPct: REGLAS.anticipoPinturaPct,  unidad: null,  bloques: ['partidas', 'herreria'] },
]

const porTipo = (tipo: TipoCotizacion) =>
  TIPOS_COTIZACION.find((t) => t.valor === tipo) ?? TIPOS_COTIZACION[0]

export const TIPO_COTIZACION: Record<TipoCotizacion, string> = Object.fromEntries(
  TIPOS_COTIZACION.map((t) => [t.valor, t.texto]),
) as Record<TipoCotizacion, string>

/** Anticipo que se pide de costumbre para ese tipo de trabajo. */
export const anticipoPorTipo = (tipo: TipoCotizacion) => porTipo(tipo).anticipoPct

/** Si el editor debe enseñar las partidas sueltas o el cotizador de herrería. */
export const muestraBloque = (tipo: TipoCotizacion, bloque: BloqueCotizacion) =>
  porTipo(tipo).bloques.includes(bloque)

/** Unidad con la que nacen las partidas de ese tipo. Nulo = metros cuadrados. */
export const unidadPorTipo = (tipo: TipoCotizacion) => porTipo(tipo).unidad

/** Título del bloque de partidas: "de pintura" sólo cuando de verdad lo es. */
export const tituloPartidas = (tipo: TipoCotizacion) =>
  tipo === 'pintura' || tipo === 'mixta' ? 'Partidas de pintura'
  : tipo === 'imper' ? 'Partidas de impermeabilización'
  : 'Partidas'

export const LINEA_CALIDAD =
  'Se utilizarán productos de la más alta calidad en el mercado, garantizando la durabilidad y el acabado del trabajo.'

// ---------------------------------------------------------------------------
// El {PRODUCTO} de los bullets del proceso
// ---------------------------------------------------------------------------

/** Marcador en los textos de proceso donde va el nombre del producto aplicado. */
export const TOKEN_PRODUCTO = '{PRODUCTO}'

export const tieneTokenProducto = (texto: string) => texto.includes(TOKEN_PRODUCTO)

export const sustituirProducto = (texto: string, nombre: string) =>
  texto.replaceAll(TOKEN_PRODUCTO, nombre.trim())

/**
 * Pone la pintura elegida en los bullets que hablan de pintura.
 *
 * Sólo toca los bullets ligados al texto de biblioteca titulado «Pintura»: el
 * sellador, el esmalte y el impermeabilizante son otras cubetas y su producto
 * se elige en su propio selector. Si el bullet ya no trae el token pero quedó
 * con la pintura anterior (se cambió de cubeta a media cotización), el nombre
 * viejo se reemplaza por el nuevo para que el PDF no mienta.
 */
export function ponerPinturaEnProcesos(
  procesos: ProcesoBorrador[],
  textos: { id: string; titulo: string }[],
  nombreNuevo: string,
  nombreViejo?: string | null,
): ProcesoBorrador[] {
  const dePintura = new Set(
    textos.filter((t) => t.titulo.trim().toLowerCase() === 'pintura').map((t) => t.id),
  )
  return procesos.map((p) => {
    if (!p.texto_proceso_id || !dePintura.has(p.texto_proceso_id)) return p
    if (tieneTokenProducto(p.contenido)) {
      return { ...p, contenido: sustituirProducto(p.contenido, nombreNuevo) }
    }
    if (nombreViejo && nombreViejo !== nombreNuevo && p.contenido.includes(nombreViejo)) {
      return { ...p, contenido: p.contenido.replaceAll(nombreViejo, nombreNuevo) }
    }
    return p
  })
}

// ---------------------------------------------------------------------------
// Las tres tarifas de la pintura
// ---------------------------------------------------------------------------

/**
 * Un metro pintado no vale lo mismo para todos: hay tarifa de público, una
 * para el cliente que ya trabaja con ellos y una tercera para obra grande.
 * Cada pintura del catálogo lleva las tres, y al cotizar se elige cuál.
 */
export const NIVELES_PRECIO: readonly { valor: NivelPrecio; texto: string; corto: string }[] = [
  { valor: 'publico',  texto: 'Precio público',         corto: 'Público' },
  { valor: 'especial', texto: 'Precio especial',        corto: 'Especial' },
  { valor: 'super',    texto: 'Precio súper especial',  corto: 'Súper' },
]

type ProductoTarifado = Pick<
  Producto,
  'precio_publico' | 'precio_especial' | 'precio_super'
>

/** Lo que cuesta el metro con esa pintura y esa tarifa. Nulo = no la tiene. */
export function precioPorNivel(p: ProductoTarifado, nivel: NivelPrecio): number | null {
  const cifra =
    nivel === 'publico' ? p.precio_publico
    : nivel === 'especial' ? p.precio_especial
    : p.precio_super
  return cifra != null && Number(cifra) > 0 ? Number(cifra) : null
}

/** Una pintura sirve para cotizar en cuanto tiene al menos una tarifa puesta. */
export const tieneTarifas = (p: ProductoTarifado) =>
  NIVELES_PRECIO.some((n) => precioPorNivel(p, n.valor) != null)

/**
 * Las pinturas cotizables, agrupadas por marca.
 *
 * El catálogo entero no cabe en botones: sólo las que ya tienen tarifa. Si
 * todavía no se ha capturado ninguna, esto sale vacío y el selector no se
 * pinta, así que la cotización sigue funcionando como siempre.
 *
 * Con `soloConTarifa: false` entran todas las pinturas activas: el sellador o
 * el impermeabilizante de un bullet no siempre tienen tarifa por metro.
 */
export function pinturasPorMarca(productos: Producto[], { soloConTarifa = true } = {}) {
  const grupos = new Map<string, Producto[]>()
  for (const p of productos) {
    if (p.tipo !== 'pintura' || !p.activo || (soloConTarifa && !tieneTarifas(p))) continue
    const marca = p.marca?.trim() || 'Sin marca'
    grupos.set(marca, [...(grupos.get(marca) ?? []), p])
  }
  return [...grupos.entries()].map(([marca, pinturas]) => ({ marca, pinturas }))
}

/** Fecha de hoy en formato ISO, respetando el día local de Hermosillo. */
export function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Notas al pie del PDF, tal como salen hoy en la carta. */
export function notasCotizacion(
  anticipoPct: number,
  vigenciaDias: number,
  conIva = true,
): string[] {
  return [
    ...(conIva ? ['*Precios más IVA'] : []),
    `*Anticipo ${Math.round(anticipoPct)}% para iniciar trabajo, resto al finalizar`,
    '*Trabajo Garantizado.',
    `*Vigencia de cotización ${vigenciaDias} días`,
  ]
}
