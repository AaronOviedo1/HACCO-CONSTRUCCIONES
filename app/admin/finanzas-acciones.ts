'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { REGLAS } from '@/lib/empresa'
import { hoyHermosillo } from '@/lib/format'
import type {
  EstadoPagoFijo, GastoSql, MetodoPago, PagoCxpLote, PeriodicidadPago, ResultadoPagoLote,
  TipoDeduccion, TipoMovimientoCaja, TipoPagoCobranza, TipoPagoProgramado, TipoProducto,
} from '@/types/database'

export type Resultado<T = undefined> = { ok: true; datos?: T } | { ok: false; error: string }

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

const fallo = (error: { message: string }): Resultado<never> => ({ ok: false, error: error.message })

// ===========================================================================
// GASTOS
// ===========================================================================
export async function registrarGasto(gasto: GastoSql): Promise<Resultado<{ id: string }>> {
  if (!gasto.descripcion.trim()) return { ok: false, error: 'Falta la descripción del gasto.' }
  if (gasto.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }
  if (gasto.condicion === 'credito' && !gasto.proveedor_id) {
    return { ok: false, error: 'Un gasto a crédito necesita proveedor para abrir la cuenta por pagar.' }
  }
  if (gasto.metodo === 'caja_chica' && gasto.condicion === 'credito') {
    return { ok: false, error: 'Un gasto de caja chica se paga de contado.' }
  }

  const supabase = await staff()
  const { data, error } = await supabase.rpc('registrar_gasto', {
    p_datos: { ...gasto, descripcion: gasto.descripcion.trim() },
  })

  if (error) return fallo(error)

  revalidatePath('/admin/gastos')
  revalidatePath('/admin/cuentas-por-pagar')
  revalidatePath('/admin')
  // El gasto de caja chica trae su salida de caja colgando (trigger).
  if (gasto.metodo === 'caja_chica') revalidatePath('/admin/caja-chica')
  // El inventario del taller se ve en el catálogo, y la compra pudo darle entrada.
  if (gasto.al_inventario) revalidatePath('/admin/catalogo')
  if (gasto.obra_id) revalidatePath(`/admin/obras/${gasto.obra_id}`)
  return { ok: true, datos: { id: data as string } }
}

/**
 * Corrige un gasto ya capturado, incluido moverlo de «general» a una OT.
 *
 * El material REAL de la obra y la cuenta por pagar cuelgan del gasto, así que
 * la función de la base rehace las dos ramas; aquí sólo se revalidan las dos
 * obras, la de antes y la de ahora, porque el concentrado de las dos cambia.
 */
export async function actualizarGasto(
  id: string,
  gasto: GastoSql,
  obraAnterior: string | null,
): Promise<Resultado<{ id: string }>> {
  if (!gasto.descripcion.trim()) return { ok: false, error: 'Falta la descripción del gasto.' }
  if (gasto.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }
  if (gasto.condicion === 'credito' && !gasto.proveedor_id) {
    return { ok: false, error: 'Un gasto a crédito necesita proveedor para abrir la cuenta por pagar.' }
  }
  if (gasto.metodo === 'caja_chica' && gasto.condicion === 'credito') {
    return { ok: false, error: 'Un gasto de caja chica se paga de contado.' }
  }

  const supabase = await staff()
  const { error } = await supabase.rpc('editar_gasto', {
    p_gasto: id,
    p_datos: { ...gasto, descripcion: gasto.descripcion.trim() },
  })

  if (error) return fallo(error)

  // Pudo entrar, salir o cambiar la salida de caja ligada; barato revalidar siempre.
  revalidatePath('/admin/caja-chica')
  revalidatePath('/admin/gastos')
  revalidatePath('/admin/cuentas-por-pagar')
  revalidatePath('/admin')
  for (const obra of new Set([gasto.obra_id, obraAnterior].filter(Boolean))) {
    revalidatePath(`/admin/obras/${obra}`)
  }
  return { ok: true, datos: { id } }
}

