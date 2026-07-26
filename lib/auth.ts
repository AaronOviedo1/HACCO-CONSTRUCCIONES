import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { Profile, RolUsuario } from '@/types/database'

/** A dónde manda la app a cada rol al entrar. */
export const RUTA_POR_ROL: Record<RolUsuario, string> = {
  admin: '/admin',
  administracion: '/admin',
  contador: '/admin/reportes',
  cuadrilla: '/obra',
}

export const NOMBRE_ROL: Record<RolUsuario, string> = {
  admin: 'Dirección',
  administracion: 'Administración',
  cuadrilla: 'Cuadrilla',
  contador: 'Contador',
}

/** Perfil del usuario de la sesión actual, o null si no hay sesión. */
export async function obtenerPerfil(): Promise<Profile | null> {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return data ?? null
}

/** Exige sesión activa; si no hay, manda a login. */
export async function requerirPerfil(): Promise<Profile> {
  const perfil = await obtenerPerfil()
  if (!perfil) redirect('/login')
  if (!perfil.activo) redirect('/login?motivo=inactivo')
  return perfil
}

/** Exige que el usuario tenga alguno de los roles indicados. */
export async function requerirRol(roles: RolUsuario[]): Promise<Profile> {
  const perfil = await requerirPerfil()
  if (!roles.includes(perfil.rol)) redirect(RUTA_POR_ROL[perfil.rol])
  return perfil
}

export const esStaff = (rol: RolUsuario) => rol === 'admin' || rol === 'administracion'
