import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { requerirRol } from '@/lib/auth'
import { cargarReporte } from '@/lib/reportes'
import { fecha, pesos, pesosCortos, porcentaje } from '@/lib/format'
import { CATEGORIA_GASTO, METODO_PAGO, mesActual } from '@/lib/finanzas'
import { ESTATUS_COTIZACION } from '@/lib/cotizaciones'
import { ESTATUS_OBRA } from '@/lib/obras'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { FilaLista } from '@/components/movil/piezas'
import { BarraReportes, BotonHoja } from '@/components/reportes/barra'
import type { EstatusObra } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PaginaReportes({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const perfil = await requerirRol(['admin', 'administracion', 'contador'])
  const { mes = mesActual() } = await searchParams
  const r = await cargarReporte(mes)
  const f = r.finanzas

  const sinDatos =
    f.facturado === 0 && f.cobrado === 0 && r.obras.length === 0 && r.cotizaciones.length === 0

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        descripcion={`Cierre de ${r.etiqueta}. Todo lo que necesita el contador, exportable a Excel.`}
      />

      <BarraReportes mes={mes} soloLectura={perfil.rol === 'contador'} />

      {r.errorLectura && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No se pudo leer parte de la información: {r.errorLectura}
        </div>
      )}

      {sinDatos ? (
        <Tarjeta>
          <EstadoVacio
            titulo={`Sin movimientos en ${r.etiqueta}`}
            descripcion="Elige otro mes o captura cotizaciones, gastos y cobranza para que el cierre tenga contenido."
          />
        </Tarjeta>
      ) : (
        <div className="space-y-5">
          {/* a) Resumen financiero ------------------------------------- */}
          <section id="financiero">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-tinta-900">Resumen financiero</h2>
              <BotonHoja mes={mes} hoja="financiero" titulo="Resumen financiero" />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador
                etiqueta="Facturado"
                valor={pesosCortos(f.facturado)}
                nota={`${f.liquidadas.length} obras liquidadas en el mes`}
              />
              <Indicador etiqueta="Costo de obra" valor={pesosCortos(f.costoObra.total)} />
              <Indicador
                etiqueta="Utilidad bruta"
                valor={pesosCortos(f.utilidadBruta)}
                nota={porcentaje(f.margenPct, 1)}
                tono={f.utilidadBruta < 0 ? 'rojo' : 'verde'}
              />
              <Indicador
                etiqueta="Utilidad a fecha de corte"
                valor={pesosCortos(f.utilidadCorte)}
                nota="después de gastos generales y pagos fijos"
                tono={f.utilidadCorte < 0 ? 'rojo' : f.utilidadCorte > 0 ? 'verde' : 'neutro'}
              />
            </div>

            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <Tarjeta titulo="Del facturado a la utilidad" className="lg:col-span-2">
                <dl className="divide-y divide-tinta-100">
                  <Renglon etiqueta="Facturado (obra liquidada en el mes)" valor={pesos(f.facturado)} fuerte />
                  <Renglon etiqueta="Material consumido" valor={`- ${pesos(f.costoObra.material)}`} sangria />
                  <Renglon etiqueta="Mano de obra pagada" valor={`- ${pesos(f.costoObra.manoObra)}`} sangria />
                  <Renglon etiqueta="Viáticos" valor={`- ${pesos(f.costoObra.viaticos)}`} sangria />
                  <Renglon etiqueta="Gastos adicionales de obra" valor={`- ${pesos(f.costoObra.adicionales)}`} sangria />
                  <Renglon
                    etiqueta="Utilidad bruta"
                    valor={pesos(f.utilidadBruta)}
                    fuerte
                    tono={f.utilidadBruta < 0 ? 'rojo' : 'verde'}
                    nota={porcentaje(f.margenPct, 1)}
                  />
                  <Renglon etiqueta="Gastos generales" valor={`- ${pesos(f.totalGastosGenerales)}`} sangria />
                  <Renglon
                    etiqueta="Pagos fijos de la quincena"
                    valor={`- ${pesos(f.totalPagosFijos)}`}
                    sangria
                    nota={`${pesos(f.pagosFijosPagados)} ya pagados`}
                  />
                  <Renglon
                    etiqueta="Utilidad a fecha de corte"
                    valor={pesos(f.utilidadCorte)}
                    destacado
                    tono={f.utilidadCorte < 0 ? 'rojo' : 'verde'}
                  />
                </dl>
                <div className="border-t border-tinta-100 bg-tinta-50 px-4 py-3 text-xs text-tinta-600">
                  <p>
                    <strong>Facturado</strong> cuenta sólo las obras que terminaron de cobrarse
                    dentro del mes. En caja entraron <strong>{pesos(f.cobrado)}</strong> contando
                    anticipos y abonos parciales.
                  </p>
                  <p className="mt-1">
                    <strong>Punto de equilibrio:</strong>{' '}
                    {f.puntoEquilibrio == null ? (
                      'no se puede calcular sin margen positivo en el mes.'
                    ) : (
                      <>
                        habría que facturar <strong>{pesos(f.puntoEquilibrio)}</strong> para cubrir
                        los {pesos(f.costosFijos)} de costos fijos con el margen de{' '}
                        {porcentaje(f.margenPct, 1)}.
                      </>
                    )}
                  </p>
                </div>
              </Tarjeta>

              <Tarjeta titulo="Gastos generales por categoría">
                {f.categorias.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-tinta-500">
                    Sin gastos fuera de obra.
                  </p>
                ) : (
                  <ul className="divide-y divide-tinta-100">
                    {f.categorias.map((c) => (
                      <li key={c.categoria} className="px-4 py-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-tinta-600">{CATEGORIA_GASTO[c.categoria]}</span>
                          <span className="font-medium tabular-nums text-tinta-900">
                            {pesos(c.monto)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tinta-100">
                          <div
                            className="h-full rounded-full bg-haaco-500"
                            style={{
                              width: `${
                                f.totalGastosGenerales > 0
                                  ? (c.monto / f.totalGastosGenerales) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                    <li className="flex items-center justify-between bg-tinta-50 px-4 py-2.5 text-sm font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">{pesos(f.totalGastosGenerales)}</span>
                    </li>
                  </ul>
                )}
              </Tarjeta>
            </div>
          </section>

          {/* b) Obras del mes ----------------------------------------- */}
          <section id="obras">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-tinta-900">
                Obras con movimiento en {r.etiqueta}
              </h2>
              <BotonHoja mes={mes} hoja="obras" titulo="Obras" />
            </div>

            {/* Teléfono: la obra y lo que dejó; el desglose, en la hoja --- */}
            {r.obras.length > 0 && (
              <Tarjeta className="lg:hidden" pie={`${r.obras.length} órdenes de trabajo`}>
                {r.obras.map((o) => {
                  const pct =
                    Number(o.cotizado) > 0 ? (Number(o.utilidad) / Number(o.cotizado)) * 100 : 0
                  return (
                    <FilaLista
                      key={o.obra_id}
                      href={`/admin/obras/${o.obra_id}`}
                      principal={o.nombre}
                      secundario={`${o.ot_numero} · ${ESTATUS_OBRA[o.estatus as EstatusObra].texto} · real ${pesos(o.material_real)}`}
                      derecha={
                        <>
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              Number(o.utilidad) < 0 ? 'text-red-600' : 'text-haaco-700'
                            }`}
                          >
                            {pesos(o.utilidad)}
                          </span>
                          <span className="text-[10.5px] text-tinta-400">{porcentaje(pct, 0)}</span>
                        </>
                      }
                    />
                  )
                })}
              </Tarjeta>
            )}

            <Tarjeta
              className={r.obras.length > 0 ? 'hidden lg:block' : ''}
              pie={`${r.obras.length} órdenes de trabajo`}
            >
              {r.obras.length === 0 ? (
                <EstadoVacio titulo="Sin obras con movimiento este mes" />
              ) : (
                <Tabla>
                  <thead>
                    <tr>
                      <Th>OT</Th>
                      <Th>Obra</Th>
                      <Th>Cotización</Th>
                      <Th>Apertura</Th>
                      <Th>Actualizada</Th>
                      <Th>Estatus</Th>
                      <Th numerico>Material presup.</Th>
                      <Th numerico>Material real</Th>
                      <Th numerico>Mano de obra</Th>
                      <Th numerico>Adicionales</Th>
                      <Th numerico>Utilidad</Th>
                      <Th numerico>%</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.obras.map((o) => {
                      const pct =
                        Number(o.cotizado) > 0 ? (Number(o.utilidad) / Number(o.cotizado)) * 100 : 0
                      const rebasado = Number(o.material_real) > Number(o.material_cotizado)
                      return (
                        <tr key={o.obra_id} className="hover:bg-tinta-50/60">
                          <Td>
                            <Link
                              href={`/admin/obras/${o.obra_id}`}
                              className="font-mono text-xs text-haaco-700 hover:underline"
                            >
                              {o.ot_numero}
                            </Link>
                          </Td>
                          <Td>{o.nombre}</Td>
                          <Td className="font-mono text-xs text-tinta-500">{o.cotizacion_folio}</Td>
                          <Td className="whitespace-nowrap text-tinta-500">{fecha(o.fecha_apertura)}</Td>
                          <Td className="whitespace-nowrap text-tinta-500">
                            {fecha(o.fecha_ultima_actualizacion)}
                          </Td>
                          <Td>
                            <Etiqueta tono={ESTATUS_OBRA[o.estatus as EstatusObra].tono}>
                              {ESTATUS_OBRA[o.estatus as EstatusObra].texto}
                            </Etiqueta>
                          </Td>
                          <Td numerico className="text-tinta-500">{pesos(o.material_cotizado)}</Td>
                          <Td numerico className={rebasado ? 'font-medium text-red-600' : ''}>
                            {pesos(o.material_real)}
                          </Td>
                          <Td numerico>{pesos(o.mano_obra)}</Td>
                          <Td numerico className="text-tinta-500">{pesos(o.gastos_adicionales)}</Td>
                          <Td numerico className={Number(o.utilidad) < 0 ? 'font-semibold text-red-600' : 'font-medium text-haaco-700'}>
                            {pesos(o.utilidad)}
                          </Td>
                          <Td numerico className="text-tinta-500">{porcentaje(pct, 0)}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Tabla>
              )}
            </Tarjeta>
          </section>

          {/* c) Cotizaciones ------------------------------------------ */}
          <section id="cotizaciones">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-tinta-900">
                Cotizaciones de {r.etiqueta}
              </h2>
              <BotonHoja mes={mes} hoja="cotizaciones" titulo="Cotizaciones" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Tarjeta titulo="Por estatus">
                {r.porEstatus.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-tinta-500">
                    No se cotizó nada este mes.
                  </p>
                ) : (
                  <ul className="divide-y divide-tinta-100">
                    {r.porEstatus.map((e) => (
                      <li key={e.estatus} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <Etiqueta tono={ESTATUS_COTIZACION[e.estatus].tono}>
                          {ESTATUS_COTIZACION[e.estatus].texto}
                        </Etiqueta>
                        <span className="flex items-baseline gap-3">
                          <span className="tabular-nums text-tinta-500">{pesos(e.monto)}</span>
                          <span className="w-6 text-right font-semibold tabular-nums">
                            {e.cantidad}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>

              <Tarjeta
                titulo={
                  <span className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-600" />
                    Obra aprobada no liquidada al corte
                  </span>
                }
                pie="Regla contable: esto todavía no es ingreso. Se reconoce cuando se termine de cobrar."
                className="lg:col-span-2"
              >
                {/* Teléfono: cliente y lo que falta por cobrar ---------- */}
                {r.aprobadasNoLiquidadas.length > 0 && (
                  <div className="lg:hidden">
                    {r.aprobadasNoLiquidadas.map((c) => (
                      <FilaLista
                        key={c.cotizacion_id}
                        principal={c.cliente}
                        secundario={`${c.folio} · contratado ${pesos(c.cotizado)}${c.requiere_factura ? ' · con factura' : ''}`}
                        derecha={
                          <>
                            <span className="text-sm font-semibold tabular-nums text-amber-700">
                              {pesos(c.saldo)}
                            </span>
                            <span className="text-[10.5px] text-tinta-400">
                              cobrado {pesos(c.cobrado)}
                            </span>
                          </>
                        }
                      />
                    ))}
                    <p className="flex items-center justify-between gap-2 bg-amber-50/60 px-4 py-2.5 text-sm">
                      <span className="font-semibold text-tinta-900">Total no realizable aún</span>
                      <span className="font-semibold tabular-nums text-amber-700">
                        {pesos(r.aprobadasNoLiquidadas.reduce((s, c) => s + Number(c.saldo), 0))}
                      </span>
                    </p>
                  </div>
                )}

                {r.aprobadasNoLiquidadas.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-tinta-500">
                    Todo lo aprobado está liquidado.
                  </p>
                ) : (
                  <div className="hidden lg:block">
                  <Tabla>
                    <thead>
                      <tr>
                        <Th>Cliente</Th>
                        <Th>Cotización</Th>
                        <Th>Factura</Th>
                        <Th numerico>Contratado</Th>
                        <Th numerico>Cobrado</Th>
                        <Th numerico>Pendiente</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.aprobadasNoLiquidadas.map((c) => (
                        <tr key={c.cotizacion_id} className="hover:bg-tinta-50/60">
                          <Td className="font-medium text-tinta-900">{c.cliente}</Td>
                          <Td className="font-mono text-xs">{c.folio}</Td>
                          <Td className="text-tinta-500">{c.requiere_factura ? 'Sí' : 'No'}</Td>
                          <Td numerico>{pesos(c.cotizado)}</Td>
                          <Td numerico className="text-tinta-500">{pesos(c.cobrado)}</Td>
                          <Td numerico className="font-semibold text-amber-700">{pesos(c.saldo)}</Td>
                        </tr>
                      ))}
                      <tr className="bg-amber-50/60">
                        <Td className="font-semibold">Total no realizable aún</Td>
                        <Td> </Td>
                        <Td> </Td>
                        <Td numerico className="font-semibold">
                          {pesos(r.aprobadasNoLiquidadas.reduce((s, c) => s + Number(c.cotizado), 0))}
                        </Td>
                        <Td numerico className="font-semibold">
                          {pesos(r.aprobadasNoLiquidadas.reduce((s, c) => s + Number(c.cobrado), 0))}
                        </Td>
                        <Td numerico className="text-base font-semibold text-amber-700">
                          {pesos(r.aprobadasNoLiquidadas.reduce((s, c) => s + Number(c.saldo), 0))}
                        </Td>
                      </tr>
                    </tbody>
                  </Tabla>
                  </div>
                )}
              </Tarjeta>
            </div>
          </section>

          {/* d) Cobranza ---------------------------------------------- */}
          <section id="cobranza">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-tinta-900">Concentrado de cobranza</h2>
              <BotonHoja mes={mes} hoja="cobranza" titulo="Cobranza" />
            </div>

            <Tarjeta
              pie={`Total general por cobrar: ${pesos(
                r.cobranza.reduce((s, c) => s + Number(c.saldo), 0),
              )}`}
            >
              {/* Teléfono: por cliente, cuánto falta ------------------- */}
              {r.cobranza.length > 0 && (
                <div className="lg:hidden">
                  {r.cobranza.map((c) => (
                    <FilaLista
                      key={c.cotizacion_id}
                      principal={c.cliente}
                      secundario={`${c.folio} · ${fecha(c.fecha)} · cobrado ${pesos(c.cobrado)} de ${pesos(c.cotizado)}`}
                      derecha={
                        <>
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              Number(c.saldo) > 0 ? 'text-amber-700' : 'text-haaco-700'
                            }`}
                          >
                            {pesos(c.saldo)}
                          </span>
                          <span className="text-[10.5px] text-tinta-400">
                            {porcentaje(c.pct_pendiente, 0)} pendiente
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}

              {r.cobranza.length === 0 ? (
                <EstadoVacio titulo="Sin obras aprobadas" />
              ) : (
                <div className="hidden lg:block">
                <Tabla>
                  <thead>
                    <tr>
                      <Th>Cliente</Th>
                      <Th>Cotización</Th>
                      <Th>Fecha</Th>
                      <Th numerico>Cotizado</Th>
                      <Th numerico>Anticipo</Th>
                      <Th numerico>Abonos</Th>
                      <Th numerico>Cobrado</Th>
                      <Th numerico>Saldo</Th>
                      <Th numerico>% pend.</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.cobranza.map((c) => (
                      <tr key={c.cotizacion_id} className="hover:bg-tinta-50/60">
                        <Td className="font-medium text-tinta-900">{c.cliente}</Td>
                        <Td className="font-mono text-xs">{c.folio}</Td>
                        <Td className="whitespace-nowrap text-tinta-500">{fecha(c.fecha)}</Td>
                        <Td numerico>{pesos(c.cotizado)}</Td>
                        <Td numerico className="text-tinta-500">{pesos(c.anticipo)}</Td>
                        <Td numerico className="text-tinta-500">
                          {pesos(Number(c.abonos) + Number(c.liquidacion))}
                        </Td>
                        <Td numerico>{pesos(c.cobrado)}</Td>
                        <Td numerico className={Number(c.saldo) > 0 ? 'font-semibold text-amber-700' : 'text-haaco-700'}>
                          {pesos(c.saldo)}
                        </Td>
                        <Td numerico className="text-tinta-500">{porcentaje(c.pct_pendiente, 0)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
                </div>
              )}
            </Tarjeta>
          </section>

          {/* e) Movimientos ------------------------------------------- */}
          <section id="movimientos">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-tinta-900">
                Movimientos: tarjeta de empresa vs efectivo
              </h2>
              <BotonHoja mes={mes} hoja="movimientos" titulo="Movimientos" />
            </div>

            <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador etiqueta="Tarjeta de empresa" valor={pesos(r.totales.tarjeta)} />
              <Indicador etiqueta="Efectivo" valor={pesos(r.totales.efectivo)} />
              <Indicador etiqueta="Transferencias" valor={pesos(r.totales.transferencia)} />
              <Indicador etiqueta="Salidas del mes" valor={pesos(r.totales.salidas)} tono="ambar" />
            </div>

            <Tarjeta pie={`${r.movimientos.length} movimientos`}>
              {/* Teléfono: el movimiento y su monto -------------------- */}
              {r.movimientos.length > 0 && (
                <div className="lg:hidden">
                  {r.movimientos.map((m, i) => (
                    <FilaLista
                      key={i}
                      principal={m.concepto}
                      secundario={`${fecha(m.fecha)} · ${m.origen} · ${METODO_PAGO[m.metodo]}${m.referencia ? ` · ${m.referencia}` : ''}`}
                      derecha={
                        <span className="text-sm font-semibold tabular-nums">{pesos(m.monto)}</span>
                      }
                    />
                  ))}
                </div>
              )}

              {r.movimientos.length === 0 ? (
                <EstadoVacio titulo="Sin movimientos este mes" />
              ) : (
                <div className="hidden lg:block">
                <Tabla>
                  <thead>
                    <tr>
                      <Th>Fecha</Th>
                      <Th>Origen</Th>
                      <Th>Concepto</Th>
                      <Th>Referencia</Th>
                      <Th>Método</Th>
                      <Th numerico>Monto</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.movimientos.map((m, i) => (
                      <tr key={i} className="hover:bg-tinta-50/60">
                        <Td className="whitespace-nowrap text-tinta-500">{fecha(m.fecha)}</Td>
                        <Td>
                          <Etiqueta tono={m.origen === 'Nómina' ? 'azul' : m.origen === 'Pago fijo' ? 'ambar' : 'gris'}>
                            {m.origen}
                          </Etiqueta>
                        </Td>
                        <Td>{m.concepto}</Td>
                        <Td className="text-tinta-500">{m.referencia}</Td>
                        <Td className="text-tinta-600">{METODO_PAGO[m.metodo]}</Td>
                        <Td numerico className="font-medium">{pesos(m.monto)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
                </div>
              )}
            </Tarjeta>
          </section>
        </div>
      )}
    </>
  )
}

function Renglon({
  etiqueta, valor, nota, fuerte, destacado, sangria, tono,
}: {
  etiqueta: string
  valor: string
  nota?: string
  fuerte?: boolean
  destacado?: boolean
  sangria?: boolean
  tono?: 'verde' | 'rojo'
}) {
  const color = tono === 'rojo' ? 'text-red-600' : tono === 'verde' ? 'text-haaco-700' : 'text-tinta-900'
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${sangria ? 'pl-8' : ''}`}>
      <dt className={`text-sm ${fuerte || destacado ? 'font-semibold text-tinta-900' : 'text-tinta-600'}`}>
        {etiqueta}
        {nota && <span className="ml-2 text-xs font-normal text-tinta-400">{nota}</span>}
      </dt>
      <dd
        className={`tabular-nums ${
          destacado ? `text-lg font-semibold ${color}` : fuerte ? `font-semibold ${color}` : 'text-sm text-tinta-700'
        }`}
      >
        {valor}
      </dd>
    </div>
  )
}
