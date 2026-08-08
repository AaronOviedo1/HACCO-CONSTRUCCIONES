import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos } from '@/lib/format'
import { ESTATUS_COTIZACION } from '@/lib/cotizaciones'
import { ESTATUS_OBRA } from '@/lib/obras'
import {
  CATEGORIA_GASTO, antiguedadCobranza, etiquetaMes, mesActual, rangoMes, semanasDePago,
} from '@/lib/finanzas'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { Anillo, FilaLista } from '@/components/movil/piezas'
import { GraficaMeses } from '@/components/movil/grafica-meses'
import { GraficaFlujo } from '@/components/admin/grafica-flujo'
import { GraficaGastos } from '@/components/admin/grafica-gastos'
import { GraficaAntiguedad } from '@/components/admin/grafica-antiguedad'
import { GraficaObrasCosto } from '@/components/admin/grafica-obras-costo'
import { CalendarioPagos } from '@/components/admin/calendario-pagos'
import { TileResumen } from '@/components/admin/tile-resumen'
import { VentasDelMes } from '@/components/admin/ventas-del-mes'
import type { CategoriaGasto, EstatusCotizacion, EstatusObra } from '@/types/database'

export const dynamic = 'force-dynamic'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Color con el que se pinta cada estatus de obra en la barra de composición. */
const COLOR_TONO = {
  verde: 'var(--color-haaco-800)',
  gris: 'var(--color-tinta-700)',
  ambar: '#92400e',
  rojo: '#991b1b',
  azul: '#075985',
} as const

/** Los seis meses que cierra hoy, del más viejo al actual. */
function ultimosSeisMeses() {
  const hoy = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 5 + i, 1)
    return {
      clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      m: MESES[d.getMonth()],
    }
  })
}

