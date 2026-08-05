import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos } from '@/lib/format'
import { ESTADO_CXP, agruparPorMes, vencimientosPorSemana } from '@/lib/finanzas'
import { mesesPlegados } from '@/lib/meses-plegados'
import { EncabezadoPagina, Etiqueta, Indicador, Tarjeta } from '@/components/ui'
import { MesesPlegables, SeccionMes } from '@/components/meses'
import {
  BotonNuevaCxp, BotonPagarProveedor, BotonPagoMovil, FiltroProveedorCxp,
} from '@/components/finanzas/cxp'
import { TablaCxp } from '@/components/finanzas/tabla-cxp'
import { BarrasSemanas, FilaLista } from '@/components/movil/piezas'
import type { EstadoCxp } from '@/types/database'

export const dynamic = 'force-dynamic'

const VISTAS = [
  { clave: 'todas', titulo: 'Todas' },
  { clave: 'pendientes', titulo: 'Por pagar' },
  { clave: 'programacion', titulo: 'Programación de pagos' },
] as const

export default async function PaginaCuentasPorPagar({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; proveedor?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { t, proveedor } = await searchParams
  const vista = VISTAS.find((v) => v.clave === t)?.clave ?? 'pendientes'

  const supabase = await crearClienteServidor()

  const [{ data: cuentas, error }, { data: dashboard }, { data: proveedores }] = await Promise.all([
    supabase.from('v_cuentas_por_pagar').select('*').order('vencimiento'),
    supabase.from('v_cxp_por_proveedor').select('*').order('saldo_total', { ascending: false }),
    supabase.from('proveedores').select('*').order('nombre'),
  ])

  const todas = cuentas ?? []
  const activas = todas.filter((c) => c.estado !== 'pagada' && c.estado !== 'cancelada')

  let filas = vista === 'todas' ? todas : activas
  if (proveedor) filas = filas.filter((c) => c.proveedor_id === proveedor)
  if (vista === 'programacion') {
    filas = [...filas].sort(
      (a, b) => new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime(),
    )
  }

  // Aquí el mes que importa es el del vencimiento: cuándo hay que pagar.
  const meses = agruparPorMes(filas, (c) => c.vencimiento)
  const detalleMes = (grupo: (typeof meses)[number]) =>
    `${grupo.filas.length} · saldo ${pesos(grupo.filas.reduce((s, c) => s + Number(c.saldo), 0))}`
  const etiquetaVence = (grupo: (typeof meses)[number]) =>
    grupo.mes ? `Vencen en ${grupo.etiqueta}` : grupo.etiqueta
  const plegados = await mesesPlegados('cxp', meses.map((g) => g.mes))

  // Lo que se le puede liquidar de un jalón al proveedor filtrado, en el móvil.
  const porPagarDelProveedor = proveedor
    ? filas.filter((c) => !c.cancelada && Number(c.saldo) > 0)
    : []

  const saldoTotal = activas.reduce((s, c) => s + Number(c.saldo), 0)
  const vencido = activas.filter((c) => c.estado === 'vencida').reduce((s, c) => s + Number(c.saldo), 0)
  const urgente = activas.filter((c) => c.estado === 'urgente').reduce((s, c) => s + Number(c.saldo), 0)
  const proximo = activas.filter((c) => c.estado === 'proxima').reduce((s, c) => s + Number(c.saldo), 0)

  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas por pagar"
        descripcion="Vencimiento, saldo y estado se calculan solos con la fecha de factura y los días de crédito del proveedor."
        acciones={<BotonNuevaCxp proveedores={proveedores ?? []} />}
      />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:mb-5 lg:grid-cols-4 lg:gap-3">
        <Indicador etiqueta="Saldo total" valor={pesosCortos(saldoTotal)} nota={`${activas.length} facturas abiertas`} />
        <Indicador etiqueta="Vencido" valor={pesosCortos(vencido)} tono={vencido > 0 ? 'rojo' : 'neutro'} />
        <Indicador
          etiqueta="Urgente"
          valor={pesosCortos(urgente)}
          nota="vence en 3 días o menos"
          tono={urgente > 0 ? 'rojo' : 'neutro'}
          className="hidden lg:block"
        />
        <Indicador
          etiqueta="Próximo"
          valor={pesosCortos(proximo)}
          nota="vence en 15 días"
          tono="ambar"
          className="hidden lg:block"
        />
      </div>

      {/* Teléfono: primero cuándo pega, luego a quién ---------------------- */}
      {activas.length > 0 && (
        <div className="lg:hidden">
          <Tarjeta className="mb-3.5">
            <div className="px-3.5 py-4">
              <div className="mb-3.5 flex items-baseline justify-between">
                <h2 className="text-[14.5px] font-semibold">Vencimientos por semana</h2>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    vencido + urgente > 0 ? 'text-red-600' : 'text-tinta-400'
                  }`}
                >
                  {vencido + urgente > 0
                    ? `${pesosCortos(vencido + urgente)} urgente`
                    : 'nada urgente'}
                </span>
              </div>
              <BarrasSemanas
                semanas={vencimientosPorSemana(
                  activas.map((c) => ({ vencimiento: c.vencimiento, saldo: Number(c.saldo) })),
                )}
              />
            </div>
          </Tarjeta>

          <div className="mb-3.5 flex flex-col gap-2.5">
            <FiltroProveedorCxp
              proveedores={proveedores ?? []}
              valor={proveedor ?? ''}
              vista={vista}
            />
            {/* En el teléfono no hay casillas: se filtra por proveedor y se
                liquida todo lo suyo de un botón, que es el mismo resultado. */}
            {proveedor && porPagarDelProveedor.length > 1 && (
              <BotonPagarProveedor cuentas={porPagarDelProveedor} />
            )}
          </div>

          <Tarjeta>
            <MesesPlegables lista="cxp" plegados={plegados}>
            {meses.map((grupo) => (
              <SeccionMes
                key={grupo.mes}
                mes={grupo.mes}
                enTarjeta
                etiqueta={etiquetaVence(grupo)}
                detalle={detalleMes(grupo)}
              >
                {grupo.filas.map((c) => {
                  const estado = ESTADO_CXP[c.estado as EstadoCxp]
                  return (
                    <FilaLista
                      key={c.id}
                      principal={c.proveedor}
                      secundario={`${c.folio_factura ?? 'sin folio'} · vence ${fecha(c.vencimiento)}`}
                      derecha={
                        <>
                          <span className="text-[15px] font-bold tabular-nums">{pesos(c.saldo)}</span>
                          <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
                        </>
                      }
                      accion={<BotonPagoMovil cuenta={c} />}
                    />
                  )
                })}
              </SeccionMes>
            ))}
            </MesesPlegables>
          </Tarjeta>
        </div>
      )}

      <nav className="mb-4 hidden flex-wrap items-center gap-2 lg:flex">
        {VISTAS.map((v) => (
          <Link
            key={v.clave}
            href={`/admin/cuentas-por-pagar?t=${v.clave}${proveedor ? `&proveedor=${proveedor}` : ''}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              vista === v.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {v.titulo}
          </Link>
        ))}
        {proveedor && (
          <Link
            href={`/admin/cuentas-por-pagar?t=${vista}`}
            className="rounded-lg px-3 py-2 text-sm font-medium text-tinta-500 hover:bg-tinta-100"
          >
            Quitar filtro de proveedor
          </Link>
        )}
      </nav>

      <TablaCxp
        plegados={plegados}
        grupos={meses.map((g) => ({
          mes: g.mes,
          etiqueta: etiquetaVence(g),
          detalle: detalleMes(g),
          filas: g.filas,
        }))}
        proveedores={proveedores ?? []}
        porProveedor={dashboard ?? []}
        vista={vista}
        totalFilas={filas.length}
        saldoVisible={filas.reduce((s, c) => s + Number(c.saldo), 0)}
        sinDatos={todas.length === 0}
        error={Boolean(error)}
      />
    </>
  )
}
