import Link from 'next/link'
import { Plus, Zap } from 'lucide-react'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos } from '@/lib/format'
import { ESTATUS_COTIZACION } from '@/lib/cotizaciones'
import { CATEGORIA_GASTO, mesActual, rangoMes } from '@/lib/finanzas'
import { EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tarjeta } from '@/components/ui'
import type { CategoriaGasto, EstatusCotizacion } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const perfil = await requerirRol(['admin', 'administracion'])
  const supabase = await crearClienteServidor()
  const mes = mesActual()
  const { desde, hasta } = rangoMes(mes)

  const [cotizacionesMes, obras, cobranza, cxp, gastosMes, prenomina, recientes] = await Promise.all([
    supabase.from('v_cotizaciones').select('estatus, total').gte('fecha', desde).lt('fecha', hasta),
    supabase.from('obras').select('estatus'),
    supabase.from('v_cobranza').select('saldo, estatus, anticipo_esperado, anticipo'),
    supabase.from('v_cuentas_por_pagar').select('saldo, estado, proveedor, vencimiento, folio_factura'),
    supabase.from('v_gastos').select('categoria, monto').gte('fecha', desde).lt('fecha', hasta),
    supabase.from('v_prenomina').select('*').order('disponible', { ascending: false }),
    supabase.from('v_cotizaciones').select('*').order('updated_at', { ascending: false }).limit(5),
  ])

  const bdLista = !cotizacionesMes.error && !obras.error

  const delMes = cotizacionesMes.data ?? []
  const porEstatus = (e: EstatusCotizacion) => delMes.filter((c) => c.estatus === e)

  const enObra = (obras.data ?? []).filter((o) => o.estatus === 'en_obra').length
  const pausadas = (obras.data ?? []).filter((o) => o.estatus === 'pausada').length
  const agendadas = (obras.data ?? []).filter((o) => o.estatus === 'agendada').length

  const porCobrar = (cobranza.data ?? [])
    .filter((c) => c.estatus === 'aprobada' || c.estatus === 'terminada')
    .reduce((s, c) => s + Number(c.saldo ?? 0), 0)

  const anticiposPendientes = (cobranza.data ?? [])
    .filter((c) => c.estatus === 'aprobada' && Number(c.anticipo) < Number(c.anticipo_esperado))
    .reduce((s, c) => s + (Number(c.anticipo_esperado) - Number(c.anticipo)), 0)

  const urgentes = (cxp.data ?? []).filter((c) => c.estado === 'vencida' || c.estado === 'urgente')
  const montoUrgente = urgentes.reduce((s, c) => s + Number(c.saldo ?? 0), 0)

  const nomina = prenomina.data ?? []
  const aPagarNomina = nomina.reduce(
    (s, p) => s + Math.max(0, Number(p.disponible) - Number(p.deducciones)),
    0,
  )

  const gastos = gastosMes.data ?? []
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const porCategoria = new Map<CategoriaGasto, number>()
  for (const g of gastos) {
    porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + Number(g.monto))
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <>
      <EncabezadoPagina
        titulo={`Buen día, ${perfil.nombre.split(' ')[0]}`}
        descripcion="Qué se cotizó, qué está en obra, qué falta cobrar y qué falta pagar."
        acciones={
          <>
            <Link
              href="/admin/cotizar-rapido"
              className="inline-flex items-center gap-2 rounded-lg border border-haaco-300 bg-haaco-50 px-4 py-2 text-sm font-medium text-haaco-800 transition hover:bg-haaco-100"
            >
              <Zap size={16} />
              Cotización rápida
            </Link>
            <Link
              href="/admin/cotizaciones/nueva"
              className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
            >
              <Plus size={16} />
              Nueva cotización
            </Link>
          </>
        }
      />

      {!bdLista && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No se pudo leer la base de datos. Verifica que las migraciones estén aplicadas
          (<code className="font-mono">npm run bd:push</code>).
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          etiqueta="Por cobrar"
          valor={pesosCortos(porCobrar)}
          nota={
            anticiposPendientes > 0
              ? `${pesosCortos(anticiposPendientes)} son anticipos sin cobrar`
              : 'Obras aprobadas y terminadas'
          }
          tono={porCobrar > 0 ? 'ambar' : 'verde'}
          href="/admin/cobranza"
        />
        <Indicador
          etiqueta="Nómina de la semana"
          valor={pesosCortos(aPagarNomina)}
          nota="devengado por avance, menos deducciones"
          href="/admin/nomina?t=prenomina"
        />
        <Indicador
          etiqueta="Pagos urgentes"
          valor={pesosCortos(montoUrgente)}
          nota={`${urgentes.length} ${urgentes.length === 1 ? 'factura vencida o por vencer' : 'facturas vencidas o por vencer'}`}
          tono={montoUrgente > 0 ? 'rojo' : 'neutro'}
          href="/admin/cuentas-por-pagar"
        />
        <Indicador
          etiqueta="Gastos del mes"
          valor={pesosCortos(totalGastos)}
          nota={`${gastos.length} movimientos`}
          href="/admin/gastos"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          etiqueta="Cotizado este mes"
          valor={pesosCortos(delMes.reduce((s, c) => s + Number(c.total), 0))}
          nota={`${delMes.length} ${delMes.length === 1 ? 'cotización' : 'cotizaciones'}`}
          href={`/admin/cotizaciones?mes=${mes}`}
        />
        <Indicador
          etiqueta="Obras en proceso"
          valor={String(enObra)}
          nota={`${agendadas} agendadas · ${pausadas} pausadas`}
          tono="verde"
          href="/admin/obras"
        />
        <Indicador
          etiqueta="Aprobadas este mes"
          valor={String(porEstatus('aprobada').length)}
          nota={pesosCortos(porEstatus('aprobada').reduce((s, c) => s + Number(c.total), 0))}
          href={`/admin/cotizaciones?mes=${mes}&estatus=aprobada`}
        />
        <Indicador
          etiqueta="Por resolver"
          valor={String(porEstatus('borrador').length + porEstatus('enviada').length)}
          nota="borrador y enviadas"
          tono="ambar"
          href={`/admin/cotizaciones?mes=${mes}&estatus=enviada`}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Prenómina --------------------------------------------------- */}
        <Tarjeta
          titulo="Prenómina"
          pie="Lo que se puede pagar hoy según el avance reportado."
        >
          {nomina.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-500">Sin contratos activos.</p>
          ) : (
            <ul className="divide-y divide-tinta-100">
              {nomina.slice(0, 6).map((p) => {
                const aPagar = Math.max(0, Number(p.disponible) - Number(p.deducciones))
                return (
                  <li key={p.trabajador_id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-tinta-900">{p.trabajador}</span>
                      <span className="text-xs text-tinta-400">
                        {p.contratos_activos} {p.contratos_activos === 1 ? 'obra' : 'obras'}
                        {Number(p.deducciones) > 0 && ` · ${pesos(p.deducciones)} en préstamos`}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-medium tabular-nums ${
                        aPagar > 0 ? 'text-haaco-700' : 'text-tinta-400'
                      }`}
                    >
                      {pesos(aPagar)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="border-t border-tinta-100 px-5 py-2.5">
            <Link href="/admin/nomina" className="text-sm font-medium text-haaco-700 hover:underline">
              Ir a nómina →
            </Link>
          </div>
        </Tarjeta>

        {/* Gastos por categoría ---------------------------------------- */}
        <Tarjeta titulo="Gastos del mes por categoría">
          {categorias.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-500">Sin gastos este mes.</p>
          ) : (
            <ul className="divide-y divide-tinta-100">
              {categorias.map(([categoria, monto]) => (
                <li key={categoria} className="px-5 py-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-tinta-600">{CATEGORIA_GASTO[categoria]}</span>
                    <span className="font-medium tabular-nums text-tinta-900">{pesos(monto)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tinta-100">
                    <div
                      className="h-full rounded-full bg-haaco-500"
                      style={{ width: `${totalGastos > 0 ? (monto / totalGastos) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {/* Pagos urgentes ---------------------------------------------- */}
        <Tarjeta titulo="Pagos que no pueden esperar">
          {urgentes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-500">
              Nada vencido ni por vencer.
            </p>
          ) : (
            <ul className="divide-y divide-tinta-100">
              {urgentes.slice(0, 6).map((c, i) => (
                <li key={`${c.folio_factura}-${i}`} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-tinta-900">{c.proveedor}</span>
                    <span className="text-xs text-tinta-400">
                      {c.folio_factura} · vence {fecha(c.vencimiento)}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums text-red-600">
                    {pesos(c.saldo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-tinta-100 px-5 py-2.5">
            <Link
              href="/admin/cuentas-por-pagar"
              className="text-sm font-medium text-haaco-700 hover:underline"
            >
              Ver cuentas por pagar →
            </Link>
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Movimiento reciente" className="mt-4">
        {(recientes.data ?? []).length === 0 ? (
          <EstadoVacio
            titulo="Todavía no hay cotizaciones"
            descripcion="Empieza por la primera: de ahí salen las órdenes de trabajo y la cobranza."
            accion={
              <Link
                href="/admin/cotizaciones/nueva"
                className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
              >
                <Plus size={16} />
                Nueva cotización
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-tinta-100">
            {(recientes.data ?? []).map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/cotizaciones/${c.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-tinta-50"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-tinta-900">
                      <span className="font-mono text-xs text-haaco-700">{c.folio}</span>
                      <span className="truncate">{c.cliente}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-tinta-500">
                      {c.nombre_obra ?? 'Sin nombre de obra'} · {fecha(c.fecha)}
                      {c.obras > 0 && ` · ${c.obras} OT`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-medium tabular-nums text-tinta-800">
                      {pesos(c.total)}
                    </span>
                    <Etiqueta tono={ESTATUS_COTIZACION[c.estatus].tono}>
                      {ESTATUS_COTIZACION[c.estatus].texto}
                    </Etiqueta>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </>
  )
}
