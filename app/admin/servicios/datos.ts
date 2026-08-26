import 'server-only'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'

/**
 * Lo que el formulario de la visita necesita: a quién es y quién va.
 *
 * Los técnicos salen de la cuadrilla y de la oficina: quien va a ver un portón
 * puede ser el herrero, pero también Luis. Se piden activos y ordenados por
 * nombre, que es como se buscan en la lista.
 */
export async function cargarCatalogosServicio() {
  const supabase = await crearClienteServidor()

  const [{ data: clientes }, { data: tecnicos }] = await Promise.all([
    supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
    supabase.from('profiles').select('id, nombre, rol, oficio').eq('activo', true).order('nombre'),
  ])

  return { clientes: clientes ?? [], tecnicos: tecnicos ?? [] }
}

/**
 * El servicio completo para su pantalla.
 *
 * Cuatro consultas cortas y el cruce en JS: la vista ya trae al cliente y al
 * técnico resueltos, y lo demás cuelga por su propio id.
 */
export async function cargarServicio(id: string) {
  const supabase = await crearClienteServidor()

  const { data: servicio } = await supabase
    .from('v_servicios')
    .select('*')
    .eq('servicio_id', id)
    .maybeSingle()

  if (!servicio) notFound()

  const [{ data: items }, { data: pagos }, { data: cita }, { data: siguiente }] =
    await Promise.all([
      supabase.from('servicio_items').select('*').eq('servicio_id', id).order('orden'),
      supabase.from('servicio_pagos').select('*').eq('servicio_id', id).order('fecha'),
      supabase.from('recordatorios').select('*').eq('servicio_id', id).order('fecha'),
      // El preventivo que ya salió de aquí, para no ofrecerlo dos veces.
      supabase.from('servicios').select('id, folio, fecha_visita').eq('origen_id', id).limit(1),
    ])

  return {
    servicio,
    items: items ?? [],
    pagos: pagos ?? [],
    cita: cita?.[0] ?? null,
    preventivo: siguiente?.[0] ?? null,
  }
}
