import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos, porcentaje } from '@/lib/format'
import { ESTATUS_OBRA, tonoUtilidad } from '@/lib/obras'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { BuscadorTabla } from '@/components/buscador'
import type { EstatusObra } from '@/types/database'

export const dynamic = 'force-dynamic'

const FILTROS: { clave: string; titulo: string }[] = [
  { clave: 'activas', titulo: 'Activas' },
  { clave: '', titulo: 'Todas' },
  { clave: 'en_obra', titulo: 'En obra' },
  { clave: 'pausada', titulo: 'Pausadas' },
  { clave: 'en_entrega', titulo: 'En entrega' },
  { clave: 'cerrada', titulo: 'Cerradas' },
]

export default async function PaginaObras({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estatus?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { q, estatus = 'activas' } = await searchParams
  const supabase = await crearClienteServidor()

  const { data, error } = await supabase
    .from('v_obra_concentrado')
    .select('*')
    .order('fecha_apertura', { ascending: false })

  const todas = data ?? []

  const filas = todas.filter((o) => {
    if (estatus === 'activas' && o.estatus === 'cerrada') return false
    if (estatus && estatus !== 'activas' && o.estatus !== estatus) return false
    if (q?.trim()) {
      const texto = `${o.ot_numero ?? ''} ${o.nombre} ${o.cliente} ${o.cotizacion_folio ?? ''}`.toLowerCase()
      if (!texto.includes(q.trim().toLowerCase())) return false
    }
    return true
  })

  const activas = todas.filter((o) => o.estatus !== 'cerrada')
  const utilidadActiva = activas.reduce((s, o) => s + Number(o.utilidad), 0)
  const cotizadoActivo = activas.reduce((s, o) => s + Number(o.cotizado), 0)

  return (
    <>
      <EncabezadoPagina
        titulo="Obras"
        descripcion="Cada orden de trabajo con su concentrado: lo cotizado contra lo que realmente se está gastando."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Obras activas" valor={String(activas.length)} />
        <Indicador
          etiqueta="En obra"
          valor={String(todas.filter((o) => o.estatus === 'en_obra').length)}
          nota={`${todas.filter((o) => o.estatus === 'pausada').length} pausadas`}
          tono="verde"
        />
        <Indicador etiqueta="Cotizado activo" valor={pesosCortos(cotizadoActivo)} />
        <Indicador
          etiqueta="Utilidad proyectada"
          valor={pesosCortos(utilidadActiva)}
          nota={cotizadoActivo > 0 ? porcentaje((utilidadActiva / cotizadoActivo) * 100) : undefined}
          tono={tonoUtilidad(utilidadActiva, cotizadoActivo) === 'rojo' ? 'rojo' : 'verde'}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BuscadorTabla marcador="OT, obra, cliente o folio de cotización…" />
        <nav className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => {
            const activo = estatus === f.clave || (f.clave === '' && estatus === '')
            const params = new URLSearchParams()
            if (q) params.set('q', q)
            if (f.clave) params.set('estatus', f.clave)
            else params.set('estatus', '')
            return (
              <Link
                key={f.titulo}
                href={`/admin/obras?${params}`}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activo
                    ? 'bg-haaco-700 text-white'
                    : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
                }`}
              >
                {f.titulo}
              </Link>
            )
          })}
        </nav>
      </div>

      <Tarjeta pie={`${filas.length} de ${todas.length} órdenes de trabajo`}>
        {error ? (
          <EstadoVacio titulo="No se pudo leer la lista" descripcion="Revisa que las migraciones estén aplicadas." />
        ) : filas.length === 0 ? (
          <EstadoVacio
            titulo={todas.length === 0 ? 'Todavía no hay órdenes de trabajo' : 'Ninguna coincide'}
            descripcion={
              todas.length === 0
                ? 'Las OTs se abren al aprobar una cotización.'
                : 'Cambia el filtro o el texto de búsqueda.'
            }
            accion={
              todas.length === 0 ? (
                <Link
                  href="/admin/cotizaciones"
                  className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
                >
                  Ir a cotizaciones
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>OT</Th>
                <Th>Obra</Th>
                <Th>Cliente</Th>
                <Th>Estatus</Th>
                <Th numerico>Avance</Th>
                <Th numerico>Cotizado</Th>
                <Th numerico>Real</Th>
                <Th numerico>Utilidad</Th>
                <Th>Actualizada</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((o) => {
                const gastado =
                  Number(o.mano_obra) + Number(o.material_real) +
                  Number(o.viaticos) + Number(o.gastos_adicionales)
                const pctUtilidad =
                  Number(o.cotizado) > 0 ? (Number(o.utilidad) / Number(o.cotizado)) * 100 : 0

                return (
                  <tr key={o.obra_id} className="hover:bg-tinta-50/60">
                    <Td className="font-medium">
                      <Link href={`/admin/obras/${o.obra_id}`} className="font-mono text-xs text-haaco-700 hover:underline">
                        {o.ot_numero}
                      </Link>
                      <span className="mt-0.5 block font-mono text-[10px] text-tinta-400">
                        {o.cotizacion_folio}
                      </span>
                    </Td>
                    <Td>
                      <Link href={`/admin/obras/${o.obra_id}`} className="hover:underline">
                        {o.nombre}
                      </Link>
                    </Td>
                    <Td className="text-tinta-500">{o.cliente}</Td>
                    <Td>
                      <Etiqueta tono={ESTATUS_OBRA[o.estatus as EstatusObra].tono}>
                        {ESTATUS_OBRA[o.estatus as EstatusObra].texto}
                      </Etiqueta>
                    </Td>
                    <Td numerico>
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-tinta-100 sm:block">
                          <span
                            className="block h-full rounded-full bg-haaco-500"
                            style={{ width: `${Math.min(100, Number(o.avance_pct))}%` }}
                          />
                        </span>
                        {Number(o.avance_pct)}%
                      </span>
                    </Td>
                    <Td numerico>{pesos(o.cotizado)}</Td>
                    <Td numerico className="text-tinta-500">{pesos(gastado)}</Td>
                    <Td numerico>
                      <span
                        className={
                          pctUtilidad < 0
                            ? 'font-semibold text-red-600'
                            : pctUtilidad < 15
                              ? 'font-medium text-amber-600'
                              : 'font-medium text-haaco-700'
                        }
                      >
                        {pesos(o.utilidad)}
                        <span className="ml-1 text-xs font-normal text-tinta-400">
                          {porcentaje(pctUtilidad, 0)}
                        </span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-tinta-500">
                      {fecha(o.fecha_ultima_actualizacion)}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </>
  )
}
