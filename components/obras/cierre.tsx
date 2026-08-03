'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AlertTriangle, Check, Lock, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo,
} from '@/components/formulario'
import { Etiqueta, Tarjeta } from '@/components/ui'
import { EntradaSugerencias } from '@/components/entrada-sugerencias'
import { SelectorFecha } from '@/components/filtro-fechas'
import { fecha, pesos } from '@/lib/format'
import { hoyISO, num } from '@/lib/cotizaciones'
import { REGLAS } from '@/lib/empresa'
import {
  agregarDetalle, cerrarObra, eliminarDetalle, guardarPoliza, marcarDetalle,
} from '@/app/admin/obras/acciones'
import type { ResultadoCierre } from '@/types/database'
import type { DatosObra } from '@/app/admin/obras/datos'

type AreaPoliza = { area: string; pintura: string; color: string; codigo: string }

const CONDICIONES_DEFECTO =
  'La presente garantía ampara defectos de aplicación del recubrimiento: desprendimiento, ampollamiento o cuarteadura atribuibles a la mano de obra o al proceso de aplicación, durante la vigencia señalada y contada a partir de la fecha de conclusión de los trabajos.'

const DESLINDES_DEFECTO =
  'No quedan amparados: daños por humedad, filtraciones o fugas ajenas al recubrimiento; golpes, rayaduras o maltrato posterior a la entrega; movimientos estructurales o asentamientos del inmueble; intervención de terceros sobre la superficie; ni fenómenos naturales extraordinarios. La garantía se pierde si se aplica cualquier producto adicional sobre la superficie sin autorización de HAACO PRO RECUBRIMIENTOS.'

