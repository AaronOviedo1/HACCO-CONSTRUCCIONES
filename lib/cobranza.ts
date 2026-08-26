import { redondear } from '@/lib/cotizaciones'

/**
 * La cuenta de la cobranza, en un solo lugar.
 *
 * Vivía copiada en el panel, en la pantalla de cobranza y en la de dinero, y
 * las tres habían ido separándose: el panel contaba nada más lo aprobado y
 * terminado, la cobranza sumaba además lo que ya tiene obra, y los anticipos
 * pendientes salían distintos en cada una. Dos pantallas que dicen números
 * distintos de lo mismo no se corrigen una vez: se corrigen cada vez que
 * alguien toca una de las dos, así que la cuenta se hace aquí y allá sólo se
 * enseña.
 */

/**
 * Lo que hace falta para sacar los totales, dicho por forma y no por tabla.
 *
 * Lo cumple una fila de `v_cobranza` y también una de `v_servicios`: una
 * reparación se cobra distinto que una obra, pero el dinero se cuenta igual, y
 * dos funciones que suman lo mismo acaban dando números distintos. Lo único
 * que no tienen los servicios es el anticipo —se cobran al terminar—, por eso
 * esos dos campos son opcionales.
 */
export type FilaCobranza = {
  estatus: string
  cotizado: number
  cobrado: number
  saldo: number
  anticipo?: number | null
  anticipo_esperado?: number | null
}

/**
 * El dinero que se persigue: lo aprobado, lo terminado y lo que ya tiene obra
 * abierta aunque la cotización haya regresado a borrador para editarse. Si la
 * obra arrancó, su dinero se sigue cobrando.
 */
export function cobranzaViva<T extends { cotizacion_id: string; estatus: string }>(
  filas: T[],
  conObra: Set<string>,
): T[] {
  return filas.filter(
    (c) => c.estatus === 'aprobada' || c.estatus === 'terminada' || conObra.has(c.cotizacion_id),
  )
}

/** Los totales de la cobranza, ya con los sobrepagos apartados. */
export type ResumenCobranza = {
  /** Lo que deben, que es la suma de los saldos positivos y nada más. */
  porCobrar: number
  /** Lo que algún cliente pagó de más, en positivo. Se dice aparte, no se resta. */
  sobrepagos: number
  /** Cuántas cotizaciones tienen saldo a favor del cliente. */
  cuantosSobrepagos: number
  /** El dinero recibido. */
  cobrado: number
  /** El total contratado: la suma de lo cotizado. */
  contratado: number
  /** Qué tanto del contratado ya se cobró, de 0 a 100. */
  pctCobrado: number
  /** Lo que falta por cobrar de anticipos, sólo de las obras aprobadas. */
  anticiposPendientes: number
}

/**
 * Saca los totales de un montón de filas de cobranza.
 *
 * Los sobrepagos no restan. Un cliente que pagó de más no cancela la deuda de
 * otro, y restarlo dejaba el total sin coincidir con sumar a mano los renglones
 * de la lista —que es justo la comprobación que hace quien cobra—. Se cuentan
 * aparte para poder decirlos.
 *
 * El porcentaje se saca contra lo contratado y no contra `cobrado + porCobrar`:
 * con los sobrepagos ya fuera del saldo, esa suma dejó de ser el total del
 * contrato y el porcentaje bajaba sin que nada hubiera cambiado en la realidad.
 */
export function resumenCobranza(filas: FilaCobranza[]): ResumenCobranza {
  let porCobrar = 0
  let sobrepagos = 0
  let cuantosSobrepagos = 0
  let cobrado = 0
  let contratado = 0
  let anticiposPendientes = 0

  for (const c of filas) {
    const saldo = Number(c.saldo ?? 0)
    if (saldo > 0) porCobrar += saldo
    else if (saldo < 0) {
      sobrepagos -= saldo
      cuantosSobrepagos++
    }
    cobrado += Number(c.cobrado ?? 0)
    contratado += Number(c.cotizado ?? 0)

    // Sólo de las aprobadas: en una obra terminada el anticipo ya no tiene
    // sentido perseguirlo, y lo que quedara debiendo ya está en «por cobrar».
    const falta = Number(c.anticipo_esperado ?? 0) - Number(c.anticipo ?? 0)
    if (c.estatus === 'aprobada' && falta > 0) anticiposPendientes += falta
  }

  return {
    porCobrar: redondear(porCobrar),
    sobrepagos: redondear(sobrepagos),
    cuantosSobrepagos,
    cobrado: redondear(cobrado),
    contratado: redondear(contratado),
    pctCobrado: contratado > 0 ? Math.min(100, Math.round((cobrado / contratado) * 100)) : 0,
    anticiposPendientes: redondear(anticiposPendientes),
  }
}
