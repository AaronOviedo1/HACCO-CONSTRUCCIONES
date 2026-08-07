'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { aPayload, validar, type BorradorCotizacion } from '@/lib/cotizaciones'
import type {
  Cotizacion, EstatusCotizacion, ObraNuevaSql, ResultadoAprobacion,
} from '@/types/database'

export type Resultado<T = undefined> = { ok: true; datos?: T } | { ok: false; error: string }

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

function refrescar(id?: string) {
  revalidatePath('/admin/cotizaciones')
  revalidatePath('/admin')
  if (id) revalidatePath(`/admin/cotizaciones/${id}`)
}

/** Guarda el documento completo en una sola transacción. */
export async function guardarCotizacion(
  id: string | null,
  borrador: BorradorCotizacion,
): Promise<Resultado<{ id: string }>> {
  const faltas = validar(borrador)
  if (faltas.length > 0) return { ok: false, error: faltas.join(' ') }

  const supabase = await staff()
  const { data, error } = await supabase.rpc('guardar_cotizacion', {
    p_id: id,
    p_datos: aPayload(borrador),
  })

  if (error) return { ok: false, error: error.message }

  refrescar(data as string)
  return { ok: true, datos: { id: data as string } }
}

/** Copia la cotización para armar una variante del mismo cliente. */
export async function duplicarCotizacion(id: string): Promise<Resultado<{ id: string }>> {
  const supabase = await staff()
  const { data, error } = await supabase.rpc('duplicar_cotizacion', { p_id: id })
  if (error) return { ok: false, error: error.message }

  refrescar()
  return { ok: true, datos: { id: data as string } }
}

/**
 * Aprobar: abre las órdenes de trabajo, copia el presupuesto de materiales y
 * deja fijado el porcentaje de anticipo que se va a cobrar.
 */
export async function aprobarCotizacion(
  id: string,
  obras: ObraNuevaSql[],
  anticipoPct: number,
): Promise<Resultado<ResultadoAprobacion>> {
  if (obras.length === 0) return { ok: false, error: 'Hay que crear al menos una orden de trabajo.' }
  if (obras.some((o) => !o.nombre.trim())) {
    return { ok: false, error: 'Cada orden de trabajo necesita un nombre.' }
  }

  const supabase = await staff()
  const { data, error } = await supabase.rpc('aprobar_cotizacion', {
    p_id: id,
    p_obras: obras.map((o) => ({ ...o, nombre: o.nombre.trim() })),
    p_anticipo_pct: anticipoPct,
  })

  if (error) return { ok: false, error: error.message }

  refrescar(id)
  revalidatePath('/admin/obras')
  revalidatePath('/admin/cobranza')
  return { ok: true, datos: data as ResultadoAprobacion }
}

/** Enviada, rechazada, terminada o de regreso a borrador. */
export async function cambiarEstatus(
  id: string,
  estatus: EstatusCotizacion,
): Promise<Resultado> {
  const supabase = await staff()

  const hoy = new Date().toISOString().slice(0, 10)
  const parche: Partial<Cotizacion> = { estatus }
  if (estatus === 'enviada') parche.fecha_envio = hoy
  if (estatus === 'rechazada') parche.fecha_resolucion = hoy

  const { error } = await supabase.from('cotizaciones').update(parche).eq('id', id)
  if (error) return { ok: false, error: error.message }

  refrescar(id)
  return { ok: true }
}

export async function eliminarCotizacion(id: string): Promise<Resultado> {
  const supabase = await staff()

  const [{ count: conObras }, { data: cobros }] = await Promise.all([
    supabase.from('obras').select('id', { count: 'exact', head: true }).eq('cotizacion_id', id),
    supabase.from('pagos_cobranza').select('monto').eq('cotizacion_id', id),
  ])

  if ((conObras ?? 0) > 0) {
    return {
      ok: false,
      error: 'No se puede eliminar: esta cotización ya tiene órdenes de trabajo abiertas.',
    }
  }

  // Los pagos cuelgan de la cotización en cascada: sin esta revisión, borrarla
  // se llevaría por delante el dinero ya cobrado sin decir nada.
  if (cobros && cobros.length > 0) {
    const total = cobros.reduce((s, p) => s + Number(p.monto), 0)
    return {
      ok: false,
      error: `No se puede eliminar: tiene ${cobros.length} ${
        cobros.length === 1 ? 'cobro registrado' : 'cobros registrados'
      } por ${total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}. Quítalos primero desde Cobranza.`,
    }
  }

  const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }

  refrescar()
  return { ok: true }
}
