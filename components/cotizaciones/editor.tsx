'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  Check, Copy, FileDown, GripVertical, Plus, Save, Send, Share2, Trash2, X,
} from 'lucide-react'
import { AreaTexto, Campo, Casilla, Entrada, Numero, Seleccion } from '@/components/formulario'
import { FormularioCliente } from '@/components/catalogos/formulario-cliente'
import { Etiqueta, Tarjeta } from '@/components/ui'
import { DialogoAprobar } from '@/components/cotizaciones/dialogo-aprobar'
import { pesos } from '@/lib/format'
import {
  ESTATUS_COTIZACION, TIPO_COTIZACION, conceptoVacio, costoConcepto, importePartida,
  notasCotizacion, num, precioConcepto, sumaMateriales, totalMaterial, totalesCotizacion,
  type BorradorCotizacion, type ConceptoBorrador, type MaterialBorrador,
} from '@/lib/cotizaciones'
import {
  cambiarEstatus, duplicarCotizacion, eliminarCotizacion, guardarCotizacion,
} from '@/app/admin/cotizaciones/acciones'
import type { Cliente, EstatusCotizacion, Producto, TextoProceso, TipoCotizacion } from '@/types/database'

type Props = {
  cotizacionId: string | null
  folio: string | null
  estatus: EstatusCotizacion
  inicial: BorradorCotizacion
  clientes: Cliente[]
  textos: TextoProceso[]
  productos: Producto[]
  obras: number
}

