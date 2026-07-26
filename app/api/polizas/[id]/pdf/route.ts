import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { responderPdf } from '@/lib/pdf'
import { parsearFecha } from '@/lib/format'
import { DocumentoPoliza, type DatosPoliza } from '@/components/documentos/documentos-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: poliza } = await supabase
    .from('polizas_garantia')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!poliza) return new Response('Póliza no encontrada', { status: 404 })

  const { data: concentrado } = await supabase
    .from('v_obra_concentrado')
    .select('*')
    .eq('obra_id', poliza.obra_id)
    .maybeSingle()

  // El vencimiento se calcula desde la conclusión, no desde la emisión.
  const inicio = parsearFecha(poliza.fecha_conclusion ?? poliza.fecha_emision)
  const vence = inicio
    ? new Date(inicio.getTime() + poliza.vigencia_dias * 86_400_000).toISOString().slice(0, 10)
    : null

  const datos: DatosPoliza = {
    folio: poliza.folio ?? 'S/F',
    fechaEmision: poliza.fecha_emision,
    fechaConclusion: poliza.fecha_conclusion,
    vigenciaDias: poliza.vigencia_dias,
    vence,
    cliente: concentrado?.cliente ?? 'Cliente',
    domicilio: concentrado?.domicilio ?? null,
    obra: concentrado?.nombre ?? 'Obra',
    otNumero: concentrado?.ot_numero ?? '—',
    condiciones: poliza.condiciones,
    deslindes: poliza.deslindes,
    areas: Array.isArray(poliza.items)
      ? (poliza.items as DatosPoliza['areas'])
      : [],
  }

  return responderPdf(
    DocumentoPoliza,
    { datos },
    `Poliza ${datos.folio} - ${datos.cliente}.pdf`,
    peticion,
  )
}
