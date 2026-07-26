import 'server-only'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { borradorVacio, type BorradorCotizacion } from '@/lib/cotizaciones'

/** Catálogos que necesita el editor: clientes, biblioteca de textos y pinturas. */
export async function cargarCatalogos() {
  const supabase = await crearClienteServidor()
  const [{ data: clientes }, { data: textos }, { data: productos }] = await Promise.all([
    supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
    supabase.from('textos_proceso').select('*').eq('activo', true).order('orden'),
    supabase.from('productos').select('*').eq('activo', true).neq('tipo', 'insumo_taller').order('nombre'),
  ])

  return { clientes: clientes ?? [], textos: textos ?? [], productos: productos ?? [] }
}

/** Reconstruye el borrador del editor a partir de lo guardado. */
export async function cargarCotizacion(id: string) {
  const supabase = await crearClienteServidor()

  const { data: cotizacion } = await supabase.from('cotizaciones').select('*').eq('id', id).maybeSingle()
  if (!cotizacion) notFound()

  const [{ data: procesos }, { data: items }, { data: desglose }, { data: materiales }, { count: obras }] =
    await Promise.all([
      supabase.from('cotizacion_procesos').select('*').eq('cotizacion_id', id).order('orden'),
      supabase.from('cotizacion_items').select('*').eq('cotizacion_id', id).order('orden'),
      supabase.from('cotizacion_herreria_desglose').select('*').eq('cotizacion_id', id).order('orden'),
      supabase.from('cotizacion_materiales').select('*').eq('cotizacion_id', id).order('orden'),
      supabase.from('obras').select('id', { count: 'exact', head: true }).eq('cotizacion_id', id),
    ])

  const base = borradorVacio(cotizacion.tipo)

  const borrador: BorradorCotizacion = {
    ...base,
    cliente_id: cotizacion.cliente_id,
    nombre_obra: cotizacion.nombre_obra ?? '',
    domicilio_obra: cotizacion.domicilio_obra ?? '',
    tipo: cotizacion.tipo,
    requiere_factura: cotizacion.requiere_factura,
    anticipo_pct: String(cotizacion.anticipo_pct ?? base.anticipo_pct),
    iva_pct: String(cotizacion.iva_pct),
    vigencia_dias: String(cotizacion.vigencia_dias),
    linea_calidad: cotizacion.linea_calidad ?? '',
    notas: cotizacion.notas ?? '',
    fecha: cotizacion.fecha,
    procesos: (procesos ?? []).map((p) => ({
      texto_proceso_id: p.texto_proceso_id,
      contenido: p.contenido_override ?? '',
    })),
    // Las partidas con desglose_id son las que genera el cotizador de herrería:
    // se editan como concepto, no como partida suelta.
    items: (items ?? [])
      .filter((i) => !i.desglose_id)
      .map((i) => ({
        descripcion: i.descripcion,
        m2: i.m2 == null ? '' : String(i.m2),
        precio_unitario: String(i.precio_unitario),
      })),
    desglose: (desglose ?? []).map((d) => ({
      concepto: d.concepto,
      mano_obra: String(d.mano_obra),
      gastos_indirectos_pct: String(d.gastos_indirectos_pct),
      utilidad_pct: String(d.utilidad_pct),
      materiales: (materiales ?? [])
        .filter((m) => m.desglose_id === d.id)
        .map((m) => ({
          rubro: m.rubro,
          material: m.material,
          piezas: String(m.piezas),
          costo: String(m.costo),
        })),
    })),
    materiales: (materiales ?? [])
      .filter((m) => !m.desglose_id)
      .map((m) => ({
        rubro: m.rubro,
        material: m.material,
        piezas: String(m.piezas),
        costo: String(m.costo),
      })),
  }

  return { cotizacion, borrador, obras: obras ?? 0 }
}
