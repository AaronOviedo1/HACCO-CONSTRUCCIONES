import { redondear } from '@/lib/cotizaciones'
import type { CategoriaGasto, MetodoPago } from '@/types/database'

/** Un artículo del ticket, ya cuadrado. */
export type RenglonTicket = {
  descripcion: string
  piezas: number
  /** El neto de ese renglón: su importe, menos su descuento y más su IVA. */
  monto: number
  /**
   * Qué producto del catálogo es, si se reconoció. Es lo que convierte el
   * renglón de una factura en el precio vigente de ese material.
   */
  producto_id: string | null
}

/** Un artículo tal como viene impreso, antes de sacarle el neto. */
export type RenglonLeido = {
  descripcion: string
  piezas: number
  /** El importe del renglón según el comprobante, sin descuento ni impuesto. */
  importe: number
  producto_id: string | null
  /** El descuento de ese renglón, cuando el comprobante lo desglosa así. */
  descuento: number | null
  /** El IVA de ese renglón, cuando el comprobante lo desglosa así. */
  impuesto: number | null
}

/** Las cifras del pie del comprobante, tal como están impresas. */
export type DesgloseComprobante = {
  subtotal: number | null
  /** La suma de los descuentos, en positivo. */
  descuento: number | null
  /** El IVA. */
  impuesto: number | null
  total: number | null
}

/** Lo que devuelve el cuadre: los netos y si la cuenta cerró. */
export type CuadreRenglones = {
  renglones: RenglonTicket[]
  /** Si la suma de los netos dio el total leído, o si no había total con qué comparar. */
  cuadra: boolean
  /** Lo que sobró o faltó contra el total. Cero cuando cuadra o cuando no hay total. */
  diferencia: number
}

/** Lo que la foto de un comprobante puede llenar del formulario de gasto. */
export type LecturaTicket = {
  descripcion: string | null
  piezas: number | null
  /** El total del comprobante: el descuento ya restado y el IVA ya sumado. */
  monto: number | null
  /** Los artículos del ticket; con dos o más el formulario se divide en conceptos. */
  renglones: RenglonTicket[]
  /** El pie del comprobante, para enseñarlo y comparar. Null si no traía ni una cifra. */
  desglose: DesgloseComprobante | null
  metodo: MetodoPago | null
  categoria: CategoriaGasto | null
  folio: string | null
  fecha: string | null
  proveedor_id: string | null
  /** El producto del catálogo cuando el ticket es de un solo artículo. */
  producto_id: string | null
  /** Frase corta cuando la foto salió mal o no es un comprobante. */
  aviso: string | null
}

/**
 * Saca el neto de cada renglón: lo que de verdad se pagó por ese artículo.
 *
 * El importe que trae impreso una factura es el bruto —sin descuento y sin
 * IVA—, así que sumar importes da el subtotal, no el total. Aquí cada renglón
 * se lleva su descuento y su impuesto para que la suma de las casillas del
 * formulario sea, al centavo, lo que se pagó.
 *
 * En orden: lo que el comprobante desglosa renglón por renglón manda; lo que
 * sólo viene al pie se reparte; y si aun así sobran o faltan unos centavos de
 * redondeo, se cargan al renglón más grande. Cuando la diferencia es de verdad
 * no se fuerza nada: los netos van como salieron y el formulario avisa para que
 * se revisen contra el papel.
 */
