'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, CopyPlus, Pencil, Plus, Undo2 } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, Opciones,
  PieConBorrado, PieDialogo, Seleccion, TextoPie,
} from '@/components/formulario'
import { FiltroMes, SelectorFecha } from '@/components/filtro-fechas'
import { fecha } from '@/lib/format'
import { hoyISO, num } from '@/lib/cotizaciones'
import {
  CATEGORIAS_PAGO_FIJO, ESTADO_PAGO_FIJO, METODO_PAGO_SIN_CAJA, etiquetaQuincena, quincenaDe,
} from '@/lib/finanzas'
import {
  asegurarQuincenas, eliminarPagoFijo, generarQuincena, guardarPagoFijo, marcarPagoFijo,
  restaurarPagoFijo,
} from '@/app/admin/finanzas-acciones'
import type {
  AlcanceQuitarPago, EstadoPagoFijo, MetodoPago, PagoFijo, PeriodicidadPago, ResultadoQuitarPago,
} from '@/types/database'

export function BarraPagosFijos({ mes, quincenas }: { mes: string; quincenas: string[] }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [nuevo, setNuevo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const generar = (quincena: string) =>
    iniciar(async () => {
      const r = await generarQuincena(quincena)
      if (!r.ok) return setAviso(r.error)
      setAviso(
        r.datos === 0
          ? `La ${etiquetaQuincena(quincena).toLowerCase()} ya tenía a todos los de la lista.`
          : `Se agregaron ${r.datos} ${r.datos === 1 ? 'pago' : 'pagos'} de la lista a la ${etiquetaQuincena(quincena).toLowerCase()}.`,
      )
      router.refresh()
    })

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* Se paga por quincena: el mes es la unidad que importa. */}
        <FiltroMes mes={mes} titulo="Mes de las quincenas" />

        {quincenas.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => generar(q)}
            disabled={pendiente}
            className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50"
          >
            <CopyPlus size={15} />
            Generar {etiquetaQuincena(q).toLowerCase()}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setNuevo(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
        >
          <Plus size={16} />
          Nuevo pago
        </button>
      </div>

      {aviso && (
        <p className="mb-4 rounded-lg bg-haaco-50 px-4 py-2.5 text-sm text-haaco-800 ring-1 ring-haaco-200">
          {aviso}
        </p>
      )}

      {nuevo && <FormularioPagoFijo quincenas={quincenas} onCerrar={() => setNuevo(false)} />}
    </>
  )
}

/**
 * Las dos acciones de un renglón: marcar pagado y corregir.
 *
 * «Editar» va con su palabra y no sólo con el lápiz. Con el icono a secas nadie
 * lo encontraba —el cliente pidió por escrito «habilitar» algo que llevaba
 * meses habilitado—, y en el teléfono los dos botones eran dos cuadros de
 * 26 px pegados: quien buscaba corregir un monto acababa marcándolo pagado.
 * Aquí los dos miden lo que mide un dedo y hay un respiro entre ellos.
 */
/**
 * Arma solo las quincenas del mes en curso que todavía no existen.
 *
 * La página no puede hacerlo por su cuenta: pintarla es un GET y un GET no
 * escribe. Así que lo pide el navegador en cuanto la pantalla aparece, y sólo
 * para el mes en curso —si se disparara en cualquier mes, hojear diciembre del
 * año que entra dejaría veinte renglones creados allá—.
 *
 * Repetirlo no duplica nada: quien manda es `generar_quincena`, que lleva su
 * propio candado. El `useRef` es sólo para no pedirlo dos veces por montaje,
 * que en desarrollo React monta todo por partida doble.
 */
