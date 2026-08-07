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

  // Los oficiales de la consulta anterior son sólo los que siguen laborando:
  // ésos son los que se pueden elegir para un contrato nuevo. Pero las tarjetas
  // de los contratos ya firmados necesitan el perfil de quien los firmó, aunque
  // se haya dado de baja, o perderían el nombre y la etiqueta de externo.
  const idsTrabajador = [...new Set((contratos.data ?? []).map((c) => c.trabajador_id))]

  const [items, herramientas, nomina, materialesPrevios, productos, perfilesContrato] =
    await Promise.all([
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
    supabase
      .from('productos')
      .select('nombre, costo, precio_neto')
      .eq('activo', true)
      .neq('tipo', 'insumo_taller'),
    idsTrabajador.length > 0
      ? supabase.from('profiles').select('*').in('id', idsTrabajador)
      : Promise.resolve({ data: [] as never[] }),
  ])

  // Los que se pueden elegir, más los que ya firmaron algo aquí, sin repetir.
  const porId = new Map((oficiales.data ?? []).map((p) => [p.id, p]))
  for (const p of perfilesContrato.data ?? []) if (!porId.has(p.id)) porId.set(p.id, p)
  const trabajadores = [...porId.values()]

  const [materialesCotizados, partidasCotizacion, conceptosPrevios, polizasPrevias] =
    await Promise.all([
      supabase.from('cotizacion_materiales').select('material, costo').limit(2000),
      // Las partidas de la cotización de esta obra: sirven como áreas de la póliza.
      supabase
        .from('cotizacion_items')
        .select('descripcion, orden')
        .eq('cotizacion_id', concentrado.cotizacion_id)
        .order('orden'),
      // Los conceptos ya usados en cualquier obra: los nombres se repiten.
      supabase.from('obra_conceptos').select('nombre, presupuesto').limit(2000),
      // Colores y códigos de todas las pólizas: los tonos se repiten entre obras.
      supabase.from('polizas_garantia').select('items').limit(500),
    ])

  const sugerenciasConceptos = masComunes(
    (conceptosPrevios.data ?? []).map((c) => ({ texto: c.nombre, monto: c.presupuesto })),
    20,
  )

  const sugerenciasAreas = masComunes(
    (partidasCotizacion.data ?? []).map((p) => ({ texto: p.descripcion, monto: null })),
    20,
  )

  // Cada color con su código más reciente, para autocompletar la póliza.
  const coloresVistos = new Map<string, { color: string; codigo: string }>()
  for (const p of polizasPrevias.data ?? []) {
    const items = Array.isArray(p.items) ? p.items : []
    for (const item of items) {
      const { color, codigo } = item as { color?: string; codigo?: string }
      if (color?.trim()) {
        coloresVistos.set(color.trim().toLowerCase(), {
          color: color.trim(),
          codigo: codigo?.trim() ?? '',
        })
      }
    }
  }
  const coloresPoliza = [...coloresVistos.values()]

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
    /** Sólo los que siguen laborando: alimenta el selector de un contrato nuevo. */
    oficiales: oficiales.data ?? [],
    /** Los anteriores más los que ya firmaron un contrato de esta OT, de baja o no. */
    trabajadores,
    insumos: insumos.data ?? [],
    pagares: pagaresDeLaObra,
    pagareItems: items.data ?? [],
    herramientas: herramientas.data ?? [],
    nomina: nomina.data ?? [],
    sugerenciasMateriales,
    sugerenciasAreas,
    sugerenciasConceptos,
    coloresPoliza,
  }
}

export type DatosObra = Awaited<ReturnType<typeof cargarObra>>
