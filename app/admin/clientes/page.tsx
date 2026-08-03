import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { pesos } from '@/lib/format'
import { EncabezadoPagina, EstadoVacio, Tabla, Tarjeta, Td, Th } from '@/components/ui'
import { BuscadorTabla } from '@/components/buscador'
import {
  BotonNuevoCliente, FilaCliente, FilaClienteMovil,
} from '@/components/catalogos/formulario-cliente'

export const dynamic = 'force-dynamic'

export default async function PaginaClientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { q } = await searchParams
  const supabase = await crearClienteServidor()

  let consulta = supabase.from('clientes').select('*').order('nombre')
  if (q?.trim()) consulta = consulta.ilike('nombre', `%${q.trim()}%`)

  const [{ data }, { data: cotizaciones }] = await Promise.all([
    consulta,
    supabase.from('v_cotizaciones').select('cliente_id, total, estatus'),
  ])

  const filas = data ?? []
  const resumen = new Map<string, { n: number; monto: number }>()
  for (const c of cotizaciones ?? []) {
    const previo = resumen.get(c.cliente_id) ?? { n: 0, monto: 0 }
    resumen.set(c.cliente_id, {
      n: previo.n + 1,
      monto: previo.monto + (c.estatus === 'aprobada' || c.estatus === 'terminada' ? Number(c.total) : 0),
    })
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion="Cada cliente puede tener varias cotizaciones; sólo la aprobada genera órdenes de trabajo."
        acciones={<BotonNuevoCliente />}
      />

      <div className="mb-4">
        <BuscadorTabla marcador="Buscar cliente por nombre…" />
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
            titulo={q ? 'Ningún cliente coincide' : 'Todavía no hay clientes'}
            descripcion={
              q
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
                <Th numerico>Contratado</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => {
                const datos = resumen.get(c.id) ?? { n: 0, monto: 0 }
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
