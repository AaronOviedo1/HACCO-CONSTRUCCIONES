'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, CopyPlus, Pencil, Plus } from 'lucide-react'
import {
  AreaTexto, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, Opciones,
  PieConBorrado, Seleccion,
} from '@/components/formulario'
import { FiltroMes, SelectorFecha } from '@/components/filtro-fechas'
import { fecha } from '@/lib/format'
import { hoyISO, num } from '@/lib/cotizaciones'
import {
  CATEGORIAS_PAGO_FIJO, ESTADO_PAGO_FIJO, METODO_PAGO_SIN_CAJA, etiquetaQuincena, quincenaDe,
} from '@/lib/finanzas'
import {
  eliminarPagoFijo, generarQuincena, guardarPagoFijo, marcarPagoFijo,
} from '@/app/admin/finanzas-acciones'
import type { EstadoPagoFijo, MetodoPago, PagoFijo } from '@/types/database'

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
          ? 'No había pagos recurrentes que copiar.'
          : `Se copiaron ${r.datos} pagos recurrentes a la ${etiquetaQuincena(quincena).toLowerCase()}.`,
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
export function AccionesPagoFijo({ pago, quincenas }: { pago: PagoFijo; quincenas: string[] }) {
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
        <FormularioPagoFijo pago={pago} quincenas={quincenas} onCerrar={() => setEditando(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function FormularioPagoFijo({
  pago, quincenas, onCerrar,
}: {
  pago?: PagoFijo
  /** Las dos quincenas del mes que se está viendo. */
  quincenas: string[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

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
  const [recurrente, setRecurrente] = useState(pago?.recurrente ?? false)

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
        recurrente,
        fecha_pago: estado === 'pagado' ? (pago?.fecha_pago ?? hoyISO()) : null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const borrar = () =>
    iniciar(async () => {
      if (!pago) return
      const r = await eliminarPagoFijo(pago.id)
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={pago ? 'Editar pago fijo' : 'Nuevo pago fijo'}
      descripcion="Lo que marques abajo se copia a la siguiente quincena cuando aprietes «Generar quincena»."
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
        <Casilla
          etiqueta="Copiar a la siguiente quincena"
          checked={recurrente}
          onChange={(e) => setRecurrente(e.target.checked)}
        />
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieConBorrado
        onCerrar={onCerrar}
        onGuardar={guardar}
        pendiente={pendiente}
        puedeGuardar={Boolean(beneficiario.trim())}
        borrado={
          pago ? { pregunta: `¿Eliminar el pago a ${pago.beneficiario}?`, onBorrar: borrar } : undefined
        }
      />
    </Dialogo>
  )
}
