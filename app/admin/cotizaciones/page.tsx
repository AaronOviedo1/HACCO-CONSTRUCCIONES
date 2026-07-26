import Link from 'next/link'
import { Plus } from 'lucide-react'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos } from '@/lib/format'
import { ESTATUS_COTIZACION, TIPO_COTIZACION } from '@/lib/cotizaciones'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { FiltrosCotizaciones } from '@/components/cotizaciones/filtros'
import type { EstatusCotizacion, TipoCotizacion } from '@/types/database'

export const dynamic = 'force-dynamic'

type Filtros = {
  estatus?: string
  tipo?: string
  cliente?: string
  mes?: string
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
  if (filtros.mes) {
    const [anio, mes] = filtros.mes.split('-').map(Number)
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
    const hastaFecha = new Date(anio, mes, 1)
    const hasta = `${hastaFecha.getFullYear()}-${String(hastaFecha.getMonth() + 1).padStart(2, '0')}-01`
    consulta = consulta.gte('fecha', desde).lt('fecha', hasta)
  }

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
            className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
          >
            <Plus size={16} />
            Nueva cotización
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Cotizaciones" valor={String(filas.length)} nota="con los filtros actuales" />
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

      <Tarjeta pie={`${filas.length} ${filas.length === 1 ? 'cotización' : 'cotizaciones'}`}>
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