export function AsegurarQuincenas({ quincenas }: { quincenas: string[] }) {
  const router = useRouter()
  const pedido = useRef(false)
  const [armando, setArmando] = useState(true)

  useEffect(() => {
    if (pedido.current) return
    pedido.current = true

    let vivo = true
    asegurarQuincenas(quincenas).then((r) => {
      if (!vivo) return
      setArmando(false)
      if (r.ok && (r.datos ?? 0) > 0) router.refresh()
    })
    return () => {
      vivo = false
    }
  }, [quincenas, router])

  if (!armando) return null

  return (
    <p className="mb-4 rounded-lg bg-haaco-50 px-4 py-2.5 text-sm text-haaco-800 ring-1 ring-haaco-200">
      Armando la quincena con la lista de pagos fijos…
    </p>
  )
}

/**
 * Lo que alguien sacó a mano de esta quincena, con la vuelta atrás a la vista.
 *
 * Desde que quitar un pago se queda quitado, quitarlo por error no tendría
 * remedio: «Generar quincena» respeta la decisión y ya no lo traería. Aquí
 * queda dicho qué falta y de quién fue la mano, y se vuelve a traer de un toque.
 */
export function OmitidosDeQuincena({
  quincena,
  omitidos,
}: {
  quincena: string
  omitidos: { programado_id: string; beneficiario: string }[]
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()

  const traer = (programadoId: string) =>
    iniciar(async () => {
      await restaurarPagoFijo(programadoId, quincena)
      router.refresh()
    })

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>Quitaste de esta quincena:</span>
      {omitidos.map((o) => (
        <button
          key={o.programado_id}
          type="button"
          onClick={() => traer(o.programado_id)}
          disabled={pendiente}
          className="inline-flex items-center gap-1 rounded-md border border-tinta-200 bg-white px-2 py-1 font-medium text-tinta-700 transition hover:border-haaco-300 hover:text-haaco-800 disabled:opacity-50"
        >
          <Undo2 size={12} />
          {o.beneficiario}
        </button>
      ))}
      <span>· toca el nombre para volver a traerlo.</span>
    </span>
  )
}

