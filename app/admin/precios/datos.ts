import 'server-only'
import { crearClienteServidor } from '@/lib/supabase/server'
import type { PrecioVigente } from '@/lib/precios'
import type { EstatusRonda, OrigenPrecio } from '@/types/database'

/** Una fila de la ronda: qué preguntar, a quién, y a cómo estaba la última vez. */
export type FilaRonda = {
  producto_id: string
  producto: string
  unidad: string
  motivo: string | null
  estado: EstatusRonda
  proveedor_id: string | null
  proveedor: string | null
  telefono: string | null
  /** Lo último que se supo de ese precio, si es que se supo algo. */
  ultimo: PrecioVigente | null
  /** Cuántas cotizaciones de los últimos dos meses lo usaron. */
  usos: number
}

export type RenglonHuerfano = {
  id: string
  texto: string
  precio_neto: number | null
  proveedor: string | null
  fecha: string
  folio: string | null
}

export type PropuestaPendiente = {
  id: string
  producto: string
  unidad: string
  proveedor: string | null
  neto_actual: number | null
  neto_nuevo: number
  variacion_pct: number | null
  origen: OrigenPrecio
  folio: string | null
  gasto_id: string | null
  fecha: string
}

/**
 * Todo lo de la pantalla de precios en un tirón.
 *
 * La ronda del día se lee de su tabla y no se calcula al vuelo: la lista tiene
 * que quedarse quieta mientras ella trabaja el teléfono.
 *
 * Se cruza con mapas en vez de con joins anidados, como en el resto de la casa:
 * son consultas cortas por clave primaria y así el tipado no depende de que
 * PostgREST adivine la relación.
 */
export async function cargarPrecios() {
  const supabase = await crearClienteServidor()

  const [
    { data: ronda }, { data: vigentes }, { data: frescura }, { data: huerfanos },
    { data: propuestas }, { data: productos }, { data: proveedores },
  ] = await Promise.all([
    supabase
      .from('ronda_precios')
      .select('producto_id, motivo, orden, estado')
      .eq('fecha', hoyEnHermosillo())
      .order('orden'),
    supabase.from('v_precios_vigentes').select('*'),
    supabase.from('v_precios_frescura').select('*'),
    supabase
      .from('renglones_sin_ligar')
      .select('*')
      .eq('resuelto', false)
      .order('fecha', { ascending: false })
      .limit(40),
    supabase
      .from('precios_propuestos')
      .select('*')
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false }),
    supabase
      .from('productos')
      .select('id, nombre, unidad, tipo, proveedor_id')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('proveedores').select('id, nombre, telefono').eq('activo', true).order('nombre'),
  ])

  const lista = (vigentes ?? []) as PrecioVigente[]
  const porProducto = new Map(lista.map((p) => [p.producto_id, p]))
  const usosDe = new Map((frescura ?? []).map((f) => [f.producto_id, f.usos ?? 0]))
  const fichaDe = new Map((productos ?? []).map((p) => [p.id, p]))
  const proveedorDe = new Map((proveedores ?? []).map((p) => [p.id, p]))

  const filas: FilaRonda[] = (ronda ?? []).flatMap((r) => {
    const ficha = fichaDe.get(r.producto_id)
    if (!ficha) return []
    const ultimo = porProducto.get(r.producto_id) ?? null
    // A quién se le pregunta: el del último precio, o el que trae el catálogo.
    const proveedorId = ultimo?.proveedor_id ?? ficha.proveedor_id ?? null
    const proveedor = proveedorId ? proveedorDe.get(proveedorId) : undefined

    return [{
      producto_id: r.producto_id,
      producto: ficha.nombre,
      unidad: ficha.unidad,
      motivo: r.motivo,
      estado: r.estado,
      proveedor_id: proveedorId,
      proveedor: proveedor?.nombre ?? null,
      telefono: proveedor?.telefono ?? null,
      ultimo,
      usos: usosDe.get(r.producto_id) ?? 0,
    }]
  })

  // De qué observación salió cada propuesta: es lo que deja ver el folio y
  // cachar un disparate de un vistazo.
  const observacionIds = (propuestas ?? [])
    .map((p) => p.observacion_id)
    .filter((id): id is string => Boolean(id))

  const { data: observaciones } = observacionIds.length
    ? await supabase
        .from('precios_material')
        .select('id, origen, folio_factura, fecha, gasto_id')
        .in('id', observacionIds)
    : { data: [] }

  const observacionDe = new Map((observaciones ?? []).map((o) => [o.id, o]))

  return {
    ronda: filas,
    sinLigar: (huerfanos ?? []).map((h) => ({
      id: h.id,
      texto: h.texto,
      precio_neto: h.precio_neto,
      proveedor: h.proveedor_id ? (proveedorDe.get(h.proveedor_id)?.nombre ?? null) : null,
      fecha: h.fecha,
      folio: h.folio_factura,
    })) satisfies RenglonHuerfano[],
    propuestas: (propuestas ?? []).map((p) => {
      const ficha = fichaDe.get(p.producto_id)
      const observacion = p.observacion_id ? observacionDe.get(p.observacion_id) : undefined
      return {
        id: p.id,
        producto: ficha?.nombre ?? 'Material',
        unidad: ficha?.unidad ?? '',
        proveedor: p.proveedor_id ? (proveedorDe.get(p.proveedor_id)?.nombre ?? null) : null,
        neto_actual: p.neto_actual,
        neto_nuevo: p.neto_nuevo,
        variacion_pct: p.variacion_pct,
        origen: observacion?.origen ?? 'factura',
        folio: observacion?.folio_factura ?? null,
        gasto_id: observacion?.gasto_id ?? null,
        fecha: observacion?.fecha ?? p.created_at.slice(0, 10),
      }
    }) satisfies PropuestaPendiente[],
    productos: productos ?? [],
    proveedores: proveedores ?? [],
    // Lo que ya se sabe de todo el catálogo, para la pestaña de consulta.
    vigentes: lista,
  }
}

/**
 * Qué día es en Hermosillo. Igual que `hoy_hermosillo()` en la base: el
 * servidor corre en UTC y a las cinco de la tarde de acá allá ya sería mañana,
 * así que la ronda del día no se encontraría. Sonora no cambia de horario.
 */
export function hoyEnHermosillo() {
  return new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/**
 * Lo que hay pendiente de precios, para avisarlo en el tablero. Dos cuentas
 * cortas: no vale la pena cargar la pantalla entera para enseñar un número.
 */
export async function pendientesDePrecios() {
  const supabase = await crearClienteServidor()
  const [{ count: porPreguntar }, { count: porRevisar }] = await Promise.all([
    supabase
      .from('ronda_precios')
      .select('producto_id', { count: 'exact', head: true })
      .eq('fecha', hoyEnHermosillo())
      .eq('estado', 'pendiente'),
    supabase
      .from('precios_propuestos')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ])

  return { porPreguntar: porPreguntar ?? 0, porRevisar: porRevisar ?? 0 }
}
