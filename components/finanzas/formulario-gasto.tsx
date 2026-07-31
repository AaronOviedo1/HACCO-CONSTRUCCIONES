'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2, Plus, Sparkles, TriangleAlert, X } from 'lucide-react'
import {
  Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, Opciones, PieDialogo, Seleccion,
} from '@/components/formulario'
import { SelectorFecha } from '@/components/filtro-fechas'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { hoyISO, num } from '@/lib/cotizaciones'
import { pesos } from '@/lib/format'
import { CATEGORIA_GASTO, CONDICION, METODO_PAGO } from '@/lib/finanzas'
import { prepararTicket, type LecturaTicket } from '@/lib/ticket'
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
        className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] bg-haaco-700 px-4 text-base font-semibold text-white shadow-verde transition active:bg-haaco-800 lg:min-h-0 lg:w-auto lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium lg:shadow-none lg:hover:bg-haaco-800"
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

  // Lectura del ticket: lo que ya tecleó quien captura manda sobre lo que lea
  // la foto, aunque la foto llegue después.
  const tocado = useRef(new Set<string>())
  const [leyendo, setLeyendo] = useState(false)
  const [llenados, setLlenados] = useState<string[] | null>(null)
  const [avisoTicket, setAvisoTicket] = useState<string | null>(null)

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
    leer(f)
  }

  const leer = async (f: File) => {
    setLeyendo(true)
    setLlenados(null)
    setAvisoTicket(null)
    try {
      const cuerpo = new FormData()
      cuerpo.append('archivo', await prepararTicket(f), f.name)
      cuerpo.append(
        'proveedores',
        JSON.stringify(proveedores.map(({ id, nombre }) => ({ id, nombre }))),
      )

      const r = await fetch('/api/ticket', { method: 'POST', body: cuerpo })
      const datos = await r.json()
      if (!r.ok || !datos.lectura) {
        setAvisoTicket(datos.error ?? 'No se pudo leer el ticket; captúralo a mano.')
        return
      }
      aplicar(datos.lectura as LecturaTicket)
    } catch {
      setAvisoTicket('No se pudo leer el ticket; captúralo a mano.')
    } finally {
      setLeyendo(false)
    }
  }

  const aplicar = (l: LecturaTicket) => {
    const puestos: string[] = []
    const poner = <T,>(campo: string, valor: T | null, guardar: (v: T) => void) => {
      if (valor === null || tocado.current.has(campo)) return
      guardar(valor)
      puestos.push(campo)
    }

    poner('descripción', l.descripcion, setDescripcion)
    poner('piezas', l.piezas === null ? null : String(l.piezas), setPiezas)
    poner('monto', l.monto === null ? null : String(l.monto), setMonto)
    poner('método', l.metodo, setMetodo)
    poner('categoría', l.categoria, setCategoria)
    poner('folio', l.folio, setFolio)
    poner('fecha', l.fecha, setFecha)
    poner('proveedor', l.proveedor_id, setProveedorId)

    // Si no salió nada y además hay algo que decir —la foto no era un
    // comprobante—, basta con el aviso.
    setLlenados(puestos.length === 0 && l.aviso ? null : puestos)
    setAvisoTicket(l.aviso)
  }

  /** Marca un campo como escrito a mano para que la foto ya no lo pise. */
  const mio = (campo: string) => tocado.current.add(campo)

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
      descripcion="Toma la foto del ticket: se lee sola y tú nada más revisas."
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
                  setLlenados(null)
                  setAvisoTicket(null)
                  if (entrada.current) entrada.current.value = ''
                }}
                className="absolute right-2 top-2 rounded-full bg-tinta-950/70 p-1.5 text-white"
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
              className="flex w-full items-center justify-center gap-2.5 rounded-[20px] border-2 border-dashed border-haaco-300 bg-haaco-50/50 px-4 py-7 text-[17px] font-semibold text-haaco-800 transition hover:bg-haaco-50 lg:rounded-xl lg:py-5 lg:text-sm"
            >
              <Camera size={24} className="lg:hidden" />
              <Camera size={20} className="hidden lg:block" />
              Foto del ticket o factura
            </button>
          )}

          {/* Lo que la foto alcanzó a llenar: siempre a la vista y corregible. */}
          {leyendo && (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-haaco-50 px-3 py-2.5 text-sm font-medium text-haaco-800">
              <Loader2 size={15} className="animate-spin" />
              Leyendo el ticket…
            </p>
          )}

          {!leyendo && llenados !== null && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-haaco-50 px-3 py-2.5 text-sm text-haaco-900">
              <span className="flex items-start gap-2">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-haaco-700" />
                {llenados.length > 0 ? (
                  <span>
                    Del ticket: <strong className="font-semibold">{lista(llenados)}</strong>. Revisa
                    antes de guardar.
                  </span>
                ) : (
                  <span>El ticket no agregó nada que no estuviera ya capturado.</span>
                )}
              </span>
              {archivo && (
                <button
                  type="button"
                  onClick={() => leer(archivo)}
                  className="shrink-0 text-xs font-semibold text-haaco-700 underline-offset-2 hover:underline"
                >
                  Volver a leer
                </button>
              )}
            </div>
          )}

          {!leyendo && avisoTicket && (
            <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              {avisoTicket}
            </p>
          )}
        </div>

        <Campo
          etiqueta="Descripción"
          hijo={
            <Entrada
              value={descripcion}
              onChange={(e) => {
                mio('descripción')
                setDescripcion(e.target.value)
              }}
              placeholder="Cubetas Rivinol 7 blanco"
              autoFocus
            />
          }
        />
        <Campo
          etiqueta="Categoría"
          hijo={
            <Opciones
              valor={categoria}
              opciones={Object.entries(CATEGORIA_GASTO) as [CategoriaGasto, string][]}
              onCambio={(v) => {
                mio('categoría')
                setCategoria(v)
              }}
            />
          }
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={
            <SelectorFecha
              valor={fecha}
              onCambio={(v) => {
                mio('fecha')
                setFecha(v)
              }}
            />
          }
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
          hijo={
            <Numero
              value={piezas}
              onChange={(e) => {
                mio('piezas')
                setPiezas(e.target.value)
              }}
            />
          }
        />
        <Campo
          etiqueta="Monto total"
          ancho="medio"
          hijo={
            <Numero
              value={monto}
              onChange={(e) => {
                mio('monto')
                setMonto(e.target.value)
              }}
              placeholder="0.00"
              className="text-center text-2xl font-bold -tracking-[0.5px] lg:text-right lg:text-sm lg:font-normal lg:tracking-normal"
            />
          }
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
            <Seleccion
              value={proveedorId}
              onChange={(e) => {
                mio('proveedor')
                setProveedorId(e.target.value)
              }}
            >
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
          hijo={
            <Entrada
              value={folio}
              onChange={(e) => {
                mio('folio')
                setFolio(e.target.value)
              }}
              placeholder="PN14741"
            />
          }
        />

        <Campo
          etiqueta="Método"
          ancho="medio"
          hijo={
            <Seleccion
              value={metodo}
              onChange={(e) => {
                mio('método')
                setMetodo(e.target.value as MetodoPago)
              }}
            >
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
            <Opciones
              valor={condicion}
              columnas={2}
              opciones={Object.entries(CONDICION) as [CondicionCompra, string][]}
              onCambio={setCondicion}
            />
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
              className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600"
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
          className="min-h-12 rounded-[14px] border border-tinta-300 bg-white px-4 text-base font-semibold text-tinta-700 transition hover:bg-tinta-50 sm:min-h-0 sm:rounded-lg sm:py-2 sm:text-sm sm:font-medium"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || subiendo || !descripcion.trim() || num(monto) <= 0}
          className="min-h-12 rounded-[14px] bg-haaco-700 px-4 text-base font-semibold text-white transition hover:bg-haaco-800 disabled:bg-haaco-300 sm:min-h-0 sm:rounded-lg sm:py-2 sm:text-sm sm:font-medium"
        >
          {subiendo ? 'Subiendo ticket…' : pendiente ? 'Guardando…' : 'Registrar gasto'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

/** «descripción, monto y folio»: lo que llenó la foto, dicho de corrido. */
function lista(palabras: string[]) {
  if (palabras.length === 1) return palabras[0]
  return `${palabras.slice(0, -1).join(', ')} y ${palabras[palabras.length - 1]}`
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
