import { obtenerPerfil } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Sugerencias de domicilio de Google Places.
 *
 * La llave vive en el servidor y nunca sale al navegador: el teléfono le
 * pregunta a esta ruta y esta ruta le pregunta a Google. Sólo para gente con
 * sesión, para que no quede un proxy abierto que alguien más pueda gastar.
 */
export async function GET(peticion: Request) {
  const perfil = await obtenerPerfil()
  if (!perfil) return Response.json({ sugerencias: [] }, { status: 401 })

  const llave = process.env.GOOGLE_PLACES_API_KEY
  if (!llave) {
    return Response.json(
      { sugerencias: [], error: 'Falta GOOGLE_PLACES_API_KEY en el entorno.' },
      { status: 501 },
    )
  }

  const params = new URL(peticion.url).searchParams
  const consulta = (params.get('q') ?? '').trim()
  if (consulta.length < 3) return Response.json({ sugerencias: [] })

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', consulta)
  url.searchParams.set('components', 'country:mx')
  url.searchParams.set('language', 'es-419')
  // Hermosillo al centro: lo de cerca primero, sin excluir el resto del país.
  url.searchParams.set('location', '29.0729,-110.9559')
  url.searchParams.set('radius', '60000')
  const sesion = params.get('sesion')
  if (sesion) url.searchParams.set('sessiontoken', sesion)
  url.searchParams.set('key', llave)

  try {
    const respuesta = await fetch(url, { cache: 'no-store' })
    const datos = await respuesta.json()

    if (datos.status !== 'OK' && datos.status !== 'ZERO_RESULTS') {
      return Response.json(
        { sugerencias: [], error: datos.error_message ?? datos.status },
        { status: 502 },
      )
    }

    return Response.json({
      sugerencias: (datos.predictions ?? []).slice(0, 6).map((p: { place_id: string; description: string }) => ({
        id: p.place_id,
        texto: p.description,
      })),
    })
  } catch {
    return Response.json({ sugerencias: [], error: 'No se pudo consultar Google.' }, { status: 502 })
  }
}
