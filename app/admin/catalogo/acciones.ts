'use server'

import { revalidatePath } from 'next/cache'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import type { PrecioVigente } from '@/lib/precios'
import type { OrigenPrecio } from '@/types/database'

export type Resultado<T = undefined> = { ok: true; datos?: T } | { ok: false; error: string }

async function staff() {
  await requerirRol(['admin', 'administracion'])
  return crearClienteServidor()
}

const fallo = (error: { message: string }): Resultado<never> => ({ ok: false, error: error.message })

/** Un precio que se pagó alguna vez por este material. */
export type ObservacionPrecio = {
  id: string
  fecha: string
  precio_neto: number
  unidad: string | null
  origen: OrigenPrecio
  folio_factura: string | null
  proveedor: string | null
  registrado_por: string | null
  nota: string | null
}

export type HistorialPrecio = {
  /** El último, con su semáforo ya calculado por la vista. */
  ultimo: PrecioVigente | null
  /** Quién lo registró, que la vista no expone. */
  ultimoPor: string | null
  /** Los de antes, del más reciente al más viejo. */
  anteriores: ObservacionPrecio[]
}

/**
 * Lo que se ha pagado por un material, para la ficha del catálogo.
 *
 * Se pide al abrir la ficha y no al pintar la tabla: enseñar el historial de un
 * producto no justifica traer el de los quinientos.
 *
 * El último sale de `v_precios_vigentes` —la misma vista que lee el cotizador,
 * para que el mismo material se lea idéntico en las dos pantallas— y el resto
 * de la tabla en crudo. Los nombres se cruzan con mapas y no con joins
 * anidados, como en el resto de la casa.
 */
export async function historialDePrecio(productoId: string): Promise<Resultado<HistorialPrecio>> {
  const supabase = await staff()

  const [{ data: ultimo }, { data: observaciones, error }] = await Promise.all([
    supabase.from('v_precios_vigentes').select('*').eq('producto_id', productoId).maybeSingle(),
    supabase
      .from('precios_material')
      .select('id, fecha, precio_neto, unidad, origen, folio_factura, proveedor_id, registrado_por, nota')
      .eq('producto_id', productoId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  if (error) return fallo(error)

  const filas = observaciones ?? []
  const proveedorIds = [...new Set(filas.map((o) => o.proveedor_id).filter(Boolean))] as string[]
  const perfilIds = [...new Set(filas.map((o) => o.registrado_por).filter(Boolean))] as string[]

  const [{ data: proveedores }, { data: perfiles }] = await Promise.all([
    proveedorIds.length
      ? supabase.from('proveedores').select('id, nombre').in('id', proveedorIds)
      : Promise.resolve({ data: [] }),
    perfilIds.length
      ? supabase.from('profiles').select('id, nombre').in('id', perfilIds)
      : Promise.resolve({ data: [] }),
  ])

  const nombreProveedor = new Map((proveedores ?? []).map((p) => [p.id, p.nombre]))
  const nombrePerfil = new Map((perfiles ?? []).map((p) => [p.id, p.nombre]))
  const vigente = (ultimo as PrecioVigente | null) ?? null

  const registroDelUltimo = filas.find((o) => o.id === vigente?.observacion_id)?.registrado_por

  return {
    ok: true,
    datos: {
      ultimo: vigente,
      ultimoPor: registroDelUltimo ? (nombrePerfil.get(registroDelUltimo) ?? null) : null,
      anteriores: filas
        // El primero ya va arriba con su semáforo; repetirlo se lee como un error.
        .filter((o) => o.id !== vigente?.observacion_id)
        .map((o) => ({
          id: o.id,
          fecha: o.fecha,
          precio_neto: Number(o.precio_neto),
          unidad: o.unidad,
          origen: o.origen,
          folio_factura: o.folio_factura,
          proveedor: o.proveedor_id ? (nombreProveedor.get(o.proveedor_id) ?? null) : null,
          registrado_por: o.registrado_por ? (nombrePerfil.get(o.registrado_por) ?? null) : null,
          nota: o.nota,
        })),
    },
  }
}

/**
 * Le pone nombre a un renglón de factura que no se pudo ligar solo.
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
  revalidatePath('/admin/catalogo')
  return { ok: true }
}
