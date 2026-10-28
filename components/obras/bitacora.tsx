'use client'

import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/components/clases'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { CalendarClock, ImagePlus, NotebookPen, Pencil, Trash2, X } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { SelectorFecha } from '@/components/filtro-fechas'
import { useEsOficina } from '@/components/permisos'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { fecha, fechaHora } from '@/lib/format'
import { hoyISO, num } from '@/lib/cotizaciones'
import { CLASES_BITACORA, MAX_FOTOS_BITACORA } from '@/lib/obras'
import { prepararTicket } from '@/lib/ticket'
import { anotarEnBitacora, eliminarNotaBitacora } from '@/app/admin/obras/acciones'
import type { BitacoraObra, ClaseBitacora, CronogramaTarea } from '@/types/database'
import type { DatosObra } from '@/app/admin/obras/datos'

/**
 * La pestaña de bitácora de una OT (app/admin/obras/[id]): el registro de lo
 * que de verdad pasó en la obra, día por día. Dos cosas conviven en la misma
 * lista: lo que anotan solos los triggers —estatus, fechas movidas, avances,
 * pagarés— y lo que escribe quien va a la obra, con su clase de evento, sus
 * fotos y la tarea del cronograma a la que afecta. Lo segundo se corrige; lo
 * primero es historial y se lee.
 *
 * Es la bitácora de COS traída aquí, porque Abdel la llenaba allá.
 */