/** Alta rápida en el catálogo desde el gasto, para compras que se repiten. */
export async function agregarProductoAlCatalogo(datos: {
  nombre: string
  costo: number
  unidad: string
  tipo: TipoProducto
  proveedor_id: string | null
}): Promise<Resultado> {
  if (!datos.nombre.trim()) return { ok: false, error: 'Falta el nombre del producto.' }

  const supabase = await staff()
  const costo = datos.costo || 0
  const iva = Math.round(costo * (REGLAS.ivaPct / 100) * 100) / 100

  const { error } = await supabase.from('productos').insert({
    nombre: datos.nombre.trim(),
    unidad: datos.unidad.trim() || 'pza',
    tipo: datos.tipo,
    costo,
    iva,
    precio_neto: Math.round((costo + iva) * 100) / 100,
    proveedor_id: datos.proveedor_id,
  })

  if (error) return fallo(error)
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

/**
 * Borra un gasto y todo lo que dejó. Va en una sola función de la base porque
 * los rastros tienen que caer juntos: el material de la obra, la entrada al
 * taller —que antes se quedaba y dejaba la existencia inflada— y su parte de la
 * cuenta por pagar, que baja a lo que de verdad se le debe al proveedor.
 */
export async function eliminarGasto(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('eliminar_gasto', { p_gasto: id })
  if (error) return fallo(error)

  revalidatePath('/admin/gastos')
  revalidatePath('/admin/cuentas-por-pagar')
  revalidatePath('/admin/catalogo')
  revalidatePath('/admin')
  // Si era de caja chica, su salida se fue con él (cascade).
  revalidatePath('/admin/caja-chica')
  return { ok: true }
}

// ===========================================================================
// COBRANZA
// ===========================================================================
export async function registrarCobro(pago: {
  cotizacion_id: string
  tipo: TipoPagoCobranza
  monto: number
  metodo: MetodoPago
  fecha: string
  comprobante_path: string | null
  notas: string | null
}): Promise<Resultado> {
  if (pago.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('pagos_cobranza')
    .insert({ ...pago, registrado_por: user?.id ?? null })

  if (error) return fallo(error)

  revalidatePath('/admin/cobranza')
  revalidatePath('/admin')
  return { ok: true }
}

/**
 * Corrige un pago ya aplicado.
 *
 * El caso de siempre: se capturó el saldo completo —que el diálogo sugiere como
 * ayuda— cuando en realidad fue un abono, y la cotización se fue al historial.
 *
 * Aquí basta el update: a diferencia del gasto, el pago no deja rastros que
 * rehacer. El saldo lo calcula la vista al leer, así que con el monto nuevo la
 * cotización regresa sola a «Por cobrar»; y el recibo, si lo tiene, arma el PDF
 * leyendo el importe del pago, no una copia.
 */
export async function actualizarCobro(
  id: string,
  pago: {
    tipo: TipoPagoCobranza
    monto: number
    metodo: MetodoPago
    fecha: string
    comprobante_path: string | null
    notas: string | null
  },
  obras: string[] = [],
): Promise<Resultado> {
  if (pago.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }
  if (!pago.fecha) return { ok: false, error: 'Falta la fecha del pago.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: antes } = await supabase
    .from('pagos_cobranza')
    .select('comprobante_path')
    .eq('id', id)
    .maybeSingle()

  if (!antes) return { ok: false, error: 'Ese pago ya no existe.' }

  const { error } = await supabase
    .from('pagos_cobranza')
    .update({ ...pago, editado_por: user?.id ?? null })
    .eq('id', id)

  if (error) return fallo(error)

  // El comprobante que se sustituyó ya no lo apunta nadie.
  if (antes.comprobante_path && antes.comprobante_path !== pago.comprobante_path) {
    await supabase.storage.from('comprobantes').remove([antes.comprobante_path])
  }

  revalidatePath('/admin/cobranza')
  revalidatePath('/admin')
  for (const obra of obras) revalidatePath(`/admin/obras/${obra}`)
  return { ok: true }
}

export async function eliminarCobro(id: string, obras: string[] = []): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('pagos_cobranza').delete().eq('id', id)
  if (error) return fallo(error)

  revalidatePath('/admin/cobranza')
  revalidatePath('/admin')
  for (const obra of obras) revalidatePath(`/admin/obras/${obra}`)
  return { ok: true }
}

// ===========================================================================
// NÓMINA
// ===========================================================================
/**
 * Un renglón del recibo: abona a un contrato de obra o a la raya de una
 * semana, nunca a los dos. La base lo exige con un check y la RPC lo reparte.
 */
export type BloqueDeRecibo = {
  contrato_id?: string | null
  raya_id?: string | null
  monto: number
  porcentaje: number | null
}

export async function pagarNomina(datos: {
  trabajador_id: string
  fecha: string
  metodo: MetodoPago
  pagos: BloqueDeRecibo[]
  deducciones: string[]
  notas: string | null
}): Promise<Resultado<{ reciboId: string }>> {
  const conMonto = datos.pagos.filter((p) => p.monto > 0)
  if (conMonto.length === 0) return { ok: false, error: 'Captura al menos un abono.' }

  const supabase = await staff()
  const { data, error } = await supabase.rpc('pagar_nomina', {
    p_trabajador: datos.trabajador_id,
    p_fecha: datos.fecha,
    p_metodo: datos.metodo,
    p_pagos: conMonto,
    p_deducciones: datos.deducciones,
    p_notas: datos.notas,
  })

  if (error) return fallo(error)

  revalidatePath('/admin/nomina')
  revalidatePath('/admin')
  return { ok: true, datos: { reciboId: data as string } }
}

/**
 * Corrige un recibo ya emitido. Se manda el documento completo —los renglones
 * que quedan, no un parche— porque la base rehace los totales desde ellos.
 */
export async function editarReciboNomina(datos: {
  recibo_id: string
  fecha: string
  metodo: MetodoPago
  pagos: BloqueDeRecibo[]
  notas: string | null
}): Promise<Resultado> {
  const conMonto = datos.pagos.filter((p) => p.monto > 0)
  if (conMonto.length === 0) return { ok: false, error: 'Deja al menos un abono con importe.' }

  const supabase = await staff()
  const { error } = await supabase.rpc('editar_recibo_nomina', {
    p_recibo: datos.recibo_id,
    p_fecha: datos.fecha,
    p_metodo: datos.metodo,
    p_pagos: conMonto,
    p_notas: datos.notas,
  })

  if (error) return fallo(error)
  revalidatePath('/admin/nomina')
  revalidatePath('/admin')
  return { ok: true }
}

/**
 * Echa atrás un recibo. Los abonos se borran —el saldo de los contratos vuelve
 * solo— y los préstamos que descontaba regresan a pendientes, pero el folio se
 * queda en la lista marcado como cancelado: se entregó en papel y firmado.
 */
export async function cancelarReciboNomina(
  reciboId: string,
  motivo: string | null,
): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('cancelar_recibo_nomina', {
    p_recibo: reciboId,
    p_motivo: motivo,
  })

  if (error) return fallo(error)
  revalidatePath('/admin/nomina')
  revalidatePath('/admin')
  return { ok: true }
}

export async function guardarDeduccion(deduccion: {
  id?: string
  trabajador_id: string
  tipo: TipoDeduccion
  monto: number
  fecha: string
  notas: string | null
}): Promise<Resultado> {
  if (deduccion.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }

  const supabase = await staff()
  const fila = {
    trabajador_id: deduccion.trabajador_id,
    tipo: deduccion.tipo,
    monto: deduccion.monto,
    fecha: deduccion.fecha,
    notas: deduccion.notas,
  }

  const { error } = deduccion.id
    ? await supabase.from('deducciones').update(fila).eq('id', deduccion.id)
    : await supabase.from('deducciones').insert(fila)

  if (error) return fallo(error)
  revalidatePath('/admin/nomina')
  return { ok: true }
}

export async function eliminarDeduccion(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('deducciones').delete().eq('id', id).is('recibo_id', null)
  if (error) return fallo(error)
  revalidatePath('/admin/nomina')
  return { ok: true }
}

// ===========================================================================
// CUENTAS POR PAGAR
// ===========================================================================
export async function guardarCuentaPorPagar(cxp: {
  id?: string
  proveedor_id: string
  folio_factura: string
  monto: number
  fecha_factura: string
  dias_credito: number
  cancelada: boolean
  notas: string | null
}): Promise<Resultado> {
  if (!cxp.proveedor_id) return { ok: false, error: 'Falta el proveedor.' }
  if (!cxp.folio_factura.trim()) return { ok: false, error: 'Falta el folio de la factura.' }

  const supabase = await staff()
  const folio = cxp.folio_factura.trim()
  // El importe va aparte: una factura armada con gastos no lo acepta de aquí.
  const fila = {
    proveedor_id: cxp.proveedor_id,
    folio_factura: folio,
    fecha_factura: cxp.fecha_factura,
    dias_credito: cxp.dias_credito,
    cancelada: cxp.cancelada,
    notas: cxp.notas,
  }

  if (cxp.id) {
    // Si la factura se armó con los gastos capturados, su importe es la suma de
    // ellos: aquí se deja pasar todo lo demás —el folio, la fecha, los días—
    // pero el importe no, porque el siguiente recálculo lo pisaría de vuelta.
    const { data: previa } = await supabase
      .from('cuentas_por_pagar')
      .select('automatica')
      .eq('id', cxp.id)
      .single()

    const { error } = await supabase
      .from('cuentas_por_pagar')
      .update(previa?.automatica ? fila : { ...fila, monto: cxp.monto })
      .eq('id', cxp.id)
    if (error) return fallo(error)

    // Corregir el folio aquí lo corrige para los conceptos de la factura: si se
    // quedaran con el viejo, capturar uno más abriría otra cuenta.
    if (previa?.automatica) {
      const { error: errorFolio } = await supabase
        .from('gastos')
        .update({ folio_factura: folio })
        .eq('cxp_id', cxp.id)
      if (errorFolio) return fallo(errorFolio)
      revalidatePath('/admin/gastos')
    }
  } else {
    const { error } = await supabase.from('cuentas_por_pagar').insert({ ...fila, monto: cxp.monto })
    if (error) return fallo(error)
  }

  revalidatePath('/admin/cuentas-por-pagar')
  revalidatePath('/admin')
  return { ok: true }
}

export async function abonarCuentaPorPagar(
  id: string,
  monto: number,
  fecha: string,
): Promise<Resultado<{ pagado: number; saldo: number; liquidada: boolean }>> {
  const supabase = await staff()
  const { data, error } = await supabase.rpc('abonar_cxp', {
    p_id: id,
    p_monto: monto,
    p_fecha: fecha,
  })

  if (error) return fallo(error)
  revalidatePath('/admin/cuentas-por-pagar')
  revalidatePath('/admin')
  return { ok: true, datos: data as { pagado: number; saldo: number; liquidada: boolean } }
}

/**
 * Liquida de un jalón varias facturas del mismo proveedor. Es lo que pasa de
 * verdad cuando se le paga a un proveedor: una sola transferencia cubre todo
 * lo que se le debe. O entran todas o no entra ninguna.
 */
export async function abonarLoteCuentasPorPagar(
  pagos: PagoCxpLote[],
  fecha: string,
): Promise<Resultado<ResultadoPagoLote>> {
  if (pagos.length === 0) return { ok: false, error: 'Elige al menos una factura.' }
  if (pagos.some((p) => !(p.monto > 0))) {
    return { ok: false, error: 'Todos los montos tienen que ser mayores a cero.' }
  }

  const supabase = await staff()
  const { data, error } = await supabase.rpc('abonar_cxp_lote', {
    p_pagos: pagos,
    p_fecha: fecha,
  })

  if (error) return fallo(error)
  revalidatePath('/admin/cuentas-por-pagar')
  revalidatePath('/admin')
  return { ok: true, datos: data as ResultadoPagoLote }
}

export async function eliminarCuentaPorPagar(id: string): Promise<Resultado> {
  const supabase = await staff()

  // Una factura que se armó con gastos capturados no se borra desde aquí: los
  // gastos seguirían siendo a crédito y quedarían sin a quién pagarle.
  const { count } = await supabase
    .from('gastos')
    .select('id', { count: 'exact', head: true })
    .eq('cxp_id', id)

  if (count && count > 0) {
    return {
      ok: false,
      error: `Esta factura sale de ${count} ${count === 1 ? 'gasto capturado' : 'gastos capturados'}. Bórralos o pásalos a contado desde Gastos.`,
    }
  }

  const { error } = await supabase.from('cuentas_por_pagar').delete().eq('id', id)
  if (error) return fallo(error)
  revalidatePath('/admin/cuentas-por-pagar')
  revalidatePath('/admin')
  return { ok: true }
}

// ===========================================================================
// PAGOS FIJOS
// ===========================================================================
export async function guardarPagoFijo(pago: {
  id?: string
  quincena: string
  categoria: string
  beneficiario: string
  monto: number
  metodo: MetodoPago
  estado: EstadoPagoFijo
  descripcion: string | null
  notas: string | null
  fecha_pago: string | null
}): Promise<Resultado> {
  if (!pago.beneficiario.trim()) return { ok: false, error: 'Falta el beneficiario.' }

  const supabase = await staff()
  /*
   * La fecha se guarda tal como se capturó, sin cuadrarla al 15 ni al fin de
   * mes. No todo pago fijo cae en quincena: la nómina de dirección se paga sin
   * fecha fija y queda fuera del ciclo quincenal a propósito. Lo que sí hace
   * falta es que ninguno se pierda de vista, y de eso se encarga la pantalla,
   * que pide el mes completo y acomoda cada pago en la quincena que le toca.
   */
  const fila = { ...pago, beneficiario: pago.beneficiario.trim() }
  delete (fila as { id?: string }).id

  const { error } = pago.id
    ? await supabase.from('pagos_fijos').update(fila).eq('id', pago.id)
    : await supabase.from('pagos_fijos').insert(fila)

  if (error) return fallo(error)
  revalidatePath('/admin/pagos-fijos')
  return { ok: true }
}

export async function marcarPagoFijo(
  id: string,
  estado: EstadoPagoFijo,
): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase
    .from('pagos_fijos')
    .update({
      estado,
      // En Hermosillo, no en UTC: marcado a las seis de la tarde, quedaba pagado mañana.
      fecha_pago: estado === 'pagado' ? hoyHermosillo() : null,
    })
    .eq('id', id)

  if (error) return fallo(error)
  revalidatePath('/admin/pagos-fijos')
  return { ok: true }
}

