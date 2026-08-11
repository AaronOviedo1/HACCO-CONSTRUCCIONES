'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import type { OrigenPrecio } from '@/types/database'

export type Resultado<T = undefined> = { ok: true; datos?: T } | { ok: false; error: string }

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

const fallo = (error: { message: string }): Resultado<never> => ({ ok: false, error: error.message })

const refrescar = () => {
  revalidatePath('/admin/precios')
  revalidatePath('/admin/catalogo')
}

/**
 * Registra el precio que acaban de dictar.
 *
 * `aprobar` va en true desde la pantalla de la llamada: ella está viendo el
 * número mientras lo escribe, y hacerla confirmarlo otra vez en una bandeja es
 * fricción sin valor. La aprobación se reserva para lo que el sistema dedujo
 * solo de una factura, que es donde sí puede equivocarse.
 */
export async function registrarPrecio(datos: {
  producto_id: string
  proveedor_id?: string | null
  precio_neto: number
  origen?: OrigenPrecio
  unidad?: string | null
  nota?: string | null
  aprobar?: boolean
}): Promise<Resultado> {
  if (!(datos.precio_neto > 0)) return { ok: false, error: 'El precio tiene que ser mayor a cero.' }

  const supabase = await staff()
  const { error } = await supabase.rpc('registrar_precio', {
    p_producto: datos.producto_id,
    p_proveedor: datos.proveedor_id || null,
    p_neto: datos.precio_neto,
    p_origen: datos.origen ?? 'llamada',
    p_unidad: datos.unidad?.trim() || null,
    p_nota: datos.nota?.trim() || null,
    p_aprobar: datos.aprobar ?? true,
  })

  if (error) return fallo(error)
  refrescar()
  return { ok: true }
}

/** El «Preguntar hoy» del cotizador: mete el material a la ronda del día. */
export async function preguntarPrecio(productoId: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('agregar_a_ronda', { p_producto: productoId })
  if (error) return fallo(error)
  refrescar()
  return { ok: true }
}

/**
 * Le pone nombre a un renglón que no se pudo ligar solo.
 *
 * Sin producto es «esto no es material»: se calla para siempre. Con producto,
 * el alias queda aprendido y ese texto no vuelve a preguntar, así que la lista
 * encoge cada semana.
 */
export async function ligarRenglon(
  renglonId: string,
  productoId: string | null,
): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('ligar_renglon', {
    p_renglon: renglonId,
    p_producto: productoId,
  })
  if (error) return fallo(error)
  refrescar()
  return { ok: true }
}

export async function aceptarPropuesta(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('aceptar_propuesta_precio', { p_id: id })
  if (error) return fallo(error)
  refrescar()
  revalidatePath('/admin')
  return { ok: true }
}

export async function rechazarPropuesta(id: string, motivo?: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('rechazar_propuesta_precio', {
    p_id: id,
    p_motivo: motivo?.trim() || null,
  })
  if (error) return fallo(error)
  refrescar()
  revalidatePath('/admin')
  return { ok: true }
}

/**
 * Arma la ronda a mano. En producción la corre el cron cada mañana; esto es
 * para verla hoy sin esperar a mañana, y para que en local exista del todo.
 */
export async function correrRonda(): Promise<Resultado<{ cuantos: number }>> {
  await requerirRol(['admin'])
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.rpc('ronda_precios_del_dia', { p_fecha: null })
  if (error) return fallo(error)
  refrescar()
  return { ok: true, datos: { cuantos: (data as number) ?? 0 } }
}

/** Deja de seguir un material —o vuelve a seguirlo— en la ronda de la mañana. */
export async function seguirPrecio(productoId: string, seguir: boolean): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase
    .from('productos')
    .update({ seguir_precio: seguir })
    .eq('id', productoId)
  if (error) return fallo(error)
  refrescar()
  return { ok: true }
}
