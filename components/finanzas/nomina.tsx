'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { HandCoins, Pencil, Wallet } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { SelectorFecha } from '@/components/filtro-fechas'
import { montoEnLetra, pesos, porcentaje } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import { METODO_PAGO_SIN_CAJA, TIPO_DEDUCCION, etiquetaSemana } from '@/lib/finanzas'
import { eliminarDeduccion, guardarDeduccion, pagarNomina } from '@/app/admin/finanzas-acciones'
import { Etiqueta } from '@/components/ui'
import type {
  Deduccion, MetodoPago, TipoDeduccion, VNominaContrato, VPrenomina, VRayaSemanal,
} from '@/types/database'

/**
 * Cómo se capturó el abono de un contrato: en pesos o en porcentaje del
 * contrato. Se guarda el texto tal cual se tecleó y el importe se deriva, para
 * que «20 %» siga diciendo 20 y no 2,000 en cuanto se toca otra cosa.
 */
type Captura = { modo: 'monto' | 'pct'; texto: string }

/**
 * Un renglón al que se le puede abonar, venga del avance de una obra o de la
 * raya de una semana. Los dos motores calculan distinto —uno por porcentaje de
 * obra y el otro por días trabajados— pero a la hora de pagar se comportan
 * igual, y con esto el diálogo, los totales y el recibo no tienen que saber de
 * cuál vienen.
 */
type Pagable = {
  /** `contrato_id` o `raya_id`, según de dónde salga. */
  clave: string
  esRaya: boolean
  titulo: string
  detalle: string
  total: number
  devengado: number
  pagado: number
  porPagar: number
  disponible: number
}

/**
 * Todo lo que se le puede abonar a alguien, venga del avance de una obra o de
 * la raya de una semana.
 *
 * Los dos motores calculan distinto —uno por porcentaje de obra y el otro por
 * días trabajados— pero a la hora de pagar se comportan igual, y con esto el
 * diálogo, los totales y el recibo no tienen que saber de cuál vienen.
 *
 * Fuera del componente porque también hace falta antes del primer render, para
 * dejar el abono ya capturado cuando el diálogo se abre desde el renglón de una
 * semana: ahí quien lo abrió ya dijo a quién le va a pagar.
 */
function pagablesDe(
  trabajadorId: string,
  contratos: VNominaContrato[],
  rayas: VRayaSemanal[],
): Pagable[] {
  return [
    ...rayas
      .filter((r) => r.trabajador_id === trabajadorId)
      .map((r) => ({
        clave: r.raya_id,
        esRaya: true,
        titulo: `Raya ${etiquetaSemana(r.semana)}`,
        detalle: `${r.dias_trabajados} de ${r.dias_base} días · ${r.obras ?? 'sin obra'}`,
        total: Number(r.total),
        devengado: Number(r.devengado),
        pagado: Number(r.pagado),
        porPagar: Number(r.por_pagar),
        disponible: Number(r.disponible),
      })),
    ...contratos
      .filter((c) => c.trabajador_id === trabajadorId)
      .map((c) => ({
        clave: c.contrato_id,
        esRaya: false,
        titulo: c.obra,
        detalle: `avance ${Number(c.avance_pct)}%`,
        total: Number(c.total),
        devengado: Number(c.devengado),
        pagado: Number(c.pagado),
        porPagar: Number(c.por_pagar),
        disponible: Number(c.disponible),
      })),
  ]
}