export function EditorCotizacion({
  cotizacionId, folio, estatus, inicial, clientes, textos, productos, obras,
}: Props) {
  const router = useRouter()
  const [doc, setDoc] = useState<BorradorCotizacion>(inicial)
  const [sucio, setSucio] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [aprobando, setAprobando] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const totales = useMemo(() => totalesCotizacion(doc), [doc])
  const bloqueado = estatus === 'aprobada' || estatus === 'terminada'
  const muestraPintura = doc.tipo === 'pintura' || doc.tipo === 'mixta'
  const muestraHerreria = doc.tipo === 'herreria' || doc.tipo === 'mixta'

  const cambiar = <C extends keyof BorradorCotizacion>(campo: C, valor: BorradorCotizacion[C]) => {
    setDoc((d) => ({ ...d, [campo]: valor }))
    setSucio(true)
    setAviso(null)
  }

  // -------------------------------------------------------------------------
  async function guardar(): Promise<string | null> {
    setError(null)
    const r = await guardarCotizacion(cotizacionId, doc)
    if (!r.ok) {
      setError(r.error)
      return null
    }
    setSucio(false)
    setAviso('Cambios guardados.')
    if (!cotizacionId) {
      router.replace(`/admin/cotizaciones/${r.datos!.id}`)
    } else {
      router.refresh()
    }
    return r.datos!.id
  }

  const alGuardar = () => iniciar(async () => { await guardar() })

  const alEnviar = () =>
    iniciar(async () => {
      const id = sucio || !cotizacionId ? await guardar() : cotizacionId
      if (!id) return
      const r = await cambiarEstatus(id, 'enviada')
      if (!r.ok) return setError(r.error)
      setAviso('Cotización marcada como enviada.')
      router.refresh()
    })

  const alCambiarEstatus = (nuevo: EstatusCotizacion) =>
    iniciar(async () => {
      if (!cotizacionId) return
      const r = await cambiarEstatus(cotizacionId, nuevo)
      if (!r.ok) return setError(r.error)
      router.refresh()
    })

  const alDuplicar = () =>
    iniciar(async () => {
      if (!cotizacionId) return
      const r = await duplicarCotizacion(cotizacionId)
      if (!r.ok) return setError(r.error)
      router.push(`/admin/cotizaciones/${r.datos!.id}`)
    })

  const alEliminar = () =>
    iniciar(async () => {
      if (!cotizacionId) return
      if (!confirm(`¿Eliminar la cotización ${folio ?? ''}? No se puede deshacer.`)) return
      const r = await eliminarCotizacion(cotizacionId)
      if (!r.ok) return setError(r.error)
      router.push('/admin/cotizaciones')
    })

  const compartir = async () => {
    if (!cotizacionId) return
    const url = `${window.location.origin}/api/cotizaciones/${cotizacionId}/pdf`
    try {
      const respuesta = await fetch(url)
      if (!respuesta.ok) throw new Error('No se pudo generar el PDF')
      const blob = await respuesta.blob()
      const archivo = new File([blob], `Cotizacion ${folio ?? ''}.pdf`, { type: 'application/pdf' })

      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({
          files: [archivo],
          title: `Cotización ${folio ?? ''}`,
          text: `Cotización ${folio ?? ''} · HAACO PRO RECUBRIMIENTOS`,
        })
        return
      }
      // Sin API de compartir (escritorio): se descarga y se abre WhatsApp Web.
      const enlace = document.createElement('a')
      enlace.href = URL.createObjectURL(blob)
      enlace.download = archivo.name
      enlace.click()
      URL.revokeObjectURL(enlace.href)
      window.open('https://web.whatsapp.com', '_blank')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo compartir el PDF.')
    }
  }

  // -------------------------------------------------------------------------
  const cliente = clientes.find((c) => c.id === doc.cliente_id)

  return (
    <div className="pb-44 lg:pb-32">
      {/* Encabezado -------------------------------------------------------- */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* El folio es un dato, no un título: se lee mejor en monoespaciada. */}
            <h1
              className={`text-[26px] font-bold -tracking-[0.5px] lg:text-2xl lg:font-semibold lg:tracking-tight lg:text-tinta-900 ${
                folio ? 'font-mono text-haaco-700 lg:font-sans' : 'text-tinta-900'
              }`}
            >
              {folio ?? 'Nueva cotización'}
            </h1>
            <Etiqueta tono={ESTATUS_COTIZACION[estatus].tono}>
              {ESTATUS_COTIZACION[estatus].texto}
            </Etiqueta>
            <Etiqueta tono="gris">{TIPO_COTIZACION[doc.tipo]}</Etiqueta>
          </div>
          <p className="mt-1 text-sm text-tinta-500">
            {cliente ? cliente.nombre : 'Elige un cliente para empezar'}
            {doc.nombre_obra && ` · ${doc.nombre_obra}`}
            {obras > 0 && ` · ${obras} ${obras === 1 ? 'OT abierta' : 'OTs abiertas'}`}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          {cotizacionId && (
            <>
              <a
                href={`/api/cotizaciones/${cotizacionId}/pdf?descargar=1`}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-[0.5px] border-tinta-300 bg-white px-3 text-[15.5px] font-semibold text-tinta-700 transition hover:bg-tinta-50 lg:min-h-0 lg:flex-none lg:rounded-lg lg:py-2 lg:text-sm lg:font-medium"
              >
                <FileDown size={16} />
                Ver PDF
              </a>
              <button
                type="button"
                onClick={compartir}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-3 text-[15.5px] font-semibold text-white transition active:bg-haaco-800 lg:min-h-0 lg:flex-none lg:rounded-lg lg:border lg:border-tinta-300 lg:bg-white lg:py-2 lg:text-sm lg:font-medium lg:text-tinta-700 lg:hover:bg-tinta-50"
              >
                <Share2 size={16} />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={alDuplicar}
                disabled={pendiente}
                className="hidden items-center gap-2 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50 lg:inline-flex"
              >
                <Copy size={16} />
                Duplicar
              </button>
            </>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {aviso && !error && (
        <p className="mb-4 rounded-lg bg-haaco-50 px-4 py-3 text-sm text-haaco-800 ring-1 ring-haaco-200">
          {aviso}
        </p>
      )}
      {bloqueado && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Esta cotización ya está {ESTATUS_COTIZACION[estatus].texto.toLowerCase()} y sus órdenes de
          trabajo están abiertas. Para modificarla, regrésala a borrador.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Datos generales ---------------------------------------------- */}
          <Tarjeta titulo="Datos de la cotización">
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <Campo
                etiqueta="Cliente"
                hijo={
                  <div className="flex gap-2">
                    <Seleccion
                      value={doc.cliente_id}
                      onChange={(e) => cambiar('cliente_id', e.target.value)}
                      disabled={bloqueado}
                    >
                      <option value="">Elegir cliente…</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </Seleccion>
                    <button
                      type="button"
                      onClick={() => setNuevoCliente(true)}
                      className="shrink-0 rounded-lg border border-tinta-300 bg-white px-3 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
                      title="Crear cliente"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                }
              />
              <Campo
                etiqueta="Tipo de trabajo"
                hijo={
                  <Seleccion
                    value={doc.tipo}
                    onChange={(e) => {
                      const tipo = e.target.value as TipoCotizacion
                      setDoc((d) => ({
                        ...d,
                        tipo,
                        anticipo_pct: tipo === 'herreria' ? '60' : d.anticipo_pct,
                      }))
                      setSucio(true)
                    }}
                    disabled={bloqueado}
                  >
                    <option value="pintura">Pintura</option>
                    <option value="herreria">Herrería</option>
                    <option value="mixta">Mixta (pintura + herrería)</option>
                  </Seleccion>
                }
              />
              <Campo
                etiqueta="Nombre de la obra"
                hijo={
                  <Entrada
                    value={doc.nombre_obra}
                    onChange={(e) => cambiar('nombre_obra', e.target.value)}
                    placeholder="La Jolla"
                    disabled={bloqueado}
                  />
                }
              />
              <Campo
                etiqueta="Fecha"
                hijo={
                  <Entrada
                    type="date"
                    value={doc.fecha}
                    onChange={(e) => cambiar('fecha', e.target.value)}
                    disabled={bloqueado}
                  />
                }
              />
              <Campo
                etiqueta="Domicilio de la obra"
                ancho="medio"
                hijo={
                  <AreaTexto
                    rows={2}
                    value={doc.domicilio_obra}
                    onChange={(e) => cambiar('domicilio_obra', e.target.value)}
                    placeholder={cliente?.domicilio ?? 'Calle, número, colonia'}
                    disabled={bloqueado}
                  />
                }
              />
              <div className="grid gap-4 sm:grid-cols-3 sm:col-span-2">
                <Campo
                  etiqueta="Anticipo %"
                  hijo={
                    <Numero
                      value={doc.anticipo_pct}
                      onChange={(e) => cambiar('anticipo_pct', e.target.value)}
                      disabled={bloqueado}
                    />
                  }
                />
                <Campo
                  etiqueta="IVA %"
                  hijo={
                    <Numero
                      value={doc.iva_pct}
                      onChange={(e) => cambiar('iva_pct', e.target.value)}
                      disabled={bloqueado}
                    />
                  }
                />
                <Campo
                  etiqueta="Vigencia (días)"
                  hijo={
                    <Numero
                      value={doc.vigencia_dias}
                      onChange={(e) => cambiar('vigencia_dias', e.target.value)}
                      disabled={bloqueado}
                    />
                  }
                />
              </div>
              <Casilla
                etiqueta="El cliente pide factura"
                checked={doc.requiere_factura}
                onChange={(e) => cambiar('requiere_factura', e.target.checked)}
                disabled={bloqueado}
              />
            </div>
          </Tarjeta>

          {/* Bullets del proceso ------------------------------------------ */}
          <BloqueProcesos
            doc={doc}
            setDoc={setDoc}
            setSucio={setSucio}
            textos={textos}
            productos={productos}
            bloqueado={bloqueado}
          />

          {/* Partidas de pintura ------------------------------------------ */}
          {muestraPintura && (
            <BloquePartidas doc={doc} setDoc={setDoc} setSucio={setSucio} bloqueado={bloqueado} />
          )}

          {/* Conceptos de herrería ---------------------------------------- */}
          {muestraHerreria && (
            <BloqueHerreria doc={doc} setDoc={setDoc} setSucio={setSucio} bloqueado={bloqueado} />
          )}

          {/* Materiales presupuestados ------------------------------------ */}
          <BloqueMateriales doc={doc} setDoc={setDoc} setSucio={setSucio} bloqueado={bloqueado} />

          {/* Notas -------------------------------------------------------- */}
          <Tarjeta titulo="Notas al pie">
            <div className="px-5 py-5">
              <ul className="mb-4 space-y-1 text-sm text-tinta-600">
                {notasCotizacion(num(doc.anticipo_pct), num(doc.vigencia_dias)).map((n) => (
                  <li key={n} className="font-medium">{n}</li>
                ))}
              </ul>
              <Campo
                etiqueta="Línea de calidad de productos"
                hijo={
                  <AreaTexto
                    rows={2}
                    value={doc.linea_calidad}
                    onChange={(e) => cambiar('linea_calidad', e.target.value)}
                    disabled={bloqueado}
                  />
                }
              />
              <div className="mt-4">
                <Campo
                  etiqueta="Notas internas (no salen en el PDF)"
                  hijo={
                    <AreaTexto
                      rows={2}
                      value={doc.notas}
                      onChange={(e) => cambiar('notas', e.target.value)}
                      disabled={bloqueado}
                    />
                  }
                />
              </div>
            </div>
          </Tarjeta>
        </div>

        {/* Resumen ---------------------------------------------------------- */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <Tarjeta titulo="Resumen">
            <dl className="divide-y divide-tinta-100">
              {muestraPintura && (
                <Renglon etiqueta="Partidas de pintura" valor={pesos(totales.partidas)} />
              )}
              {muestraHerreria && (
                <Renglon etiqueta="Conceptos de herrería" valor={pesos(totales.conceptos)} />
              )}
              <Renglon etiqueta="Subtotal" valor={pesos(totales.subtotal)} fuerte />
              <Renglon etiqueta={`IVA ${num(doc.iva_pct)}%`} valor={pesos(totales.iva)} />
              <Renglon etiqueta="Total" valor={pesos(totales.total)} destacado />
              <Renglon
                etiqueta={`Anticipo ${num(doc.anticipo_pct)}%`}
                valor={pesos(totales.anticipo)}
              />
            </dl>
            {muestraHerreria && totales.conceptos > 0 && (
              <div className="border-t border-tinta-100 bg-tinta-50 px-5 py-3 text-xs text-tinta-500">
                Costo directo de herrería {pesos(totales.costoDirecto)} · utilidad{' '}
                <strong className="text-haaco-700">{pesos(totales.utilidadHerreria)}</strong>
              </div>
            )}
          </Tarjeta>

          {cotizacionId && !bloqueado && (
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setAprobando(true)}
                className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[16px] bg-haaco-700 px-4 text-base font-semibold text-white shadow-verde transition hover:bg-haaco-800 lg:min-h-0 lg:rounded-lg lg:py-3 lg:text-sm lg:shadow-none"
              >
                <Check size={17} />
                Aprobar y abrir órdenes de trabajo
              </button>
              <button
                type="button"
                onClick={() => alCambiarEstatus('rechazada')}
                disabled={pendiente}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-tinta-300 bg-white px-4 py-2.5 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
              >
                <X size={16} />
                Marcar como rechazada
              </button>
            </div>
          )}

          {bloqueado && (
            <button
              type="button"
              onClick={() => alCambiarEstatus('borrador')}
              disabled={pendiente}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-tinta-300 bg-white px-4 py-2.5 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
            >
              Regresar a borrador
            </button>
          )}

          {cotizacionId && obras === 0 && (
            <button
              type="button"
              onClick={alEliminar}
              disabled={pendiente}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              <Trash2 size={16} />
              Eliminar cotización
            </button>
          )}
        </aside>
      </div>

      {/* Barra fija de guardado ------------------------------------------- */}
      {!bloqueado && (
        <div className="fixed inset-x-0 bottom-[var(--alto-tabs)] z-30 border-t-[0.5px] border-tinta-200 bg-white/95 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:pl-72">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-baseline gap-2 sm:block">
              <p className="text-xs text-tinta-500">Total con IVA</p>
              <p className="truncate text-xl font-semibold tabular-nums text-tinta-900">
                {pesos(totales.total)}
              </p>
              {sucio && <span className="text-xs text-amber-600 sm:hidden">Sin guardar</span>}
            </div>
            <div className="flex items-center gap-2">
              {sucio && <span className="hidden text-xs text-amber-600 sm:inline">Sin guardar</span>}
              <button
                type="button"
                onClick={alGuardar}
                disabled={pendiente}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border border-tinta-300 bg-white px-4 text-sm font-semibold text-tinta-700 transition hover:bg-tinta-50 disabled:opacity-50 sm:min-h-0 sm:flex-none sm:rounded-lg sm:py-2.5 sm:font-medium"
              >
                <Save size={16} />
                {pendiente ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={alEnviar}
                disabled={pendiente}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-haaco-700 px-4 text-sm font-semibold text-white transition hover:bg-haaco-800 disabled:bg-haaco-300 sm:min-h-0 sm:flex-none sm:rounded-lg sm:py-2.5"
              >
                <Send size={16} />
                <span className="sm:hidden">Enviar</span>
                <span className="hidden sm:inline">Guardar y marcar enviada</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <FormularioCliente
        abierto={nuevoCliente}
        onCerrar={() => setNuevoCliente(false)}
        onGuardado={(id) => {
          cambiar('cliente_id', id)
          router.refresh()
        }}
      />

      {cotizacionId && aprobando && (
        <DialogoAprobar
          onCerrar={() => setAprobando(false)}
          cotizacionId={cotizacionId}
          folio={folio}
          nombreObra={doc.nombre_obra || cliente?.nombre || 'Obra'}
          domicilio={doc.domicilio_obra}
          total={totales.total}
          subtotal={totales.subtotal}
          anticipoPct={num(doc.anticipo_pct)}
          hayCambiosSinGuardar={sucio}
          onGuardarPrimero={guardar}
        />
      )}
    </div>
  )
}

// ===========================================================================
// Bloques
// ===========================================================================
function Renglon({
  etiqueta, valor, fuerte, destacado,
}: {
  etiqueta: string
  valor: string
  fuerte?: boolean
  destacado?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <dt className={`text-sm ${destacado ? 'font-semibold text-tinta-900' : 'text-tinta-600'}`}>
        {etiqueta}
      </dt>
      <dd
        className={`tabular-nums ${
          destacado
            ? 'text-lg font-semibold text-haaco-700'
            : fuerte
              ? 'text-sm font-semibold text-tinta-900'
              : 'text-sm text-tinta-700'
        }`}
      >
        {valor}
      </dd>
    </div>
  )
}

type BloqueProps = {
  doc: BorradorCotizacion
  setDoc: React.Dispatch<React.SetStateAction<BorradorCotizacion>>
  setSucio: (v: boolean) => void
  bloqueado: boolean
}

function BloqueProcesos({
  doc, setDoc, setSucio, textos, productos, bloqueado,
}: BloqueProps & { textos: TextoProceso[]; productos: Producto[] }) {
  const usados = new Set(doc.procesos.map((p) => p.texto_proceso_id).filter(Boolean))

  const agregar = (texto: TextoProceso) => {
    setDoc((d) => ({
      ...d,
      procesos: [...d.procesos, { texto_proceso_id: texto.id, contenido: texto.contenido }],
    }))
    setSucio(true)
  }

  return (
    <Tarjeta
      titulo="Descripción del trabajo"
      pie="Cada renglón sale como bullet en el PDF. Puedes editarlo sin tocar la biblioteca."
    >
      <div className="px-5 py-5">
        {doc.procesos.length === 0 && (
          <p className="mb-4 text-sm text-tinta-500">
            Todavía no hay bullets. Elige de la biblioteca los pasos que aplican a este trabajo.
          </p>
        )}

        <ul className="space-y-2">
          {doc.procesos.map((p, i) => (
            <li key={i} className="flex items-start gap-2">
              <GripVertical size={16} className="mt-2.5 shrink-0 text-tinta-300" />
              <AreaTexto
                rows={2}
                value={p.contenido}
                disabled={bloqueado}
                onChange={(e) => {
                  const contenido = e.target.value
                  setDoc((d) => ({
                    ...d,
                    procesos: d.procesos.map((x, j) => (j === i ? { ...x, contenido } : x)),
                  }))
                  setSucio(true)
                }}
              />
              {!bloqueado && (
                <button
                  type="button"
                  onClick={() => {
                    setDoc((d) => ({ ...d, procesos: d.procesos.filter((_, j) => j !== i) }))
                    setSucio(true)
                  }}
                  className="mt-1.5 rounded-lg p-1.5 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Quitar bullet"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>

        {!bloqueado && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {textos
                .filter((t) => t.activo && !usados.has(t.id))
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => agregar(t)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-[0.5px] border-tinta-200 bg-white px-3 text-[13px] font-medium text-tinta-600 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800 lg:min-h-0 lg:rounded-lg lg:px-2.5 lg:py-1.5 lg:text-xs"
                  >
                    <Plus size={13} />
                    {t.titulo}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => {
                  setDoc((d) => ({
                    ...d,
                    procesos: [...d.procesos, { texto_proceso_id: null, contenido: '' }],
                  }))
                  setSucio(true)
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-tinta-300 px-3 text-[13px] font-medium text-tinta-500 transition hover:bg-tinta-50 lg:min-h-0 lg:rounded-lg lg:px-2.5 lg:py-1.5 lg:text-xs"
              >
                <Plus size={13} />
                Texto libre
              </button>
            </div>

            {productos.length > 0 && doc.procesos.some((p) => p.contenido.includes('{PRODUCTO}')) && (
              <p className="mt-3 text-xs text-amber-700">
                Hay bullets con <code className="font-mono">{'{PRODUCTO}'}</code> sin sustituir.
                Cámbialo por el nombre de la pintura: {productos.slice(0, 3).map((p) => p.nombre).join(', ')}…
              </p>
            )}
          </>
        )}
      </div>
    </Tarjeta>
  )
}

function BloquePartidas({ doc, setDoc, setSucio, bloqueado }: BloqueProps) {
  const actualizar = (i: number, campo: 'descripcion' | 'm2' | 'precio_unitario', valor: string) => {
    setDoc((d) => ({
      ...d,
      items: d.items.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)),
    }))
    setSucio(true)
  }

  return (
    <Tarjeta titulo="Partidas">
      {/* Teléfono: una tarjeta por partida, que la tabla no cabe. */}
      <div className="flex flex-col gap-3 px-4 py-4 lg:hidden">
        {doc.items.map((item, i) => (
          <div key={i} className="rounded-[16px] border-[0.5px] border-tinta-200 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tinta-100 text-xs font-semibold text-tinta-500">
                {i + 1}
              </span>
              <Entrada
                value={item.descripcion}
                onChange={(e) => actualizar(i, 'descripcion', e.target.value)}
                placeholder="Exterior fachada principal"
                disabled={bloqueado}
              />
              {!bloqueado && (
                <button
                  type="button"
                  onClick={() => {
                    setDoc((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))
                    setSucio(true)
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-tinta-400"
                  aria-label={`Quitar partida ${i + 1}`}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Numero
                value={item.m2}
                onChange={(e) => actualizar(i, 'm2', e.target.value)}
                placeholder="m²"
                disabled={bloqueado}
                className="!text-center"
              />
              <span className="shrink-0 text-tinta-400">×</span>
              <Numero
                value={item.precio_unitario}
                onChange={(e) => actualizar(i, 'precio_unitario', e.target.value)}
                placeholder="$ / m²"
                disabled={bloqueado}
                className="!text-center"
              />
              <span className="min-w-[88px] shrink-0 text-right text-[14.5px] font-semibold tabular-nums">
                {pesos(importePartida(item))}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr>
              <th className="w-10 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500">#</th>
              <th className="border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500">Descripción</th>
              <th className="w-24 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">M²</th>
              <th className="w-28 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">P.U.</th>
              <th className="w-32 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">Importe</th>
              <th className="w-10 border-b border-tinta-200 bg-tinta-50/70" />
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, i) => (
              <tr key={i}>
                <td className="border-b border-tinta-100 px-3 py-1.5 text-tinta-400 tabular-nums">{i + 1}</td>
                <td className="border-b border-tinta-100 px-3 py-1.5">
                  <Entrada
                    value={item.descripcion}
                    onChange={(e) => actualizar(i, 'descripcion', e.target.value)}
                    placeholder="Exterior fachada principal"
                    disabled={bloqueado}
                  />
                </td>
                <td className="border-b border-tinta-100 px-3 py-1.5">
                  <Numero
                    value={item.m2}
                    onChange={(e) => actualizar(i, 'm2', e.target.value)}
                    placeholder="—"
                    disabled={bloqueado}
                  />
                </td>
                <td className="border-b border-tinta-100 px-3 py-1.5">
                  <Numero
                    value={item.precio_unitario}
                    onChange={(e) => actualizar(i, 'precio_unitario', e.target.value)}
                    placeholder="0.00"
                    disabled={bloqueado}
                  />
                </td>
                <td className="border-b border-tinta-100 px-3 py-1.5 text-right font-medium tabular-nums text-tinta-900">
                  {pesos(importePartida(item))}
                </td>
                <td className="border-b border-tinta-100 px-1 py-1.5">
                  {!bloqueado && (
                    <button
                      type="button"
                      onClick={() => {
                        setDoc((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))
                        setSucio(true)
                      }}
                      className="rounded-lg p-1.5 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Quitar partida ${i + 1}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!bloqueado && (
        <div className="border-t border-tinta-100 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              setDoc((d) => ({
                ...d,
                items: [...d.items, { descripcion: '', m2: '', precio_unitario: '' }],
              }))
              setSucio(true)
            }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-tinta-300 px-3 text-[15px] font-medium text-tinta-600 transition hover:bg-tinta-50 lg:min-h-0 lg:w-auto lg:rounded-lg lg:border lg:py-2 lg:text-sm"
          >
            <Plus size={15} />
            Agregar partida
          </button>
        </div>
      )}
    </Tarjeta>
  )
}

function BloqueHerreria({ doc, setDoc, setSucio, bloqueado }: BloqueProps) {
  const actualizar = (i: number, parche: Partial<ConceptoBorrador>) => {
    setDoc((d) => ({
      ...d,
      desglose: d.desglose.map((c, j) => (j === i ? { ...c, ...parche } : c)),
    }))
    setSucio(true)
  }

  return (
    <Tarjeta
      titulo="Cotizador de herrería"
      pie="Materiales + mano de obra + indirectos = costo. El precio de venta se calcula con el % de utilidad y entra como partida en la cotización."
    >
      <div className="space-y-4 px-5 py-5">
        {doc.desglose.length === 0 && (
          <p className="text-sm text-tinta-500">
            Captura cada concepto por separado (Macetero #2, Registro #3…) para ver la utilidad de
            cada uno.
          </p>
        )}

        {doc.desglose.map((concepto, i) => (
          <ConceptoHerreria
            key={i}
            concepto={concepto}
            indice={i}
            bloqueado={bloqueado}
            onCambio={(parche) => actualizar(i, parche)}
            onQuitar={() => {
              setDoc((d) => ({ ...d, desglose: d.desglose.filter((_, j) => j !== i) }))
              setSucio(true)
            }}
          />
        ))}

        {!bloqueado && (
          <button
            type="button"
            onClick={() => {
              setDoc((d) => ({ ...d, desglose: [...d.desglose, conceptoVacio()] }))
              setSucio(true)
            }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-tinta-300 px-3 text-[15px] font-medium text-tinta-600 transition hover:bg-tinta-50 lg:min-h-0 lg:w-auto lg:rounded-lg lg:border lg:py-2 lg:text-sm"
          >
            <Plus size={15} />
            Agregar concepto
          </button>
        )}
      </div>
    </Tarjeta>
  )
}

function ConceptoHerreria({
  concepto, indice, bloqueado, onCambio, onQuitar,
}: {
  concepto: ConceptoBorrador
  indice: number
  bloqueado: boolean
  onCambio: (parche: Partial<ConceptoBorrador>) => void
  onQuitar: () => void
}) {
  const costo = costoConcepto(concepto)
  const precio = precioConcepto(concepto)

  const cambiarMaterial = (i: number, parche: Partial<MaterialBorrador>) =>
    onCambio({
      materiales: concepto.materiales.map((m, j) => (j === i ? { ...m, ...parche } : m)),
    })

  return (
    <div className="rounded-xl border border-tinta-200">
      <div className="flex items-center gap-2 border-b border-tinta-100 bg-tinta-50/60 px-4 py-2.5">
        <span className="text-xs font-semibold text-tinta-400">#{indice + 1}</span>
        <Entrada
          value={concepto.concepto}
          onChange={(e) => onCambio({ concepto: e.target.value })}
          placeholder="Macetero #2"
          disabled={bloqueado}
          className="!border-0 !bg-transparent !px-0 font-medium focus:!ring-0"
        />
        {!bloqueado && (
          <button
            type="button"
            onClick={onQuitar}
            className="shrink-0 rounded-lg p-1.5 text-tinta-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Quitar concepto"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-400">
          Materiales
        </p>
        <div className="space-y-1.5">
          {concepto.materiales.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto] items-center gap-1.5 lg:grid-cols-12"
            >
              <div className="lg:col-span-5">
                <Entrada
                  value={m.material}
                  onChange={(e) => cambiarMaterial(i, { material: e.target.value })}
                  placeholder="PTR 1x1"
                  disabled={bloqueado}
                />
              </div>
              <div className="flex items-center justify-end lg:order-last lg:col-span-1">
                {bloqueado ? (
                  <span className="text-xs tabular-nums text-tinta-500">{pesos(totalMaterial(m))}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      onCambio({ materiales: concepto.materiales.filter((_, j) => j !== i) })
                    }
                    className="flex h-11 w-11 items-center justify-center rounded text-tinta-400 hover:bg-red-50 hover:text-red-600 lg:h-auto lg:w-auto lg:p-1"
                    aria-label="Quitar material"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-1.5 lg:contents">
                <div className="lg:col-span-2">
                  <Seleccion
                    value={m.rubro}
                    onChange={(e) => cambiarMaterial(i, { rubro: e.target.value as MaterialBorrador['rubro'] })}
                    disabled={bloqueado}
                  >
                    <option value="herreria">Herrería</option>
                    <option value="pintura">Pintura</option>
                    <option value="otro">Otro</option>
                  </Seleccion>
                </div>
                <div className="lg:col-span-2">
                  <Numero
                    value={m.piezas}
                    onChange={(e) => cambiarMaterial(i, { piezas: e.target.value })}
                    placeholder="pzas"
                    disabled={bloqueado}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Numero
                    value={m.costo}
                    onChange={(e) => cambiarMaterial(i, { costo: e.target.value })}
                    placeholder="$"
                    disabled={bloqueado}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {!bloqueado && (
          <button
            type="button"
            onClick={() =>
              onCambio({
                materiales: [
                  ...concepto.materiales,
                  { rubro: 'herreria', material: '', piezas: '1', costo: '' },
                ],
              })
            }
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-haaco-700 hover:underline lg:min-h-0 lg:text-xs lg:font-medium"
          >
            <Plus size={13} />
            Agregar material
          </button>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tinta-600">Mano de obra</span>
            <Numero
              value={concepto.mano_obra}
              onChange={(e) => onCambio({ mano_obra: e.target.value })}
              placeholder="0.00"
              disabled={bloqueado}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tinta-600">Indirectos %</span>
            <Numero
              value={concepto.gastos_indirectos_pct}
              onChange={(e) => onCambio({ gastos_indirectos_pct: e.target.value })}
              disabled={bloqueado}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-tinta-600">Utilidad %</span>
            <Numero
              value={concepto.utilidad_pct}
              onChange={(e) => onCambio({ utilidad_pct: e.target.value })}
              disabled={bloqueado}
            />
          </label>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 border-t border-tinta-100 bg-tinta-50/60 px-4 py-2.5 text-xs sm:grid-cols-4">
        <Mini etiqueta="Herrería" valor={pesos(sumaMateriales(concepto.materiales, 'herreria'))} />
        <Mini etiqueta="Pintura" valor={pesos(sumaMateriales(concepto.materiales, 'pintura'))} />
        <Mini etiqueta="Costo total" valor={pesos(costo)} />
        <Mini etiqueta="Precio de venta" valor={pesos(precio)} destacado />
      </dl>
    </div>
  )
}

function Mini({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <dt className="text-tinta-500">{etiqueta}</dt>
      <dd className={`tabular-nums ${destacado ? 'font-semibold text-haaco-700' : 'text-tinta-800'}`}>
        {valor}
      </dd>
    </div>
  )
}

function BloqueMateriales({ doc, setDoc, setSucio, bloqueado }: BloqueProps) {
  const sueltos = doc.materiales
  const total = sumaMateriales(sueltos)

  const actualizar = (i: number, parche: Partial<MaterialBorrador>) => {
    setDoc((d) => ({
      ...d,
      materiales: d.materiales.map((m, j) => (j === i ? { ...m, ...parche } : m)),
    }))
    setSucio(true)
  }

  return (
    <Tarjeta
      titulo="Material presupuestado"
      pie={`${pesos(total)} · al aprobar se copia a la orden de trabajo como material COTIZADO, para compararlo después contra lo que realmente se gastó.`}
    >
      <div className="px-5 py-5">
        {sueltos.length === 0 && (
          <p className="mb-3 text-sm text-tinta-500">
            Opcional. Anota la pintura y el material que calculas usar para poder medir la utilidad
            real de la obra.
          </p>
        )}

        <div className="space-y-1.5">
          {sueltos.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto] items-center gap-1.5 lg:grid-cols-12"
            >
              <div className="lg:col-span-6">
                <Entrada
                  value={m.material}
                  onChange={(e) => actualizar(i, { material: e.target.value })}
                  placeholder="Rivinol 7 blanco"
                  disabled={bloqueado}
                />
              </div>
              <div className="flex items-center justify-end lg:order-last lg:col-span-1">
                {!bloqueado && (
                  <button
                    type="button"
                    onClick={() => {
                      setDoc((d) => ({ ...d, materiales: d.materiales.filter((_, j) => j !== i) }))
                      setSucio(true)
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded text-tinta-400 hover:bg-red-50 hover:text-red-600 lg:h-auto lg:w-auto lg:p-1"
                    aria-label="Quitar material"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-1.5 lg:contents">
                <div className="lg:col-span-2">
                  <Numero
                    value={m.piezas}
                    onChange={(e) => actualizar(i, { piezas: e.target.value })}
                    placeholder="pzas"
                    disabled={bloqueado}
                  />
                </div>
                <div className="lg:col-span-3">
                  <Numero
                    value={m.costo}
                    onChange={(e) => actualizar(i, { costo: e.target.value })}
                    placeholder="costo"
                    disabled={bloqueado}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {!bloqueado && (
          <button
            type="button"
            onClick={() => {
              setDoc((d) => ({
                ...d,
                materiales: [
                  ...d.materiales,
                  { rubro: 'pintura', material: '', piezas: '1', costo: '' },
                ],
              }))
              setSucio(true)
            }}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-haaco-700 hover:underline lg:min-h-0 lg:font-medium"
          >
            <Plus size={14} />
            Agregar material
          </button>
        )}
      </div>
    </Tarjeta>
  )
}
