import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos } from '@/lib/format'
import { rangoDeUrl } from '@/lib/finanzas'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import {
  BarraCajaChica, BotonEditarMovimiento, BotonEliminarMovimiento,
} from '@/components/finanzas/caja-chica'

export const dynamic = 'force-dynamic'

export default async function PaginaCajaChica({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const periodo = rangoDeUrl(await searchParams)

  const supabase = await crearClienteServidor()

  const [{ data: todos }, { data: obras }] = await Promise.all([
    supabase.from('caja_chica').select('*').order('fecha', { ascending: false }),
    supabase.from('obras').select('id, nombre, ot_numero').neq('estatus', 'cerrada'),
  ])

  const movimientos = todos ?? []
  const delPeriodo = movimientos.filter(
    (m) =>
      (!periodo.desde || m.fecha >= periodo.desde) && (!periodo.hasta || m.fecha < periodo.hasta),
  )

  // El saldo es histórico: no se corta por mes.
  const saldo = movimientos.reduce(
    (s, m) => s + (m.tipo === 'entrada' ? Number(m.monto) : -Number(m.monto)),
    0,
  )
  const entradas = delPeriodo.filter((m) => m.tipo === 'entrada').reduce((s, m) => s + Number(m.monto), 0)
  const salidas = delPeriodo.filter((m) => m.tipo === 'salida').reduce((s, m) => s + Number(m.monto), 0)

  const nombreObra = new Map((obras ?? []).map((o) => [o.id, `${o.ot_numero} · ${o.nombre}`]))

  return (
    <>
      <EncabezadoPagina
        titulo="Caja chica"
        descripcion="Entradas y salidas de efectivo. El saldo es acumulado; los totales son del periodo elegido."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          etiqueta="Saldo en caja"
          valor={pesos(saldo)}
          nota="acumulado a hoy"
          tono={saldo < 0 ? 'rojo' : 'verde'}
        />
        <Indicador etiqueta="Entradas del periodo" valor={pesos(entradas)} nota={periodo.etiqueta} />
        <Indicador etiqueta="Salidas del periodo" valor={pesos(salidas)} tono="ambar" />
        <Indicador etiqueta="Movimientos" valor={String(delPeriodo.length)} />
      </div>

      <BarraCajaChica obras={obras ?? []} />

      <Tarjeta pie={`${delPeriodo.length} movimientos · ${periodo.etiqueta} · saldo acumulado ${pesos(saldo)}`}>
        {delPeriodo.length === 0 ? (
          <EstadoVacio
            titulo="Sin movimientos en el periodo"
            descripcion="Registra la entrada del fondo o la primera salida."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Concepto</Th>
                <Th>Obra</Th>
                <Th>Tipo</Th>
                <Th numerico>Monto</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {delPeriodo.map((m) => (
                <tr key={m.id} className="hover:bg-tinta-50/60">
                  <Td className="whitespace-nowrap text-tinta-500">{fecha(m.fecha)}</Td>
                  <Td>{m.concepto}</Td>
                  <Td className="text-tinta-500">
                    {m.obra_id ? (nombreObra.get(m.obra_id) ?? '—') : '—'}
                  </Td>
                  <Td>
                    <Etiqueta tono={m.tipo === 'entrada' ? 'verde' : 'ambar'}>
                      {m.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                    </Etiqueta>
                  </Td>
                  <Td
                    numerico
                    className={`font-medium ${m.tipo === 'entrada' ? 'text-haaco-700' : 'text-amber-700'}`}
                  >
                    {m.tipo === 'entrada' ? '+' : '-'} {pesos(m.monto)}
                  </Td>
                  <Td>
                    <span className="flex items-center gap-0.5">
                      <BotonEditarMovimiento movimiento={m} obras={obras ?? []} />
                      <BotonEliminarMovimiento id={m.id} concepto={m.concepto} />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </>
  )
}
