'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Banknote, X } from 'lucide-react'
import { EstadoVacio, Etiqueta, Tabla, Tarjeta, Td, Th } from '@/components/ui'
import { CuerpoMes, MesesPlegables } from '@/components/meses'
import { AccionesCxp, DialogoPagoLote } from '@/components/finanzas/cxp'
import { fecha, pesos } from '@/lib/format'
import { ESTADO_CXP } from '@/lib/finanzas'
import type { EstadoCxp, Proveedor, VCuentaPorPagar, VCxpPorProveedor } from '@/types/database'

/** Un mes de vencimientos, ya agrupado y etiquetado del lado del servidor. */
export type GrupoCxp = {
  mes: string
  etiqueta: string
  detalle: string
  filas: VCuentaPorPagar[]
}

/**
 * La tabla de cuentas por pagar con su panel de proveedores.
 *
 * Es cliente —y no la página entera— por la selección múltiple: se marcan las
 * facturas de un proveedor y se liquidan de un jalón, que es como se paga en
 * la realidad. El panel lateral vive aquí dentro para poder preseleccionar
 * todo lo de un proveedor sin pasar el estado por un contexto.
 *
 * El lote es de un solo proveedor: en cuanto se marca la primera, las de los
 * demás quedan deshabilitadas.
 */