export async function eliminarPagoFijo(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('pagos_fijos').delete().eq('id', id)
  if (error) return fallo(error)
  revalidatePath('/admin/pagos-fijos')
  return { ok: true }
}

/** Saca de la lista los pagos que le tocan a esa quincena. Repetirla no duplica. */
export async function generarQuincena(quincena: string): Promise<Resultado<number>> {
  const supabase = await staff()
  const { data, error } = await supabase.rpc('generar_quincena', { p_quincena: quincena })
  if (error) return fallo(error)

  revalidatePath('/admin/pagos-fijos')
  revalidatePath('/admin')
  return { ok: true, datos: data as number }
}

/**
 * Arma las quincenas del mes que todavía no existen.
 *
 * La llama la pantalla al abrir el mes en curso. Es segura de repetir: quien
 * manda es `generar_quincena`, que no duplica ni aunque entren dos a la vez.
 */
export async function asegurarQuincenas(quincenas: string[]): Promise<Resultado<number>> {
  const supabase = await staff()
  let creados = 0

  for (const quincena of quincenas) {
    const { data, error } = await supabase.rpc('generar_quincena', { p_quincena: quincena })
    if (error) return fallo(error)
    creados += (data as number) ?? 0
  }

  if (creados > 0) {
    revalidatePath('/admin/pagos-fijos')
    revalidatePath('/admin')
  }
  return { ok: true, datos: creados }
}