export function PanelCierre({ datos }: { datos: DatosObra }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nuevoDetalle, setNuevoDetalle] = useState('')
  const [editandoPoliza, setEditandoPoliza] = useState(false)
  const [diagnostico, setDiagnostico] = useState<ResultadoCierre | null>(null)

  const cerrada = datos.concentrado.estatus === 'cerrada'
  const sinAtender = datos.detalles.filter((d) => !d.atendido)
  const saldo = Number(datos.cobranza?.saldo ?? 0)
  const moPendiente = datos.nomina.reduce((s, n) => s + Number(n.por_pagar), 0)
  const herramientaFuera = datos.pagareItems.filter((i) => !i.devuelta).length

  const listo = sinAtender.length === 0 && saldo <= 0 && moPendiente <= 0

  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error ?? 'No se pudo completar la operación.')
      router.refresh()
    })

  const cerrar = (forzar: boolean) =>
    iniciar(async () => {
      setError(null)
      const r = await cerrarObra(datos.obra.id, hoyISO(), forzar)
      if (!r.ok) return setError(r.error)
      setDiagnostico(r.datos ?? null)
      router.refresh()
    })

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {/* Detalles de entrega ------------------------------------------- */}
        <Tarjeta
          titulo="Detalles de la entrega"
          pie="El recorrido con el cliente. Mientras queden detalles sin atender, la OT no se cierra."
        >
          {!cerrada && (
            <div className="border-b border-tinta-100 p-3">
              <div className="flex gap-2">
                <Entrada
                  value={nuevoDetalle}
                  onChange={(e) => setNuevoDetalle(e.target.value)}
                  placeholder="Retocar marco de puerta principal…"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !nuevoDetalle.trim()) return
                    accion(() => agregarDetalle(datos.obra.id, nuevoDetalle))
                    setNuevoDetalle('')
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!nuevoDetalle.trim()) return
                    accion(() => agregarDetalle(datos.obra.id, nuevoDetalle))
                    setNuevoDetalle('')
                  }}
                  disabled={pendiente || !nuevoDetalle.trim()}
                  className="shrink-0 rounded-lg bg-haaco-700 px-3 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {datos.detalles.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-tinta-500">
              Sin detalles pendientes. La obra se entregó limpia.
            </p>
          ) : (
            <ul className="divide-y divide-tinta-100">
              {datos.detalles.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => accion(() => marcarDetalle(datos.obra.id, d.id, !d.atendido))}
                    disabled={cerrada || pendiente}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                      d.atendido
                        ? 'border-haaco-600 bg-haaco-600 text-white'
                        : 'border-tinta-300 hover:border-haaco-400'
                    }`}
                    aria-label={d.atendido ? 'Marcar pendiente' : 'Marcar atendido'}
                  >
                    {d.atendido && <Check size={13} />}
                  </button>
                  <span
                    className={`min-w-0 flex-1 text-sm ${
                      d.atendido ? 'text-tinta-400 line-through' : 'text-tinta-700'
                    }`}
                  >
                    {d.descripcion}
                  </span>
                  <span className="shrink-0 text-xs text-tinta-400">
                    {d.atendido && d.fecha_atencion ? fecha(d.fecha_atencion) : fecha(d.fecha_reporte)}
                  </span>
                  {!cerrada && (
                    <button
                      type="button"
                      onClick={() => accion(() => eliminarDetalle(datos.obra.id, d.id))}
                      disabled={pendiente}
                      className="rounded p-1 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Eliminar detalle"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {/* Póliza --------------------------------------------------------- */}
        <Tarjeta
          titulo={
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-haaco-600" />
                Póliza de garantía
              </span>
              {!cerrada && (
                <button
                  type="button"
                  onClick={() => setEditandoPoliza(true)}
                  className="rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
                >
                  {datos.poliza ? 'Editar' : 'Emitir póliza'}
                </button>
              )}
            </span>
          }
          pie="El detalle de pinturas y colores por área es lo que permite retocar después sin adivinar."
        >
          {datos.poliza ? (
            <div className="px-5 py-3.5">
              <p className="mb-3 flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-haaco-700">{datos.poliza.folio}</span>
                <Etiqueta tono="verde">{datos.poliza.vigencia_dias} días</Etiqueta>
                {datos.poliza.fecha_conclusion && (
                  <span className="text-tinta-500">
                    desde {fecha(datos.poliza.fecha_conclusion)}
                  </span>
                )}
              </p>

              {Array.isArray(datos.poliza.items) && datos.poliza.items.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-tinta-200 px-2 py-1.5 text-left text-xs font-semibold uppercase text-tinta-500">
                        Área
                      </th>
                      <th className="border-b border-tinta-200 px-2 py-1.5 text-left text-xs font-semibold uppercase text-tinta-500">
                        Pintura
                      </th>
                      <th className="border-b border-tinta-200 px-2 py-1.5 text-left text-xs font-semibold uppercase text-tinta-500">
                        Color
                      </th>
                      <th className="border-b border-tinta-200 px-2 py-1.5 text-left text-xs font-semibold uppercase text-tinta-500">
                        Código
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(datos.poliza.items as AreaPoliza[]).map((i, n) => (
                      <tr key={n}>
                        <td className="border-b border-tinta-100 px-2 py-1.5 text-tinta-700">{i.area}</td>
                        <td className="border-b border-tinta-100 px-2 py-1.5 text-tinta-700">{i.pintura}</td>
                        <td className="border-b border-tinta-100 px-2 py-1.5 text-tinta-700">{i.color}</td>
                        <td className="border-b border-tinta-100 px-2 py-1.5 font-mono text-xs text-tinta-500">
                          {i.codigo}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-tinta-500">Sin detalle de pinturas por área.</p>
              )}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-tinta-500">
              Todavía no se emite la póliza.
            </p>
          )}
        </Tarjeta>
      </div>

      {/* Panel de cierre --------------------------------------------------- */}
      <div className="space-y-4">
        <Tarjeta titulo="Requisitos para cerrar">
          <ul className="divide-y divide-tinta-100">
            <Requisito
              cumplido={sinAtender.length === 0}
              texto="Detalles atendidos"
              nota={sinAtender.length > 0 ? `${sinAtender.length} pendientes` : 'Todos listos'}
            />
            <Requisito
              cumplido={saldo <= 0}
              texto="Cliente liquidado"
              nota={saldo > 0 ? `Faltan ${pesos(saldo)}` : 'Sin saldo'}
            />
            <Requisito
              cumplido={moPendiente <= 0}
              texto="Mano de obra pagada"
              nota={moPendiente > 0 ? `Faltan ${pesos(moPendiente)}` : 'Sin pendientes'}
            />
            <Requisito
              cumplido={herramientaFuera === 0}
              texto="Herramienta devuelta"
              nota={
                herramientaFuera > 0
                  ? `${herramientaFuera} en obra · se devuelven al cerrar`
                  : 'Todo en taller'
              }
              informativo
            />
          </ul>

          {!cerrada && (
            <div className="border-t border-tinta-100 p-4">
              <button
                type="button"
                onClick={() => cerrar(false)}
                disabled={pendiente}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-haaco-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
              >
                <Lock size={16} />
                {pendiente ? 'Cerrando…' : 'Cerrar orden de trabajo'}
              </button>
              <p className="mt-2 text-xs text-tinta-500">
                Al cerrar se cancelan los pagarés, la herramienta regresa al taller, se cierran los
                contratos y, si es la última OT de la cotización, ésta pasa a terminada.
              </p>
            </div>
          )}

          {cerrada && (
            <div className="border-t border-tinta-100 bg-haaco-50 p-4 text-sm text-haaco-800">
              OT cerrada el {fecha(datos.obra.fecha_cierre)}.
            </div>
          )}
        </Tarjeta>

        {!listo && !cerrada && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
              <AlertTriangle size={16} />
              Faltan requisitos
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Puedes cerrar de todos modos si Dirección lo autoriza; quedará marcado como cierre
              forzado en la bitácora.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!confirm('¿Cerrar la OT aunque falten requisitos?')) return
                cerrar(true)
              }}
              disabled={pendiente}
              className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
            >
              Cerrar de todos modos
            </button>
          </div>
        )}
      </div>

      {diagnostico && (
        <DialogoDiagnostico resultado={diagnostico} onCerrar={() => setDiagnostico(null)} />
      )}

      {editandoPoliza && (
        <FormularioPoliza
          obraId={datos.obra.id}
          poliza={datos.poliza}
          sugerenciasAreas={datos.sugerenciasAreas}
          sugerenciasPinturas={datos.sugerenciasMateriales}
          coloresPoliza={datos.coloresPoliza}
          onCerrar={() => setEditandoPoliza(false)}
        />
      )}
    </div>
  )
}

function Requisito({
  cumplido, texto, nota, informativo,
}: {
  cumplido: boolean
  texto: string
  nota: string
  informativo?: boolean
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          cumplido
            ? 'bg-haaco-100 text-haaco-700'
            : informativo
              ? 'bg-sky-100 text-sky-700'
              : 'bg-amber-100 text-amber-700'
        }`}
      >
        {cumplido ? <Check size={12} /> : <X size={12} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-tinta-800">{texto}</span>
        <span className="block text-xs text-tinta-500">{nota}</span>
      </span>
    </li>
  )
}

