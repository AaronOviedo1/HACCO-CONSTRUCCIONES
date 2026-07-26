'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import type {
  EstadoPagoFijo, GastoSql, MetodoPago, TipoDeduccion, TipoMovimientoCaja,
  TipoPagoCobranza,
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

  const supabase = await staff()
  const { data, error } = await supabase.rpc('registrar_gasto', {
    p_datos: { ...gasto, descripcion: gasto.descripcion.trim() },
  })

  if (error) return fallo(error)

  revalidatePath('/admin/gastos')
  revalidatePath('/admin/cuentas-por-pagar')
  revalidatePath('/admin')
  if (gasto.obra_id) revalidatePath(`/admin/obras/${gasto.obra_id}`)
  return { ok: true, datos: { id: data as string } }
}

export async function eliminarGasto(id: string): Promise<Resultado> {
  const supabase = await staff()

  // Primero se sueltan los rastros que dejó: material de obra y cuenta por pagar.
  await supabase.from('obra_materiales').delete().eq('gasto_id', id)
  await supabase.from('cuentas_por_pagar').delete().eq('gasto_id', id)

  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) return fallo(error)

  revalidatePath('/admin/gastos')
  revalidatePath('/admin/cuentas-por-pagar')
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

export async function eliminarCobro(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('pagos_cobranza').delete().eq('id', id)
  if (error) return fallo(error)
  revalidatePath('/admin/cobranza')
  return { ok: true }
}

// ===========================================================================
// NÓMINA
// ===========================================================================
export async function pagarNomina(datos: {
  trabajador_id: string
  fecha: string
  metodo: MetodoPago
  pagos: { contrato_id: string; monto: number; porcentaje: number | null }[]
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
  const fila = { ...cxp, folio_factura: cxp.folio_factura.trim() }
  delete (fila as { id?: string }).id

  const { error } = cxp.id
    ? await supabase.from('cuentas_por_pagar').update(fila).eq('id', cxp.id)
    : await supabase.from('cuentas_por_pagar').insert(fila)

  if (error) return fallo(error)
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

export async function eliminarCuentaPorPagar(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('cuentas_por_pagar').delete().eq('id', id)
  if (error) return fallo(error)
  revalidatePath('/admin/cuentas-por-pagar')
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
  recurrente: boolean
  fecha_pago: string | null
}): Promise<Resultado> {
  if (!pago.beneficiario.trim()) return { ok: false, error: 'Falta el beneficiario.' }

  const supabase = await staff()
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
      fecha_pago: estado === 'pagado' ? new Date().toISOString().slice(0, 10) : null,
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

/** Copia los pagos recurrentes de la quincena anterior a la indicada. */
export async function generarQuincena(quincena: string): Promise<Resultado<number>> {
  const supabase = await staff()
  const { data, error } = await supabase.rpc('generar_quincena', { p_quincena: quincena })
  if (error) return fallo(error)

  revalidatePath('/admin/pagos-fijos')
  return { ok: true, datos: data as number }
}

// ===========================================================================
// CAJA CHICA
// ===========================================================================
export async function guardarMovimientoCaja(movimiento: {
  tipo: TipoMovimientoCaja
  concepto: string
  monto: number
  fecha: string
  obra_id: string | null
}): Promise<Resultado> {
  if (!movimiento.concepto.trim()) return { ok: false, error: 'Falta el concepto.' }
  if (movimiento.monto <= 0) return { ok: false, error: 'El monto tiene que ser mayor a cero.' }

  const supabase = await staff()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase.from('caja_chica').insert({
    ...movimiento,
    concepto: movimiento.concepto.trim(),
    registrado_por: user?.id ?? null,
  })

  if (error) return fallo(error)
  revalidatePath('/admin/caja-chica')
  return { ok: true }
}

export async function eliminarMovimientoCaja(id: string): Promise<Resultado> {
  const supabase = await staff()
  const { error } = await supabase.from('caja_chica').delete().eq('id', id)
  if (error) return fallo(error)
  revalidatePath('/admin/caja-chica')
  return { ok: true }
}
