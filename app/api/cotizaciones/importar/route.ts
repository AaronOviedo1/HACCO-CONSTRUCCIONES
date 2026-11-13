import { EQUIPO, obtenerPerfil } from '@/lib/auth'
import { leerCotizacionCos } from '@/lib/importar-cos-lectura'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Una cotización de COS trae decenas de conceptos con descripciones de un
// párrafo, y todas se copian completas: la respuesta es larga.
export const maxDuration = 300

/**
 * Lectura de una cotización de COS con Claude (lib/importar-cos-lectura.ts).
 *
 * COS manda sus cotizaciones en PDF; aquí se leen y regresan como datos para
 * que el editor arme la cotización de HAACO. Igual que el ticket, todo llega
 * como propuesta: quien captura revisa y guarda. Lo que no cuadra contra las
 * cifras impresas viaja en `avisos` (ver lib/importar-cos.ts).
 */

const MAXIMO = 10 * 1024 * 1024

export async function POST(peticion: Request) {
  const perfil = await obtenerPerfil()
  if (!perfil?.activo || !EQUIPO.includes(perfil.rol)) {
    return Response.json({ error: 'Sesión no válida.' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Falta ANTHROPIC_API_KEY en el entorno.' }, { status: 501 })
  }

  const formulario = await peticion.formData()
  const archivo = formulario.get('archivo')
  if (!(archivo instanceof File)) {
    return Response.json({ error: 'No llegó ningún archivo.' }, { status: 400 })
  }
  if (archivo.type !== 'application/pdf') {
    return Response.json({ error: 'Tiene que ser el PDF de la cotización.' }, { status: 415 })
  }
  if (archivo.size > MAXIMO) {
    return Response.json({ error: 'El PDF pesa demasiado (máximo 10 MB).' }, { status: 413 })
  }

  try {
    const datos = Buffer.from(await archivo.arrayBuffer()).toString('base64')
    const r = await leerCotizacionCos(datos, process.env.ANTHROPIC_API_KEY)
    if (!r.ok) return Response.json({ error: r.error }, { status: r.estado })
    return Response.json({ lectura: r.lectura, avisos: r.avisos })
  } catch (e) {
    console.error('[importar-cos] lectura fallida', e)
    return Response.json({ error: 'No se pudo leer la cotización.' }, { status: 502 })
  }
}
