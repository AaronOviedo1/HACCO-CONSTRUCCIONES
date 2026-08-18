import { redondear } from '@/lib/cotizaciones'
import { REGLAS } from '@/lib/empresa'
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
  /**
   * Si el papel dice que el IVA ya viene dentro de los precios («Impuesto
   * Incl.»). Null cuando no lo dice de ninguna forma.
   */
  impuesto_incluido?: boolean | null
  /**
   * Si el descuento impreso ya venía rebajado de los importes, en vez de estar
   * por restarse. No lo dice el papel: lo concluye el cuadre y se guarda aquí
   * para poder enseñarlo. Null cuando el comprobante no traía descuento.
   */
  descuento_incluido?: boolean | null
}

/** Lo que devuelve el cuadre: los netos y si la cuenta cerró. */
export type CuadreRenglones = {
  renglones: RenglonTicket[]
  /** Si la suma de los netos dio el total leído, o si no había total con qué comparar. */
  cuadra: boolean
  /** Lo que sobró o faltó contra el total. Cero cuando cuadra o cuando no hay total. */
  diferencia: number
  /** Si el descuento impreso se tomó como ya rebajado. Null sin descuento que decidir. */
  descuento_incluido: boolean | null
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
 * El importe que trae impreso una factura es, casi siempre, el bruto —sin
 * descuento y sin IVA—, así que sumar importes da el subtotal, no el total.
 * Aquí cada renglón se lleva su descuento y su impuesto para que la suma de las
 * casillas del formulario sea, al centavo, lo que se pagó.
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
  if (leidos.length === 0)
    return { renglones: [], cuadra: true, diferencia: 0, descuento_incluido: null }

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
  const descuentoTotal = descuentos.reduce((s, d) => s + d, 0)

  // El IVA del pie se reparte en proporción a la BASE, no al bruto: el impuesto
  // se calcula sobre lo que queda después del descuento. Repartirlo sobre el
  // bruto desviaría los renglones cuando los descuentos son de porcentajes
  // distintos, aunque el total siguiera cuadrando.
  const netosCon = (restarDescuento: boolean, sumarImpuesto: boolean) => {
    const bases = leidos.map((r, i) => (restarDescuento ? r.importe - descuentos[i] : r.importe))
    const baseTotal = bases.reduce((s, b) => s + b, 0)
    return leidos.map((r, i) => {
      const impuesto = !sumarImpuesto
        ? 0
        : conImpuesto
          ? (r.impuesto ?? 0)
          : baseTotal > 0
            ? impuestoPie * (bases[i] / baseTotal)
            : 0
      // Un solo redondeo sobre la cuenta completa: descuento, base e impuesto son
      // cifras intermedias y encadenar sus redondeos podría desviar un peso.
      return redondear(bases[i] + impuesto)
    })
  }

  const hayDescuento = conDescuento ? leidos.some((r) => (r.descuento ?? 0) > 0) : descuentoPie > 0
  const hayImpuesto = conImpuesto ? leidos.some((r) => (r.impuesto ?? 0) > 0) : impuestoPie > 0
  const impuestoImpreso = conImpuesto
    ? leidos.reduce((s, r) => s + (r.impuesto ?? 0), 0)
    : impuestoPie

  // Un centavo por renglón —más el del propio total— es lo más que puede
  // desviar el redondeo del papel.
  const tolerancia = Math.max(0.05, redondear(0.01 * (leidos.length + 1)))

  /*
   * Dos preguntas que el papel no contesta y hay que sacar de la cuenta:
   *
   * ¿El IVA ya venía dentro de los precios? La tienda de mostrador imprime
   * «Impuesto Incl.» y sus precios ya lo traen; la factura lo lista aparte y
   * hay que sumarlo. Tratar el primero como el segundo infla el gasto un
   * dieciséis por ciento, y encima reparte de más en cada renglón.
   *
   * ¿Y el descuento, está por restarse o ya viene rebajado? Hay comprobantes
   * —el «Ahorro por promoción» de las tiendas de pintura— donde los importes de
   * los renglones YA traen la rebaja y la cifra del pie nada más la presume.
   * Restarla otra vez deja el gasto corto por el monto entero del descuento, y
   * de ahí sale bajo el costo del material con el que después se cotiza.
   *
   * Ninguna de las dos se decide por el texto —que a veces ni se alcanza a leer
   * en la foto— sino por la cuenta, y en este orden:
   *
   *   1. El total impreso, que es la cifra que se firma y por lo tanto la que
   *      manda: se prueban las cuatro combinaciones y gana la que llega a él.
   *   2. Sin total legible, el IVA contra la tasa: el impuesto se calcula sobre
   *      la base final, así que revela si esa base es el bruto —descuento ya
   *      dentro— o el bruto menos el descuento.
   *   3. Y si tampoco hay IVA, el subtotal impreso, cuando difiere de la suma
   *      de los importes por exactamente el descuento.
   *   4. Lo que quede sin resolver se lee al pie de la letra: el descuento se
   *      resta y del IVA se cree lo que el papel haya dicho.
   */
  let restarDescuento = true
  let sumarImpuesto = !(hayImpuesto && desglose.impuesto_incluido === true)

  if (desglose.total !== null) {
    const lejosDelTotal = (d: boolean, i: boolean) =>
      Math.abs(desglose.total! - netosCon(d, i).reduce((s, n) => s + n, 0))

    // La lectura literal se mide primero y la comparación es estricta: así los
    // empates los gana lo que dice el papel y ningún comprobante de los que hoy
    // cuadran cambia de cuenta. Cada dimensión sólo entra si está en juego.
    let mejor = lejosDelTotal(restarDescuento, sumarImpuesto)
    for (const d of hayDescuento ? [true, false] : [restarDescuento]) {
      for (const i of hayImpuesto ? [true, false] : [sumarImpuesto]) {
        const distancia = lejosDelTotal(d, i)
        if (distancia < mejor) {
          mejor = distancia
          restarDescuento = d
          sumarImpuesto = i
        }
      }
    }
  } else if (hayDescuento) {
    const tasa = REGLAS.ivaPct / 100
    const sinRestar = Math.abs(impuestoImpreso - bruto * tasa)
    const restando = Math.abs(impuestoImpreso - (bruto - descuentoTotal) * tasa)

    if (hayImpuesto && Math.min(sinRestar, restando) <= tolerancia) {
      // El IVA impreso sólo puede salir de una de las dos bases; la que no
      // acierta se va por el monto del descuento, que nunca son centavos.
      restarDescuento = restando < sinRestar
    } else if (desglose.subtotal !== null) {
      // Un subtotal que iguala la suma de los importes no distingue nada: pasa
      // igual si el descuento está por restarse que si ya venía rebajado. Sólo
      // dice algo cuando se separa de esa suma por el descuento entero.
      if (Math.abs(desglose.subtotal - (bruto + descuentoTotal)) <= tolerancia) {
        // El subtotal es el de lista y los importes ya vienen rebajados.
        restarDescuento = false
      } else if (Math.abs(desglose.subtotal - (bruto - descuentoTotal)) <= tolerancia) {
        // El subtotal ya trae el descuento aplicado y los importes son brutos.
        restarDescuento = true
      }
    }
  }

  const netos = netosCon(restarDescuento, sumarImpuesto)
  const descuento_incluido = hayDescuento ? !restarDescuento : null

  const armar = (montos: number[]): CuadreRenglones => ({
    renglones: leidos.map((r, i) => ({
      descripcion: r.descripcion,
      piezas: r.piezas,
      monto: montos[i],
      producto_id: r.producto_id,
    })),
    cuadra: true,
    diferencia: 0,
    descuento_incluido,
  })

  // Sin un total legible no hay contra qué cuadrar: los netos van como salieron.
  if (desglose.total === null) return armar(netos)

  const diferencia = redondear(desglose.total - netos.reduce((s, n) => s + n, 0))

  // El sobrante del redondeo se carga al renglón de mayor neto, que es donde
  // menos se nota y donde no puede voltear en negativo a un renglón chico.
  if (diferencia !== 0 && Math.abs(diferencia) <= tolerancia) {
    const mayor = netos.reduce((mejor, n, i) => (n > netos[mejor] ? i : mejor), 0)
    netos[mayor] = redondear(netos[mayor] + diferencia)
    return armar(netos)
  }

  return { ...armar(netos), cuadra: diferencia === 0, diferencia }
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