// ===========================================================================
// RAYA SEMANAL · el sueldo fijo de los oficiales
// ===========================================================================
/** Pone a alguien a sueldo, o le cambia el monto cerrando el trato anterior. */
export async function guardarSueldoSemanal(datos: {
  trabajador_id: string
  monto_semanal: number
  dias_base: number
  costo_haaco_pct: number
  obra_id: string | null
  notas: string | null
}): Promise<Resultado> {
  if (!datos.trabajador_id) return { ok: false, error: 'Falta decir de quién es el sueldo.' }
  if (datos.monto_semanal <= 0) return { ok: false, error: 'El sueldo tiene que ser mayor a cero.' }

  const supabase = await staff()
  const { error } = await supabase.rpc('guardar_sueldo_semanal', {
    p_trabajador: datos.trabajador_id,
    p_monto: datos.monto_semanal,
    p_dias_base: datos.dias_base,
    p_pct: datos.costo_haaco_pct,
    p_obra: datos.obra_id,
    p_notas: datos.notas,
  })

  if (error) return fallo(error)
  revalidatePath('/admin/nomina')
  return { ok: true }
}

/** Saca la raya de esa semana desde los sueldos dados de alta. */
export async function generarRaya(semana: string): Promise<Resultado<number>> {
  const supabase = await staff()
  const { data, error } = await supabase.rpc('generar_raya', { p_semana: semana })
  if (error) return fallo(error)

  revalidatePath('/admin/nomina')
  revalidatePath('/admin')
  return { ok: true, datos: data as number }
}

