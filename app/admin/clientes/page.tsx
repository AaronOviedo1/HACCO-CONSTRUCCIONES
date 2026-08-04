import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { pesos } from '@/lib/format'
import { EncabezadoPagina, EstadoVacio, Tabla, Tarjeta, Td, Th } from '@/components/ui'
import { BuscadorTabla } from '@/components/buscador'
import { ChipsFiltro } from '@/components/movil/piezas'
import {
  BotonNuevoCliente, FilaCliente, FilaClienteMovil,
} from '@/components/catalogos/formulario-cliente'

export const dynamic = 'force-dynamic'

const FILTROS_OBRA: { clave: string; titulo: string }[] = [
  { clave: '', titulo: 'Todos' },
  { clave: 'con', titulo: 'Con obra' },
  { clave: 'sin', titulo: 'Sin obra' },
]

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; obra?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { q, obra = '' } = await searchParams
  const supabase = await crearClienteServidor()

  let consulta = supabase.from('clientes').select('*').order('nombre')
  if (q?.trim()) consulta = consulta.ilike('nombre', `%${q.trim()}%`)

  const [{ data }, { data: cotizaciones }, { data: obrasTodas }] = await Promise.all([
    consulta,
    supabase.from('v_cotizaciones').select('cliente_id, total, estatus'),
    // El cliente no cuelga de la obra: la cadena es cliente → cotización →
    // obra. La vista del concentrado ya la resolvió y expone `cliente_id`.
    supabase.from('v_obra_concentrado').select('cliente_id'),
  ])

  const resumen = new Map<string, { n: number; monto: number }>()
  for (const c of cotizaciones ?? []) {
    const previo = resumen.get(c.cliente_id) ?? { n: 0, monto: 0 }
    resumen.set(c.cliente_id, {
      n: previo.n + 1,
      monto: previo.monto + (c.estatus === 'aprobada' || c.estatus === 'terminada' ? Number(c.total) : 0),
    })
  }

  const obrasPorCliente = new Map<string, number>()
  for (const o of obrasTodas ?? []) {
    if (o.cliente_id) obrasPorCliente.set(o.cliente_id, (obrasPorCliente.get(o.cliente_id) ?? 0) + 1)
  }

  const candidatos = data ?? []
  const filas = candidatos.filter((c) => {
    const n = obrasPorCliente.get(c.id) ?? 0
    if (obra === 'con') return n > 0
    if (obra === 'sin') return n === 0
    return true
  })

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion="Cada cliente puede tener varias cotizaciones; sólo la aprobada genera órdenes de trabajo."
        acciones={<BotonNuevoCliente />}
      />

      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
        <BuscadorTabla marcador="Buscar cliente por nombre…" />
        {/* Cotizar a alguien no es haberle hecho una obra: este filtro separa
            a los clientes de verdad de los que se quedaron en presupuesto. */}
        <ChipsFiltro
          opciones={FILTROS_OBRA.map((f) => {
            const params = new URLSearchParams()
            if (q) params.set('q', q)
            if (f.clave) params.set('obra', f.clave)
            const cadena = params.toString()
            return {
              titulo: f.titulo,
              href: cadena ? `/admin/clientes?${cadena}` : '/admin/clientes',
              activo: obra === f.clave,
            }
          })}
        />
      </div>

      {/* Teléfono: un renglón por cliente, que la tabla no cabe ----------- */}
      {filas.length > 0 && (
        <Tarjeta className="lg:hidden" pie={`${filas.length} ${filas.length === 1 ? 'cliente' : 'clientes'}`}>
          {filas.map((c) => {
            const datos = resumen.get(c.id) ?? { n: 0, monto: 0 }
            return (
              <FilaClienteMovil
                key={c.id}
                cliente={c}
                cotizaciones={datos.n}
                contratado={datos.monto}
                obras={obrasPorCliente.get(c.id) ?? 0}
              />
            )
          })}
        </Tarjeta>
      )}

      <Tarjeta
        className={filas.length > 0 ? 'hidden lg:block' : ''}
        pie={`${filas.length} ${filas.length === 1 ? 'cliente' : 'clientes'}`}
      >
        {filas.length === 0 ? (
          <EstadoVacio
            titulo={q || obra ? 'Ningún cliente coincide' : 'Todavía no hay clientes'}
            descripcion={
              obra === 'con'
                ? 'Ninguno de estos clientes tiene orden de trabajo abierta.'
                : obra === 'sin'
                  ? 'Todos los clientes que coinciden ya llegaron a obra.'
                  : q
                    ? 'Prueba con otra parte del nombre.'
                    : 'Da de alta el primero, o créalo al vuelo desde una cotización.'
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Teléfono</Th>
                <Th>Correo</Th>
                <Th>Domicilio</Th>
                <Th numerico>Cotizaciones</Th>
                <Th numerico>Obras</Th>
                <Th numerico>Contratado</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => {
                const datos = resumen.get(c.id) ?? { n: 0, monto: 0 }
                const nObras = obrasPorCliente.get(c.id) ?? 0
                return (
                  <FilaCliente key={c.id} cliente={c}>
                    <Td className="text-tinta-500">{c.telefono ?? '—'}</Td>
                    <Td className="text-tinta-500">{c.correo ?? '—'}</Td>
                    <Td className="text-tinta-500">{c.domicilio ?? '—'}</Td>
                    <Td numerico>
                      {datos.n > 0 ? (
                        <Link
                          href={`/admin/cotizaciones?cliente=${c.id}`}
                          className="relative font-medium text-haaco-700 hover:underline"
                        >
                          {datos.n}
                        </Link>
                      ) : (
                        0
                      )}
                    </Td>
                    <Td numerico>
                      {nObras > 0 ? (
                        // Sin `estatus` para no esconder las obras ya cerradas.
                        <Link
                          href={`/admin/obras?cliente=${c.id}&estatus=`}
                          className="relative font-medium text-haaco-700 hover:underline"
                        >
                          {nObras}
                        </Link>
                      ) : (
                        <span className="text-tinta-400">—</span>
                      )}
                    </Td>
                    <Td numerico className="text-tinta-500">
                      {datos.monto > 0 ? pesos(datos.monto) : '—'}
                    </Td>
                  </FilaCliente>
                )
              })}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </>
  )
}
