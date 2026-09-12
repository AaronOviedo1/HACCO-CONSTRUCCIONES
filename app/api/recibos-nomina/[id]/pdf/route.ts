import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { responderPdf } from '@/lib/pdf'
import { METODO_PAGO, TIPO_DEDUCCION, etiquetaSemana } from '@/lib/finanzas'
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

  /*
   * Un renglón abona a un contrato de obra o a la raya de una semana, nunca a
   * los dos. Los ids se separan antes de preguntar: pedir `in ('contrato_id',
   * [null])` no devuelve nada y el renglón saldría en el recibo como una
   * «Obra» sin nombre, que es lo último que se quiere en el papel que firma
   * el trabajador.
   */
  const idsContrato = (pagos ?? []).map((p) => p.contrato_id).filter((id): id is string => Boolean(id))
  const idsRaya = (pagos ?? []).map((p) => p.raya_id).filter((id): id is string => Boolean(id))

  const [{ data: contratos }, { data: rayas }] = await Promise.all([
    idsContrato.length
      ? supabase.from('v_nomina_contratos').select('*').in('contrato_id', idsContrato)
      : Promise.resolve({ data: [] }),
    idsRaya.length
      ? supabase.from('v_rayas_semanales').select('*').in('raya_id', idsRaya)
      : Promise.resolve({ data: [] }),
  ])

  const porContrato = new Map((contratos ?? []).map((c) => [c.contrato_id, c]))
  const porRaya = new Map((rayas ?? []).map((r) => [r.raya_id, r]))

  const datos: DatosReciboNomina = {
    folio: recibo.folio ?? 'S/F',
    fecha: recibo.fecha,
    trabajador: trabajador?.nombre ?? 'Trabajador',
    oficio: OFICIO[trabajador?.oficio ?? 'otro'] ?? 'Oficial',
    metodo: METODO_PAGO[recibo.metodo],
    renglones: (pagos ?? []).map((p) => {
      const importe = Number(p.monto)
      const porcentaje = p.porcentaje_del_pago == null ? null : Number(p.porcentaje_del_pago)

      // La raya se nombra por su semana: al trabajador lo que le importa es qué
      // semana está cobrando. El reparto entre obras es cuenta de la empresa.
      if (p.raya_id) {
        const r = porRaya.get(p.raya_id)
        return {
          obra: r ? `Raya ${etiquetaSemana(r.semana)}` : 'Raya de la semana',
          otNumero: null,
          importe,
          porcentaje,
          esRaya: true,
        }
      }

      const c = p.contrato_id ? porContrato.get(p.contrato_id) : undefined
      return {
        obra: c?.obra ?? 'Obra',
        otNumero: c?.ot_numero ?? null,
        importe,
        porcentaje,
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
    cancelacion: recibo.cancelado_en
      ? { fecha: recibo.cancelado_en, motivo: recibo.motivo_cancelacion }
      : null,
  }

  return responderPdf(
    DocumentoReciboNomina,
    { datos },
    `Recibo ${datos.folio} - ${datos.trabajador}.pdf`,
    peticion,
  )
}
