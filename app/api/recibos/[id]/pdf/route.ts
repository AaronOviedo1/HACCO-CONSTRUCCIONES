import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { responderPdf } from '@/lib/pdf'
import {
  DocumentoRecibo, DocumentoReciboPago,
  type DatosRecibo, type DatosReciboPago,
} from '@/components/documentos/documentos-pdf'
import type { MetodoPago } from '@/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  caja_chica: 'Caja chica', // en cobros no se ofrece; el tipo pide el mapa completo
  tarjeta_empresa: 'Tarjeta',
  transferencia: 'Transferencia electrónica',
  cheque: 'Cheque',
  deposito: 'Depósito bancario',
}

export async function GET(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: recibo } = await supabase.from('recibos').select('*').eq('id', id).maybeSingle()
  if (!recibo) return new Response('Recibo no encontrado', { status: 404 })

  const [{ data: cobranza }, { data: cotizacion }, { data: pago }, { data: obra }] =
    await Promise.all([
      supabase.from('v_cobranza').select('*').eq('cotizacion_id', recibo.cotizacion_id).maybeSingle(),
      supabase.from('cotizaciones').select('*').eq('id', recibo.cotizacion_id).maybeSingle(),
      recibo.pago_id
        ? supabase.from('pagos_cobranza').select('*').eq('id', recibo.pago_id).maybeSingle()
        : Promise.resolve({ data: null }),
      recibo.obra_id
        ? supabase.from('obras').select('*').eq('id', recibo.obra_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  const { data: cliente } = cotizacion
    ? await supabase.from('clientes').select('*').eq('id', cotizacion.cliente_id).maybeSingle()
    : { data: null }

  const monto = Number(pago?.monto ?? 0)
  const total = Number(cobranza?.cotizado ?? cotizacion?.total ?? 0)
  const nombreCliente = cliente?.nombre ?? 'Cliente'
  // El saldo se toma del estado actual de la cobranza, no de una foto vieja.
  const saldo = Number(cobranza?.saldo ?? total - monto)

  // El acuse de pago: media cuartilla, sin esquema ni firmas, para mandárselo
  // al cliente el mismo día. El recibo-contrato del anticipo sigue abajo.
  if (recibo.tipo === 'pago') {
    const datosPago: DatosReciboPago = {
      folio: recibo.folio ?? 'S/F',
      fecha: pago?.fecha ?? recibo.created_at,
      cliente: nombreCliente,
      tituloCortesia: cliente?.titulo_cortesia ?? null,
      domicilio: cotizacion?.domicilio_obra ?? cliente?.domicilio ?? null,
      metodoPago: pago ? METODO[pago.metodo] : '—',
      cotizacionFolio: cotizacion?.folio ?? '—',
      concepto: recibo.concepto,
      monto,
      totalCotizacion: total,
      pagadoAcumulado: Number(cobranza?.cobrado ?? monto),
      saldoPendiente: saldo,
      obra: obra?.nombre ?? cotizacion?.nombre_obra ?? null,
    }

    return responderPdf(
      DocumentoReciboPago,
      { datos: datosPago },
      `Recibo de pago ${datosPago.folio} - ${datosPago.cliente}.pdf`,
      peticion,
    )
  }

  const datos: DatosRecibo = {
    folio: recibo.folio ?? 'S/F',
    fecha: pago?.fecha ?? recibo.created_at,
    cliente: nombreCliente,
    tituloCortesia: cliente?.titulo_cortesia ?? null,
    domicilio: cotizacion?.domicilio_obra ?? cliente?.domicilio ?? null,
    telefono: cliente?.telefono ?? null,
    correo: cliente?.correo ?? null,
    metodoPago: pago ? METODO[pago.metodo] : '—',
    cotizacionFolio: cotizacion?.folio ?? '—',
    concepto: recibo.concepto,
    monto,
    totalCotizacion: total,
    saldoPendiente: saldo,
    esquemaPagos: recibo.esquema_pagos,
    fechaInicio: recibo.fecha_inicio,
    fechaEstimadaEntrega: recibo.fecha_estimada_entrega,
    datosBancarios: recibo.datos_bancarios,
    obra: obra?.nombre ?? cotizacion?.nombre_obra ?? null,
  }

  return responderPdf(
    DocumentoRecibo,
    { datos },
    `Recibo ${datos.folio} - ${datos.cliente}.pdf`,
    peticion,
  )
}
