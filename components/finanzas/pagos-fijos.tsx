'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, CopyPlus, Pencil, Plus } from 'lucide-react'
import {
  AreaTexto, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo,
  Seleccion,
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

      {nuevo && <FormularioPagoFijo quincenaPorDefecto={quincenas[0]} onCerrar={() => setNuevo(false)} />}
    </>
  )
}

export function AccionesPagoFijo({ pago }: { pago: PagoFijo }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [editando, setEditando] = useState(false)

  const marcar = () =>
    iniciar(async () => {
      await marcarPagoFijo(pago.id, pago.estado === 'pagado' ? 'pendiente' : 'pagado')
      router.refresh()
    })

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={marcar}
        disabled={pendiente}
        className={`rounded-lg p-1.5 transition ${
          pago.estado === 'pagado'
            ? 'text-haaco-600 hover:bg-haaco-50'
            : 'text-tinta-400 hover:bg-tinta-100 hover:text-haaco-600'
        }`}
        aria-label={pago.estado === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado'}
        title={pago.estado === 'pagado' ? 'Marcar pendiente' : 'Marcar pagado'}
      >
        <Check size={15} />
      </button>
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="rounded-lg p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
        aria-label="Editar"
      >
        <Pencil size={14} />
      </button>

      {editando && <FormularioPagoFijo pago={pago} onCerrar={() => setEditando(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
function FormularioPagoFijo({
  pago, quincenaPorDefecto, onCerrar,
}: {
  pago?: PagoFijo
  quincenaPorDefecto?: string
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [quincena, setQuincena] = useState(
    pago?.quincena ?? quincenaPorDefecto ?? quincenaDe(hoyISO()),
  )
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
      if (!confirm(`¿Eliminar el pago a ${pago.beneficiario}?`)) return
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
      descripcion="Marca como recurrente lo que se repite cada quincena para copiarlo después."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Quincena"
          ancho="medio"
          hijo={<SelectorFecha valor={quincena} onCambio={setQuincena} />}
          ayuda={`${etiquetaQuincena(quincena)} · ${fecha(quincena)}`}
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
          etiqueta="Se repite cada quincena"
          checked={recurrente}
          onChange={(e) => setRecurrente(e.target.checked)}
        />
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        {pago && (
          <button
            type="button"
            onClick={borrar}
            className="mr-auto rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            Eliminar
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
          disabled={pendiente || !beneficiario.trim()}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
