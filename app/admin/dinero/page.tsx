import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { pesosCortos } from '@/lib/format'
import { vencimientosPorSemana } from '@/lib/finanzas'
import { EncabezadoPagina, Tarjeta } from '@/components/ui'
import { BarrasSemanas, Tile } from '@/components/movil/piezas'

export const dynamic = 'force-dynamic'

export default async function PaginaDinero() {
  await requerirRol(['admin', 'administracion'])
  const supabase = await crearClienteServidor()

  const [{ data: cobranza }, { data: cxp }, { data: prenomina }, { data: caja }] = await Promise.all([
    supabase.from('v_cobranza').select('cobrado, saldo, estatus'),
    supabase.from('v_cuentas_por_pagar').select('saldo, estado, vencimiento'),
    supabase.from('v_prenomina').select('disponible, deducciones'),
    supabase.from('caja_chica').select('tipo, monto'),
  ])

  const abiertas = (cobranza ?? []).filter(
    (c) => c.estatus === 'aprobada' || c.estatus === 'terminada',
  )
  const cobrado = abiertas.reduce((s, c) => s + Number(c.cobrado ?? 0), 0)
  const porCobrar = abiertas.reduce((s, c) => s + Number(c.saldo ?? 0), 0)
  const pctCobrado = cobrado + porCobrar > 0 ? Math.round((cobrado / (cobrado + porCobrar)) * 100) : 0

  const activas = (cxp ?? [])
    .filter((c) => c.estado !== 'pagada' && c.estado !== 'cancelada')
    .map((c) => ({ ...c, saldo: Number(c.saldo ?? 0) }))
  const porPagar = activas.reduce((s, c) => s + c.saldo, 0)
  const urgentes = activas.filter((c) => c.estado === 'vencida' || c.estado === 'urgente')
  const montoUrgente = urgentes.reduce((s, c) => s + c.saldo, 0)

  const aPagarNomina = (prenomina ?? []).reduce(
    (s, p) => s + Math.max(0, Number(p.disponible) - Number(p.deducciones)),
    0,
  )
  const contratos = (prenomina ?? []).length

  const saldoCaja = (caja ?? []).reduce(
    (s, m) => s + (m.tipo === 'entrada' ? Number(m.monto) : -Number(m.monto)),
    0,
  )

  return (
    <>
      <EncabezadoPagina
        titulo="Dinero"
        descripcion="Lo que entra, lo que sale y lo que se le debe a quién."
      />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        <Tile etiqueta="Por cobrar" valor={pesosCortos(porCobrar)} href="/admin/cobranza">
          <div className="mt-2.5 h-[7px] overflow-hidden rounded-full bg-tinta-150" aria-hidden>
            <div className="h-full rounded-full bg-haaco-500" style={{ width: `${pctCobrado}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-tinta-400">{pctCobrado}% ya cobrado</div>
        </Tile>

        <Tile
          etiqueta="Por pagar"
          valor={pesosCortos(porPagar)}
          href="/admin/cuentas-por-pagar"
          nota={
            <>
              <span className={`block font-semibold ${montoUrgente > 0 ? 'text-red-600' : ''}`}>
                {pesosCortos(montoUrgente)} urgente
              </span>
              {urgentes.length}{' '}
              {urgentes.length === 1 ? 'factura vencida o por vencer' : 'facturas vencidas o por vencer'}
            </>
          }
        />

        <Tile
          etiqueta="Prenómina"
          valor={pesosCortos(aPagarNomina)}
          href="/admin/nomina?t=prenomina"
          nota={`${contratos} ${contratos === 1 ? 'oficial con contrato' : 'oficiales con contrato'}`}
        />

        <Link
          href="/admin/gastos"
          className="rounded-[18px] bg-haaco-700 p-3.5 text-white shadow-verde transition active:opacity-90 lg:rounded-xl"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4.4 8.4h3l1.4-2h6.4l1.4 2h3v10.8H4.4z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="13.2" r="3.4" stroke="currentColor" strokeWidth="1.9" />
          </svg>
          <div className="mt-2.5 text-base font-semibold leading-tight">Capturar gasto</div>
          <div className="mt-1 text-[11px] opacity-80">con foto del ticket</div>
        </Link>
      </div>

      <Tarjeta className="mb-3.5">
        <div className="px-3.5 py-4">
          <div className="mb-3.5 flex items-baseline justify-between">
            <h2 className="text-[14.5px] font-semibold">Vencimientos por semana</h2>
            <span
              className={`text-xs font-semibold tabular-nums ${
                montoUrgente > 0 ? 'text-red-600' : 'text-tinta-400'
              }`}
            >
              {montoUrgente > 0 ? `${pesosCortos(montoUrgente)} urgente` : 'nada urgente'}
            </span>
          </div>
          <BarrasSemanas semanas={vencimientosPorSemana(activas)} />
        </div>
      </Tarjeta>

      <Link
        href="/admin/caja-chica"
        className="flex items-center justify-between rounded-[20px] border-[0.5px] border-tinta-200 bg-white px-4 py-3.5 shadow-tarjeta transition active:bg-tinta-50 lg:rounded-xl"
      >
        <span>
          <span className="block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-tinta-500">
            Caja chica
          </span>
          <span className="mt-1 block text-xl font-bold tabular-nums">{pesosCortos(saldoCaja)}</span>
        </span>
        <span className="text-[11.5px] text-tinta-400">saldo de efectivo</span>
      </Link>
    </>
  )
}
