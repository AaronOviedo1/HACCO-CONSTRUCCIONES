import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { responderPdf } from '@/lib/pdf'
import { DocumentoPagare, type DatosPagare } from '@/components/documentos/documentos-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: pagare } = await supabase.from('pagares').select('*').eq('id', id).maybeSingle()
  if (!pagare) return new Response('Pagaré no encontrado', { status: 404 })

  const { data: contrato } = await supabase
    .from('contratos_oficial')
    .select('*')
    .eq('id', pagare.contrato_id)
    .maybeSingle()

  const [{ data: oficial }, { data: concentrado }, { data: items }] = await Promise.all([
    contrato
      ? supabase.from('profiles').select('*').eq('id', contrato.trabajador_id).maybeSingle()
      : Promise.resolve({ data: null }),
    contrato
      ? supabase.from('v_obra_concentrado').select('*').eq('obra_id', contrato.obra_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('pagare_items').select('*').eq('pagare_id', id),
  ])

  const idsHerramienta = (items ?? []).map((i) => i.herramienta_id)
  const { data: herramientas } = idsHerramienta.length
    ? await supabase.from('herramientas').select('*').in('id', idsHerramienta).order('codigo')
    : { data: [] }

  const valorPorId = new Map((items ?? []).map((i) => [i.herramienta_id, Number(i.valor_unitario)]))

  const datos: DatosPagare = {
    suscriptor: oficial?.nombre ?? 'Suscriptor',
    obra: concentrado?.nombre ?? 'Obra',
    domicilio: concentrado?.domicilio ?? null,
    fecha: pagare.fecha_emision,
    valorTotal: Number(pagare.valor_total),
    interesOrdinario: Number(pagare.interes_ordinario_pct),
    interesMoratorio: Number(pagare.interes_moratorio_pct),
    herramientas: (herramientas ?? []).map((h) => ({
      codigo: h.codigo,
      nombre: h.nombre,
      marca: h.marca,
      valor: valorPorId.get(h.id) ?? Number(h.valor ?? 0),
    })),
  }

  return responderPdf(
    DocumentoPagare,
    { datos },
    `Pagare ${datos.suscriptor} - ${datos.obra}.pdf`,
    peticion,
  )
}
