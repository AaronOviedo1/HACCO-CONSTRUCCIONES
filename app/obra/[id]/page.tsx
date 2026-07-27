import { notFound } from 'next/navigation'
import { Camera, FileText, Video } from 'lucide-react'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, fechaHora } from '@/lib/format'
import { ESTATUS_OBRA, ESTATUS_TAREA } from '@/lib/obras'
import { Etiqueta } from '@/components/ui'
import { Anillo, CabeceraDetalle } from '@/components/movil/piezas'
import { CapturarAvance } from '@/components/obra/capturar-avance'
import { PedirMaterial } from '@/components/obra/pedir-material'

export const dynamic = 'force-dynamic'

const ICONO = { foto: Camera, video: Video, nota: FileText } as const

export default async function ObraDeCuadrilla({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await requerirRol(['cuadrilla'])
  const { id } = await params
  const supabase = await crearClienteServidor()

  // RLS garantiza que sólo salga si el oficial tiene contrato en esta obra.
  const { data: obra } = await supabase.from('obras').select('*').eq('id', id).maybeSingle()
  if (!obra) notFound()

  const [{ data: avances }, { data: tareas }, { data: solicitudes }] = await Promise.all([
    supabase.from('avances').select('*').eq('obra_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('cronograma_tareas').select('*').eq('obra_id', id).order('orden'),
    supabase.from('solicitudes_material').select('*').eq('obra_id', id).order('created_at', { ascending: false }),
  ])

  const rutas = (avances ?? []).map((a) => a.storage_path).filter((r): r is string => Boolean(r))
  const urls = new Map<string, string>()
  if (rutas.length > 0) {
    const { data } = await supabase.storage.from('avances').createSignedUrls(rutas, 3600)
    for (const f of data ?? []) if (f.path && f.signedUrl) urls.set(f.path, f.signedUrl)
  }

  const esHerrero = perfil.oficio === 'herrero'
  const cerrada = obra.estatus === 'cerrada'
  const avance = Number(obra.avance_pct)

  return (
    <>
      <CabeceraDetalle titulo="Obra" volverA="/obra" />

      <header className="px-0.5 pt-2">
        <h1 className="text-[26px] font-bold leading-tight -tracking-[0.7px]">{obra.nombre}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-[11.5px] text-tinta-400">OT {obra.ot_numero}</span>
          <Etiqueta tono={ESTATUS_OBRA[obra.estatus].tono}>{ESTATUS_OBRA[obra.estatus].texto}</Etiqueta>
        </div>

        {obra.domicilio && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(obra.domicilio)}`}
            target="_blank"
            rel="noopener"
            className="mt-2.5 flex items-start gap-1.5 text-[13.5px] text-haaco-700"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden>
              <path
                d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.9" />
            </svg>
            <span className="underline">{obra.domicilio}</span>
          </a>
        )}
      </header>

      <section className="mt-4 flex items-center gap-4 rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta">
        <Anillo pct={avance}>
          <span className="text-[26px] font-bold -tracking-[1px]">{avance}%</span>
          <span className="mt-1 text-[9.5px] uppercase tracking-[0.07em] text-tinta-400">avance</span>
        </Anillo>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.07em] text-tinta-400">Entrega estimada</p>
          <p className="mt-0.5 text-base font-semibold">{fecha(obra.fecha_estimada_entrega)}</p>
          <p className="mt-3 text-[11px] uppercase tracking-[0.07em] text-tinta-400">Oficial</p>
          <p className="mt-0.5 truncate text-sm font-medium">{perfil.nombre}</p>
        </div>
      </section>

      {!cerrada && (
        <div id="subir" className="mt-4 flex flex-col gap-3 scroll-mt-20">
          <CapturarAvance obraId={id} avanceActual={avance} />
          {esHerrero && <PedirMaterial obraId={id} />}
        </div>
      )}

      {/* Cronograma ------------------------------------------------------- */}
      {(tareas ?? []).length > 0 && (
        <section className="mt-4 rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta">
          <h2 className="mb-3 text-[14.5px] font-semibold">Mi cronograma</h2>
          <ul className="flex flex-col gap-2.5">
            {(tareas ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2.5">
                <span
                  className={`min-w-0 truncate text-[13.5px] ${
                    t.estatus === 'terminada' ? 'text-tinta-400 line-through' : 'text-tinta-700'
                  }`}
                >
                  {t.nombre}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-tinta-400">{fecha(t.fecha_inicio)}</span>
                  <Etiqueta tono={ESTATUS_TAREA[t.estatus].tono}>
                    {ESTATUS_TAREA[t.estatus].texto}
                  </Etiqueta>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Solicitudes ------------------------------------------------------ */}
      {esHerrero && (solicitudes ?? []).length > 0 && (
        <section className="mt-4 rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-4 shadow-tarjeta">
          <h2 className="mb-3 text-[14.5px] font-semibold">Material que pedí</h2>
          <ul className="flex flex-col gap-2.5">
            {(solicitudes ?? []).map((s) => (
              <li key={s.id} className="rounded-[14px] bg-tinta-50 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <Etiqueta
                    tono={s.estatus === 'comprada' ? 'verde' : s.estatus === 'cotizada' ? 'azul' : 'ambar'}
                  >
                    {s.estatus === 'comprada'
                      ? 'Comprado'
                      : s.estatus === 'cotizada'
                        ? 'Cotizado'
                        : 'Pendiente'}
                  </Etiqueta>
                  <span className="text-[11px] text-tinta-400">{fecha(s.created_at)}</span>
                </div>
                <ul className="text-[13.5px] leading-relaxed text-tinta-700">
                  {(Array.isArray(s.items) ? s.items : []).map((item: unknown, i: number) => {
                    const it = item as { material?: string; cantidad?: number; unidad?: string }
                    return (
                      <li key={i}>
                        {it.cantidad} {it.unidad} · {it.material}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Feed ------------------------------------------------------------- */}
      <section className="mt-4">
        <h2 className="mb-3 px-0.5 text-[14.5px] font-semibold">Lo que hemos subido</h2>

        {(avances ?? []).length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-tinta-300 bg-white px-4 py-8 text-center text-sm text-tinta-500">
            Todavía no hay avances. Sube la primera foto.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(avances ?? []).map((a) => {
              const Icono = ICONO[a.tipo]
              const url = a.storage_path ? urls.get(a.storage_path) : null

              return (
                <li
                  key={a.id}
                  className="rounded-[20px] border-[0.5px] border-tinta-200 bg-white p-3 shadow-tarjeta"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icono size={14} className="text-tinta-400" />
                    <span className="text-[11.5px] text-tinta-500">{fechaHora(a.created_at)}</span>
                    {a.porcentaje_avance != null && (
                      <Etiqueta tono="verde">{Number(a.porcentaje_avance)}%</Etiqueta>
                    )}
                  </div>

                  {a.comentario && (
                    <p className="mb-2.5 whitespace-pre-line px-1 text-sm leading-relaxed text-tinta-700">
                      {a.comentario}
                    </p>
                  )}

                  {url && a.tipo === 'foto' && (
                    <a href={url} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={a.comentario ?? 'Avance'}
                        className="max-h-80 w-full rounded-[14px] object-cover"
                        loading="lazy"
                      />
                    </a>
                  )}
                  {url && a.tipo === 'video' && (
                    <video src={url} controls preload="metadata" className="max-h-80 w-full rounded-[14px]" />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
