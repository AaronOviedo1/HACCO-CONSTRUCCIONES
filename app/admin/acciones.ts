'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { REGLAS } from '@/lib/empresa'
import { casilla, explicar, numero, opcional, texto, type EstadoAccion } from '@/lib/acciones'
import type { EstadoHerramienta, TipoMovimiento, TipoProducto } from '@/types/database'

export type { EstadoAccion }

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

// ===========================================================================
// CLIENTES
// ===========================================================================
export async function guardarCliente(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const id = opcional(d, 'id')
  const nombre = texto(d, 'nombre')
  if (!nombre) return { error: 'El nombre del cliente es obligatorio.' }

  const fila = {
    nombre,
    titulo_cortesia: opcional(d, 'titulo_cortesia'),
    telefono: opcional(d, 'telefono'),
    correo: opcional(d, 'correo'),
    domicilio: opcional(d, 'domicilio'),
    notas: opcional(d, 'notas'),
    activo: d.has('activo') ? casilla(d, 'activo') : true,
  }

  const { data, error } = id
    ? await supabase.from('clientes').update(fila).eq('id', id).select('id').single()
    : await supabase.from('clientes').insert(fila).select('id').single()

  if (error) return { error: explicar(error) }
  revalidatePath('/admin/clientes')
  revalidatePath('/admin/cotizaciones')
  return { ok: true, id: data?.id }
}

export async function eliminarCliente(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const { error } = await supabase.from('clientes').delete().eq('id', texto(d, 'id'))
  if (error) return { error: explicar(error) }
  revalidatePath('/admin/clientes')
  return { ok: true }
}

// ===========================================================================
// PROVEEDORES
// ===========================================================================
export async function guardarProveedor(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const id = opcional(d, 'id')
  const nombre = texto(d, 'nombre')
  if (!nombre) return { error: 'El nombre del proveedor es obligatorio.' }

  const fila = {
    nombre,
    dias_credito_default: numero(d, 'dias_credito_default') ?? 0,
    telefono: opcional(d, 'telefono'),
    contacto: opcional(d, 'contacto'),
    notas: opcional(d, 'notas'),
    activo: d.has('activo') ? casilla(d, 'activo') : true,
  }

  const { error } = id
    ? await supabase.from('proveedores').update(fila).eq('id', id)
    : await supabase.from('proveedores').insert(fila)

  if (error) return { error: explicar(error) }
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

export async function eliminarProveedor(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const { error } = await supabase.from('proveedores').delete().eq('id', texto(d, 'id'))
  if (error) return { error: explicar(error) }
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

// ===========================================================================
// PRODUCTOS E INSUMOS
// ===========================================================================
export async function guardarProducto(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const id = opcional(d, 'id')
  const nombre = texto(d, 'nombre')
  if (!nombre) return { error: 'El nombre del producto es obligatorio.' }

  const costo = numero(d, 'costo') ?? 0
  // Si no capturan el IVA se calcula al 16%; el precio neto siempre es la suma.
  const iva = numero(d, 'iva') ?? Math.round(costo * (REGLAS.ivaPct / 100) * 100) / 100

  const fila = {
    nombre,
    codigo: opcional(d, 'codigo'),
    unidad: texto(d, 'unidad') || 'pza',
    tipo: (texto(d, 'tipo') || 'otro') as TipoProducto,
    costo,
    iva,
    precio_neto: Math.round((costo + iva) * 100) / 100,
    proveedor_id: opcional(d, 'proveedor_id'),
    notas: opcional(d, 'notas'),
    activo: d.has('activo') ? casilla(d, 'activo') : true,
  }

  const { error } = id
    ? await supabase.from('productos').update(fila).eq('id', id)
    : await supabase.from('productos').insert(fila)

  if (error) return { error: explicar(error) }
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

export async function eliminarProducto(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const { error } = await supabase.from('productos').delete().eq('id', texto(d, 'id'))
  if (error) return { error: explicar(error) }
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

/** Entrada o salida del kardex de taller. */
export async function moverKardex(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const cantidad = numero(d, 'cantidad')
  if (!cantidad || cantidad <= 0) return { error: 'La cantidad tiene que ser mayor a cero.' }

  const { error } = await supabase.from('insumos_kardex').insert({
    producto_id: texto(d, 'producto_id'),
    tipo: texto(d, 'tipo') as TipoMovimiento,
    cantidad,
    fecha: texto(d, 'fecha') || undefined,
    notas: opcional(d, 'notas'),
  })

  if (error) return { error: explicar(error) }
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

// ===========================================================================
// TEXTOS DE PROCESO
// ===========================================================================
export async function guardarTexto(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const id = opcional(d, 'id')
  const titulo = texto(d, 'titulo')
  const contenido = texto(d, 'contenido')
  if (!titulo || !contenido) return { error: 'El título y el contenido son obligatorios.' }

  const fila = {
    titulo,
    contenido,
    orden: numero(d, 'orden') ?? 0,
    activo: d.has('activo') ? casilla(d, 'activo') : true,
  }

  const { error } = id
    ? await supabase.from('textos_proceso').update(fila).eq('id', id)
    : await supabase.from('textos_proceso').insert(fila)

  if (error) return { error: explicar(error) }
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

export async function eliminarTexto(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const { error } = await supabase.from('textos_proceso').delete().eq('id', texto(d, 'id'))
  if (error) return { error: explicar(error) }
  revalidatePath('/admin/catalogo')
  return { ok: true }
}

// ===========================================================================
// HERRAMIENTAS
// ===========================================================================
export async function guardarHerramienta(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const id = opcional(d, 'id')
  const codigo = texto(d, 'codigo')
  const nombre = texto(d, 'nombre')
  if (!codigo || !nombre) return { error: 'El código y el nombre son obligatorios.' }

  const fila = {
    codigo,
    nombre,
    marca: opcional(d, 'marca'),
    valor: numero(d, 'valor'),
    estado: (texto(d, 'estado') || 'disponible') as EstadoHerramienta,
    ubicacion: texto(d, 'ubicacion') || 'Taller',
    notas: opcional(d, 'notas'),
  }

  const { error } = id
    ? await supabase.from('herramientas').update(fila).eq('id', id)
    : await supabase.from('herramientas').insert(fila)

  if (error) return { error: explicar(error) }
  revalidatePath('/admin/herramientas')
  return { ok: true }
}

export async function eliminarHerramienta(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()
  const { error } = await supabase.from('herramientas').delete().eq('id', texto(d, 'id'))
  if (error) return { error: explicar(error) }
  revalidatePath('/admin/herramientas')
  return { ok: true }
}
