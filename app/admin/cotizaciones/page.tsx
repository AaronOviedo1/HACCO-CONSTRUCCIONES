import Link from 'next/link'
import { Plus } from 'lucide-react'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos } from '@/lib/format'
import { ESTATUS_COTIZACION, TIPO_COTIZACION } from '@/lib/cotizaciones'
import { rangoDeUrl } from '@/lib/finanzas'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { FiltrosCotizaciones } from '@/components/cotizaciones/filtros'
import { BotonGrande } from '@/components/movil/piezas'
import type { EstatusCotizacion, TipoCotizacion } from '@/types/database'

export const dynamic = 'force-dynamic'

type Filtros = {
  estatus?: string
  tipo?: string
  cliente?: string
  desde?: string
  hasta?: string
  q?: string
}

export default async function PaginaCotizaciones({
  searchParams,
}: {
  searchParams: Promise<Filtros>
}) {
  await requerirRol(['admin', 'administracion'])
  const filtros = await searchParams
  const supabase = await crearClienteServidor()

  let consulta = supabase.from('v_cotizaciones').select('*').order('fecha', { ascending: false })

  if (filtros.estatus) consulta = consulta.eq('estatus', filtros.estatus as EstatusCotizacion)
  if (filtros.tipo) consulta = consulta.eq('tipo', filtros.tipo as TipoCotizacion)
  if (filtros.cliente) consulta = consulta.eq('cliente_id', filtros.cliente)

  // Sin fechas en la URL se ven todas: aquí el periodo es opcional.
  const periodo = rangoDeUrl(filtros, { porDefecto: 'todo' })
  if (periodo.desde) consulta = consulta.gte('fecha', periodo.desde)
  if (periodo.hasta) consulta = consulta.lt('fecha', periodo.hasta)

  const [{ data, error }, { data: clientes }] = await Promise.all([
    consulta,
    supabase.from('clientes').select('id, nombre').order('nombre'),
  ])

  let filas = data ?? []
  if (filtros.q?.trim()) {
    const busqueda = filtros.q.trim().toLowerCase()
    filas = filas.filter((c) =>
      `${c.folio ?? ''} ${c.cliente} ${c.nombre_obra ?? ''}`.toLowerCase().includes(busqueda),
    )
  }

  const montoTotal = filas.reduce((s, c) => s + Number(c.total), 0)
  const aprobadas = filas.filter((c) => c.estatus === 'aprobada' || c.estatus === 'terminada')
  const pendientes = filas.filter((c) => c.estatus === 'borrador' || c.estatus === 'enviada')

  return (
    <>
      <EncabezadoPagina
        titulo="Cotizaciones"
        descripcion="De aquí cuelga todo: órdenes de trabajo, cobranza, nómina y materiales."
        acciones={
          <Link
            href="/admin/cotizaciones/nueva"
            className="hidden items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 lg:inline-flex"
          >
            <Plus size={16} />
            Nueva cotización
          </Link>
        }
      />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:mb-5 lg:grid-cols-4 lg:gap-3">
        <Indicador
          etiqueta="Cotizaciones"
          valor={String(filas.length)}
          nota={periodo.filtrado ? periodo.etiqueta : 'con los filtros actuales'}
        />
        <Indicador etiqueta="Monto cotizado" valor={pesos(montoTotal)} />
        <Indicador
          etiqueta="Aprobadas"
          valor={String(aprobadas.length)}
          nota={pesos(aprobadas.reduce((s, c) => s + Number(c.total), 0))}
          tono="verde"
        />
        <Indicador
          etiqueta="Por resolver"
          valor={String(pendientes.length)}
          nota="borrador y enviadas"
          tono="ambar"
        />
      </div>

      <FiltrosCotizaciones clientes={clientes ?? []} />

      {/* Teléfono: renglón tocable con el folio como ancla visual ----------- */}
      {filas.length > 0 && (
        <div className="lg:hidden">
          <div className="overflow-hidden rounded-[20px] border-[0.5px] border-tinta-200 bg-white shadow-tarjeta">
            {filas.map((c) => (
              <Link
                key={c.id}
                href={`/admin/cotizaciones/${c.id}`}
                className="flex items-center gap-3 border-b-[0.5px] border-tinta-100 p-3.5 transition last:border-b-0 active:bg-tinta-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-haaco-50 font-mono text-xs font-bold text-haaco-700">
                  {c.folio ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold -tracking-[0.2px]">
                    {c.cliente}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-tinta-400">
                    {c.nombre_obra ?? 'Sin nombre de obra'} · {TIPO_COTIZACION[c.tipo]}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[14.5px] font-semibold tabular-nums">{pesos(c.total)}</span>
                  <Etiqueta tono={ESTATUS_COTIZACION[c.estatus].tono}>
                    {ESTATUS_COTIZACION[c.estatus].texto}
                  </Etiqueta>
                </span>
              </Link>
            ))}
          </div>

          <BotonGrande
            href="/admin/cotizar-rapido"
            className="mt-3.5"
            icono={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M13.4 2.6 5.6 14.2h5l-1 7.2 7.8-11.6h-5z"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            Cotización rápida
          </BotonGrande>
          <p className="mt-2.5 text-center text-[11.5px] text-tinta-400">
            {filas.length} {filas.length === 1 ? 'cotización' : 'cotizaciones'}
          </p>
        </div>
      )}

      <Tarjeta
        className={filas.length > 0 ? 'hidden lg:block' : ''}
        pie={`${filas.length} ${filas.length === 1 ? 'cotización' : 'cotizaciones'}`}
      >
        {error ? (
          <EstadoVacio
            titulo="No se pudo leer la lista"
            descripcion="Revisa que las migraciones estén aplicadas."
          />
        ) : filas.length === 0 ? (
          <EstadoVacio
            titulo="Ninguna cotización coincide"
            descripcion="Cambia los filtros o crea la primera cotización."
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
          <Tabla>
            <thead>
              <tr>
                <Th>Folio</Th>
                <Th>Fecha</Th>
                <Th>Cliente</Th>
                <Th>Obra</Th>
                <Th>Tipo</Th>
                <Th numerico>Total</Th>
                <Th>Estatus</Th>
                <Th numerico>OTs</Th>
                <Th>Factura</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-tinta-50/60">
                  <Td className="font-medium">
                    <Link href={`/admin/cotizaciones/${c.id}`} className="text-haaco-700 hover:underline">
                      {c.folio}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-tinta-500">{fecha(c.fecha)}</Td>
                  <Td>{c.cliente}</Td>
                  <Td className="text-tinta-500">{c.nombre_obra ?? '—'}</Td>
                  <Td className="text-tinta-500">{TIPO_COTIZACION[c.tipo]}</Td>
                  <Td numerico className="font-medium">{pesos(c.total)}</Td>
                  <Td>
                    <Etiqueta tono={ESTATUS_COTIZACION[c.estatus].tono}>
                      {ESTATUS_COTIZACION[c.estatus].texto}
                    </Etiqueta>
                  </Td>
                  <Td numerico className="text-tinta-500">{c.obras > 0 ? c.obras : '—'}</Td>
                  <Td className="text-tinta-500">{c.requiere_factura ? 'Sí' : 'No'}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </>
  )
}
