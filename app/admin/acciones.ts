'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { REGLAS } from '@/lib/empresa'
import { hoyHermosillo } from '@/lib/format'
import { casilla, explicar, numero, opcional, texto, type EstadoAccion } from '@/lib/acciones'
import type { EstadoHerramienta, TipoMovimiento, TipoProducto } from '@/types/database'

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

// ===========================================================================
// AJUSTES
// ===========================================================================

/** La meta de venta del mes, que Dirección cambia desde el propio tablero. */
export async function guardarMetaVenta(_prev: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  const supabase = await staff()

  const meta = numero(d, 'meta')
  if (meta == null || meta < 0) return { error: 'La meta tiene que ser un número.' }

  const { error } = await supabase
    .from('ajustes')
    .upsert({ clave: 'meta_venta_mensual', valor: meta }, { onConflict: 'clave' })

  if (error) return { error: explicar(error) }
  revalidatePath('/admin')
  return { ok: true }
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
    requiere_factura: casilla(d, 'requiere_factura'),
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
  const perfil = await requerirRol(['admin', 'administracion'])
  const supabase = await crearClienteServidor()
  const id = opcional(d, 'id')
  const nombre = texto(d, 'nombre')
  if (!nombre) return { error: 'El nombre del producto es obligatorio.' }

  const costo = numero(d, 'costo') ?? 0
  // Si no capturan el IVA se calcula al 16%; el precio neto siempre es la suma.
  const iva = numero(d, 'iva') ?? Math.round(costo * (REGLAS.ivaPct / 100) * 100) / 100
  const neto = Math.round((costo + iva) * 100) / 100

  // A cómo estaba antes de este guardado: si el número cambió, es que alguien
  // preguntó y le dijeron otra cosa, y eso merece quedar escrito.
  const { data: antes } = id
    ? await supabase.from('productos').select('precio_neto').eq('id', id).maybeSingle()
    : { data: null }

  const cambioElPrecio = neto > 0 && Number(antes?.precio_neto ?? 0) !== neto

  const fila = {
    nombre,
    codigo: opcional(d, 'codigo'),
    unidad: texto(d, 'unidad') || 'pza',
    tipo: (texto(d, 'tipo') || 'otro') as TipoProducto,
    costo,
    iva,
    precio_neto: neto,
    // El precio se acaba de mirar y dar por bueno: las dos fechas cuentan como
    // frescura, igual que si hubiera entrado por una factura.
    ...(cambioElPrecio
      ? { precio_actualizado_en: hoyHermosillo(), precio_revisado_en: hoyHermosillo() }
      : {}),
    // Lo que se le cobra al cliente por metro aplicado, que no tiene nada que
    // ver con lo de arriba. Sólo lo llevan las pinturas que se ofrecen al
    // cotizar; vacío = esa pintura no sale en el cotizador.
    marca: opcional(d, 'marca'),
    precio_publico: numero(d, 'precio_publico'),
    precio_especial: numero(d, 'precio_especial'),
    precio_super: numero(d, 'precio_super'),
    proveedor_id: opcional(d, 'proveedor_id'),
    notas: opcional(d, 'notas'),
    activo: d.has('activo') ? casilla(d, 'activo') : true,
  }

  const { data: guardado, error } = id
    ? await supabase.from('productos').update(fila).eq('id', id).select('id').single()
    : await supabase.from('productos').insert(fila).select('id').single()

  if (error) return { error: explicar(error) }

  /*
   * El precio nuevo se guarda además como una observación más del historial.
   *
   * Sin esto, corregir el costo a mano lo pisa y el anterior deja de existir:
   * no queda quién lo cambió, ni cuándo, ni de dónde salió. Con esto, el
   * camino de siempre —marcar al proveedor y capturar lo que dicten— deja el
   * mismo rastro que una factura, y la ficha puede contar la historia.
   *
   * No se reusa la RPC `registrar_precio`: desglosa costo e IVA con la tasa
   * vieja del producto y pisaría el IVA que se acaba de capturar.
   */
  if (cambioElPrecio && guardado) {
    await supabase.from('precios_material').insert({
      producto_id: guardado.id,
      proveedor_id: fila.proveedor_id,
      fecha: hoyHermosillo(),
      costo,
      iva,
      precio_neto: neto,
      unidad: fila.unidad,
      origen: 'captura',
      registrado_por: perfil.id,
    })
  }

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