/**
 * Corrige una raya: los días, el ajuste y a qué obras se carga.
 *
 * El reparto viaja completo, como los renglones del recibo: lo que no venga en
 * la lista deja de cargar a esa obra.
 */
export async function guardarRaya(datos: {
  raya_id: string
  dias_trabajados: number
  ajuste: number
  notas: string | null
  obras: { obra_id: string; pct: number }[]
}): Promise<Resultado> {
  const suma = datos.obras.reduce((s, o) => s + o.pct, 0)
  if (suma > 100) {
    return { ok: false, error: `El reparto entre obras va en ${suma}% y no puede pasar de 100.` }
  }

  const supabase = await staff()
  const { error } = await supabase.rpc('guardar_raya', {
    p_raya: datos.raya_id,
    p_dias_trabajados: datos.dias_trabajados,
    p_ajuste: datos.ajuste,
    p_notas: datos.notas,
    p_obras: datos.obras,
  })

  if (error) return fallo(error)
  revalidatePath('/admin/nomina')
  revalidatePath('/admin')
  return { ok: true }
}

/** Cancela una raya que no debió existir. Si ya se pagó, primero va el recibo. */
export async function cancelarRaya(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.rpc('cancelar_raya', { p_raya: id })
  if (error) return fallo(error)

  revalidatePath('/admin/nomina')
  revalidatePath('/admin')
  return { ok: true }
}

