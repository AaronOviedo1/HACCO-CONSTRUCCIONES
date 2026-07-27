import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesosCortos } from '@/lib/format'
import { ESTATUS_COTIZACION } from '@/lib/cotizaciones'
import { ESTATUS_OBRA } from '@/lib/obras'
import { CATEGORIA_GASTO, mesActual, rangoMes } from '@/lib/finanzas'
import { EncabezadoPagina, EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import {
  Anillo, Donut, FilaLista, GraficaMeses, PieTarjeta, Tile,
} from '@/components/movil/piezas'
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
  const ventana = ultimosSeisMeses()
  const { desde: desdeSeis } = rangoMes(ventana[0].clave)

  const [historico, obras, cobranza, cxp, gastosMes, prenomina, recientes] = await Promise.all([
    supabase.from('v_cotizaciones').select('fecha, estatus, total').gte('fecha', desdeSeis),
    supabase.from('obras').select('estatus'),
    supabase.from('v_cobranza').select('saldo, cobrado, estatus, anticipo_esperado, anticipo'),
    supabase.from('v_cuentas_por_pagar').select('saldo, estado, proveedor, vencimiento, folio_factura'),
    supabase.from('v_gastos').select('categoria, monto').gte('fecha', desde).lt('fecha', hasta),
    supabase.from('v_prenomina').select('disponible, deducciones'),
    supabase.from('v_cotizaciones').select('*').order('updated_at', { ascending: false }).limit(5),
  ])

  const bdLista = !historico.error && !obras.error

  // ---- cotizado contra aprobado, mes a mes -------------------------------
  const todas = historico.data ?? []
  const meses = ventana.map((v) => {
    const delMes = todas.filter((c) => String(c.fecha ?? '').startsWith(v.clave))
    return {
      m: v.m,
      cotizado: delMes.reduce((s, c) => s + Number(c.total), 0),
      aprobado: delMes
        .filter((c) => c.estatus === 'aprobada' || c.estatus === 'terminada')
        .reduce((s, c) => s + Number(c.total), 0),
    }
  })

  const delMes = todas.filter((c) => String(c.fecha ?? '').startsWith(mes))
  const porEstatusCot = (e: EstatusCotizacion) => delMes.filter((c) => c.estatus === e)
  const porResolver = porEstatusCot('borrador').length + porEstatusCot('enviada').length

  // ---- obras --------------------------------------------------------------
  const listaObras = obras.data ?? []
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

  const urgentes = (cxp.data ?? []).filter((c) => c.estado === 'vencida' || c.estado === 'urgente')
  const montoUrgente = urgentes.reduce((s, c) => s + Number(c.saldo ?? 0), 0)

  const aPagarNomina = (prenomina.data ?? []).reduce(
    (s, p) => s + Math.max(0, Number(p.disponible) - Number(p.deducciones)),
    0,
  )

  const gastos = gastosMes.data ?? []
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const porCategoria = new Map<CategoriaGasto, number>()
  for (const g of gastos) {
    porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + Number(g.monto))
  }
  const categorias = [...porCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([categoria, monto]) => ({ n: CATEGORIA_GASTO[categoria], v: monto }))

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

      <div className="grid gap-3.5 lg:grid-cols-3">
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

        {/* Los cuatro números del día ---------------------------------------- */}
        <div className="grid grid-cols-2 gap-2.5 lg:col-span-2 lg:grid-cols-4 lg:gap-3">
          <Tile
            etiqueta="Nómina de la semana"
            valor={pesosCortos(aPagarNomina)}
            nota="devengado por avance"
            href="/admin/nomina?t=prenomina"
          />
          <Tile
            etiqueta="Pagos urgentes"
            valor={pesosCortos(montoUrgente)}
            tono={montoUrgente > 0 ? 'rojo' : 'neutro'}
            nota={`${urgentes.length} ${urgentes.length === 1 ? 'factura vencida o por vencer' : 'facturas vencidas o por vencer'}`}
            href="/admin/cuentas-por-pagar"
          />
          <Tile
            etiqueta="Cotizado este mes"
            valor={pesosCortos(delMes.reduce((s, c) => s + Number(c.total), 0))}
            nota={`${delMes.length} ${delMes.length === 1 ? 'cotización' : 'cotizaciones'} · ${porResolver} por resolver`}
            href={`/admin/cotizaciones?mes=${mes}`}
          />
          <Tile
            etiqueta="Obras en proceso"
            valor={String(enObra)}
            tono="verde"
            nota={`${agendadas} agendadas · ${pausadas} pausadas`}
            href="/admin/obras"
          />
        </div>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-3">
        {/* Cotizado contra aprobado ------------------------------------------ */}
        <Tarjeta>
          <div className="px-3.5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[14.5px] font-semibold">Cotizado vs aprobado</h2>
              <span className="text-[11px] text-tinta-400">últimos 6 meses</span>
            </div>
            <GraficaMeses meses={meses} />
          </div>
        </Tarjeta>

        {/* Gastos del mes ----------------------------------------------------- */}
        <Tarjeta>
          <div className="px-3.5 py-4">
            <h2 className="mb-3.5 text-[14.5px] font-semibold">Gastos del mes por categoría</h2>
            {categorias.length === 0 ? (
              <p className="py-6 text-center text-sm text-tinta-500">Sin gastos este mes.</p>
            ) : (
              <Donut partes={categorias} centro={pesosCortos(totalGastos)} pie={MESES[new Date().getMonth()]} />
            )}
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

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        {/* Pagos urgentes ------------------------------------------------------ */}
        <Tarjeta titulo="Pagos que no pueden esperar">
          {urgentes.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-tinta-500">Nada vencido ni por vencer.</p>
          ) : (
            urgentes.slice(0, 5).map((c, i) => (
              <FilaLista
                key={`${c.folio_factura}-${i}`}
                principal={c.proveedor}
                secundario={`${c.folio_factura ?? 'sin folio'} · vence ${fecha(c.vencimiento)}`}
                derecha={
                  <span className="text-sm font-semibold tabular-nums text-red-600">
                    {pesosCortos(c.saldo)}
                  </span>
                }
              />
            ))
          )}
          <PieTarjeta href="/admin/cuentas-por-pagar">Ver cuentas por pagar →</PieTarjeta>
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
