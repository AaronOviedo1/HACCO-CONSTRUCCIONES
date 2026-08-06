'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { casilla, explicar, opcional, texto, type EstadoAccion } from '@/lib/acciones'
import type { OficioTrabajador, RolUsuario } from '@/types/database'

/**
 * El alta no está aquí a propósito. Un perfil cuelga de un usuario de Auth
 * (profiles.id es llave foránea a auth.users), y crearlo necesita la llave de
 * servicio, que sólo tienen los scripts. Las cuentas nuevas siguen saliendo de
 * `npm run usuarios:reales`.
 */
async function direccion() {
  const perfil = await requerirRol(['admin'])
  return { supabase: await crearClienteServidor(), perfil }
}

export async function guardarTrabajador(
  _prev: EstadoAccion,
  d: FormData,
): Promise<EstadoAccion> {
  const { supabase, perfil } = await direccion()

  const id = texto(d, 'id')
  if (!id) return { error: 'Falta el usuario que se va a editar.' }

  const nombre = texto(d, 'nombre')
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const rol = texto(d, 'rol') as RolUsuario
  const activo = casilla(d, 'activo')

  // Nadie se puede dejar a sí mismo fuera: si Dirección se quita el rol o se da
  // de baja, la app se queda sin quien pueda devolvérselo.
  if (id === perfil.id && (rol !== 'admin' || !activo)) {
    return { error: 'No puedes quitarte a ti mismo el rol de Dirección ni darte de baja.' }
  }

  if (!activo) {
    const problema = await conContratosVivos(supabase, id)
    if (problema) return { error: problema }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      nombre,
      telefono: opcional(d, 'telefono'),
      correo: opcional(d, 'correo'),
      rol,
      oficio: (opcional(d, 'oficio') as OficioTrabajador | null) ?? null,
      es_externo: casilla(d, 'es_externo'),
      activo,
    })
    .eq('id', id)

  if (error) return { error: explicar(error) }
  refrescar()
  return { ok: true, id }
}

/** Da de baja o reactiva sin abrir el formulario completo. */
export async function alternarActivo(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const { supabase, perfil } = await direccion()

  const id = texto(d, 'id')
  const activo = casilla(d, 'activo')
  if (!id) return { error: 'Falta el usuario.' }
  if (id === perfil.id && !activo) return { error: 'No puedes darte de baja a ti mismo.' }

  if (!activo) {
    const problema = await conContratosVivos(supabase, id)
    if (problema) return { error: problema }
  }

  const { error } = await supabase.from('profiles').update({ activo }).eq('id', id)
  if (error) return { error: explicar(error) }
  refrescar()
  return { ok: true, id }
}

/**
 * Un trabajador de baja desaparece de la prenómina —sólo agrega contratos
 * activos—, así que si se le debe algo el saldo se vuelve invisible. Se le
 * cierran o se le reasignan los contratos primero.
 */
async function conContratosVivos(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  id: string,
): Promise<string | null> {
  const { count } = await supabase
    .from('contratos_oficial')
    .select('id', { count: 'exact', head: true })
    .eq('trabajador_id', id)
    .eq('estatus', 'activo')

  if (!count) return null
  return `Tiene ${count} ${count === 1 ? 'contrato activo' : 'contratos activos'}. Reasígnalos a otro oficial o ciérralos antes de darlo de baja.`
}

function refrescar() {
  revalidatePath('/admin/usuarios')
  revalidatePath('/admin/nomina')
}
