import { createElement, type ReactElement } from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { DocumentoCotizacion, type DatosPdf } from '@/components/cotizaciones/documento-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requerirRol(['admin', 'administracion'])
  const { id } = await params
  const supabase = await crearClienteServidor()

  const { data: cotizacion } = await supabase
    .from('cotizaciones')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!cotizacion) {
    return new Response('Cotización no encontrada', { status: 404 })
  }

  const [{ data: cliente }, { data: procesos }, { data: items }] = await Promise.all([
    supabase.from('clientes').select('*').eq('id', cotizacion.cliente_id).maybeSingle(),
    supabase.from('cotizacion_procesos').select('*').eq('cotizacion_id', id).order('orden'),
    supabase.from('cotizacion_items').select('*').eq('cotizacion_id', id).order('orden'),
  ])

  const datos: DatosPdf = {
    folio: cotizacion.folio ?? 'SIN FOLIO',
    fecha: cotizacion.fecha,
    cliente: cliente?.nombre ?? 'Cliente',
    tituloCortesia: cliente?.titulo_cortesia ?? null,
    nombreObra: cotizacion.nombre_obra,
    domicilioObra: cotizacion.domicilio_obra ?? cliente?.domicilio ?? null,
    procesos: (procesos ?? []).map((p) => p.contenido_override ?? '').filter(Boolean),
    lineaCalidad: cotizacion.linea_calidad,
    partidas: (items ?? []).map((i) => ({
      descripcion: i.descripcion,
      m2: i.m2,
      unidad: i.unidad,
      precio_unitario: i.precio_unitario,
      importe: i.importe,
    })),
    // Se decide por lo que traen las partidas, no por el tipo de cotización:
    // una mixta con partidas en metros sigue saliendo con su columna M².
    usaM2: (items ?? []).every((i) => !i.unidad || i.unidad === 'm2'),
    subtotal: cotizacion.subtotal,
    descuentoPct: cotizacion.descuento_pct,
    descuento: Math.round(cotizacion.subtotal * (cotizacion.descuento_pct / 100) * 100) / 100,
    ivaPct: cotizacion.iva_pct,
    total: cotizacion.total,
    anticipoPct: cotizacion.anticipo_pct ?? 50,
    vigenciaDias: cotizacion.vigencia_dias,
    terminos: cotizacion.terminos,
  }

  // El componente devuelve un <Document>, pero TypeScript sólo ve su envoltura.
  const documento = createElement(DocumentoCotizacion, { datos }) as unknown as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(documento)
  const descargar = new URL(peticion.url).searchParams.has('descargar')
  const archivo = `Cotizacion ${datos.folio} - ${datos.cliente}.pdf`.replace(/[/\\]/g, '-')

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="${archivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}