export function PanelNomina({
  contratos, rayas, prenomina, deducciones,
}: {
  contratos: VNominaContrato[]
  rayas: VRayaSemanal[]
  prenomina: VPrenomina[]
  deducciones: Deduccion[]
  mes: string
}) {
  const [pagando, setPagando] = useState(false)
  const [prestando, setPrestando] = useState(false)

  return (
    <div className="ml-auto flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setPrestando(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
      >
        <HandCoins size={16} />
        Registrar préstamo
      </button>
      <button
        type="button"
        onClick={() => setPagando(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
      >
        <Wallet size={16} />
        Pagar nómina
      </button>

      {pagando && (
        <DialogoPago
          contratos={contratos}
          rayas={rayas}
          prenomina={prenomina}
          deducciones={deducciones}
          onCerrar={() => setPagando(false)}
        />
      )}

      {prestando && (
        <DialogoPrestamo prenomina={prenomina} onCerrar={() => setPrestando(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
export function DialogoPago({
  contratos, rayas, prenomina, deducciones, trabajadorInicial, onCerrar,
}: {
  contratos: VNominaContrato[]
  rayas: VRayaSemanal[]
  prenomina: VPrenomina[]
  deducciones: Deduccion[]
  /**
   * A quién se le va a pagar, cuando el diálogo se abre desde su renglón. El
   * abono de lo devengado y sus préstamos vienen ya marcados: ahí el sábado son
   * dos toques —abrir y firmar— en vez de elegir de nuevo lo que ya se eligió.
   */
  trabajadorInicial?: string
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  /*
   * Lo saldado no se ofrece: lo que aparece en el diálogo es lo que todavía se
   * le debe a alguien. Se filtra aquí y no en quien lo abre, que eran las
   * mismas cuatro líneas repetidas en cada sitio de llamada.
   */
  const vivos = contratos.filter((c) => Number(c.por_pagar) > 0)
  const rayasVivas = rayas.filter((r) => Number(r.por_pagar) > 0 && r.estatus !== 'cancelada')
  const pendientes = deducciones.filter((d) => !d.saldado)
  // A quien se abrió desde su renglón se le deja aunque la prenómina no lo
  // traiga: el diálogo no puede quedarse sin la persona que lo invocó.
  const conSaldo = prenomina.filter(
    (p) => Number(p.pendiente) > 0 || p.trabajador_id === trabajadorInicial,
  )

  const [trabajadorId, setTrabajadorId] = useState(
    trabajadorInicial ?? conSaldo[0]?.trabajador_id ?? '',
  )
  const [fecha, setFecha] = useState(hoyISO())
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [notas, setNotas] = useState('')
  const [capturas, setCapturas] = useState<Record<string, Captura>>(() => {
    if (!trabajadorInicial) return {}
    const inicial: Record<string, Captura> = {}
    for (const x of pagablesDe(trabajadorInicial, vivos, rayasVivas)) {
      if (x.disponible > 0) inicial[x.clave] = { modo: 'monto', texto: String(x.disponible) }
    }
    return inicial
  })
  const [elegidas, setElegidas] = useState<string[]>(() =>
    trabajadorInicial
      ? pendientes.filter((d) => d.trabajador_id === trabajadorInicial).map((d) => d.id)
      : [],
  )

  const susDeducciones = pendientes.filter((d) => d.trabajador_id === trabajadorId)
  const pagables = pagablesDe(trabajadorId, vivos, rayasVivas)

  // Lo que se le sigue debiendo a este trabajador antes de capturar el abono.
  const suSaldo = redondear(pagables.reduce((s, x) => s + x.porPagar, 0))

  const capturaDe = (x: Pagable): Captura =>
    capturas[x.clave] ?? { modo: 'monto', texto: '' }

  /**
   * El importe del abono, se haya capturado en pesos o en porcentaje. El
   * porcentaje va siempre sobre el total del contrato: «le pago el 20%» es el
   * 20% de lo pactado, que es lo mismo que dice la etiqueta del renglón y lo
   * que se guarda en el recibo.
   */
  const importeDe = (x: Pagable) => {
    const { modo, texto } = capturaDe(x)
    return modo === 'pct' ? redondear((x.total * num(texto)) / 100) : num(texto)
  }

  // Sin useMemo: el compilador de React ya memoiza esto solo, y hacerlo a mano
  // le impedía optimizar el componente completo.
  const totales = (() => {
    const subtotal = pagables.reduce((s, x) => s + importeDe(x), 0)
    const descuento = susDeducciones
      .filter((d) => elegidas.includes(d.id))
      .reduce((s, d) => s + Number(d.monto), 0)
    return { subtotal: redondear(subtotal), descuento, total: redondear(subtotal - descuento) }
  })()

  const cambiarTrabajador = (id: string) => {
    setTrabajadorId(id)
    setCapturas({})
    setElegidas([])
  }

  const capturar = (contratoId: string, captura: Captura) =>
    setCapturas((m) => ({ ...m, [contratoId]: captura }))

  /** Al cambiar de unidad el número no se pierde: se convierte a la otra. */
  const cambiarModo = (x: Pagable, modo: Captura['modo']) => {
    const actual = capturaDe(x)
    if (actual.modo === modo) return
    const texto =
      actual.texto.trim() === ''
        ? ''
        : modo === 'pct'
          ? x.total > 0 ? String(redondear((num(actual.texto) / x.total) * 100)) : ''
          : String(redondear((x.total * num(actual.texto)) / 100))
    capturar(x.clave, { modo, texto })
  }

  /** Lo que se le puede pagar hoy: el avance de la obra, o la semana completa. */
  const devengarUno = (x: Pagable) =>
    capturar(x.clave, { modo: 'monto', texto: String(x.disponible) })

  /** Lo mismo de golpe en todo lo suyo, y con sus préstamos marcados. */
  const sugerir = () => {
    const nuevas: Record<string, Captura> = {}
    for (const x of pagables) {
      if (x.disponible > 0) nuevas[x.clave] = { modo: 'monto', texto: String(x.disponible) }
    }
    setCapturas(nuevas)
    setElegidas(susDeducciones.map((d) => d.id))
  }

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await pagarNomina({
        trabajador_id: trabajadorId,
        fecha,
        metodo,
        pagos: pagables.map((x) => {
          const { modo, texto } = capturaDe(x)
          const monto = importeDe(x)
          return {
            contrato_id: x.esRaya ? null : x.clave,
            raya_id: x.esRaya ? x.clave : null,
            monto,
            // Capturado en porcentaje va el que se tecleó, sin volver a
            // derivarlo del importe ya redondeado. El % del recibo representa
            // sólo lo de este pago, no el acumulado.
            porcentaje:
              modo === 'pct'
                ? num(texto)
                : x.total > 0
                  ? redondear((monto / x.total) * 100)
                  : null,
          }
        }),
        deducciones: elegidas,
        notas: notas.trim() || null,
      })

      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
      window.open(`/api/recibos-nomina/${r.datos!.reciboId}/pdf`, '_blank')
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo="Abono a mano de obra"
      descripcion="Un recibo puede cubrir varias obras y la raya de la semana, todo del mismo trabajador."
    >
      <CuerpoDialogo>
        {conSaldo.length === 0 ? (
          <p className="rounded-lg bg-tinta-50 px-3 py-3 text-sm text-tinta-500 sm:col-span-2">
            No hay nadie con saldo pendiente: todos los contratos activos están pagados. Si falta
            pagar algo, revisa que el contrato tenga el monto correcto.
          </p>
        ) : (
          <Campo
            etiqueta="Trabajador"
            hijo={
              <Seleccion value={trabajadorId} onChange={(e) => cambiarTrabajador(e.target.value)}>
                {conSaldo.map((p) => (
                  <option key={p.trabajador_id} value={p.trabajador_id}>
                    {p.trabajador}
                    {p.es_externo ? ' (externo)' : ''} · disponible {pesos(p.disponible)} · pendiente{' '}
                    {pesos(p.pendiente)}
                  </option>
                ))}
              </Seleccion>
            }
          />
        )}
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<SelectorFecha valor={fecha} onCambio={setFecha} />}
        />
        <Campo
          etiqueta="Método"
          ancho="medio"
          hijo={
            <Seleccion value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {Object.entries(METODO_PAGO_SIN_CAJA).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />

        <div className="sm:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-tinta-700">
              Qué se le abona
              {suSaldo > 0 && (
                <span className="ml-2 font-normal text-tinta-500">
                  se le deben <strong className="text-tinta-700">{pesos(suSaldo)}</strong>
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={sugerir}
              className="text-xs font-medium text-haaco-700 hover:underline"
            >
              Sugerir lo devengado
            </button>
          </div>

          {pagables.length === 0 ? (
            <p className="rounded-lg bg-tinta-50 px-3 py-3 text-sm text-tinta-500">
              A este trabajador no se le debe nada: ni contratos con saldo ni rayas por pagar.
            </p>
          ) : (
            <ul className="divide-y divide-tinta-100 overflow-hidden rounded-xl border border-tinta-200">
              {pagables.map((c) => {
                const { modo, texto } = capturaDe(c)
                const monto = importeDe(c)
                const excede = monto > c.porPagar
                const pct = c.total > 0 ? (monto / c.total) * 100 : 0
                return (
                  <li key={c.clave} className="px-3 py-2.5">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-tinta-900">
                        {c.titulo}
                        {c.esRaya && <Etiqueta tono="azul">sueldo</Etiqueta>}
                      </span>
                      <span className="text-xs text-tinta-500">
                        {c.detalle} · devengado {pesos(c.devengado)} · pagado{' '}
                        {pesos(c.pagado)} · por pagar{' '}
                        <strong className="text-tinta-700">{pesos(c.porPagar)}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <ConmutadorUnidad modo={modo} onCambio={(m) => cambiarModo(c, m)} />
                      <Numero
                        value={texto}
                        onChange={(e) => capturar(c.clave, { modo, texto: e.target.value })}
                        placeholder={modo === 'pct' ? '0' : '0.00'}
                        className="max-w-28"
                        aria-label={modo === 'pct' ? 'Porcentaje del contrato' : 'Importe del abono'}
                      />
                      {/* La otra unidad, siempre a la vista: se captura en una
                          y se cobra en la otra. */}
                      <span className="text-xs text-tinta-500">
                        {monto > 0
                          ? modo === 'pct'
                            ? <>= <strong className="text-tinta-800">{pesos(monto)}</strong> de {pesos(c.total)}</>
                            : <>= <strong className="text-tinta-800">{porcentaje(pct, 1)}</strong> de {pesos(c.total)}</>
                          : <>de {pesos(c.total)}</>}
                        {monto > 0 && !excede && (
                          <> · quedan {pesos(redondear(c.porPagar - monto))}</>
                        )}
                      </span>
                      {/* Sin devengado sin pagar no hay atajo que ofrecer: lo
                          que se devengó ya está arriba, en el renglón. */}
                      {Number(c.disponible) > 0 && (
                        <button
                          type="button"
                          onClick={() => devengarUno(c)}
                          className="ml-auto shrink-0 rounded-lg border border-tinta-200 px-2 py-1 text-xs font-medium text-haaco-700 transition hover:bg-haaco-50"
                        >
                          Devengado {pesos(c.disponible)}
                        </button>
                      )}
                    </div>
                    {excede && (
                      <p className="mt-1 text-xs text-red-600">
                        Rebasa lo que falta por pagar ({pesos(c.porPagar)}).
                      </p>
                    )}
                    {monto > Number(c.disponible) && !excede && (
                      <p className="mt-1 text-xs text-amber-700">
                        Va por delante del avance reportado ({pesos(c.disponible)} devengado sin
                        pagar).
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {susDeducciones.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-tinta-700">Deducciones a aplicar</p>
            <ul className="space-y-1">
              {susDeducciones.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-tinta-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={elegidas.includes(d.id)}
                      onChange={() =>
                        setElegidas((l) =>
                          l.includes(d.id) ? l.filter((x) => x !== d.id) : [...l, d.id],
                        )
                      }
                      className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600"
                    />
                    <span className="flex-1 capitalize text-tinta-700">{d.tipo}</span>
                    {d.notas && <span className="text-xs text-tinta-400">{d.notas}</span>}
                    <span className="font-medium tabular-nums text-red-600">- {pesos(d.monto)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Campo
          etiqueta="Notas del recibo"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />

        <div className="rounded-xl bg-haaco-50 px-4 py-3 sm:col-span-2">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-tinta-600">Subtotal</dt>
              <dd className="tabular-nums text-tinta-900">{pesos(totales.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-tinta-600">Deducciones</dt>
              <dd className="tabular-nums text-red-600">
                {totales.descuento > 0 ? `- ${pesos(totales.descuento)}` : pesos(0)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-haaco-200 pt-1.5">
              <dt className="font-semibold text-tinta-900">Total a pagar</dt>
              <dd className="text-lg font-semibold tabular-nums text-haaco-700">
                {pesos(totales.total)}
              </dd>
            </div>
            {/* Se resta el subtotal, no el total: las deducciones bajan el
                efectivo que se entrega, no lo que se le debe del contrato. */}
            <div className="flex justify-between border-t border-haaco-200 pt-1.5">
              <dt className="text-tinta-600">Le quedará pendiente</dt>
              <dd className="font-medium tabular-nums text-tinta-900">
                {pesos(redondear(suSaldo - totales.subtotal))}
              </dd>
            </div>
          </dl>
          {totales.descuento > 0 && (
            <p className="mt-1.5 text-xs text-tinta-500">
              Las deducciones bajan el efectivo que se le entrega, no lo que se le debe del contrato.
            </p>
          )}
          {totales.total > 0 && (
            <p className="mt-1.5 text-xs uppercase text-tinta-500">{montoEnLetra(totales.total)}</p>
          )}
        </div>

        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || totales.subtotal <= 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Registrando…' : 'Pagar y generar recibo'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

/**
 * Pesos o porcentaje. Va pegado al campo y con su mismo alto: es la unidad de
 * lo que se está tecleando, no una opción del formulario.
 */
function ConmutadorUnidad({
  modo, onCambio,
}: {
  modo: Captura['modo']
  onCambio: (modo: Captura['modo']) => void
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-[14px] border border-tinta-300 lg:rounded-lg">
      {([['monto', '$'], ['pct', '%']] as const).map(([clave, texto]) => (
        <button
          key={clave}
          type="button"
          onClick={() => onCambio(clave)}
          aria-pressed={modo === clave}
          className={`w-10 py-3 text-sm font-semibold transition lg:py-2 ${
            modo === clave
              ? 'bg-haaco-700 text-white'
              : 'bg-white text-tinta-500 hover:bg-tinta-50'
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
/**
 * Un préstamo mal capturado sólo se podía dejar así: la acción de servidor ya
 * sabía actualizar y borrar, pero nada en la pantalla le pasaba el id. Un
 * préstamo ya aplicado a un recibo no se toca — se corrige el recibo.
 */
export function BotonEditarPrestamo({
  deduccion, prenomina, nombre,
}: {
  deduccion: Deduccion
  prenomina: VPrenomina[]
  /** Cómo se llama quien lo debe; sale del padrón, no de la prenómina. */
  nombre?: string
}) {
  const [abierto, setAbierto] = useState(false)

  if (deduccion.saldado) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded p-1 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-700"
        aria-label="Corregir el préstamo"
      >
        <Pencil size={13} />
      </button>

      {abierto && (
        <DialogoPrestamo
          prenomina={prenomina}
          deduccion={deduccion}
          nombreInicial={nombre}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

export function DialogoPrestamo({
  prenomina, deduccion, trabajadorInicial, nombreInicial, onCerrar,
}: {
  prenomina: VPrenomina[]
  /** Presente al corregir; ausente al registrar uno nuevo. */
  deduccion?: Deduccion
  /** De quién es, cuando se abre desde su renglón en vez de desde la barra. */
  trabajadorInicial?: string
  /** Su nombre, para los casos en que la prenómina no lo traiga. */
  nombreInicial?: string
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  /*
   * Un préstamo sobrevive a los contratos de quien lo debe, y a quien acaban de
   * poner a sueldo todavía no le han armado ninguna semana: en los dos casos su
   * dueño no viene en la prenómina. Sin un renglón propio, el desplegable se
   * quedaba enseñando a otra persona y guardarlo le cambiaba de dueño el
   * préstamo sin que nadie lo pidiera.
   */
  const deQuien = deduccion?.trabajador_id ?? trabajadorInicial
  const opciones = prenomina.map((p) => ({ id: p.trabajador_id, nombre: p.trabajador }))
  if (deQuien && !opciones.some((o) => o.id === deQuien)) {
    opciones.unshift({ id: deQuien, nombre: nombreInicial ?? 'Este trabajador' })
  }

  const [trabajadorId, setTrabajadorId] = useState(deQuien ?? opciones[0]?.id ?? '')
  const [tipo, setTipo] = useState<TipoDeduccion>(deduccion?.tipo ?? 'prestamo')
  const [monto, setMonto] = useState(deduccion ? String(Number(deduccion.monto)) : '')
  const [fecha, setFecha] = useState(deduccion?.fecha ?? hoyISO())
  const [notas, setNotas] = useState(deduccion?.notas ?? '')

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarDeduccion({
        id: deduccion?.id,
        trabajador_id: trabajadorId,
        tipo,
        monto: num(monto),
        fecha,
        notas: notas.trim() || null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const borrar = () =>
    iniciar(async () => {
      if (!deduccion) return
      if (!confirm('¿Borrar este préstamo?')) return
      const r = await eliminarDeduccion(deduccion.id)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={deduccion ? 'Corregir préstamo' : 'Préstamo o adelanto'}
      descripcion="Queda pendiente hasta que se aplique como deducción en un recibo de abono."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Trabajador"
          hijo={
            <Seleccion value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Tipo"
          ancho="medio"
          hijo={
            <Seleccion value={tipo} onChange={(e) => setTipo(e.target.value as TipoDeduccion)}>
              {Object.entries(TIPO_DEDUCCION).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Monto"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />}
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<SelectorFecha valor={fecha} onCambio={setFecha} />}
        />
        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        {deduccion && (
          <button
            type="button"
            onClick={borrar}
            disabled={pendiente}
            className="mr-auto rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            Borrar
          </button>
        )}
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || num(monto) <= 0 || !trabajadorId}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : deduccion ? 'Guardar' : 'Registrar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
