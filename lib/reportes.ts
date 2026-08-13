import 'server-only'
import { crearClienteServidor } from '@/lib/supabase/server'
import { etiquetaMes, rangoMes } from '@/lib/finanzas'
import type {
  CategoriaGasto, EstatusCotizacion, MetodoPago, VCobranza, VCotizacion, VGasto,
  VObraConcentrado,
} from '@/types/database'

const redondear = (n: number) => Math.round(n * 100) / 100

/** Categorías que se consideran gasto de obra y no gasto general. */
const DE_OBRA: CategoriaGasto[] = ['material', 'viaticos']

export type MovimientoReporte = {
  fecha: string
  concepto: string
  referencia: string
  metodo: MetodoPago
  monto: number
  origen: 'Gasto' | 'Pago fijo' | 'Nómina'
}

export type ReporteMensual = Awaited<ReturnType<typeof cargarReporte>>

/**
 * Arma el paquete mensual del contador.
 *
 * Dos criterios conviven a propósito, porque así lo revisan hoy:
 *   · FACTURADO   = obras que terminaron de cobrarse dentro del mes (devengado).
 *   · COBRADO     = todo el dinero que entró en el mes (flujo).
 * La utilidad se calcula sobre lo facturado; el cobrado va aparte como caja.
 */
export async function cargarReporte(mes: string) {
  const { desde, hasta } = rangoMes(mes)
  const supabase = await crearClienteServidor()

  const [
    cotizacionesTodas, pagosTodos, concentrados, gastosMes, nominaMes,
    pagosFijosMes, cobranzaTodas, obrasTodas,
  ] = await Promise.all([
    supabase.from('v_cotizaciones').select('*'),
    supabase.from('pagos_cobranza').select('*').order('fecha'),
    supabase.from('v_obra_concentrado').select('*'),
    supabase.from('v_gastos').select('*').gte('fecha', desde).lt('fecha', hasta),
    supabase.from('nomina_pagos').select('*').gte('fecha', desde).lt('fecha', hasta),
    supabase.from('pagos_fijos').select('*').gte('quincena', desde).lt('quincena', hasta),
    supabase.from('v_cobranza').select('*'),
    supabase.from('obras').select('id, ot_numero, cotizacion_id, fecha_apertura, fecha_cierre'),
  ])

  const cotizaciones = cotizacionesTodas.data ?? []
  const pagos = pagosTodos.data ?? []
  const obras = concentrados.data ?? []
  const gastos = gastosMes.data ?? []
  const nomina = nominaMes.data ?? []
  const fijos = pagosFijosMes.data ?? []
  const cobranza = cobranzaTodas.data ?? []

  const errorLectura =
    cotizacionesTodas.error ?? concentrados.error ?? gastosMes.error ?? cobranzaTodas.error

  // -------------------------------------------------------------------------
  // Qué obras terminaron de cobrarse dentro del mes
  // -------------------------------------------------------------------------
  const pagosPorCotizacion = new Map<string, typeof pagos>()
  for (const p of pagos) {
    pagosPorCotizacion.set(p.cotizacion_id, [...(pagosPorCotizacion.get(p.cotizacion_id) ?? []), p])
  }

  const liquidadasDelMes: { cotizacion: VCotizacion; fechaLiquidacion: string }[] = []

  for (const c of cotizaciones) {
    const suyos = (pagosPorCotizacion.get(c.id) ?? []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha))
    let acumulado = 0
    for (const p of suyos) {
      acumulado += Number(p.monto)
      // El pago que cruza el total es el que marca la fecha de liquidación.
      if (acumulado >= Number(c.total) - 0.01) {
        if (p.fecha >= desde && p.fecha < hasta) {
          liquidadasDelMes.push({ cotizacion: c, fechaLiquidacion: p.fecha })
        }
        break
      }
    }
  }

  const facturado = redondear(liquidadasDelMes.reduce((s, l) => s + Number(l.cotizacion.total), 0))
  const cobrado = redondear(
    pagos.filter((p) => p.fecha >= desde && p.fecha < hasta).reduce((s, p) => s + Number(p.monto), 0),
  )

  // -------------------------------------------------------------------------
  // Costo de obra del mes
  // -------------------------------------------------------------------------
  const gastosDeObra = gastos.filter((g) => g.obra_id)
  const gastosGenerales = gastos.filter((g) => !g.obra_id)

  const material = redondear(
    gastosDeObra.filter((g) => g.categoria === 'material').reduce((s, g) => s + Number(g.monto), 0),
  )
  const viaticos = redondear(
    gastosDeObra.filter((g) => g.categoria === 'viaticos').reduce((s, g) => s + Number(g.monto), 0),
  )
  const adicionales = redondear(
    gastosDeObra
      .filter((g) => !DE_OBRA.includes(g.categoria))
      .reduce((s, g) => s + Number(g.monto), 0),
  )
  const manoObra = redondear(nomina.reduce((s, n) => s + Number(n.monto), 0))
  const costoObra = redondear(material + manoObra + viaticos + adicionales)

  const utilidadBruta = redondear(facturado - costoObra)
  const margenPct = facturado > 0 ? redondear((utilidadBruta / facturado) * 100) : 0

  // -------------------------------------------------------------------------
  // Gastos generales por categoría y costos fijos
  // -------------------------------------------------------------------------
  const porCategoria = new Map<CategoriaGasto, number>()
  for (const g of gastosGenerales) {
    porCategoria.set(g.categoria, redondear((porCategoria.get(g.categoria) ?? 0) + Number(g.monto)))
  }
  const categorias = [...porCategoria.entries()]
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto)

  const totalGastosGenerales = redondear(categorias.reduce((s, c) => s + c.monto, 0))
  const totalPagosFijos = redondear(fijos.reduce((s, p) => s + Number(p.monto), 0))
  const pagosFijosPagados = redondear(
    fijos.filter((p) => p.estado === 'pagado').reduce((s, p) => s + Number(p.monto), 0),
  )
  const costosFijos = redondear(totalGastosGenerales + totalPagosFijos)
  const utilidadCorte = redondear(utilidadBruta - costosFijos)

  /*
   * Punto de equilibrio: cuánto habría que facturar para que la utilidad a
   * corte sea cero, con el margen de contribución de este mes. Sin margen
   * positivo la pregunta no tiene respuesta.
   */
  const puntoEquilibrio = margenPct > 0 ? redondear(costosFijos / (margenPct / 100)) : null

  // -------------------------------------------------------------------------
  // Obras con movimiento en el mes
  // -------------------------------------------------------------------------
  const obrasPorId = new Map((obrasTodas.data ?? []).map((o) => [o.id, o]))
  const obrasDelMes = obras.filter((o) => {
    const cruda = obrasPorId.get(o.obra_id)
    const actualizada = o.fecha_ultima_actualizacion?.slice(0, 10) ?? ''
    return (
      (cruda?.fecha_apertura ?? '') >= desde && (cruda?.fecha_apertura ?? '') < hasta
      || (actualizada >= desde && actualizada < hasta)
      || ((cruda?.fecha_cierre ?? '') >= desde && (cruda?.fecha_cierre ?? '') < hasta)
    )
  })

  // -------------------------------------------------------------------------
  // Cotizaciones del mes y las aprobadas que todavía no son ingreso
  // -------------------------------------------------------------------------
  const cotizacionesDelMes = cotizaciones.filter((c) => c.fecha >= desde && c.fecha < hasta)

  const porEstatus = (['borrador', 'enviada', 'aprobada', 'rechazada', 'terminada'] as EstatusCotizacion[])
    .map((estatus) => {
      const lista = cotizacionesDelMes.filter((c) => c.estatus === estatus)
      return {
        estatus,
        cantidad: lista.length,
        monto: redondear(lista.reduce((s, c) => s + Number(c.total), 0)),
      }
    })
    .filter((x) => x.cantidad > 0)

  const idsLiquidadas = new Set(liquidadasDelMes.map((l) => l.cotizacion.id))
  const aprobadasNoLiquidadas = cobranza.filter(
    (c) => (c.estatus === 'aprobada' || c.estatus === 'terminada')
      && Number(c.saldo) > 0
      && !idsLiquidadas.has(c.cotizacion_id),
  )

  // -------------------------------------------------------------------------
  // Movimientos: tarjeta de empresa contra efectivo
  // -------------------------------------------------------------------------
  const movimientos: MovimientoReporte[] = [
    ...gastos.map((g) => ({
      fecha: g.fecha,
      concepto: g.descripcion,
      referencia: [g.proveedor, g.folio_factura, g.ot_numero].filter(Boolean).join(' · ') || '—',
      metodo: g.metodo,
      monto: Number(g.monto),
      origen: 'Gasto' as const,
    })),
    ...fijos.map((p) => ({
      fecha: p.fecha_pago ?? p.quincena,
      concepto: `${p.categoria} · ${p.beneficiario}`,
      referencia: p.descripcion ?? '—',
      metodo: p.metodo,
      monto: Number(p.monto),
      origen: 'Pago fijo' as const,
    })),
    ...nomina.map((n) => ({
      fecha: n.fecha,
      concepto: 'Abono a mano de obra',
      referencia: n.recibo_folio ?? '—',
      metodo: n.metodo,
      monto: Number(n.monto),
      origen: 'Nómina' as const,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))

  const sumaPorMetodo = (metodo: MetodoPago) =>
    redondear(movimientos.filter((m) => m.metodo === metodo).reduce((s, m) => s + m.monto, 0))

  return {
    mes,
    etiqueta: etiquetaMes(mes),
    desde,
    hasta,
    errorLectura: errorLectura?.message ?? null,

    finanzas: {
      facturado,
      cobrado,
      liquidadas: liquidadasDelMes,
      costoObra: { material, manoObra, viaticos, adicionales, total: costoObra },
      utilidadBruta,
      margenPct,
      categorias,
      totalGastosGenerales,
      totalPagosFijos,
      pagosFijosPagados,
      costosFijos,
      utilidadCorte,
      puntoEquilibrio,
    },

    obras: obrasDelMes as VObraConcentrado[],
    cotizaciones: cotizacionesDelMes as VCotizacion[],
    porEstatus,
    aprobadasNoLiquidadas: aprobadasNoLiquidadas as VCobranza[],
    cobranza: cobranza.filter((c) => c.estatus === 'aprobada' || c.estatus === 'terminada') as VCobranza[],

    movimientos,
    totales: {
      tarjeta: sumaPorMetodo('tarjeta_empresa'),
      efectivo: sumaPorMetodo('efectivo'),
      cajaChica: sumaPorMetodo('caja_chica'),
      transferencia: sumaPorMetodo('transferencia'),
      otros: redondear(
        sumaPorMetodo('cheque') + sumaPorMetodo('deposito'),
      ),
      salidas: redondear(movimientos.reduce((s, m) => s + m.monto, 0)),
    },

    gastos: gastos as VGasto[],
  }
}
