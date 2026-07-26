import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { responderPdf } from '@/lib/pdf'
import { METODO_PAGO, TIPO_DEDUCCION } from '@/lib/finanzas'
import {
  DocumentoReciboNomina, type DatosReciboNomina,
} from '@/components/documentos/recibo-nomina-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OFICIO: Record<string, string> = {
  pintor: 'Pintor',
  herrero: 'Herrero',
  ayudante: 'Ayudante',
  otro: 'Oficial',
}

export async function GET(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: recibo } = await supabase
    .from('recibos_nomina')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!recibo) return new Response('Recibo no encontrado', { status: 404 })

  const [{ data: trabajador }, { data: pagos }, { data: deducciones }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', recibo.trabajador_id).maybeSingle(),
    supabase.from('nomina_pagos').select('*').eq('recibo_id', id),
    supabase.from('deducciones').select('*').eq('recibo_id', id),
  ])

  const idsContrato = (pagos ?? []).map((p) => p.contrato_id)
  const { data: contratos } = idsContrato.length
    ? await supabase.from('v_nomina_contratos').select('*').in('contrato_id', idsContrato)
    : { data: [] }

  const porContrato = new Map((contratos ?? []).map((c) => [c.contrato_id, c]))

  const datos: DatosReciboNomina = {
    folio: recibo.folio ?? 'S/F',
    fecha: recibo.fecha,
    trabajador: trabajador?.nombre ?? 'Trabajador',
    oficio: OFICIO[trabajador?.oficio ?? 'otro'] ?? 'Oficial',
    metodo: METODO_PAGO[recibo.metodo],
    renglones: (pagos ?? []).map((p) => {
      const c = porContrato.get(p.contrato_id)
      return {
        obra: c?.obra ?? 'Obra',
        otNumero: c?.ot_numero ?? null,
        importe: Number(p.monto),
        porcentaje: p.porcentaje_del_pago == null ? null : Number(p.porcentaje_del_pago),
      }
    }),
    deducciones: (deducciones ?? []).map((d) => ({
      tipo: TIPO_DEDUCCION[d.tipo],
      monto: Number(d.monto),
      notas: d.notas,
    })),
    subtotal: Number(recibo.subtotal),
    totalDeducciones: Number(recibo.deducciones),
    total: Number(recibo.total),
    notas: recibo.notas,
  }

  return responderPdf(
    DocumentoReciboNomina,
    { datos },
    `Recibo ${datos.folio} - ${datos.trabajador}.pdf`,
    peticion,
  )
}
