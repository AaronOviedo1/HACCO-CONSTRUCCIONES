import 'server-only'
import { notFound } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/server'
import { conCatalogo, masComunes } from '@/lib/sugerencias'

/** Todo lo que necesita el detalle de la OT, en una sola pasada. */
export async function cargarObra(id: string) {
  const supabase = await crearClienteServidor()

  const { data: concentrado } = await supabase
    .from('v_obra_concentrado')
    .select('*')
    .eq('obra_id', id)
    .maybeSingle()

  if (!concentrado) notFound()

  const [
    obra, conceptos, contratos, materiales, tareas, avances, bitacora,
    detalles, solicitudes, polizas, recibos, cobranza, oficiales, insumos, pagares,
  ] = await Promise.all([
    supabase.from('obras').select('*').eq('id', id).single(),
    supabase.from('obra_conceptos').select('*').eq('obra_id', id).order('orden'),
    supabase.from('contratos_oficial').select('*').eq('obra_id', id).order('created_at'),
    supabase.from('obra_materiales').select('*').eq('obra_id', id).order('created_at'),
    supabase.from('cronograma_tareas').select('*').eq('obra_id', id).order('orden'),
    supabase.from('avances').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    supabase.from('bitacora_obra').select('*').eq('obra_id', id).order('created_at', { ascending: false }).limit(80),
    supabase.from('obra_detalles').select('*').eq('obra_id', id).order('created_at'),
    supabase.from('solicitudes_material').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    supabase.from('polizas_garantia').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    supabase.from('recibos').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
    supabase.from('v_cobranza').select('*').eq('cotizacion_id', concentrado.cotizacion_id).maybeSingle(),
    supabase.from('profiles').select('*').eq('rol', 'cuadrilla').eq('activo', true).order('nombre'),
    supabase.from('v_insumos_existencia').select('*').order('nombre'),
    supabase
      .from('pagares')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const idsContrato = new Set((contratos.data ?? []).map((c) => c.id))
  const pagaresDeLaObra = (pagares.data ?? []).filter((p) => idsContrato.has(p.contrato_id))

  const [items, herramientas, nomina, materialesPrevios, productos] = await Promise.all([
    pagaresDeLaObra.length > 0
      ? supabase
          .from('pagare_items')
          .select('*')
          .in('pagare_id', pagaresDeLaObra.map((p) => p.id))
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('herramientas').select('*').order('codigo'),
    supabase.from('v_nomina_contratos').select('*').eq('obra_id', id),
    // Para el autocompletado de material: lo ya capturado en cualquier obra
    // o cotización, más el catálogo de productos con su costo.
    supabase.from('obra_materiales').select('material, costo').limit(2000),
    supabase.from('productos').select('nombre, costo').eq('activo', true).neq('tipo', 'insumo_taller'),
  ])

  const [materialesCotizados, partidasCotizacion, conceptosPrevios] = await Promise.all([
    supabase.from('cotizacion_materiales').select('material, costo').limit(2000),
    // Las partidas de la cotización de esta obra: sirven como áreas de la póliza.
    supabase
      .from('cotizacion_items')
      .select('descripcion, orden')
      .eq('cotizacion_id', concentrado.cotizacion_id)
      .order('orden'),
    // Los conceptos ya usados en cualquier obra: los nombres se repiten.
    supabase.from('obra_conceptos').select('nombre, presupuesto').limit(2000),
  ])

  const sugerenciasConceptos = masComunes(
    (conceptosPrevios.data ?? []).map((c) => ({ texto: c.nombre, monto: c.presupuesto })),
    20,
  )

  const sugerenciasAreas = masComunes(
    (partidasCotizacion.data ?? []).map((p) => ({ texto: p.descripcion, monto: null })),
    20,
  )

  const sugerenciasMateriales = conCatalogo(
    masComunes(
      [...(materialesPrevios.data ?? []), ...(materialesCotizados.data ?? [])].map((m) => ({
        texto: m.material,
        monto: m.costo,
      })),
      30,
    ),
    productos.data ?? [],
  )

  return {
    concentrado,
    obra: obra.data!,
    conceptos: conceptos.data ?? [],
    contratos: contratos.data ?? [],
    materiales: materiales.data ?? [],
    tareas: tareas.data ?? [],
    avances: avances.data ?? [],
    bitacora: bitacora.data ?? [],
    detalles: detalles.data ?? [],
    solicitudes: solicitudes.data ?? [],
    poliza: (polizas.data ?? [])[0] ?? null,
    recibos: recibos.data ?? [],
    cobranza: cobranza.data ?? null,
    oficiales: oficiales.data ?? [],
    insumos: insumos.data ?? [],
    pagares: pagaresDeLaObra,
    pagareItems: items.data ?? [],
    herramientas: herramientas.data ?? [],
    nomina: nomina.data ?? [],
    sugerenciasMateriales,
    sugerenciasAreas,
    sugerenciasConceptos,
  }
}

export type DatosObra = Awaited<ReturnType<typeof cargarObra>>
