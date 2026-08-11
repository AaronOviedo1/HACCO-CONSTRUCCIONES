'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { CalendarClock, Check, ListChecks, Plus, Trash2 } from 'lucide-react'
import {
  Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { SelectorFecha } from '@/components/filtro-fechas'
import { fecha } from '@/lib/format'
import { hoyISO, num } from '@/lib/cotizaciones'
import { ESTATUS_TAREA } from '@/lib/obras'
import { RenglonBitacora } from '@/components/obras/editar-nota'
import {
  anotarEnBitacora, crearCronogramaDesdePartidas, eliminarTarea, guardarTarea,
  marcarTareaTerminada, recorrerCronograma,
} from '@/app/admin/obras/acciones'
import type { CronogramaTarea, EstatusTarea } from '@/types/database'
import type { DatosObra } from '@/app/admin/obras/datos'

const DIA = 86_400_000

export function PanelCronograma({ datos }: { datos: DatosObra }) {
  const router = useRouter()
  // La tarea que se edita, 'nueva' para una de primer nivel, o { padre } para
  // colgarle una subtarea a una existente.
  const [editando, setEditando] = useState<
    CronogramaTarea | { padre: CronogramaTarea } | 'nueva' | null
  >(null)
  const [recorriendo, setRecorriendo] = useState(false)
  const [nota, setNota] = useState('')
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cerrada = datos.concentrado.estatus === 'cerrada'
  const responsables = new Map(datos.oficiales.map((o) => [o.id, o.nombre]))

  const padres = datos.tareas.filter((t) => !t.padre_id)
  const hijosDe = new Map<string, CronogramaTarea[]>()
  for (const t of datos.tareas) {
    if (t.padre_id) hijosDe.set(t.padre_id, [...(hijosDe.get(t.padre_id) ?? []), t])
  }

  // Rango del timeline: de la primera fecha a la última, con un margen.
  const linea = useMemo(() => {
    const fechas = datos.tareas
      .flatMap((t) => [t.fecha_inicio, t.fecha_fin])
      .filter((f): f is string => Boolean(f))
      .map((f) => new Date(`${f}T00:00:00`).getTime())

    if (fechas.length === 0) return null
    const inicio = Math.min(...fechas)
    const fin = Math.max(...fechas)
    const dias = Math.max(1, Math.round((fin - inicio) / DIA) + 1)
    return { inicio, fin, dias }
  }, [datos.tareas])

  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      setError(null)
      const r = await fn()
      if (!r.ok) return setError(r.error ?? 'No se pudo completar la operación.')
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

        <Tarjeta
          titulo={
            <span className="flex items-center justify-between gap-2">
              <span>Cronograma</span>
              {!cerrada && (
                <button
                  type="button"
                  onClick={() => setRecorriendo(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
                >
                  <CalendarClock size={14} />
                  Recorrer fechas
                </button>
              )}
            </span>
          }
          pie="El timeline dibuja cada tarea sobre el rango completo de la obra."
        >
          {datos.tareas.length === 0 ? (
            <EstadoVacio
              titulo="Sin tareas"
              descripcion="Arma el cronograma para poder recorrerlo cuando llueva o falte un oficial."
              accion={
                !cerrada ? (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => accion(() => crearCronogramaDesdePartidas(datos.obra.id))}
                      disabled={pendiente}
                      className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
                    >
                      <ListChecks size={16} />
                      {pendiente ? 'Creando…' : 'Crear cronograma con las partidas'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditando('nueva')}
                      className="inline-flex items-center gap-2 rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
                    >
                      <Plus size={16} />
                      Nueva tarea
                    </button>
                  </div>
                ) : undefined
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-tinta-100">
                {padres.map((t) => (
                  <li key={t.id}>
                    <FilaTarea
                      tarea={t}
                      linea={linea}
                      responsables={responsables}
                      cerrada={cerrada}
                      pendiente={pendiente}
                      onEditar={() => setEditando(t)}
                      onSubtarea={() => setEditando({ padre: t })}
                      onTerminar={() => accion(() => marcarTareaTerminada(datos.obra.id, t.id))}
                      onEliminar={() => accion(() => eliminarTarea(datos.obra.id, t.id))}
                    />
                    {(hijosDe.get(t.id) ?? []).map((h) => (
                      <FilaTarea
                        key={h.id}
                        tarea={h}
                        hija
                        linea={linea}
                        responsables={responsables}
                        cerrada={cerrada}
                        pendiente={pendiente}
                        onEditar={() => setEditando(h)}
                        onTerminar={() => accion(() => marcarTareaTerminada(datos.obra.id, h.id))}
                        onEliminar={() => accion(() => eliminarTarea(datos.obra.id, h.id))}
                      />
                    ))}
                  </li>
                ))}
              </ul>

              {!cerrada && (
                <div className="border-t border-tinta-100 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setEditando('nueva')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-tinta-300 px-2.5 py-1.5 text-xs font-medium text-tinta-600 transition hover:bg-tinta-50"
                  >
                    <Plus size={14} />
                    Agregar tarea
                  </button>
                </div>
              )}
            </>
          )}
        </Tarjeta>
      </div>

      {/* Bitácora ---------------------------------------------------------- */}
      <Tarjeta titulo="Bitácora de la obra" pie="Los movimientos se anotan solos; aquí puedes agregar una nota.">
        {!cerrada && (
          <div className="border-b border-tinta-100 p-3">
            <div className="flex gap-2">
              <Entrada
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Nota para el historial…"
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || !nota.trim()) return
                  accion(() => anotarEnBitacora(datos.obra.id, nota))
                  setNota('')
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (!nota.trim()) return
                  accion(() => anotarEnBitacora(datos.obra.id, nota))
                  setNota('')
                }}
                disabled={pendiente || !nota.trim()}
                className="shrink-0 rounded-lg bg-haaco-700 px-3 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
              >
                Anotar
              </button>
            </div>
          </div>
        )}

        {datos.bitacora.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-tinta-500">Sin movimientos.</p>
        ) : (
          <ul className="max-h-[36rem] divide-y divide-tinta-100 overflow-y-auto">
            {datos.bitacora.map((b) => (
              <RenglonBitacora
                key={b.id}
                obraId={datos.obra.id}
                entrada={b}
                editable={!cerrada && b.tipo === 'nota'}
              />
            ))}
          </ul>
        )}
      </Tarjeta>

      {editando && (
        <FormularioTarea
          obraId={datos.obra.id}
          tarea={editando === 'nueva' || 'padre' in editando ? undefined : editando}
          padre={editando !== 'nueva' && 'padre' in editando ? editando.padre : undefined}
          tieneHijas={
            editando !== 'nueva' &&
            !('padre' in editando) &&
            (hijosDe.get(editando.id)?.length ?? 0) > 0
          }
          orden={datos.tareas.length}
          oficiales={datos.oficiales}
          onCerrar={() => setEditando(null)}
        />
      )}

      {recorriendo && (
        <DialogoRecorrer obraId={datos.obra.id} onCerrar={() => setRecorriendo(false)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function FilaTarea({
  tarea, hija, linea, responsables, cerrada, pendiente, onEditar, onSubtarea, onTerminar, onEliminar,
}: {
  tarea: CronogramaTarea
  hija?: boolean
  linea: { inicio: number; fin: number; dias: number } | null
  responsables: Map<string, string>
  cerrada: boolean
  pendiente: boolean
  onEditar: () => void
  onSubtarea?: () => void
  onTerminar: () => void
  onEliminar: () => void
}) {
  const inicio = tarea.fecha_inicio ? new Date(`${tarea.fecha_inicio}T00:00:00`).getTime() : null
  const fin = tarea.fecha_fin ? new Date(`${tarea.fecha_fin}T00:00:00`).getTime() : inicio
  const desfase = linea && inicio ? ((inicio - linea.inicio) / DIA / linea.dias) * 100 : 0
  const ancho =
    linea && inicio && fin ? Math.max(3, (((fin - inicio) / DIA + 1) / linea.dias) * 100) : 0

  return (
    // Toda la fila abre la tarea; los botones de la derecha frenan el click.
    <div
      role="button"
      tabIndex={cerrada ? -1 : 0}
      onClick={() => !cerrada && onEditar()}
      onKeyDown={(e) => {
        if (!cerrada && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onEditar()
        }
      }}
      className={`px-4 py-3 transition ${cerrada ? '' : 'cursor-pointer hover:bg-tinta-50/60'} ${
        hija ? 'border-l-2 border-tinta-150 pl-4 ml-6' : ''
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className={`text-sm font-medium ${hija ? 'text-tinta-700' : 'text-tinta-900'}`}>
          {tarea.nombre}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-tinta-500">
            {fecha(tarea.fecha_inicio)} → {fecha(tarea.fecha_fin)}
          </span>
          <span
            className={`text-xs font-semibold tabular-nums ${
              tarea.avance_pct >= 100 ? 'text-haaco-700' : 'text-tinta-500'
            }`}
          >
            {Math.round(tarea.avance_pct)}%
          </span>
          <Etiqueta tono={ESTATUS_TAREA[tarea.estatus].tono}>
            {ESTATUS_TAREA[tarea.estatus].texto}
          </Etiqueta>
          {!cerrada && tarea.estatus !== 'terminada' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTerminar()
              }}
              disabled={pendiente}
              className="inline-flex items-center gap-1 rounded-lg border-[0.5px] border-tinta-200 px-2 py-1 text-xs font-medium text-tinta-600 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800"
              aria-label={`Marcar ${tarea.nombre} como terminada`}
            >
              <Check size={12} />
              Terminar
            </button>
          )}
          {!cerrada && onSubtarea && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSubtarea()
              }}
              className="inline-flex items-center gap-1 rounded-lg border-[0.5px] border-tinta-200 px-2 py-1 text-xs font-medium text-tinta-600 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800"
            >
              <Plus size={12} />
              Subtarea
            </button>
          )}
          {!cerrada && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEliminar()
              }}
              disabled={pendiente}
              className="rounded p-1 text-tinta-400 hover:bg-red-50 hover:text-red-600"
              aria-label={`Eliminar ${tarea.nombre}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {linea && inicio && (
        <div className={`overflow-hidden rounded-full bg-tinta-100 ${hija ? 'h-1.5' : 'h-2.5'}`}>
          <div
            className={`h-full rounded-full ${
              tarea.estatus === 'terminada'
                ? 'bg-haaco-500'
                : tarea.estatus === 'en_proceso'
                  ? 'bg-sky-500'
                  : 'bg-tinta-300'
            }`}
            style={{ marginLeft: `${desfase}%`, width: `${ancho}%` }}
          />
        </div>
      )}

      {tarea.responsable_id && (
        <p className="mt-1 text-xs text-tinta-400">{responsables.get(tarea.responsable_id)}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function FormularioTarea({
  obraId, tarea, padre, tieneHijas, orden, oficiales, onCerrar,
}: {
  obraId: string
  tarea?: CronogramaTarea
  /** Si viene, la tarea nueva se cuelga de ésta como subtarea. */
  padre?: CronogramaTarea
  /** Con subtareas, el avance de la tarea es derivado y no se captura. */
  tieneHijas?: boolean
  orden: number
  oficiales: DatosObra['oficiales']
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [nombre, setNombre] = useState(tarea?.nombre ?? '')
  const [inicio, setInicio] = useState(tarea?.fecha_inicio ?? padre?.fecha_inicio ?? hoyISO())
  const [fin, setFin] = useState(tarea?.fecha_fin ?? '')
  const [estatus, setEstatus] = useState<EstatusTarea>(tarea?.estatus ?? 'pendiente')
  const [responsable, setResponsable] = useState(tarea?.responsable_id ?? '')
  const [peso, setPeso] = useState(String(tarea?.peso ?? 1))
  const [avance, setAvance] = useState(String(Math.round(tarea?.avance_pct ?? 0)))

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarTarea(obraId, {
        id: tarea?.id,
        padre_id: tarea?.padre_id ?? padre?.id ?? null,
        nombre,
        fecha_inicio: inicio || null,
        fecha_fin: fin || inicio || null,
        estatus,
        responsable_id: responsable || null,
        orden: tarea?.orden ?? orden,
        peso: num(peso) || 1,
        avance_pct: tieneHijas ? null : num(avance),
      })
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={tarea ? 'Editar tarea' : padre ? 'Nueva subtarea' : 'Nueva tarea'}
      descripcion={padre ? `Cuelga de «${padre.nombre}».` : undefined}
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Tarea"
          hijo={
            <Entrada
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Aplicación de sellador"
              autoFocus
            />
          }
        />
        <Campo
          etiqueta="Inicio"
          ancho="medio"
          hijo={<SelectorFecha valor={inicio} onCambio={setInicio} />}
        />
        <Campo
          etiqueta="Fin"
          ancho="medio"
          hijo={<SelectorFecha valor={fin} onCambio={setFin} />}
        />
        <Campo
          etiqueta="Estatus"
          ancho="medio"
          hijo={
            <Seleccion
              value={estatus}
              onChange={(e) => {
                const v = e.target.value as EstatusTarea
                setEstatus(v)
                if (v === 'terminada') setAvance('100')
                else if (v === 'pendiente') setAvance('0')
              }}
            >
              <option value="pendiente">Pendiente</option>
              <option value="en_proceso">En proceso</option>
              <option value="terminada">Terminada</option>
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Responsable"
          ancho="medio"
          hijo={
            <Seleccion value={responsable} onChange={(e) => setResponsable(e.target.value)}>
              <option value="">Sin asignar</option>
              {oficiales.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Seleccion>
          }
        />
        {!tieneHijas && (
          <Campo
            etiqueta="Avance (%)"
            ancho="medio"
            hijo={<Numero value={avance} onChange={(e) => setAvance(e.target.value)} max={100} />}
            ayuda="Al 100 % la tarea queda terminada sola."
          />
        )}
        <Campo
          etiqueta="Peso"
          ancho="medio"
          hijo={<Numero value={peso} onChange={(e) => setPeso(e.target.value)} />}
          ayuda={
            tieneHijas
              ? 'El avance se calcula desde sus subtareas. El peso dice qué tanto pesa en la obra.'
              : 'Qué tanto pesa la tarea en el avance global. Lijar toda la casa pesa más que un retoque.'
          }
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
          disabled={pendiente || !nombre.trim()}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------
function DialogoRecorrer({ obraId, onCerrar }: { obraId: string; onCerrar: () => void }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [dias, setDias] = useState('1')
  const [desde, setDesde] = useState(hoyISO())
  const [resultado, setResultado] = useState<number | null>(null)

  const recorrer = (signo: 1 | -1) =>
    iniciar(async () => {
      setError(null)
      const r = await recorrerCronograma(obraId, signo * Math.abs(num(dias)), desde)
      if (!r.ok) return setError(r.error)
      setResultado(r.datos ?? 0)
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo="Recorrer el cronograma"
      descripcion="Mueve las tareas que todavía no terminan. Llovió, faltó el oficial, se atrasó el material."
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Días"
          ancho="medio"
          hijo={<Numero value={dias} onChange={(e) => setDias(e.target.value)} autoFocus />}
        />
        <Campo
          etiqueta="A partir de"
          ancho="medio"
          hijo={<SelectorFecha valor={desde} onCambio={setDesde} />}
          ayuda="Sólo se mueven las tareas que empiezan en esa fecha o después."
        />

        {resultado != null && (
          <p className="rounded-lg bg-haaco-50 px-3 py-2 text-sm text-haaco-800 ring-1 ring-haaco-200 sm:col-span-2">
            Se movieron {resultado} {resultado === 1 ? 'tarea' : 'tareas'}. Quedó anotado en la
            bitácora.
          </p>
        )}
        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        <button
          type="button"
          onClick={onCerrar}
          className="mr-auto rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={() => recorrer(-1)}
          disabled={pendiente}
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50"
        >
          − {Math.abs(num(dias))} días
        </button>
        <button
          type="button"
          onClick={() => recorrer(1)}
          disabled={pendiente}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          + {Math.abs(num(dias))} días
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
