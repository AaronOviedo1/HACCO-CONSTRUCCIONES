'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { horaCorta } from '@/lib/format'
import { proximoPreventivo } from '@/lib/servicios'
import type { EstatusServicio, MetodoPago } from '@/types/database'

export type Resultado<T = undefined> = { ok: true; datos?: T } | { ok: false; error: string }

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

const fallo = (error: { message: string }): Resultado<never> => ({ ok: false, error: error.message })

/**
 * Un servicio se ve desde muchos lados: su propia pantalla, el tablero —donde
 * sale la cita del día—, la cobranza y el resumen de dinero. Se revalidan
 * todos porque el dinero de la reparación cuenta igual que el de una obra.
 */
function refrescar(id?: string) {
  revalidatePath('/admin/servicios')
  revalidatePath('/admin')
  revalidatePath('/admin/cobranza')
  revalidatePath('/admin/dinero')
  if (id) revalidatePath(`/admin/servicios/${id}`)
}

// ===========================================================================
// LA CITA
// ===========================================================================

/**
 * El recordatorio de la visita lo maneja la app, no el usuario.
 *
 * Es uno por servicio y se mueve con él: si se reagenda se corrige la fila que
 * ya existe en vez de crear otra, porque dos recordatorios de la misma visita
 * hacen sonar el teléfono dos veces y dejan uno vencido para siempre —el cron
 * manda lo vencido todas las mañanas hasta que alguien lo atiende—.
 *
 * `para` va en nulo a propósito: el aviso cruza con los teléfonos de quien le
 * toca, y si se pusiera al técnico y ese usuario no tuviera aparato dado de
 * alta, el aviso no le llegaría a nadie y nadie se enteraría. Así le llega a la
 * oficina, y el técnico va nombrado en el texto.
 */
