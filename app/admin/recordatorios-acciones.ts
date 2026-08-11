'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import type { Recordatorio } from '@/types/database'

export type Resultado<T = undefined> = { ok: true; datos?: T } | { ok: false; error: string }

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

const fallo = (error: { message: string }): Resultado<never> => ({ ok: false, error: error.message })

function refrescar(cotizacionId?: string | null, obraId?: string | null) {
  revalidatePath('/admin')
  if (cotizacionId) revalidatePath(`/admin/cotizaciones/${cotizacionId}`)
  if (obraId) revalidatePath(`/admin/obras/${obraId}`)
}

/** Con `id` corrige el recordatorio; sin él lo crea. */
export async function guardarRecordatorio(datos: {
  id?: string
  cotizacion_id?: string | null
  obra_id?: string | null
  titulo: string
  nota: string | null
  fecha: string
  hora: string | null
}): Promise<Resultado<{ id: string }>> {
  if (!datos.titulo.trim()) return { ok: false, error: 'El recordatorio necesita un título.' }
  if (!datos.fecha) return { ok: false, error: 'Falta la fecha del recordatorio.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const fila = {
    cotizacion_id: datos.cotizacion_id ?? null,
    obra_id: datos.obra_id ?? null,
    titulo: datos.titulo.trim(),
    nota: datos.nota?.trim() || null,
    fecha: datos.fecha,
    hora: datos.hora || null,
    // A quien lo captura, que es quien va a hacer la llamada.
    para: user?.id ?? null,
  }

  const { data, error } = datos.id
    ? await supabase.from('recordatorios').update(fila).eq('id', datos.id).select('id').single()
    : await supabase
        .from('recordatorios')
        .insert({ ...fila, creado_por: user?.id ?? null })
        .select('id')
        .single()

  if (error) return fallo(error)
  refrescar(datos.cotizacion_id, datos.obra_id)
  return { ok: true, datos: { id: (data as Pick<Recordatorio, 'id'>).id } }
}

/**
 * Lo da por atendido, o lo devuelve a pendiente si se marcó por error. El
 * recordatorio no se borra al atenderlo: queda el rastro de que sí se llamó.
 */
export async function atenderRecordatorio(
  id: string,
  atendido: boolean,
  ligas?: { cotizacion_id?: string | null; obra_id?: string | null },
): Promise<Resultado> {
  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('recordatorios')
    .update(
      atendido
        ? { atendido_en: new Date().toISOString(), atendido_por: user?.id ?? null }
        : { atendido_en: null, atendido_por: null },
    )
    .eq('id', id)

  if (error) return fallo(error)
  refrescar(ligas?.cotizacion_id, ligas?.obra_id)
  return { ok: true }
}

/**
 * Da de alta este teléfono para recibir avisos.
 *
 * Una suscripción es por aparato, no por persona: el mismo usuario en el
 * iPhone y en el iPad son dos. El endpoint viene del navegador y es único, así
 * que volver a activar en el mismo aparato actualiza en vez de duplicar.
 */
export async function guardarSuscripcionPush(suscripcion: {
  endpoint: string
  p256dh: string
  auth: string
  agente: string | null
}): Promise<Resultado> {
  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No hay sesión.' }

  const { error } = await supabase
    .from('push_suscripciones')
    .upsert({ ...suscripcion, profile_id: user.id }, { onConflict: 'endpoint' })

  if (error) return fallo(error)
  return { ok: true }
}

export async function borrarSuscripcionPush(endpoint: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('push_suscripciones').delete().eq('endpoint', endpoint)
  if (error) return fallo(error)
  return { ok: true }
}

export async function eliminarRecordatorio(
  id: string,
  ligas?: { cotizacion_id?: string | null; obra_id?: string | null },
): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('recordatorios').delete().eq('id', id)
  if (error) return fallo(error)
  refrescar(ligas?.cotizacion_id, ligas?.obra_id)
  return { ok: true }
}
