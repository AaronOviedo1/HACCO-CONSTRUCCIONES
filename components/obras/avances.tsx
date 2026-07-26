import { Camera, FileText, Video } from 'lucide-react'
import { crearClienteServidor } from '@/lib/supabase/server'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { fechaHora } from '@/lib/format'
import type { DatosObra } from '@/app/admin/obras/datos'

const ICONO = { foto: Camera, video: Video, nota: FileText } as const

/**
 * Feed cronológico de lo que sube la cuadrilla. Reemplaza el grupo de
 * WhatsApp: aquí las fotos quedan pegadas a su obra y a su fecha.
 */
export async function PanelAvances({ datos }: { datos: DatosObra }) {
  const supabase = await crearClienteServidor()

  const rutas = datos.avances.map((a) => a.storage_path).filter((r): r is string => Boolean(r))
  const urls = new Map<string, string>()

  if (rutas.length > 0) {
    const { data } = await supabase.storage.from('avances').createSignedUrls(rutas, 3600)
    for (const firma of data ?? []) {
      if (firma.path && firma.signedUrl) urls.set(firma.path, firma.signedUrl)
    }
  }

  const autores = new Map(datos.oficiales.map((o) => [o.id, o.nombre]))

  if (datos.avances.length === 0) {
    return (
      <Tarjeta>
        <EstadoVacio
          titulo="Todavía no hay avances"
          descripcion="La cuadrilla sube fotos y el porcentaje desde su teléfono, en la pantalla /obra. Cada avance actualiza el porcentaje de la OT."
        />
      </Tarjeta>
    )
  }

  return (
    <div className="space-y-3">
      {datos.avances.map((avance) => {
        const Icono = ICONO[avance.tipo]
        const url = avance.storage_path ? urls.get(avance.storage_path) : null

        return (
          <Tarjeta key={avance.id}>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-haaco-50 text-haaco-700">
                <Icono size={16} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-tinta-900">
                    {autores.get(avance.autor_id) ?? 'Cuadrilla'}
                  </span>
                  <span className="text-xs text-tinta-400">{fechaHora(avance.created_at)}</span>
                  {avance.porcentaje_avance != null && (
                    <Etiqueta tono="verde">{Number(avance.porcentaje_avance)}% de avance</Etiqueta>
                  )}
                </div>

                {avance.comentario && (
                  <p className="mt-1.5 whitespace-pre-line text-sm text-tinta-700">
                    {avance.comentario}
                  </p>
                )}

                {url && avance.tipo === 'foto' && (
                  <a href={url} target="_blank" rel="noopener" className="mt-2.5 block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={avance.comentario ?? 'Avance de obra'}
                      className="max-h-96 w-full rounded-xl border border-tinta-200 object-cover"
                      loading="lazy"
                    />
                  </a>
                )}

                {url && avance.tipo === 'video' && (
                  <video
                    src={url}
                    controls
                    preload="metadata"
                    className="mt-2.5 max-h-96 w-full rounded-xl border border-tinta-200"
                  />
                )}
              </div>
            </div>
          </Tarjeta>
        )
      })}
    </div>
  )
}
