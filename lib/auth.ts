import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { RUTA_POR_ROL } from '@/lib/roles'
import type { Profile, RolUsuario } from '@/types/database'

// Las etiquetas y rutas de cada rol viven en lib/roles.ts, que no depende del
// servidor: así los formularios del navegador las pueden usar. Se reexportan
// aquí porque es donde las busca el resto de la app.
export { NOMBRE_ROL, RUTA_POR_ROL, esStaff } from '@/lib/roles'

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
