import Link from 'next/link'
import { Plus } from 'lucide-react'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, horaCorta, hoyHermosillo, pesos, pesosCortos } from '@/lib/format'
import { agruparPorMes, mesActual, rangoDeUrl } from '@/lib/finanzas'
import { mesesPlegados } from '@/lib/meses-plegados'
import { TIPO_SERVICIO, comoCobranza, etapaServicio, serviciosCobrables } from '@/lib/servicios'
import { resumenCobranza } from '@/lib/cobranza'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, FilaEnlace, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { CuerpoMes, MesesPlegables, SeccionMes } from '@/components/meses'
import { BuscadorTabla } from '@/components/buscador'
import { BotonGrande, ChipsFiltro } from '@/components/movil/piezas'
import { FolioAbriendo, PuntoAbriendo } from '@/components/enlace-abriendo'
import { FiltroRango } from '@/components/filtro-fechas'
import type { EstatusServicio, TipoServicio, VServicio } from '@/types/database'

export const dynamic = 'force-dynamic'

type Filtros = {
  estatus?: string
  tipo?: string
  q?: string
  desde?: string
  hasta?: string
  v?: string
}

/**
 * Lo que sigue vivo: todo lo que no se cerró ni se cayó. Es la lectura de
 * diario —qué visitas hay, qué presupuestos esperan respuesta, qué falta
 * cobrar—, y los meses la estorban porque una reparación de julio sin cobrar
 * queda enterrada tres bloques arriba.
 */
const ABIERTOS: EstatusServicio[] = ['agendado', 'diagnostico', 'presupuestado', 'aprobado']

/**
 * Abierto es lo que todavía pide algo: trabajo por hacer o dinero por cobrar.
 * Un rechazado con la visita sin pagar entra: el «no» del cliente cierra el
 * trabajo, no la cuenta.
 */
const sigueAbierto = (s: VServicio) =>
  ABIERTOS.includes(s.estatus) ||
  ((s.estatus === 'reparado' || s.estatus === 'rechazado') && Number(s.saldo) > 0)