async function acomodarCita(
  supabase: Awaited<ReturnType<typeof staff>>,
  servicioId: string,
  datos: {
    folio: string | null
    cliente: string
    descripcion: string
    domicilio: string | null
    tecnico: string | null
    fecha_visita: string
    hora_visita: string | null
  },
) {
  const { data: { user } } = await supabase.auth.getUser()

  const detalle = [
    datos.hora_visita ? horaCorta(datos.hora_visita) : null,
    datos.descripcion,
    datos.domicilio,
    datos.tecnico ? `téc. ${datos.tecnico}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const fila = {
    titulo: `Visita ${datos.folio ?? ''} · ${datos.cliente}`.replace('  ', ' ').trim(),
    nota: detalle || null,
    fecha: datos.fecha_visita,
    hora: datos.hora_visita,
    para: null,
    // Se reagendó: la visita vuelve a estar pendiente aunque ya se hubiera
    // dado por atendida.
    atendido_en: null,
    atendido_por: null,
  }

  const { data: existente } = await supabase
    .from('recordatorios')
    .select('id')
    .eq('servicio_id', servicioId)
    .limit(1)
    .maybeSingle()

  if (existente) {
    await supabase.from('recordatorios').update(fila).eq('id', existente.id)
    return
  }

  await supabase
    .from('recordatorios')
    .insert({ ...fila, servicio_id: servicioId, creado_por: user?.id ?? null })
}

/** Da la visita por hecha. Sin esto, el aviso de la mañana no se calla nunca. */
async function cerrarCita(
  supabase: Awaited<ReturnType<typeof staff>>,
  servicioId: string,
) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase
    .from('recordatorios')
    .update({ atendido_en: new Date().toISOString(), atendido_por: user?.id ?? null })
    .eq('servicio_id', servicioId)
    .is('atendido_en', null)
}

// ===========================================================================
// EL SERVICIO
// ===========================================================================

/** Con `id` corrige la cita; sin él levanta el servicio. */
export async function agendarServicio(datos: {
  id?: string
  cliente_id: string
  descripcion: string
  domicilio: string | null
  tecnico_id: string | null
  fecha_visita: string
  hora_visita: string | null
  requiere_factura: boolean
  /** Lo que cuesta ir. En cero cuando no se le cobra al cliente. */
  cuota_visita: number
  notas: string | null
}): Promise<Resultado<{ id: string }>> {
  if (!datos.cliente_id) return { ok: false, error: 'Falta decir de quién es el portón.' }
  if (!datos.descripcion.trim()) return { ok: false, error: 'Falta decir qué se va a revisar.' }
  if (!datos.fecha_visita) return { ok: false, error: 'Falta el día de la visita.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const fila = {
    cliente_id: datos.cliente_id,
    descripcion: datos.descripcion.trim(),
    domicilio: datos.domicilio?.trim() || null,
    tecnico_id: datos.tecnico_id || null,
    fecha_visita: datos.fecha_visita,
    hora_visita: datos.hora_visita || null,
    requiere_factura: datos.requiere_factura,
    // El IVA no se captura: si el cliente pide factura son los 16 de siempre.
    iva_pct: datos.requiere_factura ? 16 : 0,
    cuota_visita: Math.max(0, datos.cuota_visita),
    notas: datos.notas?.trim() || null,
  }

  const { data, error } = datos.id
    ? await supabase.from('servicios').update(fila).eq('id', datos.id).select('id').single()
    : await supabase
        .from('servicios')
        .insert({ ...fila, creado_por: user?.id ?? null })
        .select('id')
        .single()

  if (error) return fallo(error)

  const id = (data as { id: string }).id

  const { data: servicio } = await supabase
    .from('v_servicios')
    .select('folio, cliente, descripcion, domicilio, tecnico, fecha_visita, hora_visita, estatus')
    .eq('servicio_id', id)
    .maybeSingle()

  // La cita sólo se mueve mientras la visita siga pendiente: reabrir el aviso
  // de un servicio que ya se diagnosticó sería sacarlo del cajón sin motivo.
  if (servicio && (servicio.estatus === 'agendado' || !datos.id)) {
    await acomodarCita(supabase, id, servicio)
  }

  refrescar(id)
  return { ok: true, datos: { id } }
}

/** Lo que encontró el técnico. Cierra la cita: la visita ya se hizo. */
export async function guardarDiagnostico(id: string, diagnostico: string): Promise<Resultado> {
  if (!diagnostico.trim()) return { ok: false, error: 'Escribe qué encontró el técnico.' }

  const supabase = await staff()

  const { data: antes } = await supabase
    .from('servicios')
    .select('estatus')
    .eq('id', id)
    .maybeSingle()

  const parche: { diagnostico: string; estatus?: EstatusServicio } = {
    diagnostico: diagnostico.trim(),
  }
  // Corregir el diagnóstico de un servicio ya aprobado no lo devuelve atrás.
  if (antes?.estatus === 'agendado') parche.estatus = 'diagnostico'

  const { error } = await supabase.from('servicios').update(parche).eq('id', id)
  if (error) return fallo(error)

  await cerrarCita(supabase, id)
  refrescar(id)
  return { ok: true }
}

/**
 * El presupuesto: las partidas se reemplazan enteras.
 *
 * Se borra y se vuelve a insertar en vez de cuadrar altas, bajas y cambios uno
 * por uno: son tres renglones a lo mucho y el trigger deja el subtotal al día
 * solo. El total ni se toca, que es columna generada.
 */
export async function guardarPresupuesto(
  id: string,
  datos: {
    items: {
      descripcion: string
      cantidad: number
      unidad: string | null
      precio_unitario: number
    }[]
    requiere_factura: boolean
    vigencia_dias: number
    garantia_dias: number
    /** Se puede poner en cero: hay trabajos donde la visita se absorbe. */
    cuota_visita: number
  },
): Promise<Resultado> {
  const items = datos.items.filter((i) => i.descripcion.trim())
  if (items.length === 0) {
    // Decir «falta una partida» a quien ya escribió el precio no ayuda: lo que
    // le falta es el concepto, y hay que nombrarlo.
    const algoCapturado = datos.items.some((i) => i.precio_unitario > 0)
    return {
      ok: false,
      error: algoCapturado
        ? 'Falta decir qué es cada partida: escribe el concepto.'
        : 'El presupuesto necesita al menos una partida.',
    }
  }
  if (items.some((i) => i.precio_unitario <= 0)) {
    return { ok: false, error: 'Cada partida necesita su precio.' }
  }

  const supabase = await staff()

  const { data: antes } = await supabase
    .from('servicios')
    .select('estatus')
    .eq('id', id)
    .maybeSingle()

  const { error: borrado } = await supabase.from('servicio_items').delete().eq('servicio_id', id)
  if (borrado) return fallo(borrado)

  const { error: alta } = await supabase.from('servicio_items').insert(
    items.map((i, orden) => ({
      servicio_id: id,
      descripcion: i.descripcion.trim(),
      cantidad: i.cantidad || 1,
      unidad: i.unidad || null,
      precio_unitario: i.precio_unitario,
      orden,
    })),
  )
  if (alta) return fallo(alta)

  const parche: {
    requiere_factura: boolean
    iva_pct: number
    vigencia_dias: number
    garantia_dias: number
    cuota_visita: number
    fecha_presupuesto: string
    estatus?: EstatusServicio
  } = {
    requiere_factura: datos.requiere_factura,
    iva_pct: datos.requiere_factura ? 16 : 0,
    vigencia_dias: datos.vigencia_dias,
    garantia_dias: datos.garantia_dias,
    cuota_visita: Math.max(0, datos.cuota_visita),
    fecha_presupuesto: new Date().toISOString().slice(0, 10),
  }
  // Corregir el precio de un servicio ya aprobado no lo devuelve a presupuesto.
  if (antes?.estatus === 'agendado' || antes?.estatus === 'diagnostico') {
    parche.estatus = 'presupuestado'
  }

  const { error } = await supabase.from('servicios').update(parche).eq('id', id)
  if (error) return fallo(error)

  await cerrarCita(supabase, id)
  refrescar(id)
  return { ok: true }
}

/** El sí o el no del cliente. Aquí nace la venta. */
export async function resolverServicio(
  id: string,
  aprobado: boolean,
  fecha: string,
): Promise<Resultado> {
  if (!fecha) return { ok: false, error: 'Falta la fecha en que contestó el cliente.' }

  const supabase = await staff()

  const { data: servicio } = await supabase
    .from('v_servicios')
    .select('presupuesto')
    .eq('servicio_id', id)
    .maybeSingle()

  if (aprobado && Number(servicio?.presupuesto ?? 0) <= 0) {
    return { ok: false, error: 'Captura el presupuesto antes de darlo por aprobado.' }
  }

  const { error } = await supabase
    .from('servicios')
    .update({ estatus: aprobado ? 'aprobado' : 'rechazado', fecha_resolucion: fecha })
    .eq('id', id)

  if (error) return fallo(error)

  await cerrarCita(supabase, id)
  refrescar(id)
  return { ok: true }
}

export async function marcarReparado(
  id: string,
  fecha: string,
  notas: string | null,
): Promise<Resultado> {
  if (!fecha) return { ok: false, error: 'Falta la fecha en que quedó la reparación.' }

  const supabase = await staff()
  const parche: { estatus: EstatusServicio; fecha_reparacion: string; notas?: string | null } = {
    estatus: 'reparado',
    fecha_reparacion: fecha,
  }
  if (notas !== null) parche.notas = notas.trim() || null

  const { error } = await supabase.from('servicios').update(parche).eq('id', id)
  if (error) return fallo(error)

  refrescar(id)
  return { ok: true }
}

/** Devuelve el servicio a una etapa anterior cuando se marcó de más. */
export async function regresarServicio(id: string, estatus: EstatusServicio): Promise<Resultado> {
  const supabase = await staff()

  const parche: {
    estatus: EstatusServicio
    fecha_resolucion?: string | null
    fecha_reparacion?: string | null
  } = { estatus }
  // Deshacer la resolución borra su fecha: si no, la venta seguiría contando
  // en el mes de un sí que ya no existe.
  if (estatus !== 'aprobado' && estatus !== 'rechazado' && estatus !== 'reparado') {
    parche.fecha_resolucion = null
  }
  if (estatus !== 'reparado') parche.fecha_reparacion = null

  const { error } = await supabase.from('servicios').update(parche).eq('id', id)
  if (error) return fallo(error)

  refrescar(id)
  return { ok: true }
}

export async function cancelarServicio(id: string, motivo: string | null): Promise<Resultado> {
  const supabase = await staff()

  const { data: pagos } = await supabase
    .from('servicio_pagos')
    .select('id')
    .eq('servicio_id', id)
    .limit(1)

  if (pagos && pagos.length > 0) {
    return { ok: false, error: 'No se puede cancelar: ya tiene dinero cobrado.' }
  }

  // Cancelar pone el total en cero: es «no se hizo la visita». Si el técnico
  // ya fue, lo que corresponde es rechazarlo y cobrar la cuota, no cancelarlo.
  const parche: { estatus: EstatusServicio; notas?: string } = { estatus: 'cancelado' }
  if (motivo?.trim()) parche.notas = motivo.trim()

  const { error } = await supabase.from('servicios').update(parche).eq('id', id)
  if (error) return fallo(error)

  await cerrarCita(supabase, id)
  refrescar(id)
  return { ok: true }
}

export async function eliminarServicio(id: string): Promise<Resultado> {
  const supabase = await staff()

  // Los pagos cuelgan en cascada: sin esta revisión, borrar el servicio se
  // llevaría por delante el dinero cobrado sin decir nada.
  const { data: pagos } = await supabase
    .from('servicio_pagos')
    .select('monto')
    .eq('servicio_id', id)

  if (pagos && pagos.length > 0) {
    const total = pagos.reduce((suma, p) => suma + Number(p.monto), 0)
    return {
      ok: false,
      error: `No se puede eliminar: tiene ${pagos.length} ${
        pagos.length === 1 ? 'cobro registrado' : 'cobros registrados'
      } por ${total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}. Quítalos primero.`,
    }
  }

  const { error } = await supabase.from('servicios').delete().eq('id', id)
  if (error) return fallo(error)

  refrescar()
  return { ok: true }
}

/**
 * Agenda el preventivo que sigue.
 *
 * Los preventivos son cada seis meses y no los pide el cliente: se ofrecen al
 * cerrar el trabajo, que es el único momento en que alguien se acuerda. Nace
 * del servicio anterior —mismo portón, mismo domicilio— y queda ligado a él
 * para poder seguir la historia de esa puerta con los años.
 */
export async function agendarPreventivo(id: string): Promise<Resultado<{ id: string }>> {
  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: origen } = await supabase
    .from('servicios')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!origen) return { ok: false, error: 'Ese servicio ya no existe.' }

  const { data: yaHay } = await supabase
    .from('servicios')
    .select('id')
    .eq('origen_id', id)
    .limit(1)
    .maybeSingle()

  if (yaHay) {
    return { ok: false, error: 'De este servicio ya salió un preventivo agendado.' }
  }

  const fecha = proximoPreventivo(origen.fecha_reparacion ?? origen.fecha_visita)

  const { data, error } = await supabase
    .from('servicios')
    .insert({
      tipo: 'preventivo',
      origen_id: id,
      cliente_id: origen.cliente_id,
      descripcion: 'Mantenimiento preventivo de portón',
      domicilio: origen.domicilio,
      tecnico_id: origen.tecnico_id,
      fecha_visita: fecha,
      hora_visita: origen.hora_visita,
      requiere_factura: origen.requiere_factura,
      iva_pct: origen.iva_pct,
      creado_por: user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) return fallo(error)

  const nuevo = (data as { id: string }).id

  const { data: servicio } = await supabase
    .from('v_servicios')
    .select('folio, cliente, descripcion, domicilio, tecnico, fecha_visita, hora_visita')
    .eq('servicio_id', nuevo)
    .maybeSingle()

  if (servicio) await acomodarCita(supabase, nuevo, servicio)

  refrescar(id)
  refrescar(nuevo)
  return { ok: true, datos: { id: nuevo } }
}

// ===========================================================================
// EL COBRO
// ===========================================================================
export async function registrarCobroServicio(pago: {
  servicio_id: string
  monto: number
  metodo: MetodoPago
  fecha: string
  comprobante_path: string | null
  notas: string | null
}): Promise<Resultado> {
  if (pago.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }
  if (!pago.fecha) return { ok: false, error: 'Falta la fecha del pago.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('servicio_pagos')
    .insert({ ...pago, registrado_por: user?.id ?? null })

  if (error) return fallo(error)

  refrescar(pago.servicio_id)
  return { ok: true }
}

export async function actualizarCobroServicio(
  id: string,
  servicioId: string,
  pago: {
    monto: number
    metodo: MetodoPago
    fecha: string
    comprobante_path: string | null
    notas: string | null
  },
): Promise<Resultado> {
  if (pago.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }
  if (!pago.fecha) return { ok: false, error: 'Falta la fecha del pago.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: antes } = await supabase
    .from('servicio_pagos')
    .select('comprobante_path')
    .eq('id', id)
    .maybeSingle()

  if (!antes) return { ok: false, error: 'Ese pago ya no existe.' }

  const { error } = await supabase
    .from('servicio_pagos')
    .update({ ...pago, editado_por: user?.id ?? null })
    .eq('id', id)

  if (error) return fallo(error)

  // El comprobante que se sustituyó ya no lo apunta nadie.
  if (antes.comprobante_path && antes.comprobante_path !== pago.comprobante_path) {
    await supabase.storage.from('comprobantes').remove([antes.comprobante_path])
  }

  refrescar(servicioId)
  return { ok: true }
}

export async function eliminarCobroServicio(id: string, servicioId: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('servicio_pagos').delete().eq('id', id)
  if (error) return fallo(error)

  refrescar(servicioId)
  return { ok: true }
}
