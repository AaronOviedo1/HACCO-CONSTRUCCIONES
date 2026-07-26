'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { RUTA_POR_ROL } from '@/lib/auth'
import type { RolUsuario } from '@/types/database'

export type EstadoLogin = { error?: string }

export async function iniciarSesion(
  _estadoPrevio: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const correo = String(datos.get('correo') ?? '').trim()
  const contrasena = String(datos.get('contrasena') ?? '')

  if (!correo || !contrasena) {
    return { error: 'Escribe tu correo y tu contraseña.' }
  }

  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  })

  if (error || !data.user) {
    return { error: 'Correo o contraseña incorrectos.' }
  }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('rol, activo')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!perfil) {
    await supabase.auth.signOut()
    return { error: 'Tu usuario aún no tiene perfil asignado. Avísale a Dirección.' }
  }

  if (!perfil.activo) {
    await supabase.auth.signOut()
    return { error: 'Tu usuario está dado de baja.' }
  }

  revalidatePath('/', 'layout')
  redirect(RUTA_POR_ROL[perfil.rol as RolUsuario])
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