export default async function PaginaServicios({
  searchParams,
}: {
  searchParams: Promise<Filtros>
}) {
  await requerirRol(['admin', 'administracion'])
  const filtros = await searchParams
  const historico = filtros.v === 'historico'
  const hoy = hoyHermosillo()
  const mes = mesActual()

  const supabase = await crearClienteServidor()

  let consulta = supabase
    .from('v_servicios')
    .select('*')
    .order('fecha_visita', { ascending: !historico })

  if (filtros.estatus) consulta = consulta.eq('estatus', filtros.estatus as EstatusServicio)
  if (filtros.tipo) consulta = consulta.eq('tipo', filtros.tipo as TipoServicio)

  // Sin fechas en la URL se ven todos: aquí el periodo es opcional.
  const periodo = rangoDeUrl(filtros, { porDefecto: 'todo' })
  if (periodo.desde) consulta = consulta.gte('fecha_visita', periodo.desde)
  if (periodo.hasta) consulta = consulta.lt('fecha_visita', periodo.hasta)

  const [{ data }, { data: pagos }] = await Promise.all([
    consulta,
    supabase.from('servicio_pagos').select('monto, fecha'),
  ])

  const todos = data ?? []

  let filas = todos
  // Un estatus elegido a mano manda sobre el recorte de la vista.
  if (!filtros.estatus && !filtros.tipo && !historico) {
    filas = filas.filter(sigueAbierto)
  }

  if (filtros.q?.trim()) {
    const busqueda = filtros.q.trim().toLowerCase()
    filas = filas.filter((s) =>
      `${s.folio ?? ''} ${s.cliente} ${s.descripcion} ${s.domicilio ?? ''} ${s.tecnico ?? ''}`
        .toLowerCase()
        .includes(busqueda),
    )
  }

  // Los cuatro números de arriba se sacan de todo lo capturado, no de lo que
  // el filtro deja ver: si no, buscar un cliente cambiaría el «por cobrar».
  const citasHoy = todos.filter((s) => s.estatus === 'agendado' && s.fecha_visita <= hoy)
  const esperandoRespuesta = todos.filter((s) => s.estatus === 'presupuestado')
  const { porCobrar } = resumenCobranza(serviciosCobrables(todos).map(comoCobranza))
  const cobradoMes = (pagos ?? [])
    .filter((p) => String(p.fecha).startsWith(mes))
    .reduce((suma, p) => suma + Number(p.monto), 0)

  const meses = agruparPorMes(filas, (s: VServicio) => s.fecha_visita)
  const plegados = await mesesPlegados(
    'servicios',
    meses.map((g) => g.mes),
  )

  /** Cambia de vista sin perder lo que se está buscando. */
  const enlace = (parche: Partial<Filtros>) => {
    const params = new URLSearchParams()
    const junto = { ...filtros, ...parche }
    for (const [clave, valor] of Object.entries(junto)) {
      if (valor) params.set(clave, String(valor))
    }
    const cadena = params.toString()
    return cadena ? `/admin/servicios?${cadena}` : '/admin/servicios'
  }

  const CHIPS = [
    {
      titulo: 'Abiertos',
      href: enlace({ estatus: '', tipo: '', v: '' }),
      activo: !filtros.estatus && !filtros.tipo && !historico,
    },
    {
      titulo: 'Citas',
      href: enlace({ estatus: 'agendado', tipo: '', v: '' }),
      activo: filtros.estatus === 'agendado',
    },
    {
      titulo: 'Por cobrar',
      href: enlace({ estatus: 'reparado', tipo: '', v: '' }),
      activo: filtros.estatus === 'reparado',
    },
    {
      titulo: 'Preventivos',
      href: enlace({ estatus: '', tipo: 'preventivo', v: 'historico' }),
      activo: filtros.tipo === 'preventivo',
    },
    {
      titulo: 'Todos',
      href: enlace({ estatus: '', tipo: '', v: 'historico' }),
      activo: historico && !filtros.estatus && !filtros.tipo,
    },
  ]

  return (
    <>
      <EncabezadoPagina
        titulo="Servicios y reparaciones"
        descripcion="Portones eléctricos: la visita, el diagnóstico, el presupuesto y el cobro."
        acciones={
          // En el teléfono no: abajo está el botón grande y el flotante, y
          // tres veces el mismo botón en una pantalla es ruido.
          <Link
            href="/admin/servicios/nuevo"
            className="hidden items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 lg:inline-flex"
          >
            <Plus size={16} />
            Agendar visita
          </Link>
        }
      />

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:mb-5 lg:grid-cols-4 lg:gap-3">
        <Indicador
          etiqueta="Visitas pendientes"
          valor={String(citasHoy.length)}
          nota="de hoy y atrasadas"
          tono={citasHoy.length > 0 ? 'ambar' : 'neutro'}
        />
        <Indicador
          etiqueta="Esperando respuesta"
          valor={String(esperandoRespuesta.length)}
          nota="presupuestos enviados"
        />
        <Indicador
          etiqueta="Por cobrar"
          valor={pesosCortos(porCobrar)}
          tono={porCobrar > 0 ? 'ambar' : 'verde'}
        />
        <Indicador etiqueta="Cobrado del mes" valor={pesosCortos(cobradoMes)} tono="verde" />
      </div>

      <div className="mb-3.5 flex flex-col gap-2.5 lg:mb-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
        <BuscadorTabla marcador="Cliente, folio, domicilio o técnico…" />
        <ChipsFiltro opciones={CHIPS} />
        <span className="hidden lg:inline-flex">
          <FiltroRango titulo="Periodo de las visitas" />
        </span>
      </div>

      {filas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            titulo={
              filtros.q || filtros.estatus
                ? 'Ningún servicio coincide'
                : historico
                  ? 'Todavía no hay servicios'
                  : 'No hay nada abierto'
            }
            descripcion={
              filtros.q
                ? 'Prueba con otra parte del nombre o del folio.'
                : historico
                  ? 'Agenda la primera visita y aquí va quedando el registro.'
                  : 'Todo lo agendado ya se cerró. En «Todos» está el historial completo.'
            }
            accion={
              <Link
                href="/admin/servicios/nuevo"
                className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
              >
                Agendar visita
              </Link>
            }
          />
        </Tarjeta>
      ) : (
        <>
          {/* Teléfono: una tarjeta por servicio ---------------------------- */}
          <div className="flex flex-col gap-3 lg:hidden">
            <MesesPlegables lista="servicios" plegados={plegados}>
              {meses.map((grupo) => (
                <SeccionMes
                  key={grupo.mes}
                  mes={grupo.mes}
                  etiqueta={grupo.etiqueta}
                  detalle={`${grupo.filas.length} ${grupo.filas.length === 1 ? 'servicio' : 'servicios'}`}
                >
                  {grupo.filas.map((s: VServicio) => {
                    const etapa = etapaServicio(s)
                    return (
                      <Link
                        key={s.servicio_id}
                        href={`/admin/servicios/${s.servicio_id}`}
                        prefetch={false}
                        className="block rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta active:bg-tinta-50"
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-[15.5px] font-semibold leading-snug -tracking-[0.2px]">
                              {s.cliente}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-tinta-400">
                              {s.descripcion}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-tinta-400">
                            <FolioAbriendo folio={s.folio} />
                          </span>
                        </span>

                        <span className="mt-3 flex items-end justify-between gap-3">
                          <span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Etiqueta tono={etapa.tono}>{etapa.texto}</Etiqueta>
                              {s.tipo === 'preventivo' && (
                                <Etiqueta tono={TIPO_SERVICIO.preventivo.tono}>
                                  {TIPO_SERVICIO.preventivo.texto}
                                </Etiqueta>
                              )}
                            </span>
                            <span className="mt-1.5 block text-xs text-tinta-500">
                              {fecha(s.fecha_visita)}
                              {s.hora_visita ? ` · ${horaCorta(s.hora_visita)}` : ''}
                              {s.tecnico ? ` · ${s.tecnico}` : ''}
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="block text-base font-bold tabular-nums">
                              {Number(s.cotizado) > 0 ? pesos(s.cotizado) : '—'}
                            </span>
                            {Number(s.saldo) > 0 && Number(s.cobrado) > 0 && (
                              <span className="block text-[11px] text-amber-700">
                                faltan {pesos(s.saldo)}
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                    )
                  })}
                </SeccionMes>
              ))}
            </MesesPlegables>

            <BotonGrande href="/admin/servicios/nuevo" icono={<Plus size={19} />}>
              Agendar visita
            </BotonGrande>
          </div>

          {/* Computadora: la tabla completa -------------------------------- */}
          <Tarjeta
            className="hidden lg:block"
            pie={
              historico
                ? `${filas.length} ${filas.length === 1 ? 'servicio' : 'servicios'}`
                : `${filas.length} ${
                    filas.length === 1 ? 'servicio abierto' : 'servicios abiertos'
                  } · en «Todos» está el historial completo`
            }
          >
            <Tabla>
              <thead>
                <tr>
                  <Th>Folio</Th>
                  <Th>Cliente</Th>
                  <Th>Servicio</Th>
                  <Th>Visita</Th>
                  <Th>Técnico</Th>
                  <Th>Estatus</Th>
                  <Th numerico>Total</Th>
                  <Th numerico>Cobrado</Th>
                  <Th numerico>Saldo</Th>
                </tr>
              </thead>
              <MesesPlegables lista="servicios" plegados={plegados}>
                {meses.map((grupo) => (
                  <CuerpoMes
                    key={grupo.mes}
                    mes={grupo.mes}
                    columnas={9}
                    etiqueta={grupo.etiqueta}
                    detalle={`${grupo.filas.length} · ${pesos(
                      grupo.filas.reduce((suma: number, s: VServicio) => suma + Number(s.cotizado), 0),
                    )}`}
                  >
                    {grupo.filas.map((s: VServicio) => {
                      const etapa = etapaServicio(s)
                      return (
                        <FilaEnlace key={s.servicio_id}>
                          <Td>
                            <Link
                              href={`/admin/servicios/${s.servicio_id}`}
                              prefetch={false}
                              data-enlace-fila
                              className="font-mono text-xs text-haaco-700 hover:underline"
                            >
                              {s.folio}
                              <PuntoAbriendo />
                            </Link>
                          </Td>
                          <Td className="font-medium text-tinta-900">{s.cliente}</Td>
                          <Td className="text-tinta-500">{s.descripcion}</Td>
                          <Td className="whitespace-nowrap text-tinta-500">
                            {fecha(s.fecha_visita)}
                            {s.hora_visita && (
                              <span className="ml-1 text-xs text-tinta-400">
                                {horaCorta(s.hora_visita)}
                              </span>
                            )}
                          </Td>
                          <Td className="text-tinta-500">{s.tecnico ?? '—'}</Td>
                          <Td>
                            <span className="flex flex-wrap items-center gap-1.5">
                              <Etiqueta tono={etapa.tono}>{etapa.texto}</Etiqueta>
                              {s.tipo === 'preventivo' && (
                                <Etiqueta tono={TIPO_SERVICIO.preventivo.tono}>
                                  {TIPO_SERVICIO.preventivo.texto}
                                </Etiqueta>
                              )}
                            </span>
                          </Td>
                          <Td numerico>{Number(s.cotizado) > 0 ? pesos(s.cotizado) : '—'}</Td>
                          <Td numerico className="text-tinta-500">
                            {Number(s.cobrado) > 0 ? pesos(s.cobrado) : '—'}
                          </Td>
                          <Td
                            numerico
                            className={
                              Number(s.saldo) > 0 ? 'font-semibold text-amber-700' : 'text-haaco-700'
                            }
                          >
                            {Number(s.cotizado) > 0 ? pesos(s.saldo) : '—'}
                          </Td>
                        </FilaEnlace>
                      )
                    })}
                  </CuerpoMes>
                ))}
              </MesesPlegables>
            </Tabla>
          </Tarjeta>
        </>
      )}
    </>
  )
}