function DialogoDiagnostico({
  resultado, onCerrar,
}: {
  resultado: ResultadoCierre
  onCerrar: () => void
}) {
  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={resultado.cerrada ? 'Orden de trabajo cerrada' : 'Todavía no se puede cerrar'}
    >
      <div className="flex-1 px-5 py-6">
        {resultado.cerrada ? (
          <ul className="space-y-2 text-sm text-tinta-700">
            <li>✓ {resultado.contratos_cerrados} contratos de mano de obra cerrados</li>
            <li>✓ {resultado.pagares_cancelados} pagarés cancelados</li>
            <li>✓ {resultado.herramientas_devueltas} herramientas de regreso en el taller</li>
            {resultado.cotizacion_terminada && (
              <li>✓ Era la última OT: la cotización pasó a «terminada»</li>
            )}
            {resultado.forzado && (
              <li className="text-amber-700">⚠ Cierre forzado: quedó anotado en la bitácora</li>
            )}
          </ul>
        ) : (
          <ul className="space-y-2 text-sm text-tinta-700">
            {resultado.detalles_pendientes > 0 && (
              <li>· {resultado.detalles_pendientes} detalles de entrega sin atender</li>
            )}
            {resultado.saldo_cliente > 0 && (
              <li>· El cliente debe {pesos(resultado.saldo_cliente)}</li>
            )}
            {resultado.mano_obra_pendiente > 0 && (
              <li>· Falta pagar {pesos(resultado.mano_obra_pendiente)} de mano de obra</li>
            )}
          </ul>
        )}
      </div>
      <PieDialogo>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
        >
          Entendido
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
function FormularioPoliza({
  obraId, poliza, sugerenciasAreas, sugerenciasPinturas, coloresPoliza, onCerrar,
}: {
  obraId: string
  poliza: DatosObra['poliza']
  sugerenciasAreas: DatosObra['sugerenciasAreas']
  sugerenciasPinturas: DatosObra['sugerenciasMateriales']
  coloresPoliza: DatosObra['coloresPoliza']
  onCerrar: () => void
}) {
  // Cada color visto en pólizas anteriores, con su código a la mano.
  const sugerenciasColores = coloresPoliza.map((c) => ({
    texto: c.color,
    veces: 0,
    monto: null,
  }))
  const codigoDe = new Map(coloresPoliza.map((c) => [c.color.toLowerCase(), c.codigo]))
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [conclusion, setConclusion] = useState(poliza?.fecha_conclusion ?? hoyISO())
  const [vigencia, setVigencia] = useState(String(poliza?.vigencia_dias ?? REGLAS.garantiaDias))
  const [condiciones, setCondiciones] = useState(poliza?.condiciones ?? CONDICIONES_DEFECTO)
  const [deslindes, setDeslindes] = useState(poliza?.deslindes ?? DESLINDES_DEFECTO)
  const [areas, setAreas] = useState<AreaPoliza[]>(
    Array.isArray(poliza?.items) && poliza.items.length > 0
      ? (poliza.items as AreaPoliza[])
      : [{ area: '', pintura: '', color: '', codigo: '' }],
  )

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarPoliza(obraId, {
        id: poliza?.id,
        fecha_conclusion: conclusion || null,
        vigencia_dias: num(vigencia) || REGLAS.garantiaDias,
        items: areas,
        condiciones: condiciones.trim() || null,
        deslindes: deslindes.trim() || null,
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const cambiar = (i: number, campo: keyof AreaPoliza, valor: string) =>
    setAreas((l) => l.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)))

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="xl"
      titulo={poliza ? 'Editar póliza de garantía' : 'Emitir póliza de garantía'}
      descripcion="El folio se asigna solo con el formato H###-AA."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Fecha de conclusión"
          ancho="medio"
          hijo={<SelectorFecha valor={conclusion} onCambio={setConclusion} />}
          ayuda="La vigencia se cuenta desde aquí."
        />
        <Campo
          etiqueta="Vigencia (días)"
          ancho="medio"
          hijo={<Numero value={vigencia} onChange={(e) => setVigencia(e.target.value)} />}
        />

        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-tinta-700">Pinturas y colores por área</p>
          <div className="space-y-1.5">
            {areas.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-1.5">
                <div className="col-span-3">
                  <EntradaSugerencias
                    valor={a.area}
                    onCambio={(v) => cambiar(i, 'area', v)}
                    onElegir={(s) => cambiar(i, 'area', s.texto)}
                    sugerencias={sugerenciasAreas}
                    placeholder="Fachada"
                  />
                </div>
                <div className="col-span-4">
                  <EntradaSugerencias
                    valor={a.pintura}
                    onCambio={(v) => cambiar(i, 'pintura', v)}
                    onElegir={(s) => cambiar(i, 'pintura', s.texto)}
                    sugerencias={sugerenciasPinturas}
                    placeholder="Rivinol 7"
                  />
                </div>
                <div className="col-span-2">
                  <EntradaSugerencias
                    valor={a.color}
                    onCambio={(v) => cambiar(i, 'color', v)}
                    onElegir={(s) => {
                      // Al elegir un color conocido su código se llena solo.
                      const codigo = codigoDe.get(s.texto.toLowerCase())
                      setAreas((l) =>
                        l.map((fila, j) =>
                          j === i
                            ? { ...fila, color: s.texto, codigo: codigo || fila.codigo }
                            : fila,
                        ),
                      )
                    }}
                    sugerencias={sugerenciasColores}
                    placeholder="Blanco"
                  />
                </div>
                <div className="col-span-2">
                  <Entrada value={a.codigo} onChange={(e) => cambiar(i, 'codigo', e.target.value)} placeholder="RV-100" />
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  {areas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAreas((l) => l.filter((_, j) => j !== i))}
                      className="rounded p-1 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Quitar área"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAreas((l) => [...l, { area: '', pintura: '', color: '', codigo: '' }])}
            className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-haaco-700 hover:underline"
          >
            <Plus size={14} />
            Agregar área
          </button>
        </div>

        <Campo
          etiqueta="Condiciones de la garantía"
          hijo={<AreaTexto rows={4} value={condiciones} onChange={(e) => setCondiciones(e.target.value)} />}
        />
        <Campo
          etiqueta="Deslindes"
          hijo={<AreaTexto rows={4} value={deslindes} onChange={(e) => setDeslindes(e.target.value)} />}
        />

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
          disabled={pendiente}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar póliza'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
