import 'server-only'
import { crearClienteServidor } from '@/lib/supabase/server'
import { redondear } from '@/lib/cotizaciones'
import { hoyHermosillo } from '@/lib/format'
import { TIPO_PAGO_COBRANZA } from '@/lib/finanzas'
import { METODO_PAGO_FORMAL, cobranzaViva } from '@/lib/cobranza'
import { serviciosCobrables } from '@/lib/servicios'

/**
 * El estado de cuenta de un cliente: todas sus obras y reparaciones que
 * todavía deben algo, en un solo papel.
 *
 * Lo pidió la oficina para los clientes que tienen varias obras aprobadas a la
 * vez: mandarles un recibo por obra no les dice cuánto deben en total, y eso
 * es justo lo que preguntan. El criterio de qué se cobra es el mismo de la
 * pantalla de cobranza —`cobranzaViva` y `serviciosCobrables`—, para que el
 * total del papel coincida con el renglón del cliente.
 */

export type MovimientoEstadoCuenta = {
  fecha: string
  concepto: string
  forma: string
  monto: number
}

export type CuentaEstadoCuenta = {
  clave: string
  /** El folio de la cotización o del servicio. */
  folio: string | null
  /** Lo que se lee primero: el nombre de la obra o la descripción del servicio. */
  titulo: string
  fecha: string
  domicilio: string | null
  cotizado: number
  cobrado: number
  saldo: number
  pagos: MovimientoEstadoCuenta[]
}

export type DatosEstadoCuenta = {
  /** El día al que se corta la cuenta. */
  fecha: string
  cliente: string
  tituloCortesia: string | null
  domicilio: string | null
  telefono: string | null
  cuentas: CuentaEstadoCuenta[]
  total: { cotizado: number; cobrado: number; saldo: number }
  /** Lo que el cliente pagó de más en cuentas ya saldadas. Se dice, no se resta. */
  saldoAFavor: number
}

export async function cargarEstadoDeCuenta(clienteId: string): Promise<DatosEstadoCuenta | null> {
  const supabase = await crearClienteServidor()

  const { data: cliente } = await supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle()
  if (!cliente) return null

  const [{ data: cobranza }, { data: servicios }] = await Promise.all([
    supabase.from('v_cobranza').select('*').eq('cliente_id', clienteId).order('fecha'),
    supabase.from('v_servicios').select('*').eq('cliente_id', clienteId).order('fecha_visita'),
  ])

  const cotizacionIds = (cobranza ?? []).map((c) => c.cotizacion_id)
  const servicioIds = (servicios ?? []).map((s) => s.servicio_id)

  // Un cliente sin cotizaciones o sin servicios no pregunta nada: un `in` vacío
  // es una consulta que no hace falta mandar.
  const vacio = { data: [] }
  const [{ data: obras }, { data: cotizaciones }, { data: pagos }, { data: pagosServicio }] =
    await Promise.all([
      cotizacionIds.length
        ? supabase.from('obras').select('cotizacion_id, nombre').in('cotizacion_id', cotizacionIds)
        : vacio,
      cotizacionIds.length
        ? supabase.from('cotizaciones').select('id, nombre_obra, domicilio_obra').in('id', cotizacionIds)
        : vacio,
      cotizacionIds.length
        ? supabase.from('pagos_cobranza').select('*').in('cotizacion_id', cotizacionIds).order('fecha')
        : vacio,
      servicioIds.length
        ? supabase.from('servicio_pagos').select('*').in('servicio_id', servicioIds).order('fecha')
        : vacio,
    ])

  const conObra = new Set((obras ?? []).map((o) => o.cotizacion_id))
  const vivas = cobranzaViva(cobranza ?? [], conObra)
  const cotizacion = new Map((cotizaciones ?? []).map((c) => [c.id, c]))

  const obrasCuentas: CuentaEstadoCuenta[] = vivas
    .filter((c) => Number(c.saldo) > 0)
    .map((c) => {
      const suyas = (obras ?? []).filter((o) => o.cotizacion_id === c.cotizacion_id)
      const cot = cotizacion.get(c.cotizacion_id)
      return {
        clave: c.cotizacion_id,
        folio: c.folio,
        titulo:
          suyas.map((o) => o.nombre).join(' · ') || cot?.nombre_obra || `Cotización ${c.folio ?? ''}`.trim(),
        fecha: c.fecha,
        domicilio: cot?.domicilio_obra ?? null,
        cotizado: Number(c.cotizado),
        cobrado: Number(c.cobrado),
        saldo: Number(c.saldo),
        pagos: (pagos ?? [])
          .filter((p) => p.cotizacion_id === c.cotizacion_id)
          .map((p) => ({
            fecha: p.fecha,
            concepto: TIPO_PAGO_COBRANZA[p.tipo],
            forma: METODO_PAGO_FORMAL[p.metodo],
            monto: Number(p.monto),
          })),
      }
    })

  const serviciosCuentas: CuentaEstadoCuenta[] = serviciosCobrables(servicios ?? [])
    .filter((s) => Number(s.saldo) > 0)
    .map((s) => ({
      clave: s.servicio_id,
      folio: s.folio,
      titulo: s.descripcion,
      fecha: s.fecha_visita,
      domicilio: s.domicilio,
      cotizado: Number(s.cotizado),
      cobrado: Number(s.cobrado),
      saldo: Number(s.saldo),
      pagos: (pagosServicio ?? [])
        .filter((p) => p.servicio_id === s.servicio_id)
        .map((p) => ({
          fecha: p.fecha,
          concepto: 'Pago',
          forma: METODO_PAGO_FORMAL[p.metodo],
          monto: Number(p.monto),
        })),
    }))

  // De la más vieja a la más nueva: así se lee de dónde viene el adeudo.
  const cuentas = [...obrasCuentas, ...serviciosCuentas].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const saldoAFavor = [
    ...vivas.map((c) => Number(c.saldo)),
    ...serviciosCobrables(servicios ?? []).map((s) => Number(s.saldo)),
  ].reduce((suma, saldo) => (saldo < 0 ? suma - saldo : suma), 0)

  return {
    fecha: hoyHermosillo(),
    cliente: cliente.nombre,
    tituloCortesia: cliente.titulo_cortesia,
    domicilio: cliente.domicilio,
    telefono: cliente.telefono,
    cuentas,
    total: {
      cotizado: redondear(cuentas.reduce((s, c) => s + c.cotizado, 0)),
      cobrado: redondear(cuentas.reduce((s, c) => s + c.cobrado, 0)),
      saldo: redondear(cuentas.reduce((s, c) => s + c.saldo, 0)),
    },
    saldoAFavor: redondear(saldoAFavor),
  }
}
