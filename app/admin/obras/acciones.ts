'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import type {
  EstatusObra, EstatusSolicitud, EstatusTarea, MetodoPago, OrigenMaterial,
  ResultadoBorradoObra, ResultadoCierre, ResultadoReapertura, ResultadoReasignacion,
  TipoAvance, TipoPagoCobranza,
} from '@/types/database'

export type Resultado<T = undefined> = { ok: true; datos?: T } | { ok: false; error: string }

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

function refrescar(obraId: string) {
  revalidatePath(`/admin/obras/${obraId}`)
  revalidatePath('/admin/obras')
  revalidatePath('/admin')
}

const fallo = (error: { message: string }): Resultado<never> => ({ ok: false, error: error.message })

// ===========================================================================
// OBRA
// ===========================================================================
export async function actualizarObra(
  id: string,
  parche: {
    nombre?: string
    domicilio?: string | null
    estatus?: EstatusObra
    monto_cotizado?: number
    fecha_estimada_entrega?: string | null
    notas?: string | null
  },
): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase
    .from('obras')
    .update({ ...parche, fecha_ultima_actualizacion: new Date().toISOString() })
    .eq('id', id)

  if (error) return fallo(error)
  refrescar(id)
  return { ok: true }
}

/** Con `id` corrige la nota; sin él la agrega. */
export async function anotarEnBitacora(
  obraId: string,
  texto: string,
  id?: string,
): Promise<Resultado> {
  const supabase = await staff()
  if (!texto.trim()) return { ok: false, error: 'La nota no puede ir vacía.' }

  const { data: { user } } = await supabase.auth.getUser()

  // Sólo se corrigen las notas escritas a mano: los renglones que pone el
  // sistema —una obra que cambió de estatus, un avance que entró— son el
  // historial de lo que pasó y ahí no se escribe.
  const { error } = id
    ? await supabase
        .from('bitacora_obra')
        .update({ descripcion: texto.trim(), editado_por: user?.id ?? null })
        .eq('id', id)
        .eq('tipo', 'nota')
    : await supabase.from('bitacora_obra').insert({
        obra_id: obraId,
        tipo: 'nota',
        descripcion: texto.trim(),
        autor_id: user?.id ?? null,
      })

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

export async function eliminarNotaBitacora(obraId: string, id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('bitacora_obra').delete().eq('id', id).eq('tipo', 'nota')
  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

/**
 * Dirección y Administración también pueden dejar un avance cuando van a la
 * obra. Mismo feed que la cuadrilla; la foto se sube desde el navegador a
 * avances/{obra_id}/... igual que en /obra.
 */
export async function registrarAvanceAdmin(
  obraId: string,
  datos: {
    tipo: TipoAvance
    storage_path: string | null
    comentario: string
    porcentaje: number | null
  },
): Promise<Resultado> {
  const perfil = await requerirRol(['admin', 'administracion'])
  const supabase = await crearClienteServidor()

  if (!datos.storage_path && !datos.comentario.trim()) {
    return { ok: false, error: 'Sube una foto o escribe una nota.' }
  }

  const { error } = await supabase.from('avances').insert({
    obra_id: obraId,
    autor_id: perfil.id,
    tipo: datos.tipo,
    storage_path: datos.storage_path,
    comentario: datos.comentario.trim() || null,
    porcentaje_avance: datos.porcentaje,
  })

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

/**
 * Corrige la nota y el porcentaje de un avance ya subido. La foto no se toca:
 * si la foto está mal, el avance se borra y se sube otro.
 *
 * Bajar el porcentaje baja el avance de la obra —lo recalcula el trigger de
 * 20260810000030— y con él el devengado de los contratos de esa obra. Quien
 * corrige tiene que saberlo antes de guardar, no después: el aviso lo da la
 * pantalla, aquí sólo se guarda.
 */
export async function editarAvance(
  obraId: string,
  id: string,
  datos: { comentario: string; porcentaje: number | null },
): Promise<Resultado> {
  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('avances')
    .update({
      comentario: datos.comentario.trim() || null,
      porcentaje_avance: datos.porcentaje,
      editado_por: user?.id ?? null,
    })
    .eq('id', id)

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

export async function eliminarAvance(obraId: string, id: string): Promise<Resultado> {
  const supabase = await staff()

  // La foto se va con el avance: si se queda, ocupa el bucket para siempre y
  // ya no hay nada que la enseñe.
  const { data: avance } = await supabase
    .from('avances')
    .select('storage_path')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('avances').delete().eq('id', id)
  if (error) return fallo(error)

  if (avance?.storage_path) {
    await supabase.storage.from('avances').remove([avance.storage_path])
  }

  refrescar(obraId)
  return { ok: true }
}

// ===========================================================================
// CONCEPTOS
// ===========================================================================
export async function guardarConcepto(
  obraId: string,
  concepto: { id?: string; nombre: string; presupuesto: number },
): Promise<Resultado> {
  const supabase = await staff()
  if (!concepto.nombre.trim()) return { ok: false, error: 'El concepto necesita un nombre.' }

  const fila = {
    obra_id: obraId,
    nombre: concepto.nombre.trim(),
    presupuesto: concepto.presupuesto,
  }

  const { error } = concepto.id
    ? await supabase.from('obra_conceptos').update(fila).eq('id', concepto.id)
    : await supabase.from('obra_conceptos').insert(fila)

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

export async function eliminarConcepto(obraId: string, id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('obra_conceptos').delete().eq('id', id)
  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

// ===========================================================================
// CONTRATOS DE MANO DE OBRA
// ===========================================================================
export async function guardarContrato(
  obraId: string,
  contrato: {
    id?: string
    trabajador_id: string
    trabajos: Record<string, string[]>
    m2: number
    tarifa_m2: number
    otros_importe: number
    reparaciones: { descripcion: string; importe: number }[]
    costo_haaco_pct: number
    fecha_inicia: string | null
    fecha_finaliza: string | null
    notas: string | null
  },
): Promise<Resultado<{ id: string }>> {
  const supabase = await staff()
  if (!contrato.trabajador_id) return { ok: false, error: 'Falta elegir al oficial.' }

  const reparaciones = contrato.reparaciones.filter((r) => r.descripcion.trim() || r.importe > 0)

  const fila = {
    obra_id: obraId,
    trabajador_id: contrato.trabajador_id,
    trabajos: contrato.trabajos,
    m2: contrato.m2,
    tarifa_m2: contrato.tarifa_m2,
    otros_importe: contrato.otros_importe,
    reparaciones,
    reparaciones_importe: reparaciones.reduce((s, r) => s + r.importe, 0),
    costo_haaco_pct: contrato.costo_haaco_pct,
    fecha_inicia: contrato.fecha_inicia,
    fecha_finaliza: contrato.fecha_finaliza,
    notas: contrato.notas,
  }

  const { data, error } = contrato.id
    ? await supabase.from('contratos_oficial').update(fila).eq('id', contrato.id).select('id').single()
    : await supabase.from('contratos_oficial').insert(fila).select('id').single()

  if (error) return fallo(error)

  refrescar(obraId)
  revalidatePath('/admin/nomina')
  return { ok: true, datos: { id: data!.id } }
}

export async function firmarContrato(
  obraId: string,
  id: string,
  quien: 'oficial' | 'director',
): Promise<Resultado> {
  const supabase = await staff()
  const ahora = new Date().toISOString()
  const parche =
    quien === 'oficial' ? { firma_oficial_at: ahora } : { firma_director_at: ahora }

  const { error } = await supabase.from('contratos_oficial').update(parche).eq('id', id)

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

/**
 * El oficial se va a media obra y otro la termina. El contrato del que sale se
 * ajusta a los metros que ejecutó y se cierra; se abre uno nuevo, a nombre del
 * que entra, por lo que falta. Así cada quien se queda con sus recibos.
 */
export async function reasignarContrato(
  obraId: string,
  datos: {
    contrato_id: string
    nuevo_trabajador_id: string
    fecha: string
    /** Metros ya ejecutados por quien se va. Nulo = lo proporcional a lo pagado. */
    m2_ejecutados: number | null
    motivo: string | null
  },
): Promise<Resultado<ResultadoReasignacion>> {
  const supabase = await staff()

  if (!datos.nuevo_trabajador_id) {
    return { ok: false, error: 'Elige al oficial que se queda con la obra.' }
  }

  const { data, error } = await supabase.rpc('reasignar_contrato', {
    p_contrato: datos.contrato_id,
    p_nuevo_trabajador: datos.nuevo_trabajador_id,
    p_fecha: datos.fecha,
    p_m2_ejecutados: datos.m2_ejecutados,
    p_motivo: datos.motivo,
  })

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/nomina')
  revalidatePath('/admin/herramientas')
  return { ok: true, datos: data as ResultadoReasignacion }
}

export async function eliminarContrato(obraId: string, id: string): Promise<Resultado> {
  const supabase = await staff()

  const { count } = await supabase
    .from('nomina_pagos')
    .select('id', { count: 'exact', head: true })
    .eq('contrato_id', id)

  if ((count ?? 0) > 0) {
    return { ok: false, error: 'No se puede borrar: el contrato ya tiene abonos de nómina.' }
  }

  const { error } = await supabase.from('contratos_oficial').delete().eq('id', id)
  if (error) return fallo(error)

  refrescar(obraId)
  revalidatePath('/admin/nomina')
  return { ok: true }
}

// ===========================================================================
// PAGARÉS DE HERRAMIENTA
// ===========================================================================
export async function crearPagare(
  obraId: string,
  contratoId: string,
  herramientas: string[],
): Promise<Resultado<{ id: string }>> {
  if (herramientas.length === 0) {
    return { ok: false, error: 'Elige al menos una herramienta.' }
  }

  const supabase = await staff()
  const { data, error } = await supabase.rpc('crear_pagare', {
    p_contrato: contratoId,
    p_herramientas: herramientas,
  })

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/herramientas')
  return { ok: true, datos: { id: data as string } }
}

export async function editarPagare(
  obraId: string,
  pagareId: string,
  herramientas: string[],
): Promise<Resultado<number>> {
  if (herramientas.length === 0) {
    return { ok: false, error: 'El pagaré tiene que quedar con al menos una herramienta.' }
  }

  const supabase = await staff()
  const { data, error } = await supabase.rpc('editar_pagare', {
    p_pagare: pagareId,
    p_herramientas: herramientas,
  })

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/herramientas')
  return { ok: true, datos: data as number }
}

export async function cancelarPagare(obraId: string, pagareId: string): Promise<Resultado<number>> {
  const supabase = await staff()
  const { data, error } = await supabase.rpc('cancelar_pagare', { p_pagare: pagareId })

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/herramientas')
  return { ok: true, datos: data as number }
}

export async function devolverHerramienta(obraId: string, itemId: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase
    .from('pagare_items')
    .update({ devuelta: true, fecha_devolucion: new Date().toISOString().slice(0, 10) })
    .eq('id', itemId)

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/herramientas')
  return { ok: true }
}

// ===========================================================================
// MATERIALES
// ===========================================================================
export async function guardarMaterial(
  obraId: string,
  material: {
    id?: string
    origen: OrigenMaterial
    concepto_id: string | null
    material: string
    piezas: number
    costo: number
    folio_factura: string | null
    es_taller: boolean
  },
): Promise<Resultado> {
  const supabase = await staff()
  if (!material.material.trim()) return { ok: false, error: 'Falta el nombre del material.' }

  const fila = {
    obra_id: obraId,
    origen: material.origen,
    concepto_id: material.concepto_id,
    material: material.material.trim(),
    piezas: material.piezas || 1,
    costo: material.costo,
    folio_factura: material.es_taller ? null : material.folio_factura,
    es_taller: material.es_taller,
  }

  const { error } = material.id
    ? await supabase.from('obra_materiales').update(fila).eq('id', material.id)
    : await supabase.from('obra_materiales').insert(fila)

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

/**
 * Borra el renglón vía RPC: si el material había salido del taller, la
 * cantidad regresa al kardex con un movimiento de reversa.
 */
export async function eliminarMaterial(obraId: string, id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('eliminar_material_obra', { p_material: id })
  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

/** Salida del taller: descuenta el kardex y anota el material con folio TALLER. */
export async function salidaDeTaller(
  obraId: string,
  productoId: string,
  cantidad: number,
  conceptoId: string | null,
  notas: string | null,
): Promise<Resultado> {
  if (cantidad <= 0) return { ok: false, error: 'La cantidad tiene que ser mayor a cero.' }

  const supabase = await staff()
  const { error } = await supabase.rpc('salida_taller_a_obra', {
    p_obra: obraId,
    p_producto: productoId,
    p_cantidad: cantidad,
    p_concepto: conceptoId,
    p_notas: notas,
  })

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

// ===========================================================================
// CRONOGRAMA
// ===========================================================================
export async function guardarTarea(
  obraId: string,
  tarea: {
    id?: string
    padre_id?: string | null
    nombre: string
    fecha_inicio: string | null
    fecha_fin: string | null
    estatus: EstatusTarea
    responsable_id: string | null
    orden: number
    peso?: number
    /** null en tareas con subtareas: su avance es derivado y no se manda. */
    avance_pct?: number | null
  },
): Promise<Resultado> {
  const supabase = await staff()
  if (!tarea.nombre.trim()) return { ok: false, error: 'La tarea necesita un nombre.' }

  const { avance_pct, peso, ...resto } = tarea
  const fila = {
    obra_id: obraId,
    ...resto,
    nombre: tarea.nombre.trim(),
    ...(peso != null && peso > 0 ? { peso } : {}),
    ...(avance_pct != null ? { avance_pct: Math.min(100, Math.max(0, avance_pct)) } : {}),
  }

  const { error } = tarea.id
    ? await supabase.from('cronograma_tareas').update(fila).eq('id', tarea.id)
    : await supabase.from('cronograma_tareas').insert(fila)

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

/** Marcar terminada de un toque: el trigger pone el 100 % y recalcula la obra. */
export async function marcarTareaTerminada(obraId: string, id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase
    .from('cronograma_tareas')
    .update({ estatus: 'terminada' })
    .eq('id', id)
  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

export async function eliminarTarea(obraId: string, id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('cronograma_tareas').delete().eq('id', id)
  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

/**
 * Arma el cronograma inicial con lo que ya trae la cotización: primero los
 * pasos de la descripción del trabajo (en su orden) y luego una tarea por
 * partida. Cada tarea queda de un día, encadenada a partir de hoy; de ahí se
 * ajustan fechas o se recorren.
 */
export async function crearCronogramaDesdePartidas(obraId: string): Promise<Resultado<number>> {
  const supabase = await staff()

  const { data: obra } = await supabase
    .from('obras')
    .select('id, cotizacion_id')
    .eq('id', obraId)
    .single()
  if (!obra) return { ok: false, error: 'No se encontró la obra.' }

  const [{ data: items }, { data: procesos }, { data: textos }, { count: existentes }] =
    await Promise.all([
      supabase
        .from('cotizacion_items')
        .select('descripcion, orden')
        .eq('cotizacion_id', obra.cotizacion_id)
        .order('orden'),
      supabase
        .from('cotizacion_procesos')
        .select('contenido_override, texto_proceso_id, orden')
        .eq('cotizacion_id', obra.cotizacion_id)
        .order('orden'),
      supabase.from('textos_proceso').select('id, titulo'),
      supabase.from('cronograma_tareas').select('id', { count: 'exact', head: true }).eq('obra_id', obraId),
    ])

  if ((existentes ?? 0) > 0) {
    return { ok: false, error: 'El cronograma ya tiene tareas; agrégalas una por una.' }
  }

  const titulos = new Map((textos ?? []).map((t) => [t.id, t.titulo]))
  const recortar = (s: string) => (s.length > 60 ? `${s.slice(0, 60).trimEnd()}…` : s)

  const nombres = [
    // Pasos del proceso: si el bullet salió de la biblioteca se usa su título.
    ...(procesos ?? []).map((p) =>
      (p.texto_proceso_id && titulos.get(p.texto_proceso_id)) ||
      recortar((p.contenido_override ?? '').trim()),
    ),
    ...(items ?? []).map((i) => recortar(i.descripcion.trim())),
  ].filter(Boolean)

  if (nombres.length === 0) {
    return { ok: false, error: 'La cotización no tiene partidas ni descripción del trabajo.' }
  }

  const hoy = new Date()
  const dia = (n: number) => {
    const d = new Date(hoy)
    d.setDate(d.getDate() + n)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const { error } = await supabase.from('cronograma_tareas').insert(
    nombres.map((nombre, i) => ({
      obra_id: obraId,
      nombre,
      fecha_inicio: dia(i),
      fecha_fin: dia(i),
      estatus: 'pendiente' as EstatusTarea,
      responsable_id: null,
      orden: i,
    })),
  )

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true, datos: nombres.length }
}

/** Llovió, faltó el oficial, se atrasó el material: se recorre lo que falta. */
export async function recorrerCronograma(
  obraId: string,
  dias: number,
  desde: string,
): Promise<Resultado<number>> {
  if (dias === 0) return { ok: false, error: 'Indica cuántos días recorrer.' }

  const supabase = await staff()
  const { data, error } = await supabase.rpc('recorrer_cronograma', {
    p_obra: obraId,
    p_dias: dias,
    p_desde: desde,
  })

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true, datos: data as number }
}

// ===========================================================================
// COBRANZA Y RECIBO-CONTRATO
// ===========================================================================
export async function registrarPago(
  obraId: string,
  pago: {
    cotizacion_id: string
    tipo: TipoPagoCobranza
    monto: number
    metodo: MetodoPago
    fecha: string
    notas: string | null
  },
  recibo: {
    generar: boolean
    concepto: string
    esquema_pagos: string | null
    fecha_inicio: string | null
    fecha_estimada_entrega: string | null
    datos_bancarios: string | null
  },
): Promise<Resultado<{ reciboId?: string }>> {
  if (pago.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: filaPago, error: errorPago } = await supabase
    .from('pagos_cobranza')
    .insert({ ...pago, registrado_por: user?.id ?? null })
    .select('id')
    .single()

  if (errorPago) return fallo(errorPago)

  let reciboId: string | undefined
  if (recibo.generar) {
    const { data: filaRecibo, error: errorRecibo } = await supabase
      .from('recibos')
      .insert({
        pago_id: filaPago!.id,
        cotizacion_id: pago.cotizacion_id,
        obra_id: obraId,
        concepto: recibo.concepto,
        esquema_pagos: recibo.esquema_pagos,
        fecha_inicio: recibo.fecha_inicio,
        fecha_estimada_entrega: recibo.fecha_estimada_entrega,
        datos_bancarios: recibo.datos_bancarios,
      })
      .select('id')
      .single()

    if (errorRecibo) return fallo(errorRecibo)
    reciboId = filaRecibo!.id
  }

  refrescar(obraId)
  revalidatePath('/admin/cobranza')
  return { ok: true, datos: { reciboId } }
}

// ===========================================================================
// DETALLES, ENTREGA Y CIERRE
// ===========================================================================
export async function agregarDetalle(obraId: string, descripcion: string): Promise<Resultado> {
  if (!descripcion.trim()) return { ok: false, error: 'Escribe el detalle.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('obra_detalles').insert({
    obra_id: obraId,
    descripcion: descripcion.trim(),
    reportado_por: user?.id ?? null,
  })

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

export async function marcarDetalle(
  obraId: string,
  id: string,
  atendido: boolean,
): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase
    .from('obra_detalles')
    .update({
      atendido,
      fecha_atencion: atendido ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', id)

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

export async function eliminarDetalle(obraId: string, id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('obra_detalles').delete().eq('id', id)
  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

export async function entregarObra(obraId: string, fecha: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('entregar_obra', { p_obra: obraId, p_fecha: fecha })
  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true }
}

export async function cerrarObra(
  obraId: string,
  fecha: string,
  forzar: boolean,
): Promise<Resultado<ResultadoCierre>> {
  const supabase = await staff()
  const { data, error } = await supabase.rpc('cerrar_obra', {
    p_obra: obraId,
    p_fecha: fecha,
    p_forzar: forzar,
  })

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/herramientas')
  revalidatePath('/admin/cotizaciones')
  return { ok: true, datos: data as ResultadoCierre }
}

/**
 * Devuelve a «en obra» una OT que se cerró: por error, o porque salió trabajo
 * adicional después de entregar. Los contratos de mano de obra vuelven a la
 * nómina y la cotización deja de estar terminada. Los pagarés no reviven.
 *
 * Es de Dirección, no del staff en general: reabrir mueve saldos de cliente y
 * de nómina que ya se habían dado por cerrados.
 */
export async function reabrirObra(
  obraId: string,
  motivo: string,
): Promise<Resultado<ResultadoReapertura>> {
  await requerirRol(['admin'])
  const supabase = await crearClienteServidor()

  if (!motivo.trim()) return { ok: false, error: 'Escribe por qué se reabre la OT.' }

  const { data, error } = await supabase.rpc('reabrir_obra', {
    p_obra: obraId,
    p_motivo: motivo.trim(),
  })

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/cotizaciones')
  revalidatePath('/admin/nomina')
  return { ok: true, datos: data as ResultadoReapertura }
}

/**
 * Borra la OT completa: conceptos, cronograma, material, avances, bitácora,
 * contratos con sus pagarés y la póliza. La herramienta regresa al taller
 * antes del borrado. La función se niega si ya hubo dinero de por medio.
 */
export async function eliminarObra(obraId: string): Promise<Resultado<ResultadoBorradoObra>> {
  const supabase = await staff()
  const { data, error } = await supabase.rpc('eliminar_obra', { p_obra: obraId })

  if (error) return fallo(error)

  const borrado = data as ResultadoBorradoObra
  revalidatePath('/admin/obras')
  revalidatePath('/admin')
  revalidatePath('/admin/herramientas')
  revalidatePath('/admin/cotizaciones')
  revalidatePath(`/admin/cotizaciones/${borrado.cotizacion_id}`)
  return { ok: true, datos: borrado }
}

// ===========================================================================
// PÓLIZA DE GARANTÍA
// ===========================================================================
export async function guardarPoliza(
  obraId: string,
  poliza: {
    id?: string
    fecha_conclusion: string | null
    vigencia_dias: number
    items: { area: string; pintura: string; color: string; codigo: string }[]
    condiciones: string | null
    deslindes: string | null
  },
): Promise<Resultado<{ id: string }>> {
  const supabase = await staff()

  const fila = {
    obra_id: obraId,
    fecha_conclusion: poliza.fecha_conclusion,
    vigencia_dias: poliza.vigencia_dias,
    items: poliza.items.filter((i) => i.area.trim() || i.pintura.trim()),
    condiciones: poliza.condiciones,
    deslindes: poliza.deslindes,
  }

  const { data, error } = poliza.id
    ? await supabase.from('polizas_garantia').update(fila).eq('id', poliza.id).select('id').single()
    : await supabase.from('polizas_garantia').insert(fila).select('id').single()

  if (error) return fallo(error)
  refrescar(obraId)
  return { ok: true, datos: { id: data!.id } }
}

// ===========================================================================
// SOLICITUDES DE MATERIAL DEL HERRERO
// ===========================================================================
export async function cambiarEstatusSolicitud(
  obraId: string,
  id: string,
  estatus: EstatusSolicitud,
  notas: string | null,
): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase
    .from('solicitudes_material')
    .update({ estatus, notas })
    .eq('id', id)

  if (error) return fallo(error)
  refrescar(obraId)
  revalidatePath('/admin/obras')
  return { ok: true }
}
