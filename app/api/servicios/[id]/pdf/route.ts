import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { responderPdf } from '@/lib/pdf'
import { DocumentoServicio, type DatosPdfServicio } from '@/components/servicios/documento-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(peticion: Request, { params }: { params: Promise<{ id: string }> }) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: servicio } = await supabase
    .from('v_servicios')
    .select('*')
    .eq('servicio_id', id)
    .maybeSingle()

  if (!servicio) return new Response('Servicio no encontrado', { status: 404 })

  const [{ data: items }, { data: cliente }] = await Promise.all([
    supabase.from('servicio_items').select('*').eq('servicio_id', id).order('orden'),
    supabase.from('clientes').select('titulo_cortesia').eq('id', servicio.cliente_id).maybeSingle(),
  ])

  const datos: DatosPdfServicio = {
    folio: servicio.folio ?? 'SIN FOLIO',
    // El documento se fecha el día en que se armó el presupuesto; mientras no
    // exista, vale la fecha de la visita.
    fecha: servicio.fecha_presupuesto ?? servicio.fecha_visita,
    cliente: servicio.cliente,
    tituloCortesia: cliente?.titulo_cortesia ?? null,
    descripcion: servicio.descripcion,
    domicilio: servicio.domicilio,
    fechaVisita: servicio.fecha_visita,
    horaVisita: servicio.hora_visita,
    tecnico: servicio.tecnico,
    diagnostico: servicio.diagnostico,
    partidas: (items ?? []).map((i) => ({
      descripcion: i.descripcion,
      cantidad: Number(i.cantidad),
      unidad: i.unidad,
      precio_unitario: Number(i.precio_unitario),
      importe: Number(i.importe),
    })),
    cuotaVisita: Number(servicio.cuota_visita),
    // El papel enseña siempre el trato completo —la reparación y la visita—,
    // aunque hoy sólo se deba una parte porque el cliente todavía no contesta.
    subtotal: Number(servicio.subtotal) + Number(servicio.cuota_visita),
    ivaPct: Number(servicio.iva_pct),
    total: Number(servicio.presupuesto),
    vigenciaDias: servicio.vigencia_dias,
    garantiaDias: servicio.garantia_dias,
    preventivo: servicio.tipo === 'preventivo',
  }

  return responderPdf(
    DocumentoServicio,
    { datos },
    `Presupuesto ${datos.folio} - ${datos.cliente}.pdf`,
    peticion,
  )
}