export function AccionesPagoFijo({
  pago,
  quincenas,
  periodicidad,
}: {
  pago: PagoFijo
  quincenas: string[]
  /** La del renglón de la lista del que salió; nula si es un pago suelto. */
  periodicidad: PeriodicidadPago | null
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [editando, setEditando] = useState(false)
  const pagado = pago.estado === 'pagado'

  const marcar = () =>
    iniciar(async () => {
      await marcarPagoFijo(pago.id, pagado ? 'pendiente' : 'pagado')
      router.refresh()
    })

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={marcar}
        disabled={pendiente}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border transition disabled:opacity-50 lg:min-h-9 lg:min-w-9 lg:rounded-lg ${
          pagado
            ? 'border-haaco-200 bg-haaco-50 text-haaco-700 hover:bg-haaco-100'
            : 'border-tinta-200 bg-white text-tinta-400 hover:border-haaco-300 hover:text-haaco-600'
        }`}
        aria-label={pagado ? 'Marcar pendiente' : 'Marcar pagado'}
        title={pagado ? 'Marcar pendiente' : 'Marcar pagado'}
      >
        <Check size={17} />
      </button>
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-tinta-200 bg-white px-3 text-sm font-medium text-tinta-700 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800 lg:min-h-9 lg:rounded-lg lg:px-2.5 lg:text-[13px]"
      >
        <Pencil size={14} />
        Editar
      </button>

      {editando && (
        <FormularioPagoFijo
          pago={pago}
          quincenas={quincenas}
          periodicidad={periodicidad}
          onCerrar={() => setEditando(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function FormularioPagoFijo({
  pago, quincenas, periodicidad = null, onCerrar,
}: {
  pago?: PagoFijo
  /** Las dos quincenas del mes que se está viendo. */
  quincenas: string[]
  /** La del renglón de la lista del que salió el pago; nula si es suelto. */
  periodicidad?: PeriodicidadPago | null
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  /*
   * Las dos quincenas del mes a un toque, y «otra fecha» para lo que no cae en
   * ninguna: la nómina de dirección se paga cuando se puede y queda fuera del
   * ciclo quincenal. Antes esto era un calendario a secas, y como la pantalla
   * sólo pedía el 15 y el fin de mes, esos pagos se guardaban y ya no se veían
   * —seguían contando en Reportes, pero aquí no había forma de encontrarlos—.
   * El arreglo no fue prohibir la fecha, que es legítima, sino que la lista
   * traiga el mes entero.
   */
  const [quincena, setQuincena] = useState(
    pago?.quincena ?? (quincenas.includes(quincenaDe(hoyISO())) ? quincenaDe(hoyISO()) : quincenas[0]),
  )
  const [libre, setLibre] = useState(Boolean(pago) && !quincenas.includes(quincena))
  const [categoria, setCategoria] = useState(pago?.categoria ?? 'Nómina')
  const [beneficiario, setBeneficiario] = useState(pago?.beneficiario ?? '')
  const [monto, setMonto] = useState(String(pago?.monto ?? ''))
  const [metodo, setMetodo] = useState<MetodoPago>(pago?.metodo ?? 'transferencia')
  const [estado, setEstado] = useState<EstadoPagoFijo>(pago?.estado ?? 'programado')
  const [descripcion, setDescripcion] = useState(pago?.descripcion ?? '')
  const [notas, setNotas] = useState(pago?.notas ?? '')

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarPagoFijo({
        id: pago?.id,
        quincena,
        categoria,
        beneficiario,
        monto: num(monto),
        metodo,
        estado,
        descripcion: descripcion.trim() || null,
        notas: notas.trim() || null,
        fecha_pago: estado === 'pagado' ? (pago?.fecha_pago ?? hoyISO()) : null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  /*
   * El pago sale de la lista de personal y servicios o es un renglón suelto, y
   * eliminarlo no quiere decir lo mismo en los dos casos. El suelto se borra y
   * ya. El de la lista tiene quien lo vuelva a traer: mientras la lista diga
   * que es quincenal, la pantalla lo rearma al recargar. Por eso se pregunta
   * hasta dónde llega el «eliminar» en lugar de borrar y dejar que reaparezca.
   */
  const delaLista = Boolean(pago?.programado_id)
  /*
   * Por `quincenaDe` y no por la fecha pelada: un pago se puede haber corregido
   * a una fecha suelta —la nómina de dirección se paga sin fecha fija— y la
   * mitad del mes a la que pertenece la decide la misma regla que lo acomoda en
   * la pantalla y que la que aplica la base. Si se separan, el botón diría «2ª
   * quincena» a un renglón que se está viendo bajo la 1ª.
   */
  const mitad = pago ? etiquetaQuincena(quincenaDe(pago.quincena)).toLowerCase() : ''
  const puedeSerMensual = delaLista && periodicidad === 'quincenal'

  const resumen = (d: ResultadoQuitarPago) => {
    if (!d.periodicidad) {
      return `Listo: ${d.beneficiario} ya no sale en la ${mitad}. La lista se quedó igual, así que las demás quincenas no cambian.`
    }
    const cuando = d.periodicidad === 'primera' ? 'el día 15' : 'a fin de mes'
    const limpiadas =
      d.limpiados > 0
        ? ` De paso se quitó de ${d.limpiados} ${d.limpiados === 1 ? 'quincena' : 'quincenas'} por venir.`
        : ''
    return `Listo: en la lista, ${d.beneficiario} quedó como una vez al mes, ${cuando}.${limpiadas}`
  }

  const quitar = (alcance: AlcanceQuitarPago) =>
    iniciar(async () => {
      if (!pago) return
      setError(null)
      const r = await eliminarPagoFijo(pago.id, alcance)
      if (!r.ok) return setError(r.error)
      router.refresh()
      // El suelto no necesita explicación: se fue y no vuelve.
      if (!delaLista || !r.datos) return onCerrar()
      setHecho(resumen(r.datos))
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={pago ? 'Editar pago fijo' : 'Nuevo pago fijo'}
      descripcion="Un renglón de una quincena. Quiénes salen solos cada quincena se decide en «Personal y servicios»."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Cuándo se paga"
          hijo={
            <div className="space-y-2">
              <Opciones
                valor={libre ? 'otra' : quincena}
                opciones={[
                  ...quincenas.map((q) => [q, etiquetaQuincena(q)] as [string, string]),
                  ['otra', 'Otra fecha'],
                ]}
                onCambio={(v) => {
                  if (v === 'otra') return setLibre(true)
                  setLibre(false)
                  setQuincena(v)
                }}
              />
              {libre && <SelectorFecha valor={quincena} onCambio={setQuincena} titulo="Día del pago" />}
            </div>
          }
          ayuda={`${fecha(quincena)}${libre ? ' · fuera del ciclo quincenal' : ''}`}
        />
        <Campo
          etiqueta="Categoría"
          ancho="medio"
          hijo={
            <Seleccion value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS_PAGO_FIJO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Beneficiario"
          hijo={
            <Entrada
              value={beneficiario}
              onChange={(e) => setBeneficiario(e.target.value)}
              placeholder="Telcel, Telmex, contador, administración…"
              autoFocus
            />
          }
        />
        <Campo
          etiqueta="Monto"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} />}
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
        <Campo
          etiqueta="Estado"
          ancho="medio"
          hijo={
            <Seleccion value={estado} onChange={(e) => setEstado(e.target.value as EstadoPagoFijo)}>
              {Object.entries(ESTADO_PAGO_FIJO).map(([valor, info]) => (
                <option key={valor} value={valor}>
                  {info.texto}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Descripción"
          hijo={<Entrada value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />}
        />
        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />
        {/* Aquí había una casilla de «recurrente». Desde la lista de personal y
            servicios, lo que se repite es lo que viene de la lista y la base lo
            deriva sola: marcarla no hacía nada, y al guardar se desmarcaba. */}
        {delaLista && (
          <p className="text-xs text-tinta-500 sm:col-span-2">
            Este pago salió de «Personal y servicios». Cada cuándo le toca se cambia allá;
            aquí sólo se corrige este renglón.
          </p>
        )}
        {!pago && (
          <p className="text-xs text-tinta-500 sm:col-span-2">
            Este pago se registra una sola vez. Si se repite cada quincena, agrégalo en
            «Personal y servicios» y saldrá solo.
          </p>
        )}
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      {hecho ? (
        <PieDialogo>
          <TextoPie>{hecho}</TextoPie>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
          >
            Listo
          </button>
        </PieDialogo>
      ) : (
        <PieConBorrado
          onCerrar={onCerrar}
          onGuardar={guardar}
          pendiente={pendiente}
          puedeGuardar={Boolean(beneficiario.trim())}
          borrado={
            !pago
              ? undefined
              : delaLista
                ? {
                    pregunta: puedeSerMensual
                      ? `${pago.beneficiario} está en la lista como de cada quincena, por eso sale en las dos. ¿Lo quito nada más de la ${mitad}, o es de los que se pagan una vez al mes?`
                      : `${pago.beneficiario} sale de la lista de personal y servicios. ¿Lo quito de la ${mitad}? La lista no se toca: las demás quincenas siguen igual.`,
                    texto: `Sólo de la ${mitad}`,
                    onBorrar: () => quitar('esta'),
                    alterna: puedeSerMensual
                      ? { texto: 'Es una vez al mes', onClick: () => quitar('siempre') }
                      : undefined,
                  }
                : {
                    pregunta: `¿Eliminar el pago a ${pago.beneficiario}?`,
                    onBorrar: () => quitar('esta'),
                  }
          }
        />
      )}
    </Dialogo>
  )
}
