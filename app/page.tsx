import { redirect } from 'next/navigation'
import { obtenerPerfil, RUTA_POR_ROL } from '@/lib/auth'
import { SUPABASE_CONFIGURADO } from '@/lib/config'

export default async function Inicio() {
  if (!SUPABASE_CONFIGURADO) redirect('/instalacion')

  const perfil = await obtenerPerfil()
  redirect(perfil ? RUTA_POR_ROL[perfil.rol] : '/login')
}
