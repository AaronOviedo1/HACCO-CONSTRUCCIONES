import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos, porcentaje } from '@/lib/format'
import { TIPO_PAGO_COBRANZA, tonoCobranza } from '@/lib/finanzas'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { AccionesCobranza } from '@/components/finanzas/cobranza'
import type { PagoCobranza } from '@/types/database'

export const dynamic = 'force-dynamic'

const PESTANAS = [
  { clave: 'registro', titulo: 'Registro' },
  { clave: 'concentrado', titulo: 'Concentrado' },
] as const

export default async function PaginaCobranza({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { t } = await searchParams
  const vista = PESTANAS.find((p) => p.clave === t)?.clave ?? 'registro'

  const supabase = await crearClienteServidor()

  const [{ data: cobranza }, { data: pagos }, { data: obras }] = await Promise.all([
    supabase
      .from('v_cobranza')
      .select('*')
      .in('estatus', ['aprobada', 'terminada'])
      .order('fecha', { ascending: false }),
    supabase.from('pagos_cobranza').select('*').order('fecha'),
    supabase.from('obras').select('id, cotizacion_id, nombre, ot_numero, estatus'),
  ])

  const filas = cobranza ?? []
  const porCotizacion = new Map<string, PagoCobranza[]>()
  for (const p of pagos ?? []) {
    porCotizacion.set(p.cotizacion_id, [...(porCotizacion.get(p.cotizacion_id) ?? []), p])
  }

  const obrasPorCotizacion = new Map<string, typeof obras>()
  for (const o of obras ?? []) {
    obrasPorCotizacion.set(o.cotizacion_id, [...(obrasPorCotizacion.get(o.cotizacion_id) ?? []), o])
  }

  const totalCotizado = filas.reduce((s, c) => s + Number(c.cotizado), 0)
  const totalCobrado = filas.reduce((s, c) => s + Number(c.cobrado), 0)
  const totalSaldo = filas.reduce((s, c) => s + Number(c.saldo), 0)
  const conSaldo = filas.filter((c) => Number(c.saldo) > 0)
  const anticiposPendientes = filas
    .filter((c) => Number(c.anticipo) < Number(c.anticipo_esperado))
    .reduce((s, c) => s + (Number(c.anticipo_esperado) - Number(c.anticipo)), 0)

  // Máximo de abonos capturados: define cuántas columnas pintar, como su Excel.
  const maxAbonos = Math.max(
    1,
    ...filas.map((c) => (porCotizacion.get(c.cotizacion_id) ?? []).filter((p) => p.tipo === 'abono').length),
  )

  return (
    <>
      <EncabezadoPagina
        titulo="Cobranza"
        descripcion="Por cotización aprobada: anticipo, abonos, saldo y porcentaje pendiente."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Cotizado" valor={pesosCortos(totalCotizado)} nota={`${filas.length} obras`} />
        <Indicador etiqueta="Cobrado" valor={pesosCortos(totalCobrado)} tono="verde" />
        <Indicador
          etiqueta="Por cobrar"
          valor={pesosCortos(totalSaldo)}
          nota={`${conSaldo.length} con saldo`}
          tono={totalSaldo > 0 ? 'ambar' : 'verde'}
        />
        <Indicador
          etiqueta="Anticipos sin cobrar"
          valor={pesosCortos(anticiposPendientes)}
          nota="obras aprobadas que aún no dan anticipo"
          tono={anticiposPendientes > 0 ? 'rojo' : 'neutro'}
        />
      </div>

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/admin/cobranza?t=${p.clave}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              vista === p.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {p.titulo}
          </Link>
        ))}
      </nav>

      {filas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo="Todavía no hay obras aprobadas"
            descripcion="La cobranza aparece cuando una cotización pasa a aprobada."
            accion={
              <Link
                href="/admin/cotizaciones"
                className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
              >
                Ir a cotizaciones
              </Link>
            }
          />
        </Tarjeta>
      ) : vista === 'registro' ? (
        <Tarjeta pie="Cada renglón es una cotización aprobada. Los abonos se capturan en orden.">
          <Tabla>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Cotización</Th>
                <Th>Fact.</Th>
                <Th numerico>Cotizado</Th>
                <Th numerico>Anticipo</Th>
                {Array.from({ length: maxAbonos }, (_, i) => (
                  <Th key={i} numerico>{`Abono ${i + 1}`}</Th>
                ))}
                <Th numerico>Saldo</Th>
                <Th>% pendiente</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => {
                const suyos = porCotizacion.get(c.cotizacion_id) ?? []
                const abonos = suyos.filter((p) => p.tipo === 'abono' || p.tipo === 'liquidacion')
                const pct = Number(c.pct_pendiente)

                return (
                  <tr key={c.cotizacion_id} className="hover:bg-tinta-50/60">
                    <Td className="font-medium text-tinta-900">{c.cliente}</Td>
                    <Td>
                      <Link
                        href={`/admin/cotizaciones/${c.cotizacion_id}`}
                        className="font-mono text-xs text-haaco-700 hover:underline"
                      >
                        {c.folio}
                      </Link>
                    </Td>
                    <Td className="text-tinta-500">{c.requiere_factura ? 'Sí' : 'No'}</Td>
                    <Td numerico>{pesos(c.cotizado)}</Td>
                    <Td numerico className={Number(c.anticipo) > 0 ? '' : 'text-tinta-300'}>
                      {Number(c.anticipo) > 0 ? pesos(c.anticipo) : '—'}
                    </Td>
                    {Array.from({ length: maxAbonos }, (_, i) => (
                      <Td key={i} numerico className={abonos[i] ? '' : 'text-tinta-300'}>
                        {abonos[i] ? pesos(abonos[i].monto) : '—'}
                      </Td>
                    ))}
                    <Td numerico className={Number(c.saldo) > 0 ? 'font-semibold text-amber-700' : 'text-haaco-700'}>
                      {pesos(c.saldo)}
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-tinta-100">
                          <span
                            className={`block h-full rounded-full ${
                              pct <= 0 ? 'bg-haaco-500' : pct <= 50 ? 'bg-sky-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, 100 - pct)}%` }}
                          />
                        </span>
                        <span className="text-xs tabular-nums text-tinta-600">
                          {porcentaje(pct, 0)}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <AccionesCobranza
                        cobranza={c}
                        pagos={suyos}
                        obras={obrasPorCotizacion.get(c.cotizacion_id) ?? []}
                      />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : (
        <Tarjeta
          titulo="Concentrado para el contador"
          pie={`Total general por cobrar: ${pesos(totalSaldo)}`}
        >
          <Tabla>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Cotización</Th>
                <Th>Fecha</Th>
                <Th>Factura</Th>
                <Th numerico>Cotizado</Th>
                <Th numerico>Cobrado</Th>
                <Th numerico>Saldo por liquidar</Th>
                <Th numerico>% pendiente</Th>
              </tr>
            </thead>
            <tbody>
              {conSaldo.map((c) => (
                <tr key={c.cotizacion_id} className="hover:bg-tinta-50/60">
                  <Td className="font-medium text-tinta-900">{c.cliente}</Td>
                  <Td className="font-mono text-xs">{c.folio}</Td>
                  <Td className="whitespace-nowrap text-tinta-500">{fecha(c.fecha)}</Td>
                  <Td>
                    <Etiqueta tono={c.requiere_factura ? 'azul' : 'gris'}>
                      {c.requiere_factura ? 'Sí' : 'No'}
                    </Etiqueta>
                  </Td>
                  <Td numerico>{pesos(c.cotizado)}</Td>
                  <Td numerico className="text-tinta-500">{pesos(c.cobrado)}</Td>
                  <Td numerico className="font-semibold text-amber-700">{pesos(c.saldo)}</Td>
                  <Td numerico>
                    <Etiqueta tono={tonoCobranza(Number(c.pct_pendiente))}>
                      {porcentaje(c.pct_pendiente, 0)}
                    </Etiqueta>
                  </Td>
                </tr>
              ))}
              <tr className="bg-haaco-50/60">
                <Td className="font-semibold text-tinta-900">TOTAL GENERAL</Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td numerico className="font-semibold">
                  {pesos(conSaldo.reduce((s, c) => s + Number(c.cotizado), 0))}
                </Td>
                <Td numerico className="font-semibold">
                  {pesos(conSaldo.reduce((s, c) => s + Number(c.cobrado), 0))}
                </Td>
                <Td numerico className="text-base font-semibold text-haaco-700">
                  {pesos(totalSaldo)}
                </Td>
                <Td> </Td>
              </tr>
            </tbody>
          </Tabla>
        </Tarjeta>
      )}

      {vista === 'registro' && (pagos ?? []).length > 0 && (
        <Tarjeta titulo="Últimos pagos recibidos" className="mt-4">
          <ul className="divide-y divide-tinta-100">
            {(pagos ?? [])
              .slice()
              .reverse()
              .slice(0, 8)
              .map((p) => {
                const c = filas.find((f) => f.cotizacion_id === p.cotizacion_id)
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <Etiqueta tono={p.tipo === 'anticipo' ? 'azul' : p.tipo === 'liquidacion' ? 'verde' : 'gris'}>
                        {TIPO_PAGO_COBRANZA[p.tipo]}
                      </Etiqueta>
                      <span className="text-tinta-700">{c?.cliente ?? '—'}</span>
                      <span className="font-mono text-xs text-tinta-400">{c?.folio}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-tinta-500">{fecha(p.fecha)}</span>
                      <span className="font-medium tabular-nums text-tinta-900">{pesos(p.monto)}</span>
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