export function cuadrarRenglones(
  leidos: RenglonLeido[],
  desglose: DesgloseComprobante,
): CuadreRenglones {
  if (leidos.length === 0) return { renglones: [], cuadra: true, diferencia: 0 }

  const bruto = leidos.reduce((s, r) => s + r.importe, 0)

  // Se decide campo por campo, no renglón por renglón: hay comprobantes que
  // traen el descuento en su columna pero el IVA en una sola línea al pie.
  const conDescuento = leidos.some((r) => r.descuento !== null)
  const conImpuesto = leidos.some((r) => r.impuesto !== null)

  const descuentoPie = conDescuento ? 0 : (desglose.descuento ?? 0)
  const impuestoPie = conImpuesto ? 0 : (desglose.impuesto ?? 0)

  // El descuento del pie se reparte en proporción al importe bruto, que es
  // sobre lo que se calcula.
  const descuentos = leidos.map((r) =>
    conDescuento ? (r.descuento ?? 0) : bruto > 0 ? descuentoPie * (r.importe / bruto) : 0,
  )
  const bases = leidos.map((r, i) => r.importe - descuentos[i])
  const baseTotal = bases.reduce((s, b) => s + b, 0)

  // El IVA del pie se reparte en proporción a la BASE, no al bruto: el impuesto
  // se calcula sobre lo que queda después del descuento. Repartirlo sobre el
  // bruto desviaría los renglones cuando los descuentos son de porcentajes
  // distintos, aunque el total siguiera cuadrando.
  const netos = leidos.map((r, i) => {
    const impuesto = conImpuesto
      ? (r.impuesto ?? 0)
      : baseTotal > 0
        ? impuestoPie * (bases[i] / baseTotal)
        : 0
    // Un solo redondeo sobre la cuenta completa: descuento, base e impuesto son
    // cifras intermedias y encadenar sus redondeos podría desviar un peso.
    return redondear(bases[i] + impuesto)
  })

  const armar = (montos: number[]): RenglonTicket[] =>
    leidos.map((r, i) => ({
      descripcion: r.descripcion,
      piezas: r.piezas,
      monto: montos[i],
      producto_id: r.producto_id,
    }))

  // Sin un total legible no hay contra qué cuadrar: los netos van como salieron.
  if (desglose.total === null) return { renglones: armar(netos), cuadra: true, diferencia: 0 }

  const diferencia = redondear(desglose.total - netos.reduce((s, n) => s + n, 0))

  // Un centavo por renglón —más el del propio total— es lo más que puede
  // desviar el redondeo. Ese sobrante se carga al renglón de mayor neto, que es
  // donde menos se nota y donde no puede voltear en negativo a un renglón chico.
  const tolerancia = Math.max(0.05, redondear(0.01 * (leidos.length + 1)))
  if (diferencia !== 0 && Math.abs(diferencia) <= tolerancia) {
    const mayor = netos.reduce((mejor, n, i) => (n > netos[mejor] ? i : mejor), 0)
    netos[mayor] = redondear(netos[mayor] + diferencia)
    return { renglones: armar(netos), cuadra: true, diferencia: 0 }
  }

  return { renglones: armar(netos), cuadra: diferencia === 0, diferencia }
}

/** Lado largo al que se reduce la foto: más allá de esto el modelo no lee mejor. */
const LADO = 1568

/**
 * Deja la foto lista para viajar.
 *
 * Una foto de teléfono son 4 o 6 MB y tarda en subir con la señal de la obra;
 * reducida a 1568 px pesa una fracción y se lee igual de bien. Los PDF van tal
 * cual, y si el navegador no puede abrir el formato (HEIC viejo, por ejemplo)
 * se manda el original y que decida el servidor.
 */
export async function prepararTicket(archivo: File): Promise<Blob> {
  if (archivo.type === 'application/pdf') return archivo

  try {
    // Las fotos verticales traen la rotación en los metadatos: sin esto llegan
    // acostadas y el modelo lee mucho peor.
    const mapa = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
    const escala = Math.min(1, LADO / Math.max(mapa.width, mapa.height))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(mapa.width * escala)
    lienzo.height = Math.round(mapa.height * escala)

    const pincel = lienzo.getContext('2d')
    if (!pincel) return archivo
    pincel.drawImage(mapa, 0, 0, lienzo.width, lienzo.height)
    mapa.close()

    const jpeg = await new Promise<Blob | null>((listo) =>
      lienzo.toBlob(listo, 'image/jpeg', 0.82),
    )
    return jpeg ?? archivo
  } catch {
    return archivo
  }
}