export function PanelBitacora({ datos }: { datos: DatosObra }) {
  const [editando, setEditando] = useState<BitacoraObra | 'nueva' | null>(null)
  const cerrada = datos.concentrado.estatus === 'cerrada'
  const tareas = new Map(datos.tareas.map((t) => [t.id, t.nombre]))

  return (
    <>
      <Tarjeta
        titulo={
          <span className="flex items-center justify-between gap-2">
            <span>Bitácora de la obra</span>
            {!cerrada && (
              <button
                type="button"
                onClick={() => setEditando('nueva')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-haaco-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-haaco-800"
              >
                <NotebookPen size={14} />
                Registrar
              </button>
            )}
          </span>
        }
        pie="Los movimientos del cronograma, los avances y los pagarés se anotan solos. Lo que pasa en la obra —material que llegó, lluvia, faltas, retrasos— se registra aquí."
      >
        {datos.bitacora.length === 0 ? (
          <EstadoVacio
            titulo="Sin movimientos"
            descripcion="Registra lo que pasó hoy en la obra: llegó el material, llovió, faltó el oficial."
          />
        ) : (
          <ul className="divide-y divide-tinta-100">
            {datos.bitacora.map((b) => (
              <RenglonBitacora
                key={b.id}
                obraId={datos.obra.id}
                entrada={b}
                fotos={datos.fotosBitacora}
                autor={b.autor_id ? datos.autoresBitacora[b.autor_id] : undefined}
                tarea={b.tarea_id ? tareas.get(b.tarea_id) : undefined}
                editable={!cerrada && b.tipo === 'nota'}
                onEditar={() => setEditando(b)}
              />
            ))}
          </ul>
        )}
      </Tarjeta>

      {editando && (
        <FormularioBitacora
          obraId={datos.obra.id}
          entrada={editando === 'nueva' ? undefined : editando}
          tareas={datos.tareas}
          fotosFirmadas={datos.fotosBitacora}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
function RenglonBitacora({
  obraId, entrada, fotos, autor, tarea, editable, onEditar,
}: {
  obraId: string
  entrada: BitacoraObra
  fotos: Record<string, string>
  autor?: string
  tarea?: string
  editable: boolean
  onEditar: () => void
}) {
  const router = useRouter()
  const oficina = useEsOficina()
  const [pendiente, iniciar] = useTransition()
  const aMano = entrada.tipo === 'nota'
  const clase = CLASES_BITACORA[entrada.clase]

  const borrar = () =>
    iniciar(async () => {
      if (!confirm('¿Borrar esta entrada de la bitácora? Sus fotos también se borran.')) return
      await eliminarNotaBitacora(obraId, entrada.id)
      router.refresh()
    })

  return (
    <li className="flex items-start gap-2 px-4 py-3 sm:px-5">
      <span className="min-w-0 flex-1">
        {aMano && (
          <span className="mb-1 flex flex-wrap items-center gap-1.5">
            <Etiqueta tono={clase.tono}>{clase.texto}</Etiqueta>
            {entrada.fecha && (
              <span className="text-xs font-medium text-tinta-600">{fecha(entrada.fecha)}</span>
            )}
          </span>
        )}

        {entrada.descripcion && (
          <p className="whitespace-pre-line text-sm text-tinta-700">{entrada.descripcion}</p>
        )}

        {tarea && (
          <p className="mt-1 flex items-center gap-1 text-xs text-tinta-500">
            <CalendarClock size={12} />
            {tarea}
            {entrada.dias_impacto != null && (
              <span className="font-medium text-amber-700">
                · recorrida {entrada.dias_impacto} {entrada.dias_impacto === 1 ? 'día' : 'días'}
              </span>
            )}
          </p>
        )}

        {entrada.fotos.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {entrada.fotos.map((ruta) =>
              fotos[ruta] ? (
                <a
                  key={ruta}
                  href={fotos[ruta]}
                  target="_blank"
                  rel="noopener"
                  className="block h-20 w-20 overflow-hidden rounded-lg bg-tinta-100"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que caduca */}
                  <img src={fotos[ruta]} alt="" className="h-full w-full object-cover" />
                </a>
              ) : (
                <span key={ruta} className="block h-20 w-20 rounded-lg bg-tinta-100" />
              ),
            )}
          </span>
        )}

        <p className="mt-1 text-xs text-tinta-400">
          {fechaHora(entrada.created_at)}
          {autor && ` · ${autor}`}
          {!aMano && ` · ${entrada.tipo}`}
        </p>
      </span>

      {editable && (
        <span className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onEditar}
            className="rounded p-1.5 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-700"
            aria-label="Corregir la entrada"
          >
            <Pencil size={13} />
          </button>
          {oficina && (
            <button
              type="button"
              onClick={borrar}
              disabled={pendiente}
              className="rounded p-1.5 text-tinta-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              aria-label="Borrar la entrada"
            >
              <Trash2 size={13} />
            </button>
          )}
        </span>
      )}
    </li>
  )
}

// ---------------------------------------------------------------------------
type FotoNueva = { archivo: File; vista: string }

function FormularioBitacora({
  obraId, entrada, tareas, fotosFirmadas, onCerrar,
}: {
  obraId: string
  entrada?: BitacoraObra
  tareas: CronogramaTarea[]
  fotosFirmadas: Record<string, string>
  onCerrar: () => void
}) {
  const router = useRouter()
  const entradaArchivo = useRef<HTMLInputElement>(null)
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [clase, setClase] = useState<ClaseBitacora>(entrada?.clase ?? 'nota')
  const [dia, setDia] = useState(entrada?.fecha ?? hoyISO())
  const [descripcion, setDescripcion] = useState(entrada?.descripcion ?? '')
  const [tareaId, setTareaId] = useState(entrada?.tarea_id ?? '')
  const [dias, setDias] = useState('')
  const [guardadas, setGuardadas] = useState<string[]>(entrada?.fotos ?? [])
  const [nuevas, setNuevas] = useState<FotoNueva[]>([])

  const lugares = MAX_FOTOS_BITACORA - guardadas.length - nuevas.length
  // El retraso sólo recorre la tarea al registrarse; al corregir ya pasó.
  const recorre = !entrada && clase === 'retraso' && Boolean(tareaId)

  // Las subtareas cuelgan de su tarea, como en el cronograma.
  const padres = tareas.filter((t) => !t.padre_id)
  const opcionesTarea = padres.flatMap((p) => [
    { id: p.id, nombre: p.nombre },
    ...tareas.filter((t) => t.padre_id === p.id).map((t) => ({ id: t.id, nombre: `↳ ${t.nombre}` })),
  ])

  const agregar = (lista: FileList | null) => {
    setError(null)
    if (!lista) return
    const imagenes = [...lista].filter((f) => f.type.startsWith('image/'))
    if (imagenes.length > lugares) {
      setError(`Caben hasta ${MAX_FOTOS_BITACORA} fotos por entrada; se tomaron las primeras ${lugares}.`)
    }
    setNuevas((n) => [
      ...n,
      ...imagenes.slice(0, Math.max(0, lugares)).map((archivo) => ({
        archivo,
        vista: URL.createObjectURL(archivo),
      })),
    ])
    if (entradaArchivo.current) entradaArchivo.current.value = ''
  }

  const quitarNueva = (i: number) =>
    setNuevas((n) => {
      URL.revokeObjectURL(n[i].vista)
      return n.filter((_, j) => j !== i)
    })

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const supabase = crearClienteNavegador()

      // Primero las fotos, ya reducidas: diez fotos de teléfono sin tocar son
      // 50 MB, y con la señal de la obra no subirían nunca.
      const subidas: string[] = []
      for (const { archivo } of nuevas) {
        const ruta = `${obraId}/bitacora/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const { error: errorSubida } = await supabase.storage
          .from('avances')
          .upload(ruta, await prepararTicket(archivo), { contentType: 'image/jpeg', upsert: false })
        if (errorSubida) {
          if (subidas.length > 0) await supabase.storage.from('avances').remove(subidas)
          return setError(`No se pudo subir una foto: ${errorSubida.message}`)
        }
        subidas.push(ruta)
      }

      const r = await anotarEnBitacora(
        obraId,
        {
          clase,
          descripcion,
          fecha: dia || null,
          fotos: [...guardadas, ...subidas],
          tarea_id: tareaId || null,
          dias_impacto: recorre ? Math.round(num(dias)) || null : null,
        },
        entrada?.id,
      )
      if (!r.ok) {
        if (subidas.length > 0) await supabase.storage.from('avances').remove(subidas)
        return setError(r.error)
      }

      for (const n of nuevas) URL.revokeObjectURL(n.vista)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      titulo={entrada ? 'Corregir la entrada' : 'Registrar en la bitácora'}
      descripcion={entrada ? undefined : 'Qué pasó en la obra, con fotos si las hay.'}
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Qué fue"
          ancho="medio"
          hijo={
            <Seleccion value={clase} onChange={(e) => setClase(e.target.value as ClaseBitacora)}>
              {(Object.keys(CLASES_BITACORA) as ClaseBitacora[]).map((c) => (
                <option key={c} value={c}>
                  {CLASES_BITACORA[c].texto}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Día"
          ancho="medio"
          hijo={<SelectorFecha valor={dia} onCambio={setDia} />}
        />
        <Campo
          etiqueta="Qué pasó"
          hijo={
            <AreaTexto
              rows={3}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Llegó el sellador / No se trabajó por lluvia / Faltó el oficial…"
              autoFocus
            />
          }
        />

        {tareas.length > 0 && (
          <Campo
            etiqueta="Tarea afectada"
            ancho={recorre ? 'medio' : 'completo'}
            hijo={
              <Seleccion value={tareaId} onChange={(e) => setTareaId(e.target.value)}>
                <option value="">Sin tarea</option>
                {opcionesTarea.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </Seleccion>
            }
          />
        )}
        {recorre && (
          <Campo
            etiqueta="Días de retraso"
            ancho="medio"
            hijo={<Numero value={dias} onChange={(e) => setDias(e.target.value)} placeholder="0" />}
            ayuda="Recorre la tarea: completa si no ha empezado, sólo su fin si ya va en curso."
          />
        )}
        {entrada?.dias_impacto != null && (
          <p className="text-xs text-tinta-500 sm:col-span-2">
            Este retraso ya recorrió su tarea {entrada.dias_impacto}{' '}
            {entrada.dias_impacto === 1 ? 'día' : 'días'}. Corregir la entrada no la vuelve a mover.
          </p>
        )}

        {/* Fotos: no van dentro de un <label> como los demás campos porque
            un toque en «quitar» abriría el selector de archivos. */}
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-tinta-700">
            Fotos{' '}
            <span className="font-normal text-tinta-400">
              ({guardadas.length + nuevas.length} de {MAX_FOTOS_BITACORA})
            </span>
          </span>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
            {guardadas.map((ruta) => (
              <Miniatura
                key={ruta}
                src={fotosFirmadas[ruta]}
                onQuitar={() => setGuardadas((g) => g.filter((r) => r !== ruta))}
              />
            ))}
            {nuevas.map((n, i) => (
              <Miniatura key={n.vista} src={n.vista} onQuitar={() => quitarNueva(i)} />
            ))}
            {lugares > 0 && (
              <button
                type="button"
                onClick={() => entradaArchivo.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-tinta-300 text-xs text-tinta-500 transition hover:bg-tinta-50"
              >
                <ImagePlus size={18} />
                Agregar
              </button>
            )}
          </div>
          <input
            ref={entradaArchivo}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => agregar(e.target.files)}
          />
        </div>

        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      <PieDialogo>
        <button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || (!descripcion.trim() && guardadas.length + nuevas.length === 0)}
          className={BOTON_PRIMARIO}
        >
          {pendiente ? 'Guardando…' : entrada ? 'Guardar' : 'Registrar'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

function Miniatura({ src, onQuitar }: { src?: string; onQuitar: () => void }) {
  return (
    <span className="relative block aspect-square overflow-hidden rounded-lg bg-tinta-100">
      {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local o URL firmada */}
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onQuitar}
        className="absolute right-1 top-1 rounded-full bg-tinta-900/60 p-1 text-white transition hover:bg-tinta-900/80"
        aria-label="Quitar foto"
      >
        <X size={12} />
      </button>
    </span>
  )
}
