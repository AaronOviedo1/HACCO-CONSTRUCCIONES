import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_CONFIGURADO, SUPABASE_LLAVE_PUBLICA, SUPABASE_URL } from '@/lib/supabase/entorno'
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
  // Las tareas programadas entran sin cookie y por fuera del navegador. Si
  // pasaran por aquí acabarían redirigidas al login: el cron respondería 307,
  // Vercel lo pintaría verde y nadie se enteraría en semanas. Se protegen solas
  // con CRON_SECRET; el proxy nunca fue su seguridad.
  if (request.nextUrl.pathname.startsWith('/api/cron')) return NextResponse.next()

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
    SUPABASE_URL,
    SUPABASE_LLAVE_PUBLICA,
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

  // Redirige preservando las cookies que Supabase haya tocado (p. ej. al
  // limpiar un refresh token inválido); si no se copian, la cookie vencida
  // nunca se borra y el error se repite en cada request.
  const redirigir = (destino: URL) => {
    const redireccion = NextResponse.redirect(destino)
    respuesta.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie))
    return redireccion
  }

  const { data: { user } } = await supabase.auth.getUser()
  const ruta = request.nextUrl.pathname
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta.startsWith(p))

  // Sin sesión: sólo puede ver el login
  if (!user) {
    if (esPublica) return respuesta
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.searchParams.set('siguiente', ruta)
    return redirigir(destino)
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
    return redirigir(destino)
  }

  const inicio = RUTA_POR_ROL[perfil.rol]

  // Ya con sesión, el login y la raíz llevan a su pantalla de inicio
  if (esPublica || ruta === '/') {
    const destino = request.nextUrl.clone()
    destino.pathname = inicio
    destino.search = ''
    return redirigir(destino)
  }

  // La cuadrilla nunca entra al panel administrativo
  if (perfil.rol === 'cuadrilla' && !ruta.startsWith('/obra')) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/obra'
    return redirigir(destino)
  }

  // El contador sólo ve reportes
  if (perfil.rol === 'contador' && !ruta.startsWith('/admin/reportes')) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/admin/reportes'
    return redirigir(destino)
  }

  // Staff no necesita la vista de cuadrilla
  if (ruta.startsWith('/obra') && perfil.rol !== 'cuadrilla') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/admin'
    return redirigir(destino)
  }

  return respuesta
}

export const config = {
  matcher: [
    /*
     * Todo excepto archivos estáticos, imágenes y la ficha de instalación de
     * la PWA: el teléfono pide el manifest y los iconos sin cookies, así que
     * si pasaran por aquí acabarían redirigidos al login.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
}