// ===========================================================================
// CATÁLOGO DE PAGOS PROGRAMADOS · la lista de a quién se le paga cada quincena
// ===========================================================================
export async function guardarPagoProgramado(
  programado: {
    id?: string
    tipo: TipoPagoProgramado
    trabajador_id: string | null
    beneficiario: string
    categoria: string
    monto: number
    metodo: MetodoPago
    periodicidad: PeriodicidadPago
    descripcion: string | null
    notas: string | null
    activo: boolean
  },
  /** Llevar el cambio a las quincenas que todavía no se pagan. */
  propagar = false,
): Promise<Resultado<number>> {
  if (!programado.beneficiario.trim()) return { ok: false, error: 'Falta el beneficiario.' }

  const supabase = await staff()
  const fila = { ...programado, beneficiario: programado.beneficiario.trim() }
  delete (fila as { id?: string }).id

  const { data, error } = programado.id
    ? await supabase.from('pagos_programados').update(fila).eq('id', programado.id).select('id')
    : await supabase.from('pagos_programados').insert(fila).select('id')

  if (error) return fallo(error)
  const id = programado.id ?? data?.[0]?.id
  let alcanzados = 0

  /*
   * La historia no se reescribe: sólo se tocan los pagos que siguen por
   * delante y que nadie ha marcado como pagados. Un mes cerrado y un pago ya
   * hecho se quedan con el monto que tuvieron.
   */
  if (propagar && id) {
    const { data: tocados, error: errorPropagar } = await supabase
      .from('pagos_fijos')
      .update({
        monto: fila.monto,
        beneficiario: fila.beneficiario,
        categoria: fila.categoria,
        metodo: fila.metodo,
        descripcion: fila.descripcion,
      })
      .eq('programado_id', id)
      .neq('estado', 'pagado')
      .gte('quincena', hoyHermosillo())
      .select('id')

    if (errorPropagar) return fallo(errorPropagar)
    alcanzados = tocados?.length ?? 0
  }

  revalidatePath('/admin/pagos-fijos')
  revalidatePath('/admin')
  return { ok: true, datos: alcanzados }
}

/** Un pago fijo que todavía se puede corregir, para enseñarlo antes de tocarlo. */
export type PagoPorCorregir = { id: string; quincena: string; monto: number }