export function TablaCxp({
  grupos,
  plegados,
  proveedores,
  porProveedor,
  vista,
  totalFilas,
  saldoVisible,
  sinDatos,
  error,
}: {
  grupos: GrupoCxp[]
  /** Los meses que ya venían plegados, resueltos en el servidor. */
  plegados: string[]
  proveedores: Proveedor[]
  porProveedor: VCxpPorProveedor[]
  vista: string
  totalFilas: number
  saldoVisible: number
  /** No hay ni una sola cuenta capturada, ni siquiera pagada. */
  sinDatos: boolean
  error: boolean
}) {
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [pagando, setPagando] = useState(false)

  const visibles = grupos.flatMap((g) => g.filas)
  const abiertas = visibles.filter((c) => !c.cancelada && Number(c.saldo) > 0)
  const seleccionadas = visibles.filter((c) => elegidas.has(c.id))
  const proveedorFijado = seleccionadas[0]?.proveedor_id ?? null
  const totalElegido = seleccionadas.reduce((s, c) => s + Number(c.saldo), 0)

  const alternar = (id: string) =>
    setElegidas((antes) => {
      const nuevas = new Set(antes)
      if (nuevas.has(id)) nuevas.delete(id)
      else nuevas.add(id)
      return nuevas
    })

  /** Marca todas las facturas abiertas de un proveedor y limpia lo demás. */
  const elegirProveedor = (proveedorId: string) =>
    setElegidas(new Set(abiertas.filter((c) => c.proveedor_id === proveedorId).map((c) => c.id)))

  const puedeElegirse = (c: VCuentaPorPagar) =>
    !c.cancelada &&
    Number(c.saldo) > 0 &&
    (proveedorFijado === null || c.proveedor_id === proveedorFijado)

  const delProveedor = proveedorFijado
    ? abiertas.filter((c) => c.proveedor_id === proveedorFijado)
    : []
  const todasDelProveedor =
    delProveedor.length > 0 && delProveedor.every((c) => elegidas.has(c.id))

  return (
    <div className={`grid gap-4 xl:grid-cols-4 ${totalFilas > 0 || !sinDatos ? 'hidden lg:grid' : ''}`}>
      <div className="xl:col-span-3">
        <Tarjeta pie={`${totalFilas} facturas · saldo ${pesos(saldoVisible)}`}>
          {error ? (
            <EstadoVacio titulo="No se pudo leer la lista" descripcion="Revisa las migraciones." />
          ) : totalFilas === 0 ? (
            <EstadoVacio
              titulo={sinDatos ? 'Sin cuentas por pagar' : 'Nada pendiente aquí'}
              descripcion={
                sinDatos
                  ? 'Se abren solas cuando registras un gasto a crédito, o puedes capturarlas a mano.'
                  : 'Todo al corriente con este filtro.'
              }
            />
          ) : (
            <>
              <Tabla>
                <thead>
                  <tr>
                    <Th>
                      <input
                        type="checkbox"
                        checked={todasDelProveedor}
                        disabled={proveedorFijado === null}
                        onChange={() =>
                          todasDelProveedor
                            ? setElegidas(new Set())
                            : elegirProveedor(proveedorFijado!)
                        }
                        aria-label="Marcar todas las de este proveedor"
                        title={
                          proveedorFijado === null
                            ? 'Marca una factura primero'
                            : 'Todas las de este proveedor'
                        }
                        className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600 disabled:opacity-40"
                      />
                    </Th>
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
                <MesesPlegables lista="cxp" plegados={plegados}>
                  {grupos.map((grupo) => (
                    <CuerpoMes
                      key={grupo.mes}
                      mes={grupo.mes}
                      columnas={12}
                      etiqueta={grupo.etiqueta}
                      detalle={grupo.detalle}
                    >
                      {grupo.filas.map((c) => {
                        const estado = ESTADO_CXP[c.estado as EstadoCxp]
                        const parcial = Number(c.monto_pagado) > 0 && Number(c.saldo) > 0
                        const marcada = elegidas.has(c.id)
                        return (
                          <tr
                            key={c.id}
                            className={marcada ? 'bg-haaco-50/70' : 'hover:bg-tinta-50/60'}
                          >
                            <Td>
                              <input
                                type="checkbox"
                                checked={marcada}
                                disabled={!puedeElegirse(c)}
                                onChange={() => alternar(c.id)}
                                aria-label={`Elegir factura ${c.folio_factura}`}
                                title={
                                  proveedorFijado && c.proveedor_id !== proveedorFijado
                                    ? 'Un pago en lote es de un solo proveedor'
                                    : undefined
                                }
                                className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600 disabled:opacity-30"
                              />
                            </Td>
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
                              <AccionesCxp cuenta={c} proveedores={proveedores} />
                            </Td>
                          </tr>
                        )
                      })}
                    </CuerpoMes>
                  ))}
                </MesesPlegables>
              </Tabla>

              {seleccionadas.length > 0 && (
                <div className="sticky bottom-4 z-10 mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-haaco-300 bg-white px-4 py-3 shadow-verde">
                  <p className="text-sm text-tinta-700">
                    <strong className="text-tinta-900">{seleccionadas.length}</strong>{' '}
                    {seleccionadas.length === 1 ? 'factura' : 'facturas'} de{' '}
                    {seleccionadas[0].proveedor} ·{' '}
                    <strong className="tabular-nums text-haaco-700">{pesos(totalElegido)}</strong>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setElegidas(new Set())}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-tinta-500 transition hover:bg-tinta-100"
                    >
                      <X size={14} />
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagando(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
                    >
                      <Banknote size={15} />
                      Pagar seleccionadas
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Por proveedor" pie="Toca un proveedor para filtrar, o paga todo lo suyo.">
        {porProveedor.filter((d) => Number(d.saldo_total) > 0).length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-tinta-500">Nada pendiente.</p>
        ) : (
          <ul className="divide-y divide-tinta-100">
            {porProveedor
              .filter((d) => Number(d.saldo_total) > 0)
              .map((d) => {
                const suyas = abiertas.filter((c) => c.proveedor_id === d.proveedor_id)
                return (
                  <li key={d.proveedor_id} className="px-4 py-3">
                    <Link
                      href={`/admin/cuentas-por-pagar?t=${vista}&proveedor=${d.proveedor_id}`}
                      className="block transition hover:opacity-80"
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
                    {suyas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => elegirProveedor(d.proveedor_id)}
                        className="mt-2 text-xs font-medium text-haaco-700 hover:underline"
                      >
                        Marcar sus {suyas.length} facturas
                      </button>
                    )}
                  </li>
                )
              })}
          </ul>
        )}
      </Tarjeta>

      {pagando && seleccionadas.length > 0 && (
        <DialogoPagoLote
          cuentas={seleccionadas}
          onCerrar={() => {
            setPagando(false)
            setElegidas(new Set())
          }}
        />
      )}
    </div>
  )
}
