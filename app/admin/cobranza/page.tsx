import { Fragment } from 'react'
import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos, porcentaje } from '@/lib/format'
import { TIPO_PAGO_COBRANZA, agruparPorMes, etiquetaMes, mesActual, tonoCobranza } from '@/lib/finanzas'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, FilaMes, Indicador, Tabla, Tarjeta, Td, Th, TituloMes,
} from '@/components/ui'
import { AccionesCobranza, FilaCobranza } from '@/components/finanzas/cobranza'
import type { PagoCobranza } from '@/types/database'

export const dynamic = 'force-dynamic'

const PESTANAS = [
  { clave: 'registro', titulo: 'Registro' },
  { clave: 'concentrado', titulo: 'Concentrado' },
] as const

export default async function PaginaCobranza({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { t } = await searchParams
  const vista = PESTANAS.find((p) => p.clave === t)?.clave ?? 'registro'

  const supabase = await crearClienteServidor()

  const [{ data: cobranza }, { data: pagos }, { data: obras }, { data: nombres }] = await Promise.all([
    supabase.from('v_cobranza').select('*').order('fecha', { ascending: false }),
    supabase.from('pagos_cobranza').select('*').order('fecha'),
    supabase.from('obras').select('id, cotizacion_id, nombre, ot_numero, estatus'),
    supabase.from('cotizaciones').select('id, nombre_obra'),
  ])

  // Si la cotización todavía no abre OT, la tarjeta se titula con el nombre
  // de obra que traía la cotización.
  const nombreCotizado = new Map((nombres ?? []).map((c) => [c.id, c.nombre_obra]))

  // Se cobra lo aprobado o terminado — y también lo que ya tiene OT abierta
  // aunque la cotización haya regresado a borrador o enviada para editarse:
  // la obra arrancó y su dinero se sigue aquí.
  const conObra = new Set((obras ?? []).map((o) => o.cotizacion_id))
  const filas = (cobranza ?? []).filter(
    (c) => c.estatus === 'aprobada' || c.estatus === 'terminada' || conObra.has(c.cotizacion_id),
  )
  const porCotizacion = new Map<string, PagoCobranza[]>()
  for (const p of pagos ?? []) {
    porCotizacion.set(p.cotizacion_id, [...(porCotizacion.get(p.cotizacion_id) ?? []), p])
  }

  const obrasPorCotizacion = new Map<string, typeof obras>()
  for (const o of obras ?? []) {
    obrasPorCotizacion.set(o.cotizacion_id, [...(obrasPorCotizacion.get(o.cotizacion_id) ?? []), o])
  }

  const totalCotizado = filas.reduce((s, c) => s + Number(c.cotizado), 0)
  const totalCobrado = filas.reduce((s, c) => s + Number(c.cobrado), 0)
  const totalSaldo = filas.reduce((s, c) => s + Number(c.saldo), 0)
  const conSaldo = filas.filter((c) => Number(c.saldo) > 0)
  const anticiposPendientes = filas
    .filter((c) => Number(c.anticipo) < Number(c.anticipo_esperado))
    .reduce((s, c) => s + (Number(c.anticipo_esperado) - Number(c.anticipo)), 0)

  // Máximo de abonos capturados: define cuántas columnas pintar, como su Excel.
  const maxAbonos = Math.max(
    1,
    ...filas.map((c) => (porCotizacion.get(c.cotizacion_id) ?? []).filter((p) => p.tipo === 'abono').length),
  )

  // Bloques por mes de la cotización, con lo cobrado y lo que falta de cada uno.
  const meses = agruparPorMes(filas, (c) => c.fecha)
  const detalleMes = (grupo: (typeof meses)[number]) =>
    `${pesos(grupo.filas.reduce((s, c) => s + Number(c.cobrado), 0))} cobrado · ${pesos(
      grupo.filas.reduce((s, c) => s + Number(c.saldo), 0),
    )} por cobrar`
  const mesesConSaldo = agruparPorMes(conSaldo, (c) => c.fecha)

  return (
    <>
      <EncabezadoPagina
        titulo="Cobranza"
        descripcion="Por cotización aprobada: anticipo, abonos, saldo y porcentaje pendiente."
      />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:mb-5 lg:grid-cols-4 lg:gap-3">
        <Indicador etiqueta="Cobrado" valor={pesosCortos(totalCobrado)} tono="verde" />
        <Indicador
          etiqueta="Falta"
          valor={pesosCortos(totalSaldo)}
          nota={`${conSaldo.length} con saldo`}
          tono={totalSaldo > 0 ? 'ambar' : 'verde'}
        />
        <Indicador
          etiqueta="Cotizado"
          valor={pesosCortos(totalCotizado)}
          nota={`${filas.length} obras`}
          className="hidden lg:block"
        />
        <Indicador
          etiqueta="Anticipos sin cobrar"
          valor={pesosCortos(anticiposPendientes)}
          nota="obras aprobadas que aún no dan anticipo"
          tono={anticiposPendientes > 0 ? 'rojo' : 'neutro'}
          className="hidden lg:block"
        />
      </div>

      {/* Teléfono: una tarjeta por obra, con el abono a un toque ------------ */}
      {filas.length > 0 && (
        <div className="flex flex-col gap-3 lg:hidden">
          {meses.map((grupo) => (
            <Fragment key={grupo.mes}>
              <TituloMes etiqueta={grupo.etiqueta} detalle={`${grupo.filas.length} obras`} />
              {grupo.filas.map((c) => {
                const cobradoPct =
                  Number(c.cotizado) > 0 ? Math.round((Number(c.cobrado) / Number(c.cotizado)) * 100) : 0
                const suyas = obrasPorCotizacion.get(c.cotizacion_id) ?? []

                return (
                  <article
                    key={c.cotizacion_id}
                    className="rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta"
                  >
                    <h2 className="text-[15.5px] font-semibold leading-snug -tracking-[0.2px]">
                      {suyas[0]?.nombre ?? nombreCotizado.get(c.cotizacion_id) ?? `Cotización ${c.folio ?? ''}`}
                    </h2>
                    <p className="mt-0.5 text-xs text-tinta-400">{c.cliente}</p>

                    <div className="mb-1.5 mt-3 flex justify-between text-[11.5px]">
                      <span className="text-tinta-500">Cobrado {pesos(c.cobrado)}</span>
                      <span className="font-semibold tabular-nums">{cobradoPct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-tinta-150" aria-hidden>
                      <div
                        className={`h-full rounded-full ${
                          cobradoPct >= 100 ? 'bg-haaco-600' : cobradoPct >= 50 ? 'bg-haaco-500' : 'bg-amber-600'
                        }`}
                        style={{ width: `${Math.min(100, cobradoPct)}%` }}
                      />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span>
                        <span className="block text-[10px] uppercase tracking-[0.06em] text-tinta-400">
                          Saldo
                        </span>
                        <span className="mt-px block text-base font-bold tabular-nums">
                          {pesos(c.saldo)}
                        </span>
                      </span>
                      <AccionesCobranza
                        variante="movil"
                        cobranza={c}
                        pagos={porCotizacion.get(c.cotizacion_id) ?? []}
                        obras={suyas}
                      />
                    </div>
                  </article>
                )
              })}
            </Fragment>
          ))}
        </div>
      )}

      <nav className="mb-4 hidden flex-wrap gap-1.5 lg:flex">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/admin/cobranza?t=${p.clave}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              vista === p.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {p.titulo}
          </Link>
        ))}
      </nav>

      {filas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="Todavía no hay obras aprobadas"
            descripcion="La cobranza aparece cuando una cotización pasa a aprobada."
            accion={
              <Link
                href="/admin/cotizaciones"
                className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
              >
                Ir a cotizaciones
              </Link>
            }
          />
        </Tarjeta>
      ) : vista === 'registro' ? (
        <Tarjeta
          className="hidden lg:block"
          pie="Cada renglón es una cotización aprobada. Los abonos se capturan en orden."
        >
          <Tabla>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Cotización</Th>
                <Th>Fact.</Th>
                <Th numerico>Cotizado</Th>
                <Th numerico>Anticipo</Th>
                {Array.from({ length: maxAbonos }, (_, i) => (
                  <Th key={i} numerico>{`Abono ${i + 1}`}</Th>
                ))}
                <Th numerico>Saldo</Th>
                <Th>% pendiente</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {meses.map((grupo) => (
                <Fragment key={grupo.mes}>
                  <FilaMes columnas={8 + maxAbonos} etiqueta={grupo.etiqueta} detalle={detalleMes(grupo)} />
                  {grupo.filas.map((c) => {
                    const suyos = porCotizacion.get(c.cotizacion_id) ?? []
                    const abonos = suyos.filter((p) => p.tipo === 'abono' || p.tipo === 'liquidacion')
                    const pct = Number(c.pct_pendiente)

                    return (
                      <FilaCobranza
                        key={c.cotizacion_id}
                        cobranza={c}
                        pagos={suyos}
                        obras={obrasPorCotizacion.get(c.cotizacion_id) ?? []}
                      >
                        <Td>
                          <Link
                            href={`/admin/cotizaciones/${c.cotizacion_id}`}
                            className="relative font-mono text-xs text-haaco-700 hover:underline"
                          >
                            {c.folio}
                          </Link>
                        </Td>
                        <Td className="text-tinta-500">{c.requiere_factura ? 'Sí' : 'No'}</Td>
                        <Td numerico>{pesos(c.cotizado)}</Td>
                        <Td numerico className={Number(c.anticipo) > 0 ? '' : 'text-tinta-300'}>
                          {Number(c.anticipo) > 0 ? pesos(c.anticipo) : '—'}
                        </Td>
                        {Array.from({ length: maxAbonos }, (_, i) => (
                          <Td key={i} numerico className={abonos[i] ? '' : 'text-tinta-300'}>
                            {abonos[i] ? pesos(abonos[i].monto) : '—'}
                          </Td>
                        ))}
                        <Td numerico className={Number(c.saldo) > 0 ? 'font-semibold text-amber-700' : 'text-haaco-700'}>
                          {pesos(c.saldo)}
                        </Td>
                        <Td>
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-tinta-100">
                              <span
                                className={`block h-full rounded-full ${
                                  pct <= 0 ? 'bg-haaco-500' : pct <= 50 ? 'bg-sky-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, 100 - pct)}%` }}
                              />
                            </span>
                            <span className="text-xs tabular-nums text-tinta-600">
                              {porcentaje(pct, 0)}
                            </span>
                          </span>
                        </Td>
                      </FilaCobranza>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : (
        <>
        {/* Teléfono: los totales y el PDF; la tabla completa vive en escritorio */}
        <Tarjeta className="mb-4 lg:hidden" titulo="Concentrado para el contador">
          <div className="space-y-3 px-4 py-4">
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div>
                <dt className="text-[11px] text-tinta-500">Cotizado</dt>
                <dd className="text-sm font-semibold tabular-nums">{pesosCortos(totalCotizado)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-tinta-500">Cobrado</dt>
                <dd className="text-sm font-semibold tabular-nums">{pesosCortos(totalCobrado)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-tinta-500">Por cobrar</dt>
                <dd className="text-sm font-semibold tabular-nums text-haaco-700">
                  {pesosCortos(totalSaldo)}
                </dd>
              </div>
            </dl>
            <a
              href={`/api/reportes/pdf?mes=${mesActual()}&descargar`}
              data-tap
              className="flex min-h-12 w-full items-center justify-center rounded-[14px] bg-haaco-700 px-4 text-[15px] font-semibold text-white transition active:bg-haaco-800"
            >
              Descargar PDF de {etiquetaMes(mesActual())}
            </a>
            <p className="text-center text-xs text-tinta-400">
              El concentrado detallado y otros meses están en Reportes.
            </p>
          </div>
        </Tarjeta>

        <Tarjeta
          className="hidden lg:block"
          titulo="Concentrado para el contador"
          pie={`Total general por cobrar: ${pesos(totalSaldo)}`}
        >
          <Tabla>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Cotización</Th>
                <Th>Fecha</Th>
                <Th>Factura</Th>
                <Th numerico>Cotizado</Th>
                <Th numerico>Cobrado</Th>
                <Th numerico>Saldo por liquidar</Th>
                <Th numerico>% pendiente</Th>
              </tr>
            </thead>
            <tbody>
              {mesesConSaldo.map((grupo) => (
                <Fragment key={grupo.mes}>
                  <FilaMes
                    columnas={8}
                    etiqueta={grupo.etiqueta}
                    detalle={`${pesos(grupo.filas.reduce((s, c) => s + Number(c.saldo), 0))} por cobrar`}
                  />
                  {grupo.filas.map((c) => (
                    <tr key={c.cotizacion_id} className="relative cursor-pointer hover:bg-tinta-50/60">
                      <Td className="font-medium text-tinta-900">{c.cliente}</Td>
                      <Td>
                        {/* Aquí no se cobra, se revisa: el renglón lleva a la cotización. */}
                        <Link
                          href={`/admin/cotizaciones/${c.cotizacion_id}`}
                          className="font-mono text-xs text-haaco-700 after:absolute after:inset-0 hover:underline"
                        >
                          {c.folio}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-tinta-500">{fecha(c.fecha)}</Td>
                      <Td>
                        <Etiqueta tono={c.requiere_factura ? 'azul' : 'gris'}>
                          {c.requiere_factura ? 'Sí' : 'No'}
                        </Etiqueta>
                      </Td>
                      <Td numerico>{pesos(c.cotizado)}</Td>
                      <Td numerico className="text-tinta-500">{pesos(c.cobrado)}</Td>
                      <Td numerico className="font-semibold text-amber-700">{pesos(c.saldo)}</Td>
                      <Td numerico>
                        <Etiqueta tono={tonoCobranza(Number(c.pct_pendiente))}>
                          {porcentaje(c.pct_pendiente, 0)}
                        </Etiqueta>
                      </Td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="bg-haaco-50/60">
                <Td className="font-semibold text-tinta-900">TOTAL GENERAL</Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td numerico className="font-semibold">
                  {pesos(conSaldo.reduce((s, c) => s + Number(c.cotizado), 0))}
                </Td>
                <Td numerico className="font-semibold">
                  {pesos(conSaldo.reduce((s, c) => s + Number(c.cobrado), 0))}
                </Td>
                <Td numerico className="text-base font-semibold text-haaco-700">
                  {pesos(totalSaldo)}
                </Td>
                <Td> </Td>
              </tr>
            </tbody>
          </Tabla>
        </Tarjeta>
        </>
      )}

      {vista === 'registro' && (pagos ?? []).length > 0 && (
        <Tarjeta titulo="Últimos pagos recibidos" className="mt-4 hidden lg:block">
          <ul className="divide-y divide-tinta-100">
            {(pagos ?? [])
              .slice()
              .reverse()
              .slice(0, 8)
              .map((p) => {
                const c = filas.find((f) => f.cotizacion_id === p.cotizacion_id)
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <Etiqueta tono={p.tipo === 'anticipo' ? 'azul' : p.tipo === 'liquidacion' ? 'verde' : 'gris'}>
                        {TIPO_PAGO_COBRANZA[p.tipo]}
                      </Etiqueta>
                      <span className="text-tinta-700">{c?.cliente ?? '—'}</span>
                      <span className="font-mono text-xs text-tinta-400">{c?.folio}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-tinta-500">{fecha(p.fecha)}</span>
                      <span className="font-medium tabular-nums text-tinta-900">{pesos(p.monto)}</span>
                    </span>
                  </li>
                )
              })}
          </ul>
        </Tarjeta>
      )}
    </>
  )
}
