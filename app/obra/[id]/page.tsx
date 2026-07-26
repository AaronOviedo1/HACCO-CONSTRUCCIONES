import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Camera, ChevronLeft, FileText, MapPin, Video } from 'lucide-react'
import { crearClienteServidor } from '@/lib/supabase/server'
import { requerirRol } from '@/lib/auth'
import { fecha, fechaHora } from '@/lib/format'
import { ESTATUS_OBRA, ESTATUS_TAREA } from '@/lib/obras'
import { Etiqueta } from '@/components/ui'
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

  return (
    <>
      <Link
        href="/obra"
        className="mb-3 inline-flex items-center gap-1 text-sm text-tinta-500 active:text-tinta-800"
      >
        <ChevronLeft size={16} />
        Mis obras
      </Link>

      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-tinta-900">{obra.nombre}</h1>
          <Etiqueta tono={ESTATUS_OBRA[obra.estatus].tono}>{ESTATUS_OBRA[obra.estatus].texto}</Etiqueta>
        </div>
        <p className="mt-0.5 font-mono text-xs text-tinta-400">OT {obra.ot_numero}</p>

        {obra.domicilio && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(obra.domicilio)}`}
            target="_blank"
            rel="noopener"
            className="mt-2 flex items-start gap-1.5 text-sm text-haaco-700"
          >
            <MapPin size={15} className="mt-0.5 shrink-0" />
            <span className="underline">{obra.domicilio}</span>
          </a>
        )}

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-tinta-500">Avance</span>
            <span className="font-semibold tabular-nums text-tinta-800">
              {Number(obra.avance_pct)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-tinta-100">
            <div
              className="h-full rounded-full bg-haaco-500"
              style={{ width: `${Math.min(100, Number(obra.avance_pct))}%` }}
            />
          </div>
        </div>
      </header>

      {!cerrada && (
        <div className="mb-4 space-y-3">
          <CapturarAvance obraId={id} avanceActual={Number(obra.avance_pct)} />
          {esHerrero && <PedirMaterial obraId={id} />}
        </div>
      )}

      {/* Cronograma ------------------------------------------------------- */}
      {(tareas ?? []).length > 0 && (
        <section className="mb-4 rounded-2xl border border-tinta-200 bg-white p-4">
          <h2 className="mb-2.5 text-base font-semibold text-tinta-900">Mi cronograma</h2>
          <ul className="space-y-2">
            {(tareas ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <span
                  className={`text-sm ${
                    t.estatus === 'terminada' ? 'text-tinta-400 line-through' : 'text-tinta-700'
                  }`}
                >
                  {t.nombre}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-tinta-400">{fecha(t.fecha_inicio)}</span>
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
        <section className="mb-4 rounded-2xl border border-tinta-200 bg-white p-4">
          <h2 className="mb-2.5 text-base font-semibold text-tinta-900">Material que pedí</h2>
          <ul className="space-y-2.5">
            {(solicitudes ?? []).map((s) => (
              <li key={s.id} className="rounded-xl bg-tinta-50 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <Etiqueta
                    tono={
                      s.estatus === 'comprada' ? 'verde' : s.estatus === 'cotizada' ? 'azul' : 'ambar'
                    }
                  >
                    {s.estatus === 'comprada'
                      ? 'Comprado'
                      : s.estatus === 'cotizada'
                        ? 'Cotizado'
                        : 'Pendiente'}
                  </Etiqueta>
                  <span className="text-xs text-tinta-400">{fecha(s.created_at)}</span>
                </div>
                <ul className="space-y-0.5 text-sm text-tinta-700">
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
      <section>
        <h2 className="mb-2.5 text-base font-semibold text-tinta-900">Lo que hemos subido</h2>

        {(avances ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-tinta-300 bg-white px-4 py-8 text-center text-sm text-tinta-500">
            Todavía no hay avances. Sube la primera foto.
          </p>
        ) : (
          <ul className="space-y-3">
            {(avances ?? []).map((a) => {
              const Icono = ICONO[a.tipo]
              const url = a.storage_path ? urls.get(a.storage_path) : null

              return (
                <li key={a.id} className="rounded-2xl border border-tinta-200 bg-white p-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Icono size={14} className="text-tinta-400" />
                    <span className="text-xs text-tinta-500">{fechaHora(a.created_at)}</span>
                    {a.porcentaje_avance != null && (
                      <Etiqueta tono="verde">{Number(a.porcentaje_avance)}%</Etiqueta>
                    )}
                  </div>

                  {a.comentario && (
                    <p className="mb-2 whitespace-pre-line text-sm text-tinta-700">{a.comentario}</p>
                  )}

                  {url && a.tipo === 'foto' && (
                    <a href={url} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={a.comentario ?? 'Avance'}
                        className="max-h-80 w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                    </a>
                  )}
                  {url && a.tipo === 'video' && (
                    <video src={url} controls preload="metadata" className="max-h-80 w-full rounded-xl" />
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
