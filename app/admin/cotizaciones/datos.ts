import 'server-only'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { masComunes } from '@/lib/sugerencias'
import {
  borradorVacio,
  type BorradorCotizacion,
  type SugerenciasCotizacion,
} from '@/lib/cotizaciones'

/**
 * Lo que el editor necesita para poder pintarse: clientes, biblioteca de
 * textos y pinturas. Tres consultas cortas.
 */
export async function cargarCatalogos() {
  const supabase = await crearClienteServidor()
  const [{ data: clientes }, { data: textos }, { data: productos }] = await Promise.all([
    supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
    supabase.from('textos_proceso').select('*').eq('activo', true).order('orden'),
    supabase.from('productos').select('*').eq('activo', true).neq('tipo', 'insumo_taller').order('nombre'),
  ])

  return { clientes: clientes ?? [], textos: textos ?? [], productos: productos ?? [] }
}

/**
 * Autocompletado del editor, sacado de lo ya cotizado —el Excel migrado
 * incluido—.
 *
 * Son tres barridos de miles de renglones: es lo que hacía que abrir una
 * cotización se sintiera lento. Va aparte a propósito, para que la pantalla
 * salga primero y esto llegue después.
 */
export async function cargarSugerencias(): Promise<SugerenciasCotizacion> {
  const supabase = await crearClienteServidor()
  const [{ data: partidasPrevias }, { data: materialesPrevios }, { data: procesosPrevios }] =
    await Promise.all([
      supabase.from('cotizacion_items').select('descripcion, precio_unitario').is('desglose_id', null).limit(2000),
      supabase.from('cotizacion_materiales').select('material, costo').limit(2000),
      supabase.from('cotizacion_procesos').select('contenido_override').is('texto_proceso_id', null).limit(2000),
    ])

  return {
    partidas: masComunes(
      (partidasPrevias ?? []).map((p) => ({ texto: p.descripcion, monto: p.precio_unitario })),
      30,
    ),
    materiales: masComunes(
      (materialesPrevios ?? []).map((m) => ({ texto: m.material, monto: m.costo })),
      30,
    ),
    // Bullets escritos a mano que no salieron de la biblioteca.
    procesos: masComunes(
      (procesosPrevios ?? []).map((p) => ({ texto: p.contenido_override, monto: null })),
      8,
    ).map((s) => s.texto),
  }
}

/** Reconstruye el borrador del editor a partir de lo guardado. */
export async function cargarCotizacion(id: string) {
  const supabase = await crearClienteServidor()

  const { data: cotizacion } = await supabase.from('cotizaciones').select('*').eq('id', id).maybeSingle()
  if (!cotizacion) notFound()

  const [{ data: procesos }, { data: items }, { data: desglose }, { data: materiales }, { data: obras }] =
    await Promise.all([
      supabase.from('cotizacion_procesos').select('*').eq('cotizacion_id', id).order('orden'),
      supabase.from('cotizacion_items').select('*').eq('cotizacion_id', id).order('orden'),
      supabase.from('cotizacion_herreria_desglose').select('*').eq('cotizacion_id', id).order('orden'),
      supabase.from('cotizacion_materiales').select('*').eq('cotizacion_id', id).order('orden'),
      supabase
        .from('obras')
        .select('id, ot_numero, nombre, estatus')
        .eq('cotizacion_id', id)
        .order('ot_numero'),
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
    descuento_pct: String(cotizacion.descuento_pct ?? 0),
    vigencia_dias: String(cotizacion.vigencia_dias),
    viaticos: Number(cotizacion.viaticos) > 0 ? String(cotizacion.viaticos) : '',
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
        unidad: i.unidad ?? '',
        precio_unitario: String(i.precio_unitario),
        // Con qué pintura y a qué tarifa se armó, para que al reabrirla los
        // botones salgan marcados.
        producto_id: i.producto_id,
        nivel_precio: i.nivel_precio ?? '',
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

  return { cotizacion, borrador, obras: obras ?? [] }
}
