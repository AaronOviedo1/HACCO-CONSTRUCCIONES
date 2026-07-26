'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Camera, Plus, X } from 'lucide-react'
import {
  Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { hoyISO, num } from '@/lib/cotizaciones'
import { pesos } from '@/lib/format'
import { CATEGORIA_GASTO, CONDICION, METODO_PAGO } from '@/lib/finanzas'
import { registrarGasto } from '@/app/admin/finanzas-acciones'
import type {
  CategoriaGasto, CondicionCompra, MetodoPago, ObraConcepto, Proveedor,
} from '@/types/database'

type ObraSimple = { id: string; nombre: string; ot_numero: string | null }

export function BotonNuevoGasto({
  obras, proveedores, conceptos, obraFija,
}: {
  obras: ObraSimple[]
  proveedores: Pick<Proveedor, 'id' | 'nombre' | 'dias_credito_default'>[]
  conceptos: ObraConcepto[]
  obraFija?: string
}) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
      >
        <Plus size={16} />
        Nuevo gasto
      </button>
      {abierto && (
        <FormularioGasto
          obras={obras}
          proveedores={proveedores}
          conceptos={conceptos}
          obraFija={obraFija}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function FormularioGasto({
  obras, proveedores, conceptos, obraFija, onCerrar,
}: {
  obras: ObraSimple[]
  proveedores: Pick<Proveedor, 'id' | 'nombre' | 'dias_credito_default'>[]
  conceptos: ObraConcepto[]
  obraFija?: string
  onCerrar: () => void
}) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const [pendiente, iniciar] = useTransition()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [obraId, setObraId] = useState(obraFija ?? '')
  const [conceptoId, setConceptoId] = useState('')
  const [categoria, setCategoria] = useState<CategoriaGasto>('material')
  const [descripcion, setDescripcion] = useState('')
  const [piezas, setPiezas] = useState('1')
  const [monto, setMonto] = useState('')
  const [folio, setFolio] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [condicion, setCondicion] = useState<CondicionCompra>('contado')
  const [fecha, setFecha] = useState(hoyISO())
  const [crearMaterial, setCrearMaterial] = useState(true)

  const proveedor = proveedores.find((p) => p.id === proveedorId)
  const conceptosDeObra = conceptos.filter(() => Boolean(obraId))
  const esMaterialDeObra = categoria === 'material' && Boolean(obraId)

  const elegir = (f: File | null) => {
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      setError('La foto pesa más de 10 MB.')
      return
    }
    setError(null)
    setArchivo(f)
    setVista(URL.createObjectURL(f))
  }

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      let ruta: string | null = null

      if (archivo) {
        setSubiendo(true)
        const supabase = crearClienteNavegador()
        const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const carpeta = fecha.slice(0, 7)
        ruta = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

        const { error: errorSubida } = await supabase.storage
          .from('tickets')
          .upload(ruta, archivo, { contentType: archivo.type })

        setSubiendo(false)
        if (errorSubida) {
          setError(`No se pudo subir el ticket: ${errorSubida.message}`)
          return
        }
      }

      const r = await registrarGasto({
        obra_id: obraId || null,
        concepto_id: conceptoId || null,
        categoria,
        descripcion,
        piezas: num(piezas) || 1,
        costo_unitario: num(piezas) > 0 ? num(monto) / num(piezas) : null,
        monto: num(monto),
        folio_factura: folio.trim() || null,
        proveedor_id: proveedorId || null,
        metodo,
        condicion,
        foto_ticket_path: ruta,
        fecha,
        crear_material: esMaterialDeObra && crearMaterial,
      })

      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo="Nuevo gasto"
      descripcion="Toma la foto del ticket y captura lo mínimo: lo demás se acomoda solo."
    >
      <CuerpoDialogo>
        <input
          ref={entrada}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => elegir(e.target.files?.[0] ?? null)}
        />

        <div className="sm:col-span-2">
          {vista ? (
            <div className="relative">
              {archivo?.type === 'application/pdf' ? (
                <p className="rounded-xl bg-tinta-50 px-4 py-6 text-center text-sm text-tinta-600">
                  {archivo.name}
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={vista} alt="Ticket" className="max-h-52 w-full rounded-xl object-contain" />
              )}
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(vista)
                  setArchivo(null)
                  setVista(null)
                  if (entrada.current) entrada.current.value = ''
                }}
                className="absolute right-2 top-2 rounded-full bg-tinta-900/70 p-1.5 text-white"
                aria-label="Quitar ticket"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              data-tap
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-haaco-300 bg-haaco-50/40 px-4 py-5 text-sm font-semibold text-haaco-800 transition hover:bg-haaco-50"
            >
              <Camera size={20} />
              Foto del ticket o factura
            </button>
          )}
        </div>

        <Campo
          etiqueta="Descripción"
          hijo={
            <Entrada
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Cubetas Rivinol 7 blanco"
              autoFocus
            />
          }
        />
        <Campo
          etiqueta="Categoría"
          ancho="medio"
          hijo={
            <Seleccion
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaGasto)}
            >
              {Object.entries(CATEGORIA_GASTO).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />}
        />

        <Campo
          etiqueta="Obra"
          ancho="medio"
          hijo={
            <Seleccion
              value={obraId}
              onChange={(e) => {
                setObraId(e.target.value)
                setConceptoId('')
              }}
              disabled={Boolean(obraFija)}
            >
              <option value="">Gasto general</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.ot_numero} · {o.nombre}
                </option>
              ))}
            </Seleccion>
          }
        />
        {conceptosDeObra.length > 0 && (
          <Campo
            etiqueta="Concepto"
            ancho="medio"
            hijo={
              <Seleccion value={conceptoId} onChange={(e) => setConceptoId(e.target.value)}>
                <option value="">Toda la obra</option>
                {conceptosDeObra.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Seleccion>
            }
          />
        )}

        <Campo
          etiqueta="Piezas"
          ancho="medio"
          hijo={<Numero value={piezas} onChange={(e) => setPiezas(e.target.value)} />}
        />
        <Campo
          etiqueta="Monto total"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />}
          ayuda={
            num(piezas) > 1 && num(monto) > 0
              ? `${pesos(num(monto) / num(piezas))} por pieza`
              : undefined
          }
        />

        <Campo
          etiqueta="Proveedor"
          ancho="medio"
          hijo={
            <Seleccion value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Folio de factura"
          ancho="medio"
          hijo={<Entrada value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="PN14741" />}
        />

        <Campo
          etiqueta="Método"
          ancho="medio"
          hijo={
            <Seleccion value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {Object.entries(METODO_PAGO).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Condición"
          ancho="medio"
          hijo={
            <Seleccion
              value={condicion}
              onChange={(e) => setCondicion(e.target.value as CondicionCompra)}
            >
              {Object.entries(CONDICION).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          }
          ayuda={
            condicion === 'credito'
              ? proveedor
                ? `Abre cuenta por pagar a ${proveedor.dias_credito_default} días`
                : 'A crédito hace falta elegir proveedor'
              : undefined
          }
        />

        {esMaterialDeObra && (
          <label className="flex items-center gap-2.5 rounded-lg bg-tinta-50 px-3 py-2.5 text-sm text-tinta-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={crearMaterial}
              onChange={(e) => setCrearMaterial(e.target.checked)}
              className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-500"
            />
            Registrar también como material REAL de la obra
          </label>
        )}

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
          disabled={pendiente || subiendo || !descripcion.trim() || num(monto) <= 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {subiendo ? 'Subiendo ticket…' : pendiente ? 'Guardando…' : 'Registrar gasto'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

/** Notas rápidas para el detalle del gasto en la tabla. */
export function BotonEliminarGasto({ id, onEliminar }: { id: string; onEliminar: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm('¿Eliminar el gasto? También se quitan su cuenta por pagar y su material.')) {
          onEliminar(id)
        }
      }}
      className="rounded p-1 text-tinta-400 transition hover:bg-red-50 hover:text-red-600"
      aria-label="Eliminar gasto"
    >
      <X size={15} />
    </button>
  )
}
