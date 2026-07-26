import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { responderPdf } from '@/lib/pdf'
import { leerReparaciones } from '@/lib/obras'
import { DocumentoContrato, type DatosContrato } from '@/components/documentos/documentos-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: contrato } = await supabase
    .from('contratos_oficial')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!contrato) return new Response('Contrato no encontrado', { status: 404 })

  const [{ data: oficial }, { data: concentrado }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', contrato.trabajador_id).maybeSingle(),
    supabase.from('v_obra_concentrado').select('*').eq('obra_id', contrato.obra_id).maybeSingle(),
  ])

  const oficio =
    oficial?.oficio === 'herrero' ? 'Herrero' : oficial?.oficio === 'pintor' ? 'Pintor' : 'Oficial'

  const datos: DatosContrato = {
    oficio,
    oficial: oficial?.nombre ?? 'Oficial',
    obra: concentrado?.nombre ?? 'Obra',
    domicilio: concentrado?.domicilio ?? null,
    cliente: concentrado?.cliente ?? '—',
    inicia: contrato.fecha_inicia,
    finaliza: contrato.fecha_finaliza,
    cotizacionFolio: concentrado?.cotizacion_folio ?? '—',
    trabajos: (contrato.trabajos ?? {}) as Record<string, string[]>,
    reparaciones: leerReparaciones(contrato.reparaciones),
    m2: Number(contrato.m2),
    tarifa: Number(contrato.tarifa_m2),
    otros: Number(contrato.otros_importe),
    reparacionesImporte: Number(contrato.reparaciones_importe),
    subtotal: Number(contrato.subtotal),
    costoHaacoPct: Number(contrato.costo_haaco_pct),
    retencion: Number(contrato.retencion_haaco),
    total: Number(contrato.total_pagar),
    esExterno: oficial?.es_externo ?? false,
  }

  return responderPdf(
    DocumentoContrato,
    { datos },
    `Contrato ${datos.oficial} - ${datos.obra}.pdf`,
    peticion,
  )
}
