import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_CONFIGURADO } from '@/lib/config'
import type { RolUsuario } from '@/types/database'

const RUTA_POR_ROL: Record<RolUsuario, string> = {
  admin: '/admin',
  administracion: '/admin',
  contador: '/admin/reportes',
  cuadrilla: '/obra',
}

const RUTAS_PUBLICAS = ['/login', '/auth']

/**
 * Refresca la sesión de Supabase en cada request y encamina por rol.
 * La seguridad real vive en las políticas RLS de Postgres; esto sólo evita
 * que alguien aterrice en una pantalla que no le toca.
 */
export default async function proxy(request: NextRequest) {
  // Sin llaves de Supabase todo el tráfico va a la pantalla de instalación.
  if (!SUPABASE_CONFIGURADO) {
    if (request.nextUrl.pathname === '/instalacion') return NextResponse.next()
    const destino = request.nextUrl.clone()
    destino.pathname = '/instalacion'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesNuevas) {
          cookiesNuevas.forEach(({ name, value }) => request.cookies.set(name, value))
          respuesta = NextResponse.next({ request })
          cookiesNuevas.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const ruta = request.nextUrl.pathname
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta.startsWith(p))

  // Sin sesión: sólo puede ver el login
  if (!user) {
    if (esPublica) return respuesta
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.searchParams.set('siguiente', ruta)
    return NextResponse.redirect(destino)
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle<{ rol: RolUsuario; activo: boolean }>()

  // Usuario autenticado sin perfil o dado de baja: se cierra la sesión
  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut()
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.searchParams.set('motivo', 'inactivo')
    return NextResponse.redirect(destino)
  }

  const inicio = RUTA_POR_ROL[perfil.rol]

  // Ya con sesión, el login y la raíz llevan a su pantalla de inicio
  if (esPublica || ruta === '/') {
    const destino = request.nextUrl.clone()
    destino.pathname = inicio
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  // La cuadrilla nunca entra al panel administrativo
  if (perfil.rol === 'cuadrilla' && !ruta.startsWith('/obra')) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/obra'
    return NextResponse.redirect(destino)
  }

  // El contador sólo ve reportes
  if (perfil.rol === 'contador' && !ruta.startsWith('/admin/reportes')) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/admin/reportes'
    return NextResponse.redirect(destino)
  }

  // Staff no necesita la vista de cuadrilla
  if (ruta.startsWith('/obra') && perfil.rol !== 'cuadrilla') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/admin'
    return NextResponse.redirect(destino)
  }

  return respuesta
}

export const config = {
  matcher: [
    /*
     * Todo excepto archivos estáticos e imágenes.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
