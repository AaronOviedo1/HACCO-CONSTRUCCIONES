import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos } from '@/lib/format'
import { ESTADO_CXP, vencimientosPorSemana } from '@/lib/finanzas'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import {
  AccionesCxp, BotonNuevaCxp, BotonPagoMovil, FiltroProveedorCxp,
} from '@/components/finanzas/cxp'
import { BarrasSemanas, FilaLista } from '@/components/movil/piezas'
import type { EstadoCxp } from '@/types/database'

export const dynamic = 'force-dynamic'

const VISTAS = [
  { clave: 'todas', titulo: 'Todas' },
  { clave: 'pendientes', titulo: 'Por pagar' },
  { clave: 'programacion', titulo: 'Programación de pagos' },
] as const

export default async function PaginaCuentasPorPagar({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; proveedor?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { t, proveedor } = await searchParams
  const vista = VISTAS.find((v) => v.clave === t)?.clave ?? 'pendientes'

  const supabase = await crearClienteServidor()

  const [{ data: cuentas, error }, { data: dashboard }, { data: proveedores }] = await Promise.all([
    supabase.from('v_cuentas_por_pagar').select('*').order('vencimiento'),
    supabase.from('v_cxp_por_proveedor').select('*').order('saldo_total', { ascending: false }),
    supabase.from('proveedores').select('*').order('nombre'),
  ])

  const todas = cuentas ?? []
  const activas = todas.filter((c) => c.estado !== 'pagada' && c.estado !== 'cancelada')

  let filas = vista === 'todas' ? todas : activas
  if (proveedor) filas = filas.filter((c) => c.proveedor_id === proveedor)
  if (vista === 'programacion') {
    filas = [...filas].sort(
      (a, b) => new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime(),
    )
  }

  const saldoTotal = activas.reduce((s, c) => s + Number(c.saldo), 0)
  const vencido = activas.filter((c) => c.estado === 'vencida').reduce((s, c) => s + Number(c.saldo), 0)
  const urgente = activas.filter((c) => c.estado === 'urgente').reduce((s, c) => s + Number(c.saldo), 0)
  const proximo = activas.filter((c) => c.estado === 'proxima').reduce((s, c) => s + Number(c.saldo), 0)

  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas por pagar"
        descripcion="Vencimiento, saldo y estado se calculan solos con la fecha de factura y los días de crédito del proveedor."
        acciones={<BotonNuevaCxp proveedores={proveedores ?? []} />}
      />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:mb-5 lg:grid-cols-4 lg:gap-3">
        <Indicador etiqueta="Saldo total" valor={pesosCortos(saldoTotal)} nota={`${activas.length} facturas abiertas`} />
        <Indicador etiqueta="Vencido" valor={pesosCortos(vencido)} tono={vencido > 0 ? 'rojo' : 'neutro'} />
        <Indicador
          etiqueta="Urgente"
          valor={pesosCortos(urgente)}
          nota="vence en 3 días o menos"
          tono={urgente > 0 ? 'rojo' : 'neutro'}
          className="hidden lg:block"
        />
        <Indicador
          etiqueta="Próximo"
          valor={pesosCortos(proximo)}
          nota="vence en 15 días"
          tono="ambar"
          className="hidden lg:block"
        />
      </div>

      {/* Teléfono: primero cuándo pega, luego a quién ---------------------- */}
      {activas.length > 0 && (
        <div className="lg:hidden">
          <Tarjeta className="mb-3.5">
            <div className="px-3.5 py-4">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="text-[14.5px] font-semibold">Vencimientos por semana</h2>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    vencido + urgente > 0 ? 'text-red-600' : 'text-tinta-400'
                  }`}
                >
                  {vencido + urgente > 0
                    ? `${pesosCortos(vencido + urgente)} urgente`
                    : 'nada urgente'}
                </span>
              </div>
              <BarrasSemanas
                semanas={vencimientosPorSemana(
                  activas.map((c) => ({ vencimiento: c.vencimiento, saldo: Number(c.saldo) })),
                )}
              />
            </div>
          </Tarjeta>

          <div className="mb-3.5">
            <FiltroProveedorCxp
              proveedores={proveedores ?? []}
              valor={proveedor ?? ''}
              vista={vista}
            />
          </div>

          <Tarjeta>
            {filas.map((c) => {
              const estado = ESTADO_CXP[c.estado as EstadoCxp]
              return (
                <FilaLista
                  key={c.id}
                  principal={c.proveedor}
                  secundario={`${c.folio_factura ?? 'sin folio'} · vence ${fecha(c.vencimiento)}`}
                  derecha={
                    <>
                      <span className="text-[15px] font-bold tabular-nums">{pesos(c.saldo)}</span>
                      <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                    </>
                  }
                  accion={<BotonPagoMovil cuenta={c} />}
                />
              )
            })}
          </Tarjeta>
        </div>
      )}

      <nav className="mb-4 hidden flex-wrap items-center gap-2 lg:flex">
        {VISTAS.map((v) => (
          <Link
            key={v.clave}
            href={`/admin/cuentas-por-pagar?t=${v.clave}${proveedor ? `&proveedor=${proveedor}` : ''}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              vista === v.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {v.titulo}
          </Link>
        ))}
        {proveedor && (
          <Link
            href={`/admin/cuentas-por-pagar?t=${vista}`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-tinta-500 hover:bg-tinta-100"
          >
            Quitar filtro de proveedor
          </Link>
        )}
      </nav>

      <div className={`grid gap-4 xl:grid-cols-4 ${activas.length > 0 ? 'hidden lg:grid' : ''}`}>
        <div className="xl:col-span-3">
          <Tarjeta pie={`${filas.length} facturas · saldo ${pesos(filas.reduce((s, c) => s + Number(c.saldo), 0))}`}>
            {error ? (
              <EstadoVacio titulo="No se pudo leer la lista" descripcion="Revisa las migraciones." />
            ) : filas.length === 0 ? (
              <EstadoVacio
                titulo={todas.length === 0 ? 'Sin cuentas por pagar' : 'Nada pendiente aquí'}
                descripcion={
                  todas.length === 0
                    ? 'Se abren solas cuando registras un gasto a crédito, o puedes capturarlas a mano.'
                    : 'Todo al corriente con este filtro.'
                }
              />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Proveedor</Th>
                    <Th>Factura</Th>
                    <Th>Fecha</Th>
                    <Th numerico>Días</Th>
                    <Th>Vencimiento</Th>
                    <Th numerico>Importe</Th>
                    <Th numerico>Pagado</Th>
                    <Th numerico>Saldo</Th>
                    <Th numerico>Restan</Th>
                    <Th>Estado</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((c) => {
                    const estado = ESTADO_CXP[c.estado as EstadoCxp]
                    const parcial = Number(c.monto_pagado) > 0 && Number(c.saldo) > 0
                    return (
                      <tr key={c.id} className="hover:bg-tinta-50/60">
                        <Td className="font-medium text-tinta-900">{c.proveedor}</Td>
                        <Td className="font-mono text-xs">{c.folio_factura}</Td>
                        <Td className="whitespace-nowrap text-tinta-500">{fecha(c.fecha_factura)}</Td>
                        <Td numerico className="text-tinta-500">{c.dias_credito}</Td>
                        <Td className="whitespace-nowrap text-tinta-600">{fecha(c.vencimiento)}</Td>
                        <Td numerico className={c.cancelada ? 'text-tinta-400 line-through' : ''}>
                          {c.cancelada ? 'CANCELADA' : pesos(c.monto)}
                        </Td>
                        <Td numerico className="text-tinta-500">
                          {Number(c.monto_pagado) > 0 ? pesos(c.monto_pagado) : '—'}
                          {parcial && <Etiqueta tono="ambar">parcial</Etiqueta>}
                        </Td>
                        <Td numerico className={Number(c.saldo) > 0 ? 'font-semibold' : 'text-tinta-400'}>
                          {pesos(c.saldo)}
                        </Td>
                        <Td numerico className="text-tinta-500">
                          {c.estado === 'pagada' || c.cancelada ? '—' : `${c.dias_restantes} d`}
                        </Td>
                        <Td>
                          <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                        </Td>
                        <Td>
                          <AccionesCxp cuenta={c} proveedores={proveedores ?? []} />
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Por proveedor" pie="Toca un proveedor para filtrar la lista.">
          {(dashboard ?? []).filter((d) => Number(d.saldo_total) > 0).length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-tinta-500">Nada pendiente.</p>
          ) : (
            <ul className="divide-y divide-tinta-100">
              {(dashboard ?? [])
                .filter((d) => Number(d.saldo_total) > 0)
                .map((d) => (
                  <li key={d.proveedor_id}>
                    <Link
                      href={`/admin/cuentas-por-pagar?t=${vista}&proveedor=${d.proveedor_id}`}
                      className="block px-4 py-3 transition hover:bg-tinta-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-tinta-900">{d.proveedor}</span>
                        <span className="font-medium tabular-nums text-tinta-900">
                          {pesos(d.saldo_total)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        {Number(d.vencido) > 0 && (
                          <span className="text-red-600">Vencido {pesos(d.vencido)}</span>
                        )}
                        {Number(d.por_vencer) > 0 && (
                          <span className="text-amber-600">Por vencer {pesos(d.por_vencer)}</span>
                        )}
                        <span className="text-tinta-400">{d.dias_credito_default} días crédito</span>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
