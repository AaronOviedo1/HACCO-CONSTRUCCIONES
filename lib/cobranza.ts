import { redondear } from '@/lib/cotizaciones'
import type { MetodoPago } from '@/types/database'

/**
 * La forma de pago como se escribe en lo que lee el cliente —el recibo y el
 * estado de cuenta—. No es `METODO_PAGO` de lib/finanzas a propósito: aquí va
 * la redacción formal («Transferencia electrónica», «Depósito bancario»),
 * mientras que las pantallas usan la corta.
 */
export const METODO_PAGO_FORMAL: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  caja_chica: 'Caja chica', // en cobros no se ofrece; el tipo pide el mapa completo
  tarjeta_empresa: 'Tarjeta',
  transferencia: 'Transferencia electrónica',
  cheque: 'Cheque',
  deposito: 'Depósito bancario',
}

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

/** Lo que un cliente debe, sumando todas sus obras y reparaciones con saldo. */
export type DeudaCliente = {
  clienteId: string
  cliente: string
  /** Cuántas obras (cotizaciones) y reparaciones tienen saldo. */
  cuentas: number
  cotizado: number
  cobrado: number
  saldo: number
  /** La fecha de la cuenta pendiente más vieja: de cuándo viene el adeudo. */
  desde: string
}

/**
 * La cobranza vista por cliente: un renglón por quien debe, con todas sus
 * cuentas abiertas sumadas. Es lo que respalda el estado de cuenta, que junta
 * en un solo papel todas las obras que un cliente tiene pendientes.
 *
 * Sólo entra lo que tiene saldo. Lo que el cliente pagó de más en otra obra no
 * se resta aquí, por lo mismo que en `resumenCobranza`: el estado de cuenta lo
 * dice aparte.
 */
export function deudaPorCliente(
  filas: { cliente_id: string; cliente: string; cotizado: number; cobrado: number; saldo: number; fecha: string }[],
): DeudaCliente[] {
  const porCliente = new Map<string, DeudaCliente>()
  for (const f of filas) {
    if (Number(f.saldo) <= 0) continue
    const previo = porCliente.get(f.cliente_id) ?? {
      clienteId: f.cliente_id, cliente: f.cliente, cuentas: 0, cotizado: 0, cobrado: 0, saldo: 0, desde: f.fecha,
    }
    previo.cuentas++
    previo.cotizado += Number(f.cotizado)
    previo.cobrado += Number(f.cobrado)
    previo.saldo += Number(f.saldo)
    if (f.fecha < previo.desde) previo.desde = f.fecha
    porCliente.set(f.cliente_id, previo)
  }
  return [...porCliente.values()]
    .map((d) => ({ ...d, cotizado: redondear(d.cotizado), cobrado: redondear(d.cobrado), saldo: redondear(d.saldo) }))
    .sort((a, b) => b.saldo - a.saldo)
}

/**
 * Cómo se llama el pago en el papel que se le manda al cliente.
 *
 * Vive aquí y no en el diálogo porque el recibo se emite desde dos lados —al
 * registrar el pago y después, sobre un pago viejo que no lo llevaba— y en los
 * dos tiene que decir lo mismo. El concepto se puede escribir a mano encima;
 * esto es nada más con lo que abre.
 */
export function conceptoDePago(
  tipo: 'anticipo' | 'abono' | 'liquidacion',
  folio: string | null,
): string {
  const que =
    tipo === 'anticipo' ? 'Anticipo' : tipo === 'liquidacion' ? 'Liquidación' : 'Abono'
  return folio ? `${que} de la cotización ${folio}` : que
}
