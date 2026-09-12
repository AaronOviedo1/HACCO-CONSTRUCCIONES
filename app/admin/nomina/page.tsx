import Link from 'next/link'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, hoyHermosillo, pesos, pesosCortos, porcentaje } from '@/lib/format'
import { agruparPorMes, mesActual, rangoMes, semanaDe } from '@/lib/finanzas'
import { mesesPlegados } from '@/lib/meses-plegados'
import { ESTATUS_OBRA } from '@/lib/obras'
import {
  EncabezadoPagina, EstadoVacio, Etiqueta, Indicador, Tabla, Tarjeta, Td, Th,
} from '@/components/ui'
import { CuerpoMes, MesesPlegables } from '@/components/meses'
import { BotonEditarPrestamo, PanelNomina } from '@/components/finanzas/nomina'
import { EnviarRecibo } from '@/components/finanzas/enviar-recibo'
import { BotonEditarRecibo } from '@/components/finanzas/editar-recibo'
import { PanelRayas } from '@/components/finanzas/rayas'
import { ChipsFiltro } from '@/components/movil/piezas'
import { FiltroMes } from '@/components/filtro-fechas'
import type { EstatusObra } from '@/types/database'

export const dynamic = 'force-dynamic'

export default async function PaginaNomina({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; t?: string; saldados?: string; semana?: string }>
}) {
  await requerirRol(['admin', 'administracion'])
  const { mes = mesActual(), t, saldados, semana: semanaUrl } = await searchParams
  const vista =
    t === 'prenomina' ? 'prenomina'
    : t === 'prestamos' ? 'prestamos'
    : t === 'rayas' ? 'rayas'
    : 'mensual'
  const verSaldados = saldados === '1'
  const { desde, hasta } = rangoMes(mes)
  // La semana que se está viendo: la de la URL, o la de hoy en Hermosillo. Con
  // `new Date()` en el servidor, que corre en UTC, el domingo a partir de las
  // cinco de la tarde ya enseñaba la semana siguiente.
  const semana = semanaUrl && /^\d{4}-\d{2}-\d{2}$/.test(semanaUrl)
    ? semanaDe(semanaUrl)
    : semanaDe(hoyHermosillo())

  const supabase = await crearClienteServidor()

  const [
    { data: contratos }, { data: prenomina }, { data: pagos }, { data: deducciones },
    { data: recibos }, { data: gente }, { data: rayas }, { data: sueldos }, { data: obrasVivas },
  ] = await Promise.all([
    supabase.from('v_nomina_contratos').select('*').order('trabajador'),
    supabase.from('v_prenomina').select('*').order('trabajador'),
    supabase.from('nomina_pagos').select('*').gte('fecha', desde).lt('fecha', hasta).order('fecha'),
    supabase.from('deducciones').select('*').order('fecha', { ascending: false }),
    supabase
      .from('recibos_nomina')
      .select('*')
      .gte('fecha', desde)
      .lt('fecha', hasta)
      .order('fecha', { ascending: false }),
    // El teléfono no viaja en las vistas de nómina y mandar el recibo por
    // WhatsApp lo necesita. Sale más barato traerlo aparte que recrear
    // v_nomina_contratos y v_prenomina, que van encadenadas.
    supabase.from('profiles').select('id, nombre, telefono'),
    /*
     * Las rayas no se piden por mes. Se filtraban por el mes que se estaba
     * viendo, y eso escondía justo la que importa: una semana de agosto que no
     * se pagó ya no salía en «Pagar nómina» al pasar a septiembre, aunque la
     * prenómina la seguía contando como deuda. Se piden la semana que se está
     * viendo y todas las que tienen saldo, sin importar de cuándo sean; las que
     * ya se pagaron y cuelgan de un recibo del mes se completan abajo.
     */
    supabase
      .from('v_rayas_semanales')
      .select('*')
      .or(`semana.eq.${semana},por_pagar.gt.0`)
      .order('semana', { ascending: false }),
    supabase.from('sueldos_semanales').select('*').eq('activo', true),
    supabase
      .from('obras')
      .select('id, nombre, ot_numero')
      .not('estatus', 'in', '(cerrada,terminada)')
      .order('nombre'),
  ])

  // Los recibos del mes nombran sus renglones de raya por la semana, y una
  // semana ya saldada no viene en la consulta de arriba.
  const rayasVistas = new Set((rayas ?? []).map((r) => r.raya_id))
  const faltanDeRecibos = [
    ...new Set((pagos ?? []).map((p) => p.raya_id).filter((id): id is string => Boolean(id))),
  ].filter((id) => !rayasVistas.has(id))
  const { data: rayasDeRecibos } = faltanDeRecibos.length
    ? await supabase.from('v_rayas_semanales').select('*').in('raya_id', faltanDeRecibos)
    : { data: [] }

  const listaRayas = [...(rayas ?? []), ...(rayasDeRecibos ?? [])].filter(
    (r) => r.estatus !== 'cancelada',
  )
  const telefonos = new Map((gente ?? []).map((p) => [p.id, p.telefono]))
  const nombres = new Map((gente ?? []).map((p) => [p.id, p.nombre]))

  // Un contrato pagado por completo ya no es trabajo pendiente, aunque su OT
  // siga abierta: se sale de la lista y se consulta con el chip. El criterio es
  // el saldo, no un estatus nuevo — si el contrato sube de monto, vuelve solo.
  const activos = (contratos ?? []).filter((c) => c.estatus === 'activo')
  const saldadosDelMes = activos.filter((c) => Number(c.por_pagar) <= 0)
  const filas = verSaldados ? saldadosDelMes : activos.filter((c) => Number(c.por_pagar) > 0)
  const pagosDelMes = pagos ?? []

  // Fechas distintas con pago: son las columnas de abono del Excel.
  const fechasPago = [...new Set(pagosDelMes.map((p) => p.fecha))].sort()
  const pagosPorContratoFecha = new Map<string, number>()
  for (const p of pagosDelMes) {
    const clave = `${p.contrato_id}|${p.fecha}`
    pagosPorContratoFecha.set(clave, (pagosPorContratoFecha.get(clave) ?? 0) + Number(p.monto))
  }

  // Los indicadores van sobre todos los contratos activos, no sobre lo que se
  // está viendo: la mano de obra contratada del mes no encoge porque un
  // contrato se haya terminado de pagar.
  const totalMO = activos.reduce((s, c) => s + Number(c.mano_obra), 0)
  const totalRetencion = activos.reduce((s, c) => s + Number(c.retencion_haaco), 0)

  /*
   * Estos tres salen de la prenómina y no de los contratos, porque la prenómina
   * es la que ya suma los dos motores. Desde que hay raya semanal, alguien
   * puede tener dinero por cobrar sin un solo contrato de por medio: contando
   * nada más contratos, «se puede pagar hoy» se quedaba corto por el monto
   * exacto de las rayas de la semana, que es justo el número que se mira el
   * sábado para saber cuánto sacar de la caja. La mano de obra contratada sí se
   * queda con los contratos: un sueldo no se contrata por metro.
   */
  const totalPagado = (prenomina ?? []).reduce((s, p) => s + Number(p.pagado), 0)
  const totalDisponible = (prenomina ?? []).reduce((s, p) => s + Number(p.disponible), 0)
  // Lo que se le sigue debiendo a la cuadrilla por lo ya comprometido, sin
  // importar el avance: es la deuda completa, no lo que toca pagar hoy.
  const totalPorPagar = (prenomina ?? []).reduce((s, p) => s + Number(p.pendiente), 0)

  // Lo que de verdad sale de la caja esta semana: devengado menos préstamos.
  const aPagarSemana = (prenomina ?? []).reduce(
    (s, p) => s + Math.max(0, Number(p.disponible) - Number(p.deducciones)),
    0,
  )

  // Los préstamos traen todo el historial: se separan por mes para leerlos.
  const mesesDeducciones = agruparPorMes(deducciones ?? [], (d) => d.fecha)
  const plegados = await mesesPlegados('prestamos', mesesDeducciones.map((g) => g.mes))

  return (
    <>
      <EncabezadoPagina
        titulo="Nómina"
        descripcion="Por avance de obra o por raya semanal. Lo devengado por contrato es el total por el porcentaje reportado; la raya se devenga completa cada semana."
      />

      {/* Teléfono: lo que se puede pagar hoy, trabajador por trabajador ---- */}
      {(prenomina ?? []).length > 0 && (
        <div className="mb-3.5 lg:hidden">
          <div className="rounded-[20px] bg-linear-[155deg,var(--color-haaco-700),var(--color-haaco-800)] p-4.5 text-white">
            <div className="text-[11px] uppercase tracking-[0.09em] opacity-80">
              A pagar esta semana
            </div>
            <div className="mt-1 text-3xl font-bold -tracking-[1px] tabular-nums">
              {pesosCortos(aPagarSemana)}
            </div>
            <div className="mt-1 text-xs opacity-80">avance y raya de la semana, menos préstamos</div>
          </div>

          <Tarjeta className="mt-3.5">
            <div className="px-3.5 py-4">
              <div className="mb-3.5 flex gap-3.5">
                <span className="flex items-center gap-1.5 text-[11px] text-tinta-600">
                  <span className="h-2 w-3 rounded-sm bg-haaco-700" aria-hidden />A pagar
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-tinta-600">
                  <span className="h-2 w-3 rounded-sm bg-amber-600" aria-hidden />
                  Deducciones
                </span>
              </div>

              <ul className="flex flex-col gap-3.5">
                {(prenomina ?? []).map((p) => {
                  const aPagar = Math.max(0, Number(p.disponible) - Number(p.deducciones))
                  const tope = Math.max(1, ...(prenomina ?? []).map((x) => Number(x.disponible)))
                  const semanas = Number(p.semanas_por_pagar)
                  const obras = Number(p.contratos_activos)
                  return (
                    <li key={p.trabajador_id}>
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-sm font-medium">{p.trabajador}</span>
                        <span className="text-sm font-bold tabular-nums text-haaco-600">
                          {pesosCortos(aPagar)}
                        </span>
                      </div>
                      <div className="flex h-2.5 overflow-hidden rounded-full bg-tinta-100" aria-hidden>
                        <div className="h-full bg-haaco-700" style={{ width: `${(aPagar / tope) * 100}%` }} />
                        <div
                          className="h-full bg-amber-600"
                          style={{ width: `${(Number(p.deducciones) / tope) * 100}%` }}
                        />
                      </div>
                      {/* Obras y semanas por separado: decirle «9 obras» a quien
                          tiene ocho contratos y una semana de raya no es cierto
                          de ninguna de las dos formas. */}
                      <p className="mt-1 text-[11px] text-tinta-400">
                        {obras > 0 && `${obras} ${obras === 1 ? 'obra' : 'obras'} · `}
                        {semanas > 0 && `${semanas} ${semanas === 1 ? 'semana' : 'semanas'} · `}
                        pendiente {pesosCortos(p.pendiente)}
                        {Number(p.deducciones) > 0 && ` · ${pesosCortos(p.deducciones)} en préstamos`}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          </Tarjeta>
        </div>
      )}

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:mb-5 lg:grid-cols-4 lg:gap-3">
        <Indicador
          etiqueta="Mano de obra contratada"
          valor={pesosCortos(totalMO)}
          nota={`${activos.length} contratos · retención ${pesosCortos(totalRetencion)}`}
        />
        <Indicador etiqueta="Pagado" valor={pesosCortos(totalPagado)} tono="verde" />
        <Indicador
          etiqueta="Por pagar"
          valor={pesosCortos(totalPorPagar)}
          nota="lo que falta de contratos y rayas"
          tono={totalPorPagar > 0 ? 'ambar' : 'neutro'}
        />
        <Indicador
          etiqueta="Se puede pagar hoy"
          valor={pesosCortos(totalDisponible)}
          nota="devengado menos lo abonado"
          tono={totalDisponible > 0 ? 'ambar' : 'neutro'}
          className="hidden lg:block"
        />
      </div>

      {/* Los saldados no se pierden: se apartan. Cualquier pago adicional a uno
          de ellos sale del contrato, así que se consultan aparte. */}
      {vista === 'mensual' && saldadosDelMes.length > 0 && (
        <ChipsFiltro
          className="mb-4"
          opciones={[
            {
              titulo: `Por pagar (${activos.length - saldadosDelMes.length})`,
              href: `/admin/nomina?t=mensual&mes=${mes}`,
              activo: !verSaldados,
            },
            {
              titulo: `Saldados (${saldadosDelMes.length})`,
              href: `/admin/nomina?t=mensual&mes=${mes}&saldados=1`,
              activo: verSaldados,
            },
          ]}
        />
      )}

      <nav className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { clave: 'mensual', titulo: 'Vista mensual' },
          { clave: 'prenomina', titulo: 'Prenómina' },
          { clave: 'rayas', titulo: 'Raya semanal' },
          { clave: 'prestamos', titulo: 'Préstamos y adelantos' },
        ].map((p) => (
          <Link
            key={p.clave}
            href={`/admin/nomina?t=${p.clave}&mes=${mes}`}
            className={`hidden rounded-lg px-3 py-2 text-sm font-medium transition lg:block ${
              vista === p.clave
                ? 'bg-haaco-700 text-white'
                : 'border border-tinta-200 bg-white text-tinta-600 hover:bg-tinta-50'
            }`}
          >
            {p.titulo}
          </Link>
        ))}
        <FiltroMes mes={mes} titulo="Mes de la nómina" />
        <PanelNomina
          contratos={activos}
          rayas={listaRayas}
          prenomina={prenomina ?? []}
          deducciones={deducciones ?? []}
          mes={mes}
        />
      </nav>

      {/* La raya semanal va aparte: no depende de que haya contratos por
          avance. Un pintor puede estar a puro sueldo y no tener ninguno. */}
      {vista === 'rayas' ? (
        <PanelRayas
          rayas={listaRayas}
          sueldos={sueldos ?? []}
          gente={gente ?? []}
          obras={obrasVivas ?? []}
          semana={semana}
        />
      ) : (
      <>
      {/* El chip de saldados sólo recorta la vista mensual: la prenómina y los
          préstamos siguen viéndose completos. */}
      {(vista === 'mensual' ? filas.length : activos.length) === 0 ? (
        <Tarjeta>
          {activos.length > 0 && !verSaldados ? (
            <EstadoVacio
              titulo="No queda nada por pagar"
              descripcion={`Los ${activos.length} contratos activos están pagados por completo. Se consultan en «Saldados».`}
              accion={
                <Link
                  href={`/admin/nomina?t=mensual&mes=${mes}&saldados=1`}
                  className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
                >
                  Ver saldados
                </Link>
              }
            />
          ) : (
            <EstadoVacio
              titulo="Sin contratos activos"
              descripcion="Los contratos de mano de obra se crean desde la pestaña Contratos de cada obra."
              accion={
                <Link
                  href="/admin/obras"
                  className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
                >
                  Ir a obras
                </Link>
              }
            />
          )}
        </Tarjeta>
      ) : vista === 'mensual' ? (
        <Tarjeta
          className="hidden lg:block"
          pie={
            verSaldados
              ? 'Contratos pagados por completo. Su OT puede seguir abierta; cualquier pago adicional sale del contrato.'
              : 'Una fila por trabajador y obra, con una columna por cada fecha en que se pagó.'
          }
        >
          <Tabla>
            <thead>
              <tr>
                <Th>Inicio</Th>
                <Th>Trabajador</Th>
                <Th>Obra</Th>
                <Th numerico>M.O.</Th>
                <Th numerico>C. Haaco</Th>
                <Th numerico>Total</Th>
                <Th numerico>Avance</Th>
                <Th numerico>Devengado</Th>
                {fechasPago.map((f) => (
                  <Th key={f} numerico>{fecha(f)}</Th>
                ))}
                <Th numerico>Pagado</Th>
                <Th numerico>Por pagar</Th>
                <Th numerico>%</Th>
              </tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <tr key={c.contrato_id} className="hover:bg-tinta-50/60">
                  <Td className="whitespace-nowrap text-tinta-500">{fecha(c.fecha_inicia)}</Td>
                  <Td className="font-medium text-tinta-900">
                    <span className="flex items-center gap-1.5">
                      {c.trabajador}
                      {c.es_externo && <Etiqueta tono="ambar">externo</Etiqueta>}
                    </span>
                  </Td>
                  <Td>
                    <Link href={`/admin/obras/${c.obra_id}`} className="text-tinta-700 hover:text-haaco-700">
                      {c.obra}
                    </Link>
                    <Etiqueta tono={ESTATUS_OBRA[c.estatus_obra as EstatusObra].tono}>
                      {ESTATUS_OBRA[c.estatus_obra as EstatusObra].texto}
                    </Etiqueta>
                  </Td>
                  <Td numerico>{pesos(c.mano_obra)}</Td>
                  <Td numerico className="text-tinta-500">
                    {Number(c.costo_haaco_pct) > 0 ? `- ${pesos(c.retencion_haaco)}` : '—'}
                  </Td>
                  <Td numerico className="font-medium">{pesos(c.total)}</Td>
                  <Td numerico className="text-tinta-500">{Number(c.avance_pct)}%</Td>
                  <Td numerico>{pesos(c.devengado)}</Td>
                  {fechasPago.map((f) => {
                    const monto = pagosPorContratoFecha.get(`${c.contrato_id}|${f}`)
                    return (
                      <Td key={f} numerico className={monto ? '' : 'text-tinta-300'}>
                        {monto ? pesos(monto) : '—'}
                      </Td>
                    )
                  })}
                  <Td numerico className="font-medium text-haaco-700">{pesos(c.pagado)}</Td>
                  <Td numerico className={Number(c.por_pagar) > 0 ? 'text-amber-700' : ''}>
                    {pesos(c.por_pagar)}
                  </Td>
                  <Td numerico>
                    <Etiqueta tono={Number(c.pct_pagado) >= 100 ? 'verde' : 'gris'}>
                      {porcentaje(c.pct_pagado, 0)}
                    </Etiqueta>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : vista === 'prenomina' ? (
        <Tarjeta
          className="hidden lg:block"
          titulo="Prenómina concentrada"
          pie="Un renglón por trabajador con todo lo que trae abierto en todas sus obras."
        >
          <Tabla>
            <thead>
              <tr>
                <Th>Trabajador</Th>
                <Th numerico>Obras</Th>
                <Th numerico>Total M.O.</Th>
                <Th numerico>Devengado</Th>
                <Th numerico>Pagado</Th>
                <Th numerico>% pagado</Th>
                <Th numerico>Pendiente</Th>
                <Th numerico>Deducciones</Th>
                <Th numerico>A pagar hoy</Th>
                <Th>Último pago</Th>
              </tr>
            </thead>
            <tbody>
              {(prenomina ?? []).map((p) => {
                const aPagar = Math.max(0, Number(p.disponible) - Number(p.deducciones))
                return (
                  <tr key={p.trabajador_id} className="hover:bg-tinta-50/60">
                    <Td className="font-medium text-tinta-900">
                      <span className="flex items-center gap-1.5">
                        {p.trabajador}
                        {p.es_externo && <Etiqueta tono="ambar">externo</Etiqueta>}
                      </span>
                    </Td>
                    <Td numerico className="text-tinta-500">{p.contratos_activos}</Td>
                    <Td numerico>{pesos(p.total_contratos)}</Td>
                    <Td numerico>{pesos(p.devengado)}</Td>
                    <Td numerico className="text-haaco-700">{pesos(p.pagado)}</Td>
                    <Td numerico>{porcentaje(p.pct_pagado, 0)}</Td>
                    <Td numerico className="text-tinta-500">{pesos(p.pendiente)}</Td>
                    <Td numerico className={Number(p.deducciones) > 0 ? 'text-red-600' : 'text-tinta-300'}>
                      {Number(p.deducciones) > 0 ? `- ${pesos(p.deducciones)}` : '—'}
                    </Td>
                    <Td numerico className="text-base font-semibold text-haaco-700">
                      {pesos(aPagar)}
                    </Td>
                    <Td className="whitespace-nowrap text-tinta-500">{fecha(p.ultimo_pago)}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Tabla>
        </Tarjeta>
      ) : (
        <Tarjeta
          className="hidden lg:block"
          titulo="Préstamos y adelantos"
          pie="Se descuentan al elegirlos en el recibo de abono. Al aplicarse quedan saldados."
        >
          {(deducciones ?? []).length === 0 ? (
            <EstadoVacio titulo="Sin préstamos registrados" />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Trabajador</Th>
                  <Th>Tipo</Th>
                  <Th numerico>Monto</Th>
                  <Th>Estado</Th>
                  <Th>Notas</Th>
                </tr>
              </thead>
              <MesesPlegables lista="prestamos" plegados={plegados}>
                {mesesDeducciones.map((grupo) => (
                  <CuerpoMes
                    key={grupo.mes}
                    mes={grupo.mes}
                    columnas={6}
                    etiqueta={grupo.etiqueta}
                    detalle={`${grupo.filas.length} · ${pesos(grupo.filas.reduce((s, d) => s + Number(d.monto), 0))}`}
                  >
                    {grupo.filas.map((d) => (
                        <tr key={d.id} className="hover:bg-tinta-50/60">
                          <Td className="whitespace-nowrap text-tinta-500">{fecha(d.fecha)}</Td>
                          {/* Del perfil: un préstamo sobrevive a sus contratos. */}
                          <Td className="font-medium text-tinta-900">{nombres.get(d.trabajador_id) ?? '—'}</Td>
                          <Td className="capitalize text-tinta-600">{d.tipo}</Td>
                          <Td numerico className="font-medium">{pesos(d.monto)}</Td>
                          <Td>
                            <Etiqueta tono={d.saldado ? 'verde' : 'ambar'}>
                              {d.saldado ? 'Saldado' : 'Pendiente'}
                            </Etiqueta>
                          </Td>
                          <Td className="text-tinta-500">
                            <span className="flex items-center justify-between gap-2">
                              {d.notas ?? '—'}
                              <BotonEditarPrestamo deduccion={d} prenomina={prenomina ?? []} />
                            </span>
                          </Td>
                        </tr>
                    ))}
                  </CuerpoMes>
                ))}
              </MesesPlegables>
            </Tabla>
          )}
        </Tarjeta>
      )}

      {(recibos ?? []).length > 0 && (
        <Tarjeta titulo="Recibos de abono del mes" className="mt-4">
          <ul className="divide-y divide-tinta-100">
            {(recibos ?? []).map((r) => {
              // Por el perfil y no por la prenómina: a un trabajador cuyos
              // contratos ya se cerraron se le sigue pudiendo mandar su recibo.
              const trabajador = nombres.get(r.trabajador_id) ?? '—'
              const cancelado = Boolean(r.cancelado_en)
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`font-mono text-xs ${cancelado ? 'text-tinta-400 line-through' : 'text-haaco-700'}`}>
                      {r.folio}
                    </span>
                    <span className={`font-medium ${cancelado ? 'text-tinta-400' : 'text-tinta-900'}`}>
                      {trabajador}
                    </span>
                    <span className="text-xs text-tinta-400">{fecha(r.fecha)}</span>
                    {cancelado && (
                      <>
                        <Etiqueta tono="rojo">Cancelado</Etiqueta>
                        {r.motivo_cancelacion && (
                          <span className="text-xs text-tinta-400">{r.motivo_cancelacion}</span>
                        )}
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    {!cancelado && Number(r.deducciones) > 0 && (
                      <span className="text-xs text-red-600">- {pesos(r.deducciones)}</span>
                    )}
                    <span
                      className={`font-medium tabular-nums ${cancelado ? 'text-tinta-400 line-through' : 'text-tinta-900'}`}
                    >
                      {pesos(r.total)}
                    </span>
                    {!cancelado && (
                      <>
                        <BotonEditarRecibo
                          rayas={listaRayas}
                          recibo={r}
                          pagos={pagosDelMes.filter((p) => p.recibo_id === r.id)}
                          contratos={contratos ?? []}
                          trabajador={trabajador}
                        />
                        <EnviarRecibo
                          reciboId={r.id}
                          folio={r.folio}
                          trabajador={trabajador}
                          telefono={telefonos.get(r.trabajador_id) ?? null}
                          total={Number(r.total)}
                        />
                      </>
                    )}
                    <a
                      href={`/api/recibos-nomina/${r.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      className="rounded-lg border border-tinta-300 bg-white px-2.5 py-1 text-xs font-medium text-tinta-700 hover:bg-tinta-50"
                    >
                      Recibo
                    </a>
                  </span>
                </li>
              )
            })}
          </ul>
        </Tarjeta>
      )}
      </>
      )}
    </>
  )
}
