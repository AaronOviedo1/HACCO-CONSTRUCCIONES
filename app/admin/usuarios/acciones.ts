'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { crearClienteAdmin, SIN_LLAVE_SERVICIO } from '@/lib/supabase/admin'
import { requerirRol } from '@/lib/auth'
import { casilla, explicar, opcional, texto, type EstadoAccion } from '@/lib/acciones'
import { correoInterno } from '@/lib/personal'
import type { OficioTrabajador, RolUsuario } from '@/types/database'

/**
 * Alta, edición y baja de la gente.
 *
 * Un perfil no existe sin su usuario de Auth detrás (profiles.id es llave
 * foránea a auth.users), así que crear o borrar uno pasa por la llave de
 * servicio. Aquí eso es seguro porque `direccion()` corre primero: nadie que no
 * sea Dirección llega a tocar el cliente admin.
 */
async function direccion() {
  const perfil = await requerirRol(['admin'])
  return { supabase: await crearClienteServidor(), perfil }
}

/**
 * Da de alta a alguien.
 *
 * Con acceso, hace falta su correo y una contraseña de arranque. Sin acceso
 * —el pintor de una obra suelta, el herrero de un trabajo puntual— se le
 * inventa un correo interno y una contraseña aleatoria que nadie llega a ver:
 * la cuenta existe sólo porque el perfil cuelga de ella.
 */
export async function crearTrabajador(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const { supabase } = await direccion()

  const nombre = texto(d, 'nombre')
  if (!nombre) return { error: 'El nombre es obligatorio.' }

  const conAcceso = casilla(d, 'con_acceso')
  const rol = (texto(d, 'rol') || 'cuadrilla') as RolUsuario
  const oficio = (opcional(d, 'oficio') as OficioTrabajador | null) ?? null
  const telefono = opcional(d, 'telefono')

  const correo = conAcceso ? texto(d, 'correo').toLowerCase() : correoInterno(nombre)
  const contrasena = conAcceso ? texto(d, 'contrasena') : crypto.randomUUID()

  if (conAcceso) {
    if (!correo) return { error: 'Con acceso a la app hace falta el correo con el que entra.' }
    if (contrasena.length < 8) return { error: 'La contraseña necesita al menos 8 caracteres.' }
  }

  const admin = crearClienteAdmin()
  if (!admin) return { error: SIN_LLAVE_SERVICIO }

  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre, telefono, rol, oficio, es_externo: casilla(d, 'es_externo'), con_acceso: conAcceso },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already')) {
      return { error: 'Ya hay una cuenta con ese correo.' }
    }
    return { error: error.message }
  }

  // El trigger nuevo_usuario ya dejó el perfil puesto; el teléfono se refuerza
  // aquí porque es el único campo que no siempre viaja en el metadata.
  if (telefono) {
    await supabase.from('profiles').update({ telefono }).eq('id', data.user.id)
  }

  refrescar()
  return { ok: true, id: data.user.id }
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
      con_acceso: casilla(d, 'con_acceso'),
      activo,
    })
    .eq('id', id)

  if (error) return { error: explicar(error) }
  refrescar()
  return { ok: true, id }
}

/**
 * Borra a alguien de raíz.
 *
 * Sólo para el alta que salió mal: en cuanto tiene contrato, pago, avance o
 * deuda, su historia deja de ser suya y pasa a ser la de la obra. Para esos
 * está la baja lógica, que los saca de las listas sin borrar nada.
 *
 * Las llaves foráneas frenan casi todo por su cuenta, pero `deducciones` cuelga
 * en cascada: sin esta revisión, borrar a un trabajador se llevaría en silencio
 * los préstamos que aún debe.
 */
export async function eliminarTrabajador(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const { supabase, perfil } = await direccion()

  const id = texto(d, 'id')
  if (!id) return { error: 'Falta el usuario.' }
  if (id === perfil.id) return { error: 'No puedes borrarte a ti mismo.' }

  const historia = await conHistoria(supabase, id)
  if (historia) return { error: historia }

  const admin = crearClienteAdmin()
  if (!admin) return { error: SIN_LLAVE_SERVICIO }

  // El perfil se va solo: profiles.id es llave foránea a auth.users en cascada.
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { error: error.message }

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

async function conHistoria(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  id: string,
): Promise<string | null> {
  const cabeza = { count: 'exact', head: true } as const

  // Cada tabla va por separado porque la columna que apunta a la persona no se
  // llama igual en todas, y el tipado no deja pasar una lista de pares.
  const [contratos, recibos, deudas, avances, solicitudes] = await Promise.all([
    supabase.from('contratos_oficial').select('id', cabeza).eq('trabajador_id', id),
    supabase.from('recibos_nomina').select('id', cabeza).eq('trabajador_id', id),
    supabase.from('deducciones').select('id', cabeza).eq('trabajador_id', id),
    supabase.from('avances').select('id', cabeza).eq('autor_id', id),
    supabase.from('solicitudes_material').select('id', cabeza).eq('autor_id', id),
  ])

  const hallazgos = [
    [contratos.count, 'contratos'],
    [recibos.count, 'recibos de nómina'],
    [deudas.count, 'préstamos o adelantos'],
    [avances.count, 'avances reportados'],
    [solicitudes.count, 'solicitudes de material'],
  ]
    .filter(([n]) => Number(n) > 0)
    .map(([n, que]) => `${n} ${que}`)

  if (hallazgos.length === 0) return null
  return `No se puede borrar: tiene ${hallazgos.join(', ')}. Quítale la palomita de «Sigue laborando» para sacarlo de las listas sin perder su historia.`
}

function refrescar() {
  revalidatePath('/admin/usuarios')
  revalidatePath('/admin/nomina')
}
