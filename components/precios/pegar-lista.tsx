'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Camera, Check, Loader2, Sparkles, X } from 'lucide-react'
import { AreaTexto, MensajeError, Seleccion } from '@/components/formulario'
import { pesos } from '@/lib/format'
import { prepararTicket } from '@/lib/ticket'
import { registrarPrecio } from '@/app/admin/precios/acciones'

type RenglonLeido = {
  descripcion: string
  precio: number
  unidad: string | null
  producto_id: string | null
  producto: string | null
}

/**
 * La lista que el vendedor manda por WhatsApp.
 *
 * Se pega el texto o se sube la foto, y la misma lectura que ya se usa para los
 * tickets la convierte en renglones. Cada uno se guarda por separado y sólo si
 * se le dice qué material es: nada entra a ciegas.
 *
 * Estos precios sí actualizan el catálogo al confirmarlos —está mirando la
 * lista mientras lo hace, igual que en la llamada—.
 */
export function PegarLista({ productos }: { productos: { id: string; nombre: string; unidad: string }[] }) {
  const router = useRouter()
  const archivo = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [renglones, setRenglones] = useState<RenglonLeido[] | null>(null)
  const [proveedor, setProveedor] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)

  const leer = async (foto?: File) => {
    setLeyendo(true)
    setError(null)
    setAviso(null)
    try {
      const cuerpo = new FormData()
      if (foto) cuerpo.append('archivo', await prepararTicket(foto), foto.name)
      if (texto.trim()) cuerpo.append('texto', texto)

      const r = await fetch('/api/lista-precios', { method: 'POST', body: cuerpo })
      const datos = await r.json()
      if (!r.ok || !datos.lectura) {
        setError(datos.error ?? 'No se pudo leer la lista.')
        return
      }
      setRenglones(datos.lectura.renglones)
      setProveedor(datos.lectura.proveedor)
      setAviso(datos.lectura.aviso)
    } catch {
      setError('No se pudo leer la lista.')
    } finally {
      setLeyendo(false)
    }
  }

  if (renglones) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-tinta-600">
            {renglones.length} {renglones.length === 1 ? 'renglón leído' : 'renglones leídos'}
            {proveedor && ` de ${proveedor}`}. Confirma uno por uno el material que es.
          </p>
          <button
            type="button"
            onClick={() => { setRenglones(null); setTexto('') }}
            className="text-xs font-medium text-tinta-500 underline-offset-2 hover:text-haaco-700 hover:underline"
          >
            Empezar de nuevo
          </button>
        </div>

        {aviso && <p className="text-sm text-amber-700">{aviso}</p>}

        <div className="space-y-1.5">
          {renglones.map((r, i) => (
            <FilaLeida
              key={i}
              renglon={r}
              productos={productos}
              onGuardado={() => {
                setRenglones((lista) => (lista ?? []).filter((_, j) => j !== i))
                router.refresh()
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <AreaTexto
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        placeholder={'Pega aquí la lista que te mandaron:\n\nPTR 1x1 cal 14 ......... $462 tramo\nSolera 1 1/2 x 1/8 ...... $238 tramo'}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => leer()}
          disabled={leyendo || !texto.trim()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-haaco-700 px-3.5 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:opacity-40 lg:min-h-0 lg:py-2"
        >
          {leyendo ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Leer la lista
        </button>

        <button
          type="button"
          onClick={() => archivo.current?.click()}
          disabled={leyendo}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-tinta-200 bg-white px-3.5 text-sm font-medium text-tinta-600 transition hover:bg-tinta-50 disabled:opacity-40 lg:min-h-0 lg:py-2"
        >
          <Camera size={15} />
          Subir una foto
        </button>
        <input
          ref={archivo}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) leer(f)
            e.target.value = ''
          }}
        />
      </div>

      <MensajeError mensaje={error} />
    </div>
  )
}

function FilaLeida({
  renglon,
  productos,
  onGuardado,
}: {
  renglon: RenglonLeido
  productos: { id: string; nombre: string; unidad: string }[]
  onGuardado: () => void
}) {
  const [productoId, setProductoId] = useState(renglon.producto_id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()

  const producto = productos.find((p) => p.id === productoId)
  // El PTR se compra por tramo y se cotiza por metro: si las unidades no
  // coinciden se avisa, pero nunca se convierte solo.
  const unidadDistinta =
    Boolean(producto && renglon.unidad) &&
    producto!.unidad.toLowerCase() !== renglon.unidad!.toLowerCase()

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await registrarPrecio({
        producto_id: productoId,
        precio_neto: renglon.precio,
        origen: 'lista',
        unidad: renglon.unidad,
        nota: `De la lista del proveedor: «${renglon.descripcion}»`,
        aprobar: !unidadDistinta,
      })
      if (!r.ok) return setError(r.error)
      onGuardado()
    })

  return (
    <div className="rounded-[14px] border-[0.5px] border-tinta-200 bg-white px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-tinta-800">{renglon.descripcion}</p>
          <p className="mt-0.5 text-[11px] text-tinta-400">
            <span className="tabular-nums">{pesos(renglon.precio)}</span>
            {renglon.unidad && ` por ${renglon.unidad}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="w-56">
            <Seleccion
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              aria-label="Qué material es"
            >
              <option value="">¿Qué material es?</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Seleccion>
          </div>

          <button
            type="button"
            onClick={guardar}
            disabled={pendiente || !productoId}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-haaco-700 text-white transition hover:bg-haaco-800 disabled:opacity-40 lg:h-9 lg:w-9"
            aria-label="Guardar el precio"
          >
            {pendiente ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>

          <button
            type="button"
            onClick={onGuardado}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-tinta-400 transition hover:bg-tinta-50 hover:text-tinta-600 lg:h-9 lg:w-9"
            aria-label="Descartar este renglón"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {unidadDistinta && (
        <p className="mt-1.5 text-[11px] text-amber-700">
          La lista lo da por {renglon.unidad} y el catálogo va por {producto!.unidad}. Se guarda
          como está y queda por revisar: aquí no se convierte solo.
        </p>
      )}

      <div className="mt-2 empty:mt-0"><MensajeError mensaje={error} /></div>
    </div>
  )
}