/**
 * Qué quincenas se corregirían al cambiarle el monto a un programado.
 *
 * Se consulta antes de guardar para poder decirlas por su nombre —«el 30 de
 * septiembre y el 15 de octubre»— en vez de un «las que todavía no se pagan»
 * que obliga a confiar. Si no devuelve nada, no hay nada que preguntar.
 *
 * El filtro es el mismo que aplica la propagación aquí abajo, y tiene que
 * seguirlo siendo: lo que se enseña y lo que se toca no pueden separarse.
 */
export async function pagosPorCorregir(id: string): Promise<Resultado<PagoPorCorregir[]>> {
  const supabase = await staff()
  const { data, error } = await supabase
    .from('pagos_fijos')
    .select('id, quincena, monto')
    .eq('programado_id', id)
    .neq('estado', 'pagado')
    .gte('quincena', hoyHermosillo())
    .order('quincena')

  if (error) return fallo(error)
  return { ok: true, datos: data ?? [] }
}

/** Sacarlo de la lista sin borrar lo que ya se le pagó. */
export async function archivarPagoProgramado(id: string, activo: boolean): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('pagos_programados').update({ activo }).eq('id', id)
  if (error) return fallo(error)
  revalidatePath('/admin/pagos-fijos')
  return { ok: true }
}

/**
 * Borrarlo de verdad, y sólo si nunca generó un pago.
 *
 * En cuanto generó uno, borrarlo dejaría esos renglones huérfanos —la liga se
 * pone en nulo y se vuelven pagos sueltos, sin manera de saber de dónde
 * salieron—. Para eso está archivar.
 */
export async function eliminarPagoProgramado(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { count, error: errorConteo } = await supabase
    .from('pagos_fijos')
    .select('id', { count: 'exact', head: true })
    .eq('programado_id', id)

  if (errorConteo) return fallo(errorConteo)
  if (count && count > 0) {
    return {
      ok: false,
      error: `Ya generó ${count} ${count === 1 ? 'pago' : 'pagos'}. Archívalo: deja de salir en las siguientes quincenas y el historial se conserva.`,
    }
  }

  const { error } = await supabase.from('pagos_programados').delete().eq('id', id)
  if (error) return fallo(error)
  revalidatePath('/admin/pagos-fijos')
  return { ok: true }
}

// ===========================================================================
// CAJA CHICA
// ===========================================================================
/** Con `id` corrige el movimiento; sin él lo da de alta. */
export async function guardarMovimientoCaja(movimiento: {
  id?: string
  tipo: TipoMovimientoCaja
  concepto: string
  monto: number
  fecha: string
  obra_id: string | null
}): Promise<Resultado> {
  if (!movimiento.concepto.trim()) return { ok: false, error: 'Falta el concepto.' }
  if (movimiento.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }

  const supabase = await staff()
  const { id, ...datos } = movimiento
  const campos = { ...datos, concepto: datos.concepto.trim() }

  // Los movimientos que nacieron de un gasto se corrigen desde Gastos: tocar
  // aquí la copia desincronizaría el gasto de su salida.
  if (id && (await esMovimientoDeGasto(supabase, id))) {
    return { ok: false, error: 'Este movimiento nació de un gasto; corrígelo desde Gastos.' }
  }

  // Al corregir no se toca `registrado_por`: quien capturó el movimiento
  // siguió siendo quien lo capturó.
  const { error } = id
    ? await supabase.from('caja_chica').update(campos).eq('id', id)
    : await supabase.from('caja_chica').insert({
        ...campos,
        registrado_por: (await supabase.auth.getUser()).data.user?.id ?? null,
      })

  if (error) return fallo(error)
  revalidatePath('/admin/caja-chica')
  return { ok: true }
}

export async function eliminarMovimientoCaja(id: string): Promise<Resultado> {
  const supabase = await staff()
  if (await esMovimientoDeGasto(supabase, id)) {
    return { ok: false, error: 'Este movimiento nació de un gasto; elimínalo desde Gastos.' }
  }
  const { error } = await supabase.from('caja_chica').delete().eq('id', id)
  if (error) return fallo(error)
  revalidatePath('/admin/caja-chica')
  return { ok: true }
}

async function esMovimientoDeGasto(
  supabase: Awaited<ReturnType<typeof staff>>,
  id: string,
): Promise<boolean> {
  const { data } = await supabase.from('caja_chica').select('gasto_id').eq('id', id).single()
  return Boolean(data?.gasto_id)
}
