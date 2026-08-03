import { requerirRol } from '@/lib/auth'
import { cargarReporte } from '@/lib/reportes'
import { etiquetaMes, mesActual } from '@/lib/finanzas'
import { responderPdf } from '@/lib/pdf'
import { DocumentoReporteContador } from '@/components/reportes/reporte-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(peticion: Request) {
  // El contador también exporta: es a lo que viene.
  await requerirRol(['admin', 'administracion', 'contador'])

  const params = new URL(peticion.url).searchParams
  const mes = params.get('mes') ?? mesActual()

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return new Response('El mes debe venir en formato aaaa-mm', { status: 400 })
  }

  const reporte = await cargarReporte(mes)
  if (reporte.errorLectura) {
    return new Response(reporte.errorLectura, { status: 500 })
  }

  return responderPdf(
    DocumentoReporteContador,
    { reporte },
    `Concentrado ${etiquetaMes(mes).replace(' de ', ' ')}.pdf`,
    peticion,
  )
}
