import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos, porcentaje } from '@/lib/format'
import { mesActual, rangoMes } from '@/lib/finanzas'
import { ESTATUS_OBRA } from '@/lib/obras'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { PanelNomina } from '@/components/finanzas/nomina'
import type { EstatusObra } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PaginaNomina({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; t?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { mes = mesActual(), t } = await searchParams
  const vista = t === 'prenomina' ? 'prenomina' : t === 'prestamos' ? 'prestamos' : 'mensual'
  const { desde, hasta } = rangoMes(mes)

  const supabase = await crearClienteServidor()

  const [{ data: contratos }, { data: prenomina }, { data: pagos }, { data: deducciones }, { data: recibos }] =
    await Promise.all([
      supabase.from('v_nomina_contratos').select('*').order('trabajador'),
      supabase.from('v_prenomina').select('*').order('trabajador'),
      supabase.from('nomina_pagos').select('*').gte('fecha', desde).lt('fecha', hasta).order('fecha'),
      supabase.from('deducciones').select('*').order('fecha', { ascending: false }),
      supabase
        .from('recibos_nomina')
        .select('*')
        .gte('fecha', desde)
        .lt('fecha', hasta)
        .order('fecha', { ascending: false }),
    ])

  const filas = (contratos ?? []).filter((c) => c.estatus === 'activo')
  const pagosDelMes = pagos ?? []

  // Fechas distintas con pago: son las columnas de abono del Excel.
  const fechasPago = [...new Set(pagosDelMes.map((p) => p.fecha))].sort()
  const pagosPorContratoFecha = new Map<string, number>()
  for (const p of pagosDelMes) {
    const clave = `${p.contrato_id}|${p.fecha}`
    pagosPorContratoFecha.set(clave, (pagosPorContratoFecha.get(clave) ?? 0) + Number(p.monto))
  }

  const totalMO = filas.reduce((s, c) => s + Number(c.mano_obra), 0)
  const totalRetencion = filas.reduce((s, c) => s + Number(c.retencion_haaco), 0)
  const totalPagado = filas.reduce((s, c) => s + Number(c.pagado), 0)
  const totalDisponible = filas.reduce((s, c) => s + Number(c.disponible), 0)
  const alTope = filas.filter((c) => Number(c.pct_pagado) >= 100)

  return (
    <>
      <EncabezadoPagina
        titulo="Nómina por avance"
        descripcion="Se paga según el avance de la obra. El devengado es el total del contrato por el porcentaje reportado."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Mano de obra contratada" valor={pesosCortos(totalMO)} nota={`${filas.length} contratos activos`} />
        <Indicador etiqueta="Retención Costo Haaco" valor={pesosCortos(totalRetencion)} />
        <Indicador etiqueta="Pagado" valor={pesosCortos(totalPagado)} tono="verde" />
        <Indicador
          etiqueta="Se puede pagar hoy"
          valor={pesosCortos(totalDisponible)}
          nota="devengado menos lo abonado"
          tono={totalDisponible > 0 ? 'ambar' : 'neutro'}
        />
      </div>

      {alTope.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>
            {alTope.length} {alTope.length === 1 ? 'contrato llegó' : 'contratos llegaron'} al 100% de
            lo pactado
          </strong>
          : {alTope.map((c) => `${c.trabajador} · ${c.obra}`).join(', ')}. Cualquier pago adicional
          sale del contrato.
        </div>
      )}

      <nav className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { clave: 'mensual', titulo: 'Vista mensual' },
          { clave: 'prenomina', titulo: 'Prenómina' },
          { clave: 'prestamos', titulo: 'Préstamos y adelantos' },
        ].map((p) => (
          <Link
            key={p.clave}
            href={`/admin/nomina?t=${p.clave}&mes=${mes}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              vista === p.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {p.titulo}
          </Link>
        ))}
        <PanelNomina
          contratos={filas}
          prenomina={prenomina ?? []}
          deducciones={deducciones ?? []}
          mes={mes}
        />
      </nav>

      {filas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="Sin contratos activos"
            descripcion="Los contratos de mano de obra se crean desde la pestaña Contratos de cada obra."
            accion={
              <Link
                href="/admin/obras"
                className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
              >
                Ir a obras
              </Link>
            }
          />
        </Tarjeta>
      ) : vista === 'mensual' ? (
        <Tarjeta pie="Una fila por trabajador y obra, con una columna por cada fecha en que se pagó.">
          <Tabla>
            <thead>
              <tr>
                <Th>Inicio</Th>
                <Th>Trabajador</Th>
                <Th>Obra</Th>
                <Th numerico>M.O.</Th>
                <Th numerico>C. Haaco</Th>
                <Th numerico>Total</Th>
                <Th numerico>Avance</Th>
                <Th numerico>Devengado</Th>
                {fechasPago.map((f) => (
                  <Th key={f} numerico>{fecha(f)}</Th>
                ))}
                <Th numerico>Pagado</Th>
                <Th numerico>Por pagar</Th>
                <Th numerico>%</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <tr key={c.contrato_id} className="hover:bg-tinta-50/60">
                  <Td className="whitespace-nowrap text-tinta-500">{fecha(c.fecha_inicia)}</Td>
                  <Td className="font-medium text-tinta-900">
                    <span className="flex items-center gap-1.5">
                      {c.trabajador}
                      {c.es_externo && <Etiqueta tono="ambar">externo</Etiqueta>}
                    </span>
                  </Td>
                  <Td>
                    <Link href={`/admin/obras/${c.obra_id}`} className="text-tinta-700 hover:text-haaco-700">
                      {c.obra}
                    </Link>
                    <Etiqueta tono={ESTATUS_OBRA[c.estatus_obra as EstatusObra].tono}>
                      {ESTATUS_OBRA[c.estatus_obra as EstatusObra].texto}
                    </Etiqueta>
                  </Td>
                  <Td numerico>{pesos(c.mano_obra)}</Td>
                  <Td numerico className="text-tinta-500">
                    {Number(c.costo_haaco_pct) > 0 ? `- ${pesos(c.retencion_haaco)}` : '—'}
                  </Td>
                  <Td numerico className="font-medium">{pesos(c.total)}</Td>
                  <Td numerico className="text-tinta-500">{Number(c.avance_pct)}%</Td>
                  <Td numerico>{pesos(c.devengado)}</Td>
                  {fechasPago.map((f) => {
                    const monto = pagosPorContratoFecha.get(`${c.contrato_id}|${f}`)
                    return (
                      <Td key={f} numerico className={monto ? '' : 'text-tinta-300'}>
                        {monto ? pesos(monto) : '—'}
                      </Td>
                    )
                  })}
                  <Td numerico className="font-medium text-haaco-700">{pesos(c.pagado)}</Td>
                  <Td numerico className={Number(c.por_pagar) > 0 ? 'text-amber-700' : ''}>
                    {pesos(c.por_pagar)}
                  </Td>
                  <Td numerico>
                    <Etiqueta tono={Number(c.pct_pagado) >= 100 ? 'verde' : 'gris'}>
                      {porcentaje(c.pct_pagado, 0)}
                    </Etiqueta>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : vista === 'prenomina' ? (
        <Tarjeta
          titulo="Prenómina concentrada"
          pie="Un renglón por trabajador con todo lo que trae abierto en todas sus obras."
        >
          <Tabla>
            <thead>
              <tr>
                <Th>Trabajador</Th>
                <Th numerico>Obras</Th>
                <Th numerico>Total M.O.</Th>
                <Th numerico>Devengado</Th>
                <Th numerico>Pagado</Th>
                <Th numerico>% pagado</Th>
                <Th numerico>Pendiente</Th>
                <Th numerico>Deducciones</Th>
                <Th numerico>A pagar hoy</Th>
                <Th>Último pago</Th>
              </tr>
            </thead>
            <tbody>
              {(prenomina ?? []).map((p) => {
                const aPagar = Math.max(0, Number(p.disponible) - Number(p.deducciones))
                return (
                  <tr key={p.trabajador_id} className="hover:bg-tinta-50/60">
                    <Td className="font-medium text-tinta-900">
                      <span className="flex items-center gap-1.5">
                        {p.trabajador}
                        {p.es_externo && <Etiqueta tono="ambar">externo</Etiqueta>}
                      </span>
                    </Td>
                    <Td numerico className="text-tinta-500">{p.contratos_activos}</Td>
                    <Td numerico>{pesos(p.total_contratos)}</Td>
                    <Td numerico>{pesos(p.devengado)}</Td>
                    <Td numerico className="text-haaco-700">{pesos(p.pagado)}</Td>
                    <Td numerico>{porcentaje(p.pct_pagado, 0)}</Td>
                    <Td numerico className="text-tinta-500">{pesos(p.pendiente)}</Td>
                    <Td numerico className={Number(p.deducciones) > 0 ? 'text-red-600' : 'text-tinta-300'}>
                      {Number(p.deducciones) > 0 ? `- ${pesos(p.deducciones)}` : '—'}
                    </Td>
                    <Td numerico className="text-base font-semibold text-haaco-700">
                      {pesos(aPagar)}
                    </Td>
                    <Td className="whitespace-nowrap text-tinta-500">{fecha(p.ultimo_pago)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : (
        <Tarjeta
          titulo="Préstamos y adelantos"
          pie="Se descuentan al elegirlos en el recibo de abono. Al aplicarse quedan saldados."
        >
          {(deducciones ?? []).length === 0 ? (
            <EstadoVacio titulo="Sin préstamos registrados" />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Trabajador</Th>
                  <Th>Tipo</Th>
                  <Th numerico>Monto</Th>
                  <Th>Estado</Th>
                  <Th>Notas</Th>
                </tr>
              </thead>
              <tbody>
                {(deducciones ?? []).map((d) => {
                  const trabajador = (prenomina ?? []).find((p) => p.trabajador_id === d.trabajador_id)
                  return (
                    <tr key={d.id} className="hover:bg-tinta-50/60">
                      <Td className="whitespace-nowrap text-tinta-500">{fecha(d.fecha)}</Td>
                      <Td className="font-medium text-tinta-900">{trabajador?.trabajador ?? '—'}</Td>
                      <Td className="capitalize text-tinta-600">{d.tipo}</Td>
                      <Td numerico className="font-medium">{pesos(d.monto)}</Td>
                      <Td>
                        <Etiqueta tono={d.saldado ? 'verde' : 'ambar'}>
                          {d.saldado ? 'Saldado' : 'Pendiente'}
                        </Etiqueta>
                      </Td>
                      <Td className="text-tinta-500">{d.notas ?? '—'}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </Tabla>
          )}
        </Tarjeta>
      )}

      {(recibos ?? []).length > 0 && (
        <Tarjeta titulo="Recibos de abono del mes" className="mt-4">
          <ul className="divide-y divide-tinta-100">
            {(recibos ?? []).map((r) => {
              const trabajador = (prenomina ?? []).find((p) => p.trabajador_id === r.trabajador_id)
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-haaco-700">{r.folio}</span>
                    <span className="font-medium text-tinta-900">{trabajador?.trabajador ?? '—'}</span>
                    <span className="text-xs text-tinta-400">{fecha(r.fecha)}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    {Number(r.deducciones) > 0 && (
                      <span className="text-xs text-red-600">- {pesos(r.deducciones)}</span>
                    )}
                    <span className="font-medium tabular-nums text-tinta-900">{pesos(r.total)}</span>
                    <a
                      href={`/api/recibos-nomina/${r.id}/pdf?descargar=1`}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg border border-tinta-300 bg-white px-2.5 py-1 text-xs font-medium text-tinta-700 hover:bg-tinta-50"
                    >
                      Recibo
                    </a>
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
