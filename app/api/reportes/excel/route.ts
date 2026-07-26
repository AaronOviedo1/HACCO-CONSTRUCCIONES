import { requerirRol } from '@/lib/auth'
import { cargarReporte } from '@/lib/reportes'
import { generarLibro, HOJAS, type NombreHoja } from '@/lib/excel'
import { etiquetaMes, mesActual } from '@/lib/finanzas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(peticion: Request) {
  // El contador también exporta: es a lo que viene.
  await requerirRol(['admin', 'administracion', 'contador'])

  const params = new URL(peticion.url).searchParams
  const mes = params.get('mes') ?? mesActual()
  const hoja = params.get('hoja') as NombreHoja | null

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return new Response('El mes debe venir en formato aaaa-mm', { status: 400 })
  }
  if (hoja && !(hoja in HOJAS)) {
    return new Response(`Hoja desconocida: ${hoja}`, { status: 400 })
  }

  const reporte = await cargarReporte(mes)
  const libro = await generarLibro(reporte, hoja ?? undefined)

  const titulo = hoja
    ? `${hoja.charAt(0).toUpperCase()}${hoja.slice(1)}`
    : 'Cierre'
  const archivo = `${titulo} ${etiquetaMes(mes).replace(' de ', ' ')}.xlsx`

  return new Response(new Uint8Array(libro), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${archivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}