export default async function Dashboard() {
  const perfil = await requerirRol(['admin', 'administracion'])
  const supabase = await crearClienteServidor()
  const mes = mesActual()
  const { desde, hasta } = rangoMes(mes)
  // El filtro de cotizaciones espera el último día del mes, no el primero del siguiente.
  const finDeMes = new Date(new Date(`${hasta}T00:00:00`).getTime() - 86400000)
    .toISOString()
    .slice(0, 10)
  const ventana = ultimosSeisMeses()
  const { desde: desdeSeis } = rangoMes(ventana[0].clave)
  // Hoy en día calendario local: `toISOString` se va a UTC y en Hermosillo
  // adelanta la fecha siete horas antes de tiempo.
  const ahora = new Date()
  const hoyIso = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`

  const [
    historico, obras, cobranza, cxp, gastosSeis, pagosSeis, nominaSeis, prenomina,
    concentrado, fijos, recientes, meta,
  ] = await Promise.all([
      supabase
        .from('v_cotizaciones')
        .select('id, folio, cliente, nombre_obra, fecha, vence, estatus, total')
        .gte('fecha', desdeSeis),
      supabase.from('obras').select('id, ot_numero, nombre, estatus, avance_pct'),
      supabase
        .from('v_cobranza')
        .select('saldo, cobrado, estatus, anticipo_esperado, anticipo, fecha, ultimo_pago'),
      supabase
        .from('v_cuentas_por_pagar')
        .select('saldo, estado, proveedor, vencimiento, folio_factura, dias_restantes')
        .order('vencimiento'),
      supabase.from('v_gastos').select('categoria, monto, fecha').gte('fecha', desdeSeis),
      supabase.from('pagos_cobranza').select('monto, fecha').gte('fecha', desdeSeis),
      supabase.from('nomina_pagos').select('monto, fecha').gte('fecha', desdeSeis),
      supabase.from('v_prenomina').select('*').order('disponible', { ascending: false }),
      supabase
        .from('v_obra_concentrado')
        .select(
          'obra_id, ot_numero, nombre, estatus, cotizado, mano_obra, material_real, viaticos, gastos_adicionales, utilidad',
        ),
      supabase.from('pagos_fijos').select('quincena, monto, estado').neq('estado', 'pagado'),
      supabase.from('v_cotizaciones').select('*').order('updated_at', { ascending: false }).limit(5),
      supabase.from('ajustes').select('valor').eq('clave', 'meta_venta_mensual').maybeSingle(),
    ])

  const bdLista = !historico.error && !obras.error

  // ---- lo cotizado partido en lo que cerró y lo que no --------------------
  const todas = historico.data ?? []
  const cerrada = (e: EstatusCotizacion) => e === 'aprobada' || e === 'terminada'
  /**
   * Una cotización se enfrió si el cliente dijo que no, o si se quedó sin
   * contestar hasta que se le venció el precio. Sin esa segunda mitad, las
   * ciento cincuenta y tantas cotizaciones que se importaron del Excel 2026
   * —todas en «enviada»— inflarían para siempre lo que está en juego.
   */
  const enfriada = (c: { estatus: EstatusCotizacion; vence: string | null }) =>
    c.estatus === 'rechazada' || (!!c.vence && c.vence < hoyIso && !cerrada(c.estatus))

  const meses = ventana.map((v) => {
    const delMes = todas.filter((c) => String(c.fecha ?? '').startsWith(v.clave))
    const suma = (filas: typeof delMes) => filas.reduce((s, c) => s + Number(c.total), 0)
    return {
      m: v.m,
      vendido: suma(delMes.filter((c) => cerrada(c.estatus))),
      enfriado: suma(delMes.filter((c) => enfriada(c))),
      enJuego: suma(delMes.filter((c) => !cerrada(c.estatus) && !enfriada(c))),
    }
  })

  const delMes = todas
    .filter((c) => String(c.fecha ?? '').startsWith(mes))
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
  const porEstatusCot = (e: EstatusCotizacion) => delMes.filter((c) => c.estatus === e)
  const porResolver = porEstatusCot('borrador').length + porEstatusCot('enviada').length
  const cotizadoMes = delMes.reduce((s, c) => s + Number(c.total), 0)

  // Vendido = aprobado. Lo cotizado a secas ya tiene su recuadro y no dice si
  // el cliente dijo que sí.
  const vendidoMes = delMes
    .filter((c) => c.estatus === 'aprobada' || c.estatus === 'terminada')
    .reduce((s, c) => s + Number(c.total), 0)
  const metaVenta = Number(meta.data?.valor ?? 0)

  const resumenEstatus = (
    ['borrador', 'enviada', 'seguimiento', 'aprobada', 'rechazada'] as EstatusCotizacion[]
  )
    .map((clave) => ({
      clave,
      texto: ESTATUS_COTIZACION[clave].texto,
      n: porEstatusCot(clave).length,
      monto: porEstatusCot(clave).reduce((s, c) => s + Number(c.total), 0),
    }))

  // ---- obras --------------------------------------------------------------
  const listaObras = obras.data ?? []
  const obrasAbiertas = listaObras
    .filter((o) => o.estatus !== 'cerrada')
    .sort((a, b) => Number(b.avance_pct) - Number(a.avance_pct))
  const enObra = listaObras.filter((o) => o.estatus === 'en_obra').length
  const pausadas = listaObras.filter((o) => o.estatus === 'pausada').length
  const agendadas = listaObras.filter((o) => o.estatus === 'agendada').length

  const composicion = (
    ['en_obra', 'agendada', 'pausada', 'en_entrega', 'terminada', 'cerrada'] as EstatusObra[]
  )
    .map((k) => ({
      k,
      n: listaObras.filter((o) => o.estatus === k).length,
      etiqueta: ESTATUS_OBRA[k].texto,
      color: COLOR_TONO[ESTATUS_OBRA[k].tono],
    }))
    .filter((x) => x.n > 0)

  // ---- dinero -------------------------------------------------------------
  const abiertas = (cobranza.data ?? []).filter(
    (c) => c.estatus === 'aprobada' || c.estatus === 'terminada',
  )
  const porCobrar = abiertas.reduce((s, c) => s + Number(c.saldo ?? 0), 0)
  const cobrado = abiertas.reduce((s, c) => s + Number(c.cobrado ?? 0), 0)
  const pctCobrado = cobrado + porCobrar > 0 ? Math.round((cobrado / (cobrado + porCobrar)) * 100) : 0

  const anticiposPendientes = abiertas
    .filter((c) => c.estatus === 'aprobada' && Number(c.anticipo) < Number(c.anticipo_esperado))
    .reduce((s, c) => s + (Number(c.anticipo_esperado) - Number(c.anticipo)), 0)

  // Cuánto lleva callado cada cliente que debe: el total por cobrar ya está
  // arriba, esto dice cuánto de ese total es dinero que se está añejando.
  const antiguedad = antiguedadCobranza(abiertas)

  const urgentes = (cxp.data ?? []).filter((c) => c.estado === 'vencida' || c.estado === 'urgente')
  const montoUrgente = urgentes.reduce((s, c) => s + Number(c.saldo ?? 0), 0)

  const nomina = prenomina.data ?? []
  const aPagarNomina = nomina.reduce(
    (s, p) => s + Math.max(0, Number(p.disponible) - Number(p.deducciones)),
    0,
  )

  // ---- lo que hay que desembolsar las próximas seis semanas ---------------
  const porPagar = (cxp.data ?? []).filter(
    (c) => c.estado !== 'pagada' && c.estado !== 'cancelada' && Number(c.saldo) > 0,
  )
  const semanas = semanasDePago([
    {
      clave: 'proveedores',
      pagos: porPagar.map((c) => ({ fecha: c.vencimiento, monto: Number(c.saldo) })),
    },
    // La cuadrilla no tiene fecha de vencimiento: se le paga en la semana en
    // curso lo que ya devengó por avance.
    { clave: 'nomina', pagos: [{ fecha: hoyIso, monto: aPagarNomina }] },
    {
      clave: 'fijos',
      pagos: (fijos.data ?? []).map((f) => ({ fecha: f.quincena, monto: Number(f.monto) })),
    },
  ])

  // ---- lo que cada obra abierta se ha comido de su presupuesto ------------
  const obrasCosto = (concentrado.data ?? [])
    .filter((o) => o.estatus !== 'cerrada')
    .map((o) => ({
      id: o.obra_id,
      ot: o.ot_numero,
      nombre: o.nombre,
      cotizado: Number(o.cotizado ?? 0),
      manoObra: Number(o.mano_obra ?? 0),
      material: Number(o.material_real ?? 0),
      otros: Number(o.viaticos ?? 0) + Number(o.gastos_adicionales ?? 0),
      utilidad: Number(o.utilidad ?? 0),
    }))
    .sort((a, b) => b.cotizado - a.cotizado)
    .slice(0, 6)

  // ---- gastos por mes y flujo de dinero -----------------------------------
  const gastos = gastosSeis.data ?? []
  const pagos = pagosSeis.data ?? []
  const nominaPagada = nominaSeis.data ?? []
  const sumaDelMes = (filas: { fecha: string; monto: number }[], clave: string) =>
    filas.filter((f) => String(f.fecha).startsWith(clave)).reduce((s, f) => s + Number(f.monto), 0)

  const flujo = ventana.map((v) => ({
    m: v.m,
    entra: sumaDelMes(pagos, v.clave),
    sale: sumaDelMes(gastos, v.clave) + sumaDelMes(nominaPagada, v.clave),
  }))

  const mesesGastos = ventana.map((v) => {
    const porCategoria = new Map<CategoriaGasto, number>()
    for (const g of gastos.filter((x) => String(x.fecha).startsWith(v.clave))) {
      porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + Number(g.monto))
    }
    const ordenadas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])
    const cola = ordenadas.slice(6).reduce((s, [, monto]) => s + monto, 0)
    return {
      clave: v.clave,
      etiqueta: etiquetaMes(v.clave),
      categorias: [
        ...ordenadas.slice(0, 6).map(([categoria, monto]) => ({ n: CATEGORIA_GASTO[categoria], v: monto })),
        ...(cola > 0 ? [{ n: 'Otros', v: cola }] : []),
      ],
    }
  })

  return (
    <>
      <EncabezadoPagina
        titulo={`Buen día, ${perfil.nombre.split(' ')[0]}`}
        descripcion="Qué se cotizó, qué está en obra, qué falta cobrar y qué falta pagar."
      />

      {!bdLista && (
        <div className="mb-4 rounded-2xl border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No se pudo leer la base de datos. Verifica que las migraciones estén aplicadas
          (<code className="font-mono">npm run bd:push</code>).
        </div>
      )}

      <div className="grid gap-3.5 lg:grid-cols-2">
        {/* Cobranza ---------------------------------------------------------- */}
        <section className="rounded-[22px] bg-linear-[155deg,var(--color-haaco-700),var(--color-haaco-800)] p-4.5 text-white shadow-[0_8px_22px_rgba(16,70,44,.22)] lg:rounded-xl">
          <div className="flex items-center gap-4">
            <Anillo
              pct={pctCobrado}
              tamano={86}
              grosor={9}
              color="var(--color-haaco-300)"
              pista="rgba(255,255,255,.2)"
            >
              <span className="text-[19px] font-bold -tracking-[0.5px]">{pctCobrado}%</span>
              <span className="mt-1 text-[9px] uppercase tracking-[0.08em] opacity-75">cobrado</span>
            </Anillo>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.09em] opacity-80">Por cobrar</div>
              <div className="mt-0.5 text-3xl font-bold -tracking-[1px] tabular-nums">
                {pesosCortos(porCobrar)}
              </div>
              <div className="mt-1 text-xs leading-snug opacity-80">
                {anticiposPendientes > 0
                  ? `${pesosCortos(anticiposPendientes)} son anticipos sin cobrar`
                  : 'Obras aprobadas y terminadas'}
              </div>
            </div>
          </div>
          <Link
            href="/admin/cobranza"
            className="mt-4 flex min-h-11 items-center justify-center gap-1.5 rounded-[13px] bg-white/15 text-[15px] font-semibold transition active:bg-white/25"
          >
            Ir a cobranza
            <svg width="7" height="12" viewBox="0 0 8 14" fill="none" aria-hidden>
              <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </Link>
        </section>

        {/* Lo vendido contra la meta ----------------------------------------- */}
        <VentasDelMes vendido={vendidoMes} meta={metaVenta} etiqueta={etiquetaMes(mes)} />
      </div>

      {/* Los cuatro números del día ------------------------------------------ */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {/* En escritorio cada número abre su detalle sin salir del tablero. */}
        <TileResumen
          etiqueta="Nómina de la semana"
          valor={pesosCortos(aPagarNomina)}
          nota="devengado por avance"
          href="/admin/nomina?t=prenomina"
          titulo="Prenómina de la semana"
          descripcion="Lo que se puede pagar hoy según el avance reportado, menos préstamos."
          irA="Ir a nómina"
        >
          {nomina.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-tinta-500">Sin contratos activos.</p>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Trabajador</Th>
                  <Th numerico>Obras</Th>
                  <Th numerico>Devengado</Th>
                  <Th numerico>Pagado</Th>
                  <Th numerico>Deducciones</Th>
                  <Th numerico>A pagar</Th>
                </tr>
              </thead>
              <tbody>
                {nomina.map((p) => (
                  <tr key={p.trabajador_id}>
                    <Td className="font-medium text-tinta-900">{p.trabajador}</Td>
                    <Td numerico className="text-tinta-500">{p.contratos_activos}</Td>
                    <Td numerico>{pesos(p.devengado)}</Td>
                    <Td numerico className="text-tinta-500">{pesos(p.pagado)}</Td>
                    <Td numerico className={Number(p.deducciones) > 0 ? 'text-red-600' : 'text-tinta-300'}>
                      {Number(p.deducciones) > 0 ? `- ${pesos(p.deducciones)}` : '—'}
                    </Td>
                    <Td numerico className="font-semibold text-haaco-700">
                      {pesos(Math.max(0, Number(p.disponible) - Number(p.deducciones)))}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-haaco-50/60">
                  <Td className="font-semibold text-tinta-900">Total</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td numerico className="text-base font-semibold text-haaco-700">
                    {pesos(aPagarNomina)}
                  </Td>
                </tr>
              </tbody>
            </Tabla>
          )}
        </TileResumen>

        <TileResumen
          etiqueta="Pagos urgentes"
          valor={pesosCortos(montoUrgente)}
          tono={montoUrgente > 0 ? 'rojo' : 'neutro'}
          nota={`${urgentes.length} ${urgentes.length === 1 ? 'factura vencida o por vencer' : 'facturas vencidas o por vencer'}`}
          href="/admin/cuentas-por-pagar"
          titulo="Pagos que no pueden esperar"
          descripcion="Facturas de proveedor vencidas o que vencen en tres días o menos."
          irA="Ir a cuentas por pagar"
        >
          {urgentes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-tinta-500">
              Nada vencido ni por vencer.
            </p>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Proveedor</Th>
                  <Th>Factura</Th>
                  <Th>Vence</Th>
                  <Th>Estado</Th>
                  <Th numerico>Saldo</Th>
                </tr>
              </thead>
              <tbody>
                {urgentes.map((cuenta, i) => (
                  <tr key={`${cuenta.folio_factura}-${i}`}>
                    <Td className="font-medium text-tinta-900">{cuenta.proveedor}</Td>
                    <Td className="font-mono text-xs">{cuenta.folio_factura ?? '—'}</Td>
                    <Td className="whitespace-nowrap text-tinta-500">
                      {fecha(cuenta.vencimiento)}
                      <span className="ml-1.5 text-xs text-tinta-400">
                        {Number(cuenta.dias_restantes) < 0
                          ? `venció hace ${Math.abs(Number(cuenta.dias_restantes))} d`
                          : `en ${cuenta.dias_restantes} d`}
                      </span>
                    </Td>
                    <Td>
                      <Etiqueta tono={cuenta.estado === 'vencida' ? 'rojo' : 'ambar'}>
                        {cuenta.estado === 'vencida' ? 'Vencida' : 'Urgente'}
                      </Etiqueta>
                    </Td>
                    <Td numerico className="font-semibold text-red-600">{pesos(cuenta.saldo)}</Td>
                  </tr>
                ))}
                <tr className="bg-haaco-50/60">
                  <Td className="font-semibold text-tinta-900">Total</Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td> </Td>
                  <Td numerico className="text-base font-semibold text-red-600">
                    {pesos(montoUrgente)}
                  </Td>
                </tr>
              </tbody>
            </Tabla>
          )}
        </TileResumen>

        <TileResumen
          etiqueta="Cotizado este mes"
          valor={pesosCortos(cotizadoMes)}
          nota={`${delMes.length} ${delMes.length === 1 ? 'cotización' : 'cotizaciones'} · ${porResolver} por resolver`}
          href={`/admin/cotizaciones?desde=${desde}&hasta=${finDeMes}`}
          titulo={`Cotizado en ${etiquetaMes(mes)}`}
          descripcion="Cada cotización del mes con el estatus en el que quedó."
          irA="Ver las cotizaciones del mes"
        >
          {delMes.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-tinta-500">
              Todavía no hay cotizaciones este mes.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
                {resumenEstatus.map((r) => (
                  <div key={r.clave} className="rounded-xl border border-tinta-200 px-3 py-2.5">
                    <dt className="text-xs text-tinta-500">{r.texto}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-tinta-900">
                      {r.n}
                    </dd>
                    <dd className="text-xs text-tinta-400">{pesosCortos(r.monto)}</dd>
                  </div>
                ))}
              </dl>
              <Tabla>
                <thead>
                  <tr>
                    <Th>Folio</Th>
                    <Th>Cliente</Th>
                    <Th>Obra</Th>
                    <Th>Fecha</Th>
                    <Th numerico>Total</Th>
                    <Th>Estatus</Th>
                  </tr>
                </thead>
                <tbody>
                  {delMes.map((c) => (
                    <tr key={c.id}>
                      <Td className="font-mono text-xs text-haaco-700">{c.folio}</Td>
                      <Td className="font-medium text-tinta-900">{c.cliente}</Td>
                      <Td className="text-tinta-500">{c.nombre_obra ?? '—'}</Td>
                      <Td className="whitespace-nowrap text-tinta-500">{fecha(c.fecha)}</Td>
                      <Td numerico className="font-medium">{pesos(c.total)}</Td>
                      <Td>
                        <Etiqueta tono={ESTATUS_COTIZACION[c.estatus].tono}>
                          {ESTATUS_COTIZACION[c.estatus].texto}
                        </Etiqueta>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </>
          )}
        </TileResumen>

        <TileResumen
          etiqueta="Obras en proceso"
          valor={String(enObra)}
          tono="verde"
          nota={`${agendadas} agendadas · ${pausadas} pausadas`}
          href="/admin/obras"
          titulo="Obras abiertas"
          descripcion="Las órdenes de trabajo que no están cerradas, con su avance reportado."
          irA="Ir a obras"
        >
          {obrasAbiertas.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-tinta-500">
              No hay órdenes de trabajo abiertas.
            </p>
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>OT</Th>
                  <Th>Obra</Th>
                  <Th>Estatus</Th>
                  <Th numerico>Avance</Th>
                </tr>
              </thead>
              <tbody>
                {obrasAbiertas.map((o) => (
                  <tr key={o.id}>
                    <Td className="font-mono text-xs text-haaco-700">{o.ot_numero}</Td>
                    <Td className="font-medium text-tinta-900">{o.nombre}</Td>
                    <Td>
                      <Etiqueta tono={ESTATUS_OBRA[o.estatus].tono}>
                        {ESTATUS_OBRA[o.estatus].texto}
                      </Etiqueta>
                    </Td>
                    <Td numerico>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-tinta-100">
                          <span
                            className="block h-full rounded-full bg-haaco-500"
                            style={{ width: `${Math.min(100, Number(o.avance_pct))}%` }}
                          />
                        </span>
                        {Number(o.avance_pct)}%
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </TileResumen>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        {/* Cotizado contra vendido ------------------------------------------ */}
        <Tarjeta>
          <div className="px-3.5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14.5px] font-semibold">Cotizado vs vendido</h2>
              <span className="text-[11px] text-tinta-400">últimos 6 meses</span>
            </div>
            <GraficaMeses meses={meses} meta={metaVenta} />
          </div>
        </Tarjeta>

        {/* Dinero que entra contra el que sale ------------------------------- */}
        <Tarjeta>
          <div className="px-3.5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14.5px] font-semibold">Ingresos vs egresos</h2>
              <span className="text-[11px] text-tinta-400">cobranza · gastos + nómina</span>
            </div>
            <GraficaFlujo meses={flujo} />
          </div>
        </Tarjeta>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-3">
        {/* Lo que cada obra lleva gastado de su presupuesto ------------------- */}
        <Tarjeta className="lg:col-span-2">
          <div className="px-3.5 py-4">
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <h2 className="text-[14.5px] font-semibold">Presupuesto contra lo gastado</h2>
              <span className="text-[11px] text-tinta-400">obras abiertas</span>
            </div>
            <GraficaObrasCosto obras={obrasCosto} />
          </div>
        </Tarjeta>

        {/* Qué tan añejo es lo que falta por cobrar --------------------------- */}
        <Tarjeta>
          <div className="px-3.5 py-4">
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <h2 className="text-[14.5px] font-semibold">Antigüedad de la cobranza</h2>
              <span className="text-[11px] text-tinta-400">sin pago</span>
            </div>
            <GraficaAntiguedad tramos={antiguedad} />
            <Link
              href="/admin/cobranza"
              className="mt-3.5 block text-sm font-medium text-haaco-700 hover:underline"
            >
              Ver la cobranza →
            </Link>
          </div>
        </Tarjeta>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-3">
        {/* Gastos por categoría, con el mes a elección ------------------------- */}
        <Tarjeta className="lg:col-span-2">
          <div className="px-3.5 py-4">
            <h2 className="mb-3 text-[14.5px] font-semibold">Gastos por categoría</h2>
            <GraficaGastos meses={mesesGastos} />
          </div>
        </Tarjeta>

        {/* Obras por estatus --------------------------------------------------- */}
        <Tarjeta>
          <div className="px-3.5 py-4">
            <h2 className="mb-3 text-[14.5px] font-semibold">Obras por estatus</h2>
            {composicion.length === 0 ? (
              <p className="py-6 text-center text-sm text-tinta-500">Todavía no hay obras abiertas.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {composicion.map((e) => (
                  <li key={e.k}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-tinta-700">{e.etiqueta}</span>
                      <span className="font-semibold tabular-nums">{e.n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-tinta-100" aria-hidden>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(e.n / listaObras.length) * 100}%`, background: e.color }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Tarjeta>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-3">
        {/* Lo que hay que desembolsar de aquí a mes y medio -------------------- */}
        {/* Sustituye a la lista de «pagos que no pueden esperar»: repetía tal
            cual el detalle que ya abre el recuadro de pagos urgentes, y esto
            además dice de dónde va a salir el dinero y cuándo. */}
        <Tarjeta className="lg:col-span-2">
          <div className="px-3.5 py-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[14.5px] font-semibold">Lo que hay que pagar</h2>
              <Link
                href="/admin/cuentas-por-pagar"
                className="text-[11px] font-medium text-haaco-700 hover:underline"
              >
                Ver cuentas por pagar →
              </Link>
            </div>
            <CalendarioPagos semanas={semanas} />
          </div>
        </Tarjeta>

        {/* Movimiento reciente -------------------------------------------------- */}
        <Tarjeta titulo="Movimiento reciente">
          {(recientes.data ?? []).length === 0 ? (
            <EstadoVacio
              titulo="Todavía no hay cotizaciones"
              descripcion="Empieza por la primera: de ahí salen las órdenes de trabajo y la cobranza."
              accion={
                <Link
                  href="/admin/cotizaciones/nueva"
                  className="rounded-xl bg-haaco-700 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Nueva cotización
                </Link>
              }
            />
          ) : (
            (recientes.data ?? []).map((c) => (
              <FilaLista
                key={c.id}
                href={`/admin/cotizaciones/${c.id}`}
                principal={
                  <span className="flex items-center gap-1.5">
                    <span className="font-mono text-[11.5px] font-semibold text-haaco-700">
                      {c.folio}
                    </span>
                    <span className="truncate">{c.cliente}</span>
                  </span>
                }
                secundario={`${c.nombre_obra ?? 'Sin nombre de obra'} · ${fecha(c.fecha)}`}
                derecha={
                  <>
                    <span className="text-sm font-semibold tabular-nums">{pesosCortos(c.total)}</span>
                    <Etiqueta tono={ESTATUS_COTIZACION[c.estatus].tono}>
                      {ESTATUS_COTIZACION[c.estatus].texto}
                    </Etiqueta>
                  </>
                }
              />
            ))
          )}
        </Tarjeta>
      </div>
    </>
  )
}
