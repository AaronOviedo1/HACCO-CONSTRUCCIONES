import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, pesos, pesosCortos } from '@/lib/format'
import {
  ESTADO_PAGO_FIJO, METODO_PAGO, etiquetaMes, etiquetaQuincena, mesActual, quincenaDe, quincenasDelMes,
  rangoMes,
} from '@/lib/finanzas'
import { EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tarjeta } from '@/components/ui'
import {
  AccionesPagoFijo, AsegurarQuincenas, BarraPagosFijos,
} from '@/components/finanzas/pagos-fijos'
import { CatalogoProgramados } from '@/components/finanzas/pagos-programados'
import type { EstadoPagoFijo } from '@/types/database'

export const dynamic = 'force-dynamic'

const PESTANAS = [
  { clave: 'quincenas', titulo: 'Quincenas' },
  { clave: 'catalogo', titulo: 'Personal y servicios' },
] as const

export default async function PaginaPagosFijos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; t?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { mes = mesActual(), t } = await searchParams
  const activa = PESTANAS.find((p) => p.clave === t)?.clave ?? 'quincenas'
  const quincenas = quincenasDelMes(mes)

  const supabase = await crearClienteServidor()
  /*
   * Se pide el mes entero y no los dos días de quincena.
   * No todo pago fijo cae en quincena —la nómina de dirección se paga sin
   * fecha fija—, y preguntando sólo por el 15 y el fin de mes esos pagos se
   * volvían invisibles aquí, aunque siguieran contando en Reportes. Así se
   * habían perdido de vista seis. Cada uno se acomoda abajo en la quincena que
   * le toca, con su fecha a la vista: no hay nada que corregir, sólo que ver.
   */
  const { desde, hasta } = rangoMes(mes)
  const { data } = await supabase
    .from('pagos_fijos')
    .select('*')
    .gte('quincena', desde)
    .lt('quincena', hasta)
    .order('categoria')
    .order('beneficiario')

  const { data: catalogo } = await supabase
    .from('v_pagos_programados')
    .select('*')
    .order('tipo')
    .order('beneficiario')

  const { data: personal } = await supabase
    .from('profiles')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  const pagos = data ?? []
  const programados = catalogo ?? []

  /*
   * Sólo el mes en curso se arma solo, y sólo si le falta alguna quincena. Los
   * meses viejos se quedan como quedaron —el pasado no se reescribe— y los de
   * más adelante esperan a que alguien apriete «Generar», que para eso está.
   */
  const faltantes = quincenas.filter((q) => !pagos.some((p) => p.quincena === q))
  const armarSolo =
    mes === mesActual() && faltantes.length > 0 && programados.some((p) => p.activo)
  const total = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const pagado = pagos.filter((p) => p.estado === 'pagado').reduce((s, p) => s + Number(p.monto), 0)
  const pendiente = total - pagado

  // Resumen del mes por categoría, como lo revisan hoy.
  const porCategoria = new Map<string, { total: number; pagado: number }>()
  for (const p of pagos) {
    const previo = porCategoria.get(p.categoria) ?? { total: 0, pagado: 0 }
    porCategoria.set(p.categoria, {
      total: previo.total + Number(p.monto),
      pagado: previo.pagado + (p.estado === 'pagado' ? Number(p.monto) : 0),
    })
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Pagos fijos"
        descripcion="Nómina administrativa y servicios. Es distinto de la nómina de oficiales por avance."
      />

      <nav className="mb-5 flex flex-wrap gap-1.5">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/admin/pagos-fijos?t=${p.clave}&mes=${mes}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              activa === p.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {p.titulo}
          </Link>
        ))}
      </nav>

      {activa === 'catalogo' ? (
        <CatalogoProgramados programados={programados} trabajadores={personal ?? []} />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador etiqueta={`Total ${etiquetaMes(mes)}`} valor={pesos(total)} nota={`${pagos.length} pagos`} />
            <Indicador etiqueta="Pagado" valor={pesosCortos(pagado)} tono="verde" />
            <Indicador
              etiqueta="Pendiente"
              valor={pesosCortos(pendiente)}
              tono={pendiente > 0 ? 'ambar' : 'neutro'}
            />
            <Indicador
              etiqueta="De la lista"
              valor={String(pagos.filter((p) => p.programado_id).length)}
              nota="salen de personal y servicios"
            />
          </div>

          {armarSolo && <AsegurarQuincenas quincenas={faltantes} />}
          <BarraPagosFijos mes={mes} quincenas={quincenas} />

          {/* Los `min-w-0`: sin ellos, un renglón largo estiraba la columna del
              grid —que por omisión no baja de su contenido— y con ella la página
              entera. En el teléfono eso dejaba la palomita y el botón de editar
              fuera de la pantalla, a la derecha, y había que arrastrar de lado
              para llegarles. De ahí venía el «no me deja editar». */}
          <div className="grid gap-4 xl:grid-cols-4">
            <div className="min-w-0 space-y-4 xl:col-span-3">
              {quincenas.map((quincena) => {
                const deLaQuincena = pagos.filter((p) => quincenaDe(p.quincena) === quincena)
                const totalQ = deLaQuincena.reduce((s, p) => s + Number(p.monto), 0)
                const pagadoQ = deLaQuincena
                  .filter((p) => p.estado === 'pagado')
                  .reduce((s, p) => s + Number(p.monto), 0)

                return (
                  <Tarjeta
                    key={quincena}
                    titulo={
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {etiquetaQuincena(quincena)} · {fecha(quincena)}
                        </span>
                        <span className="text-xs font-normal text-tinta-500">
                          Pagado {pesos(pagadoQ)} de {pesos(totalQ)}
                        </span>
                      </span>
                    }
                  >
                    {deLaQuincena.length === 0 ? (
                      <EstadoVacio
                        titulo="Sin pagos capturados"
                        descripcion="Usa «Generar quincena» para traer los recurrentes de la anterior."
                      />
                    ) : (
                      <ul className="divide-y divide-tinta-100">
                        {deLaQuincena.map((p) => (
                          <li
                            key={p.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 lg:gap-3 lg:py-2.5"
                          >
                            {/* En el teléfono el beneficiario se queda con el
                                primer renglón entero: compartiéndolo se aplastaba
                                a media palabra. */}
                            <div className="min-w-0 flex-1 basis-full lg:basis-auto">
                              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-tinta-900">
                                {p.beneficiario}
                                <Etiqueta tono="gris">{p.categoria}</Etiqueta>
                                {p.recurrente && <Etiqueta tono="azul">recurrente</Etiqueta>}
                                {p.quincena !== quincena && (
                                  <Etiqueta tono="gris">{fecha(p.quincena)}</Etiqueta>
                                )}
                              </p>
                              {(p.descripcion || p.notas) && (
                                <p className="mt-0.5 truncate text-xs text-tinta-500">
                                  {p.descripcion}
                                  {p.descripcion && p.notas ? ' · ' : ''}
                                  {p.notas}
                                </p>
                              )}
                            </div>

                            <span className="text-xs text-tinta-500">{METODO_PAGO[p.metodo]}</span>
                            <span className="ml-auto font-medium tabular-nums text-tinta-900 lg:ml-0 lg:w-24 lg:text-right">
                              {pesos(p.monto)}
                            </span>
                            <Etiqueta tono={ESTADO_PAGO_FIJO[p.estado as EstadoPagoFijo].tono}>
                              {ESTADO_PAGO_FIJO[p.estado as EstadoPagoFijo].texto}
                            </Etiqueta>
                            <AccionesPagoFijo pago={p} quincenas={quincenas} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Tarjeta>
                )
              })}
            </div>

            <Tarjeta
              titulo="Resumen del mes"
              pie="Por categoría, como lo revisa el contador."
              className="min-w-0"
            >
              {porCategoria.size === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-tinta-500">Sin movimientos.</p>
              ) : (
                <ul className="divide-y divide-tinta-100">
                  {[...porCategoria.entries()]
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([categoria, montos]) => (
                      <li key={categoria} className="px-4 py-2.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-tinta-600">{categoria}</span>
                          <span className="font-medium tabular-nums text-tinta-900">
                            {pesos(montos.total)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tinta-100">
                          <div
                            className="h-full rounded-full bg-haaco-500"
                            style={{
                              width: `${montos.total > 0 ? (montos.pagado / montos.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-tinta-400">
                          {pesos(montos.pagado)} pagado
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </Tarjeta>
          </div>
        </>
      )}
    </>
  )
}
