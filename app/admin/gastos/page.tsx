import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos } from '@/lib/format'
import { CATEGORIA_GASTO, CONDICION, METODO_PAGO, rangoDeUrl } from '@/lib/finanzas'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { BotonEliminarGasto, BotonNuevoGasto } from '@/components/finanzas/formulario-gasto'
import { FiltrosGastos } from '@/components/finanzas/filtros-gastos'
import { FilaLista } from '@/components/movil/piezas'
import type { CategoriaGasto } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PaginaGastos({
  searchParams,
}: {
  searchParams: Promise<{
    obra?: string; categoria?: string; metodo?: string; desde?: string; hasta?: string; q?: string
  }>
}) {
  await requerirRol(['admin', 'administracion'])
  const filtros = await searchParams
  const periodo = rangoDeUrl(filtros)

  const supabase = await crearClienteServidor()

  let consulta = supabase
    .from('v_gastos')
    .select('*')
    .order('fecha', { ascending: false })

  if (periodo.desde) consulta = consulta.gte('fecha', periodo.desde)
  if (periodo.hasta) consulta = consulta.lt('fecha', periodo.hasta)

  if (filtros.obra === 'general') consulta = consulta.is('obra_id', null)
  else if (filtros.obra) consulta = consulta.eq('obra_id', filtros.obra)
  if (filtros.categoria) consulta = consulta.eq('categoria', filtros.categoria as CategoriaGasto)
  if (filtros.metodo) consulta = consulta.eq('metodo', filtros.metodo as 'efectivo')

  const [{ data, error }, { data: obras }, { data: proveedores }, { data: conceptos }] =
    await Promise.all([
      consulta,
      supabase
        .from('obras')
        .select('id, nombre, ot_numero')
        .neq('estatus', 'cerrada')
        .order('fecha_apertura', { ascending: false }),
      supabase.from('proveedores').select('id, nombre, dias_credito_default').order('nombre'),
      supabase.from('obra_conceptos').select('*').order('nombre'),
    ])

  let filas = data ?? []
  if (filtros.q?.trim()) {
    const busqueda = filtros.q.trim().toLowerCase()
    filas = filas.filter((g) =>
      `${g.descripcion} ${g.folio_factura ?? ''} ${g.proveedor ?? ''} ${g.obra ?? ''}`
        .toLowerCase()
        .includes(busqueda),
    )
  }

  const total = filas.reduce((s, g) => s + Number(g.monto), 0)
  const enTarjeta = filas.filter((g) => g.metodo === 'tarjeta_empresa').reduce((s, g) => s + Number(g.monto), 0)
  const enEfectivo = filas.filter((g) => g.metodo === 'efectivo').reduce((s, g) => s + Number(g.monto), 0)
  const aCredito = filas.filter((g) => g.condicion === 'credito').reduce((s, g) => s + Number(g.monto), 0)

  // Concentrado por categoría, que es como lo pide el contador.
  const porCategoria = new Map<CategoriaGasto, number>()
  for (const g of filas) {
    porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + Number(g.monto))
  }
  const categorias = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])

  return (
    <>
      <EncabezadoPagina
        titulo="Gastos"
        descripcion="Todo gasto ligado a una obra alimenta su material consumido; a crédito abre su cuenta por pagar."
        acciones={
          <BotonNuevoGasto
            obras={obras ?? []}
            proveedores={proveedores ?? []}
            conceptos={conceptos ?? []}
          />
        }
      />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:mb-5 lg:grid-cols-4 lg:gap-3">
        <Indicador
          etiqueta="Gastado en el periodo"
          valor={pesosCortos(total)}
          nota={`${filas.length} movimientos · ${periodo.etiqueta}`}
        />
        <Indicador
          etiqueta="A crédito"
          valor={pesosCortos(aCredito)}
          nota="abrió cuentas por pagar"
          tono={aCredito > 0 ? 'ambar' : 'neutro'}
        />
        <Indicador etiqueta="Tarjeta de empresa" valor={pesosCortos(enTarjeta)} className="hidden lg:block" />
        <Indicador etiqueta="Efectivo" valor={pesosCortos(enEfectivo)} className="hidden lg:block" />
      </div>

      <FiltrosGastos obras={obras ?? []} />

      {/* Teléfono: el ticket del día, en renglones ------------------------- */}
      {filas.length > 0 && (
        <Tarjeta className="lg:hidden">
          {filas.map((g) => (
            <FilaLista
              key={g.id}
              href={g.obra_id ? `/admin/obras/${g.obra_id}` : undefined}
              principal={g.descripcion}
              secundario={`${fecha(g.fecha)} · ${CATEGORIA_GASTO[g.categoria]}${
                g.proveedor ? ` · ${g.proveedor}` : ''
              }`}
              derecha={
                <>
                  <span className="text-sm font-semibold tabular-nums">{pesos(g.monto)}</span>
                  {g.condicion === 'credito' ? (
                    <Etiqueta tono="ambar">{CONDICION.credito}</Etiqueta>
                  ) : (
                    <span className="text-[10.5px] text-tinta-400">{METODO_PAGO[g.metodo]}</span>
                  )}
                </>
              }
            />
          ))}
        </Tarjeta>
      )}

      <div className={`grid gap-4 xl:grid-cols-4 ${filas.length > 0 ? 'hidden lg:grid' : ''}`}>
        <div className="xl:col-span-3">
          <Tarjeta pie={`${filas.length} movimientos · ${pesos(total)}`}>
            {error ? (
              <EstadoVacio titulo="No se pudo leer la lista" descripcion="Revisa las migraciones." />
            ) : filas.length === 0 ? (
              <EstadoVacio
                titulo="Sin gastos con estos filtros"
                descripcion="Cambia el mes o registra el primero."
              />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Descripción</Th>
                    <Th>Categoría</Th>
                    <Th>Obra</Th>
                    <Th>Proveedor</Th>
                    <Th numerico>Monto</Th>
                    <Th>Método</Th>
                    <Th>Folio</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((g) => (
                    <tr key={g.id} className="hover:bg-tinta-50/60">
                      <Td className="whitespace-nowrap text-tinta-500">{fecha(g.fecha)}</Td>
                      <Td>
                        {g.descripcion}
                        {Number(g.piezas ?? 1) > 1 && (
                          <span className="ml-1.5 text-xs text-tinta-400">×{Number(g.piezas)}</span>
                        )}
                      </Td>
                      <Td className="text-tinta-500">{CATEGORIA_GASTO[g.categoria]}</Td>
                      <Td className="text-tinta-500">
                        {g.obra_id ? (
                          <Link href={`/admin/obras/${g.obra_id}`} className="text-haaco-700 hover:underline">
                            {g.ot_numero}
                          </Link>
                        ) : (
                          <span className="text-tinta-400">General</span>
                        )}
                      </Td>
                      <Td className="text-tinta-500">{g.proveedor ?? '—'}</Td>
                      <Td numerico className="font-medium">{pesos(g.monto)}</Td>
                      <Td>
                        <span className="flex items-center gap-1.5">
                          <span className="text-xs text-tinta-600">{METODO_PAGO[g.metodo]}</span>
                          {g.condicion === 'credito' && (
                            <Etiqueta tono="ambar">{CONDICION.credito}</Etiqueta>
                          )}
                        </span>
                      </Td>
                      <Td className="font-mono text-xs text-tinta-500">{g.folio_factura ?? '—'}</Td>
                      <Td className="w-8">
                        <BotonEliminarGasto id={g.id} descripcion={g.descripcion} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            )}
          </Tarjeta>
        </div>

        <Tarjeta titulo="Por categoría" pie="Es el corte que pide el contador cada mes.">
          {categorias.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-tinta-500">Sin movimientos.</p>
          ) : (
            <ul className="divide-y divide-tinta-100">
              {categorias.map(([categoria, monto]) => (
                <li key={categoria} className="px-4 py-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-tinta-600">{CATEGORIA_GASTO[categoria]}</span>
                    <span className="font-medium tabular-nums text-tinta-900">{pesos(monto)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tinta-100">
                    <div
                      className="h-full rounded-full bg-haaco-500"
                      style={{ width: `${total > 0 ? (monto / total) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  )
}
