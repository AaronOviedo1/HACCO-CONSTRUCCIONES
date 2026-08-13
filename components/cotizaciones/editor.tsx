'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useSyncExternalStore, useTransition } from 'react'
import {
  ArrowUpRight, Check, Clock, Copy, FileDown, GripVertical, Hammer, Plus, Save, Send, Share2,
  Trash2, X,
} from 'lucide-react'
import {
  AreaTexto, Campo, Casilla, Entrada, Numero, NumeroCorto, Opciones, Seleccion,
} from '@/components/formulario'
import { EntradaSugerencias, useSugerenciasDiferidas } from '@/components/entrada-sugerencias'
import { FormularioCliente } from '@/components/catalogos/formulario-cliente'
import { SelectorFecha } from '@/components/filtro-fechas'
import { CampoDomicilio } from '@/components/campo-domicilio'
import { Etiqueta, TarjetaPlegable } from '@/components/ui'
import { DialogoAprobar } from '@/components/cotizaciones/dialogo-aprobar'
import { SelectorPintura } from '@/components/cotizaciones/selector-pintura'
import { PrecioVivo } from '@/components/precios/precio-vivo'
import { PanelRecordatorios } from '@/components/recordatorios/panel'
import { pesos } from '@/lib/format'
import { compartirPdf } from '@/lib/compartir'
import { normalizarMaterial, type PrecioVigente } from '@/lib/precios'
import { precioPagado } from '@/lib/sugerencias'
import { REGLAS } from '@/lib/empresa'
import {
  ESTATUS_COTIZACION, TIPOS_COTIZACION, TIPO_COTIZACION, UNIDADES_PARTIDA, abreviaUnidad,
  anticipoPorTipo, conceptoVacio, costoConcepto, importePartida, muestraBloque, notasCotizacion,
  num, precioConcepto, redondear, sumaMateriales, totalMaterial, totalesCotizacion, tituloPartidas,
  unidadPorTipo, type BorradorCotizacion, type ConceptoBorrador, type MaterialBorrador,
  type PartidaBorrador, type Sugerencia, type SugerenciasCotizacion,
} from '@/lib/cotizaciones'
import {
  cambiarEstatus, duplicarCotizacion, eliminarCotizacion, guardarCotizacion,
} from '@/app/admin/cotizaciones/acciones'
import type {
  Cliente, EstatusCotizacion, Obra, Producto, Recordatorio, TextoProceso, TipoCotizacion,
} from '@/types/database'

type ObraLigada = Pick<Obra, 'id' | 'ot_numero' | 'nombre' | 'estatus'>

/** Busca el último precio pagado de un material del borrador. */
type BuscarPrecio = (m: MaterialBorrador) => PrecioVigente | undefined

const ESCRITORIO = '(min-width: 1024px)'

/**
 * Si la pantalla es de escritorio.
 *
 * Sirve para decidir qué tarjetas nacen abiertas. En el servidor y en el
 * primer pintado responde que no: el teléfono es el caso que manda aquí y así
 * nunca se ve un parpadeo de secciones abriéndose y cerrándose.
 */
function useEscritorio() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(ESCRITORIO)
      consulta.addEventListener('change', avisar)
      return () => consulta.removeEventListener('change', avisar)
    },
    () => window.matchMedia(ESCRITORIO).matches,
    () => false,
  )
}

type Props = {
  cotizacionId: string | null
  folio: string | null
  estatus: EstatusCotizacion
  inicial: BorradorCotizacion
  clientes: Cliente[]
  textos: TextoProceso[]
  productos: Producto[]
  /** Último precio pagado de cada material, para el semáforo de los costos. */
  precios: PrecioVigente[]
  obras: ObraLigada[]
  /** Los pendientes con fecha de esta cotización. Vacío en una nueva. */
  recordatorios: Recordatorio[]
  sugerencias: Promise<SugerenciasCotizacion>
}

export function EditorCotizacion({
  cotizacionId, folio, estatus, inicial, clientes, textos, productos, precios, obras,
  recordatorios, sugerencias: promesaSugerencias,
}: Props) {
  const router = useRouter()
  const sugerencias = useSugerenciasDiferidas(promesaSugerencias)
  const [doc, setDoc] = useState<BorradorCotizacion>(inicial)
  const [sucio, setSucio] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const [aprobando, setAprobando] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [pendiente, iniciar] = useTransition()

  const recordatoriosAbiertos = recordatorios.filter((r) => !r.atendido_en)
  const totales = useMemo(() => totalesCotizacion(doc), [doc])
  // Materiales conocidos: los del catálogo de productos más los ya cotizados.
  const materialesSugeridos = useMemo(() => {
    const mapa = new Map<string, Sugerencia>()
    for (const s of sugerencias.materiales) mapa.set(s.texto.toLowerCase(), { ...s })
    for (const p of productos) {
      const clave = p.nombre.toLowerCase()
      const previa = mapa.get(clave)
      // El neto, no el costo: el material del presupuesto se paga con IVA.
      if (!previa) {
        mapa.set(clave, {
          texto: p.nombre,
          veces: 0,
          monto: precioPagado(p),
          producto_id: p.id,
          proveedor_id: p.proveedor_id,
        })
      } else {
        // Lo cotizado antes ya trae el texto; del catálogo se toma con qué
        // producto queda ligado, que es lo que permite recordar su precio.
        previa.producto_id = p.id
        previa.proveedor_id = p.proveedor_id
        if (!previa.monto) previa.monto = precioPagado(p)
      }
    }
    return [...mapa.values()]
  }, [sugerencias.materiales, productos])

  // Un solo mapa para todas las filas de material: por producto y por nombre
  // normalizado, para que también encuentre lo que se tecleó sin elegir del
  // catálogo. Cada renglón hace un get, sin consultas por tecla.
  const preciosPorMaterial = useMemo(() => {
    const mapa = new Map<string, PrecioVigente>()
    for (const p of precios) {
      mapa.set(p.producto_id, p)
      mapa.set(normalizarMaterial(p.producto), p)
    }
    return mapa
  }, [precios])
  const precioDe = (m: MaterialBorrador) =>
    (m.producto_id ? preciosPorMaterial.get(m.producto_id) : undefined) ??
    preciosPorMaterial.get(normalizarMaterial(m.material))
  const bloqueado = estatus === 'aprobada' || estatus === 'terminada'
  // En el teléfono todo nace plegado: la cotización completa mide varias
  // pantallas y así se ve de un vistazo qué trae y se abre nada más lo que se
  // va a tocar. En el escritorio hay espacio, y al capturar una cotización
  // nueva conviene tener los datos a la vista desde el principio.
  const escritorio = useEscritorio()
  const nueva = !cotizacionId
  const abiertaEnAlta = escritorio && nueva
  const muestraPintura = muestraBloque(doc.tipo, 'partidas')
  const muestraHerreria = muestraBloque(doc.tipo, 'herreria')

  const cambiar = <C extends keyof BorradorCotizacion>(campo: C, valor: BorradorCotizacion[C]) => {
    setDoc((d) => ({ ...d, [campo]: valor }))
    setSucio(true)
    setAviso(null)
  }

  /**
   * Elegir cliente trae su forma de facturar.
   *
   * Sólo al cambiarlo: una cotización ya guardada llega con lo suyo puesto y
   * eso manda —hay clientes que facturan y una obra suelta que no—. La casilla
   * de abajo sigue estando para el caso a caso.
   */
  const elegirCliente = (id: string) => {
    const pide = clientes.find((c) => c.id === id)?.requiere_factura ?? false
    setDoc((d) => ({
      ...d,
      cliente_id: id,
      requiere_factura: pide,
      iva_pct: pide ? String(REGLAS.ivaPct) : '0',
    }))
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
      const r = await eliminarCotizacion(cotizacionId)
      if (!r.ok) {
        setBorrando(false)
        return setError(r.error)
      }
      router.push('/admin/cotizaciones')
    })

  const compartir = async () => {
    if (!cotizacionId) return
    try {
      await compartirPdf({
        url: `/api/cotizaciones/${cotizacionId}/pdf`,
        nombreArchivo: `Cotizacion ${folio ?? ''}.pdf`,
        telefono: cliente?.telefono,
        titulo: `Cotización ${folio ?? ''}`,
        mensaje: `Buen día${cliente ? ` ${cliente.nombre}` : ''}, le comparto la cotización ${folio ?? ''} de HAACO PRO RECUBRIMIENTOS.`,
      })
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
          </p>
          {obras.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {obras.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/obras/${o.id}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-[0.5px] border-haaco-200 bg-haaco-50 px-3 text-[13px] font-medium text-haaco-800 transition hover:border-haaco-400 hover:bg-haaco-100 lg:min-h-0 lg:rounded-lg lg:px-2.5 lg:py-1.5 lg:text-xs"
                >
                  <Hammer size={13} />
                  {o.ot_numero ? `OT ${o.ot_numero}` : o.nombre}
                  <ArrowUpRight size={13} className="text-haaco-600" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          {cotizacionId && (
            <>
              <a
                href={`/api/cotizaciones/${cotizacionId}/pdf`}
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
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {/* Datos generales ---------------------------------------------- */}
          <TarjetaPlegable
            titulo="Datos de la cotización"
            abierta={abiertaEnAlta}
            resumen={`Anticipo ${num(doc.anticipo_pct)}% · vigencia ${num(doc.vigencia_dias)} días · ${doc.requiere_factura ? 'con factura (IVA 16%)' : 'sin factura'}`}
          >
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <Campo
                etiqueta="Cliente"
                hijo={
                  <div className="flex gap-2">
                    <Seleccion
                      value={doc.cliente_id}
                      onChange={(e) => elegirCliente(e.target.value)}
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
                  <Opciones
                    valor={doc.tipo}
                    columnas={3}
                    deshabilitado={bloqueado}
                    opciones={TIPOS_COTIZACION.map((t) => [t.valor, t.texto] as [TipoCotizacion, string])}
                    onCambio={(tipo: TipoCotizacion) => {
                      setDoc((d) => ({
                        ...d,
                        tipo,
                        anticipo_pct: String(anticipoPorTipo(tipo)),
                      }))
                      setSucio(true)
                    }}
                  />
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
                  <SelectorFecha
                    valor={doc.fecha}
                    onCambio={(v) => cambiar('fecha', v)}
                    disabled={bloqueado}
                    titulo="Fecha de la cotización"
                  />
                }
              />
              <Campo
                etiqueta="Domicilio de la obra"
                hijo={
                  <CampoDomicilio
                    valor={doc.domicilio_obra}
                    onCambio={(v) => cambiar('domicilio_obra', v)}
                    placeholder={cliente?.domicilio ?? 'Calle, número, colonia'}
                    disabled={bloqueado}
                  />
                }
              />
              <div className="flex flex-wrap gap-x-8 gap-y-4 sm:col-span-2">
                <NumeroCorto
                  etiqueta="Anticipo"
                  sufijo="%"
                  value={doc.anticipo_pct}
                  onChange={(e) => cambiar('anticipo_pct', e.target.value)}
                  disabled={bloqueado}
                />
                <NumeroCorto
                  etiqueta="Descuento"
                  sufijo="%"
                  value={doc.descuento_pct}
                  onChange={(e) => cambiar('descuento_pct', e.target.value)}
                  disabled={bloqueado}
                />
                <NumeroCorto
                  etiqueta="Vigencia"
                  sufijo="días"
                  value={doc.vigencia_dias}
                  onChange={(e) => cambiar('vigencia_dias', e.target.value)}
                  disabled={bloqueado}
                />
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-tinta-700">Viáticos</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm text-tinta-500">$</span>
                    <Numero
                      value={doc.viaticos}
                      onChange={(e) => cambiar('viaticos', e.target.value)}
                      placeholder="0.00"
                      disabled={bloqueado}
                      className="!w-28"
                    />
                  </span>
                  <span className="mt-1 block text-xs text-tinta-400">
                    No sale en el PDF; se compara en la OT.
                  </span>
                </label>
              </div>
              {/* El IVA no se captura: con factura siempre es 16%, sin ella no va. */}
              <div className="sm:col-span-2">
                <Casilla
                  etiqueta="El cliente pide factura (se agrega IVA 16%)"
                  checked={doc.requiere_factura}
                  onChange={(e) => {
                    const pide = e.target.checked
                    setDoc((d) => ({ ...d, requiere_factura: pide, iva_pct: pide ? String(REGLAS.ivaPct) : '0' }))
                    setSucio(true)
                    setAviso(null)
                  }}
                  disabled={bloqueado}
                />
              </div>
            </div>
          </TarjetaPlegable>

          {/* Bullets del proceso ------------------------------------------ */}
          <BloqueProcesos
            doc={doc}
            setDoc={setDoc}
            setSucio={setSucio}
            textos={textos}
            productos={productos}
            bloqueado={bloqueado}
            abierta={abiertaEnAlta}
            sugeridos={sugerencias.procesos}
          />

          {/* Partidas de pintura ------------------------------------------ */}
          {muestraPintura && (
            <BloquePartidas
              doc={doc}
              setDoc={setDoc}
              setSucio={setSucio}
              bloqueado={bloqueado}
              sugerencias={sugerencias.partidas}
              productos={productos}
              abierta={escritorio}
            />
          )}

          {/* Conceptos de herrería ---------------------------------------- */}
          {muestraHerreria && (
            <BloqueHerreria
              doc={doc}
              setDoc={setDoc}
              setSucio={setSucio}
              bloqueado={bloqueado}
              sugerencias={materialesSugeridos}
              precioDe={precioDe}
              abierta={escritorio}
            />
          )}

          {/* Materiales presupuestados ------------------------------------ */}
          <BloqueMateriales
            doc={doc}
            setDoc={setDoc}
            setSucio={setSucio}
            bloqueado={bloqueado}
            abierta={abiertaEnAlta}
            sugerencias={materialesSugeridos}
            precioDe={precioDe}
          />

          {/* Notas -------------------------------------------------------- */}
          <TarjetaPlegable
            titulo="Notas al pie"
            abierta={abiertaEnAlta}
            resumen={`${notasCotizacion(num(doc.anticipo_pct), num(doc.vigencia_dias), doc.requiere_factura).length} notas en el PDF${doc.notas.trim() ? ' · con notas internas' : ''}`}
          >
            <div className="px-5 py-5">
              <ul className="mb-4 space-y-1 text-sm text-tinta-600">
                {notasCotizacion(num(doc.anticipo_pct), num(doc.vigencia_dias), doc.requiere_factura).map((n) => (
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
          </TarjetaPlegable>

          {/* Recordatorios --------------------------------------------------
              Sólo con la cotización guardada: un recordatorio cuelga de un
              folio, y un borrador que aún no existe no tiene de dónde colgar. */}
          {cotizacionId && (
            <TarjetaPlegable
              titulo="Recordatorios"
              abierta={recordatoriosAbiertos.length > 0}
              resumen={
                recordatoriosAbiertos.length > 0
                  ? `${recordatoriosAbiertos.length} pendiente${recordatoriosAbiertos.length === 1 ? '' : 's'}`
                  : 'ninguno'
              }
            >
              <div className="px-5 py-5">
                <PanelRecordatorios
                  cotizacionId={cotizacionId}
                  titulo={`${folio ?? 'Cotización'} · ${cliente?.nombre ?? 'cliente'}`}
                  recordatorios={recordatorios}
                />
              </div>
            </TarjetaPlegable>
          )}
        </div>

        {/* Resumen ---------------------------------------------------------- */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:h-fit">
          <TarjetaPlegable
            titulo="Resumen"
            abierta={escritorio}
            resumen={`Total ${pesos(totales.total)}`}
          >
            <dl className="divide-y divide-tinta-100">
              {muestraPintura && (
                <Renglon etiqueta={tituloPartidas(doc.tipo)} valor={pesos(totales.partidas)} />
              )}
              {muestraHerreria && (
                <Renglon etiqueta="Conceptos de herrería" valor={pesos(totales.conceptos)} />
              )}
              <Renglon etiqueta="Subtotal" valor={pesos(totales.subtotal)} fuerte />
              {totales.descuento > 0 && (
                <Renglon
                  etiqueta={`Descuento ${num(doc.descuento_pct)}%`}
                  valor={`- ${pesos(totales.descuento)}`}
                  enRojo
                />
              )}
              {totales.iva > 0 && <Renglon etiqueta={`IVA ${num(doc.iva_pct)}%`} valor={pesos(totales.iva)} />}
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
          </TarjetaPlegable>

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
              {/* El paso que faltaba: enviada dice lo que pasó, seguimiento
                  dice dónde está. Es lo que distingue las que siguen vivas. */}
              {estatus !== 'seguimiento' && (
                <button
                  type="button"
                  onClick={() => alCambiarEstatus('seguimiento')}
                  disabled={pendiente}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                >
                  <Clock size={16} />
                  Poner en seguimiento
                </button>
              )}
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

          {/* La confirmación se pide aquí y no con el confirm() del navegador,
              que Safari puede acabar silenciando para toda la página. */}
          {cotizacionId && obras.length === 0 && !borrando && (
            <button
              type="button"
              onClick={() => setBorrando(true)}
              disabled={pendiente}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              <Trash2 size={16} />
              Eliminar cotización
            </button>
          )}
          {cotizacionId && obras.length === 0 && borrando && (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-800">
                Se borra la cotización {folio ?? ''} con todo lo que trae. No se puede deshacer.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setBorrando(false)}
                  className="flex-1 rounded-lg border border-tinta-300 bg-white px-3 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
                >
                  Conservar
                </button>
                <button
                  type="button"
                  onClick={alEliminar}
                  disabled={pendiente}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-red-300"
                >
                  {pendiente ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Barra fija de guardado. En el teléfono va como tarjeta de cristal
          flotante, a juego con la pastilla de pestañas que vive debajo: dos
          capas del mismo material y el contenido corriendo por debajo de
          ambas. La franja pegada al borde queda sólo en escritorio, donde no
          hay pastilla con la que rimar. ------------------------------------ */}
      {!bloqueado && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[var(--alto-tabs)] z-30 px-4 lg:pointer-events-auto lg:bottom-0 lg:border-t-[0.5px] lg:border-tinta-200 lg:bg-white/95 lg:py-3 lg:pl-72 lg:backdrop-blur-xl">
          <div className="pointer-events-auto relative mx-auto flex max-w-7xl flex-col gap-2 max-lg:cristal max-lg:cristal-brillo max-lg:rounded-[1.625rem] max-lg:px-4 max-lg:py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-baseline gap-2 sm:block">
              <p className="text-xs text-tinta-500">
                {doc.requiere_factura ? 'Total con IVA' : 'Total sin IVA'}
              </p>
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

      {nuevoCliente && (
        <FormularioCliente
          abierto
          onCerrar={() => setNuevoCliente(false)}
          onGuardado={(id, pideFactura) => {
            setDoc((d) => ({
              ...d,
              cliente_id: id,
              requiere_factura: pideFactura,
              iva_pct: pideFactura ? String(REGLAS.ivaPct) : '0',
            }))
            setSucio(true)
            router.refresh()
          }}
        />
      )}

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
  etiqueta, valor, fuerte, destacado, enRojo,
}: {
  etiqueta: string
  valor: string
  fuerte?: boolean
  destacado?: boolean
  enRojo?: boolean
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
            : enRojo
              ? 'text-sm font-medium text-red-600'
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
  doc, setDoc, setSucio, textos, productos, bloqueado, abierta, sugeridos,
}: BloqueProps & {
  textos: TextoProceso[]
  productos: Producto[]
  abierta: boolean
  sugeridos: string[]
}) {
  const usados = new Set(doc.procesos.map((p) => p.texto_proceso_id).filter(Boolean))
  const contenidos = new Set(doc.procesos.map((p) => p.contenido.trim()))

  const agregar = (texto: TextoProceso) => {
    setDoc((d) => ({
      ...d,
      procesos: [...d.procesos, { texto_proceso_id: texto.id, contenido: texto.contenido }],
    }))
    setSucio(true)
  }

  return (
    <TarjetaPlegable
      titulo="Descripción del trabajo"
      abierta={abierta}
      resumen={
        doc.procesos.length === 0
          ? 'Sin bullets'
          : `${doc.procesos.length} ${doc.procesos.length === 1 ? 'bullet' : 'bullets'}`
      }
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
              {/* Bullets escritos a mano en cotizaciones anteriores (Excel migrado). */}
              {sugeridos
                .filter((s) => !contenidos.has(s.trim()))
                .map((s) => (
                  <button
                    key={s}
                    type="button"
                    title={s}
                    onClick={() => {
                      setDoc((d) => ({
                        ...d,
                        procesos: [...d.procesos, { texto_proceso_id: null, contenido: s }],
                      }))
                      setSucio(true)
                    }}
                    className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border-[0.5px] border-tinta-200 bg-tinta-50 px-3 text-[13px] font-medium text-tinta-500 transition hover:border-haaco-300 hover:bg-haaco-50 hover:text-haaco-800 lg:min-h-0 lg:rounded-lg lg:px-2.5 lg:py-1.5 lg:text-xs"
                  >
                    <Plus size={13} className="shrink-0" />
                    <span className="truncate">{s.length > 48 ? `${s.slice(0, 48)}…` : s}</span>
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
    </TarjetaPlegable>
  )
}

function BloquePartidas({
  doc, setDoc, setSucio, bloqueado, sugerencias, productos, abierta,
}: BloqueProps & { sugerencias: Sugerencia[]; productos: Producto[]; abierta: boolean }) {
  const parchear = (i: number, parche: Partial<PartidaBorrador>) => {
    setDoc((d) => ({
      ...d,
      items: d.items.map((x, j) => (j === i ? { ...x, ...parche } : x)),
    }))
    setSucio(true)
  }

  const actualizar = (
    i: number,
    campo: 'descripcion' | 'm2' | 'unidad' | 'precio_unitario',
    valor: string,
  ) =>
    // Teclear el precio a mano desmarca la tarifa: manda el número escrito.
    parchear(i, campo === 'precio_unitario' ? { precio_unitario: valor, nivel_precio: '' } : { [campo]: valor })

  // Al elegir una partida conocida se pone también su último precio unitario.
  const elegir = (i: number, s: Sugerencia) => {
    setDoc((d) => ({
      ...d,
      items: d.items.map((x, j) =>
        j === i
          ? { ...x, descripcion: s.texto, ...(s.monto ? { precio_unitario: String(s.monto) } : {}) }
          : x,
      ),
    }))
    setSucio(true)
  }

  const cuantas = doc.items.length
  const total = doc.items.reduce((s, i) => s + importePartida(i), 0)

  return (
    <TarjetaPlegable
      titulo={tituloPartidas(doc.tipo)}
      abierta={abierta}
      resumen={
        cuantas === 0
          ? 'Sin partidas'
          : `${cuantas} ${cuantas === 1 ? 'partida' : 'partidas'} · ${pesos(total)}`
      }
    >
      {/* Teléfono: una tarjeta por partida, que la tabla no cabe. */}
      <div className="flex flex-col gap-3 px-4 py-4 lg:hidden">
        {doc.items.map((item, i) => (
          <div key={i} className="rounded-[16px] border-[0.5px] border-tinta-200 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tinta-100 text-xs font-semibold text-tinta-500">
                {i + 1}
              </span>
              <EntradaSugerencias
                valor={item.descripcion}
                onCambio={(v) => actualizar(i, 'descripcion', v)}
                onElegir={(s) => elegir(i, s)}
                sugerencias={sugerencias}
                placeholder="Exterior fachada principal"
                disabled={bloqueado}
                multilinea
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
            <div className="mb-2">
              <SelectorPintura
                productos={productos}
                partida={item}
                onCambio={(parche) => parchear(i, parche)}
                deshabilitado={bloqueado}
              />
            </div>
            <div className="flex items-center gap-2">
              <Numero
                value={item.m2}
                onChange={(e) => actualizar(i, 'm2', e.target.value)}
                placeholder={abreviaUnidad(item.unidad)}
                disabled={bloqueado}
                className="!text-center"
              />
              <SelectorUnidad
                valor={item.unidad}
                onCambio={(v) => actualizar(i, 'unidad', v)}
                disabled={bloqueado}
              />
              <span className="shrink-0 text-tinta-400">×</span>
              <Numero
                value={item.precio_unitario}
                onChange={(e) => actualizar(i, 'precio_unitario', e.target.value)}
                placeholder={`$ / ${abreviaUnidad(item.unidad)}`}
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
              <th className="w-20 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-tinta-500">Cant.</th>
              <th className="w-24 border-b border-tinta-200 bg-tinta-50/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-tinta-500">Unidad</th>
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
                  <EntradaSugerencias
                    valor={item.descripcion}
                    onCambio={(v) => actualizar(i, 'descripcion', v)}
                    onElegir={(s) => elegir(i, s)}
                    sugerencias={sugerencias}
                    placeholder="Exterior fachada principal"
                    disabled={bloqueado}
                    multilinea
                  />
                  <SelectorPintura
                    productos={productos}
                    partida={item}
                    onCambio={(parche) => parchear(i, parche)}
                    compacto
                    deshabilitado={bloqueado}
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
                  <SelectorUnidad
                    valor={item.unidad}
                    onCambio={(v) => actualizar(i, 'unidad', v)}
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
                // La partida nace con la unidad que use ese tipo de trabajo:
                // pieza en herrería y otros, metro cuadrado en lo demás.
                items: [
                  ...d.items,
                  {
                    descripcion: '',
                    m2: '',
                    unidad: unidadPorTipo(d.tipo) ?? '',
                    precio_unitario: '',
                  },
                ],
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
    </TarjetaPlegable>
  )
}

/**
 * La unidad de una partida. En pintura e imper siempre son metros cuadrados y
 * el selector casi no se toca; en herrería y otros el trabajo se cobra por
 * pieza y es lo que decide cómo sale la tabla en la carta al cliente.
 */
function SelectorUnidad({
  valor, onCambio, disabled,
}: {
  valor: string
  onCambio: (valor: string) => void
  disabled?: boolean
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      disabled={disabled}
      aria-label="Unidad de la partida"
      className="min-h-11 w-full rounded-lg border border-tinta-300 bg-white px-2 text-sm text-tinta-700 outline-none transition focus:border-haaco-600 focus:ring-2 focus:ring-haaco-200 disabled:bg-tinta-50 disabled:text-tinta-400 lg:min-h-0 lg:py-2"
    >
      {UNIDADES_PARTIDA.map((u) => (
        <option key={u.valor} value={u.valor}>
          {u.texto}
        </option>
      ))}
    </select>
  )
}

function BloqueHerreria({
  doc, setDoc, setSucio, bloqueado, sugerencias, precioDe, abierta,
}: BloqueProps & { sugerencias: Sugerencia[]; precioDe: BuscarPrecio; abierta: boolean }) {
  const actualizar = (i: number, parche: Partial<ConceptoBorrador>) => {
    setDoc((d) => ({
      ...d,
      desglose: d.desglose.map((c, j) => (j === i ? { ...c, ...parche } : c)),
    }))
    setSucio(true)
  }

  const cuantos = doc.desglose.length
  const venta = doc.desglose.reduce((s, c) => s + precioConcepto(c), 0)

  return (
    <TarjetaPlegable
      titulo="Cotizador de herrería"
      abierta={abierta}
      resumen={
        cuantos === 0
          ? 'Sin conceptos'
          : `${cuantos} ${cuantos === 1 ? 'concepto' : 'conceptos'} · ${pesos(venta)}`
      }
      pie="Materiales + mano de obra + indirectos = costo. El precio de venta se calcula con el % de utilidad y entra como partida en la cotización."
    >
      <div className="space-y-4 px-5 py-5">
        {doc.desglose.length === 0 && (
          <p className="text-sm text-tinta-500">
            Captura cada concepto por separado (Portón principal, Barandal escalera…) para ver la utilidad de
            cada uno.
          </p>
        )}

        {doc.desglose.map((concepto, i) => (
          <ConceptoHerreria
            key={i}
            concepto={concepto}
            indice={i}
            bloqueado={bloqueado}
            sugerencias={sugerencias}
            precioDe={precioDe}
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
    </TarjetaPlegable>
  )
}

function ConceptoHerreria({
  concepto, indice, bloqueado, onCambio, onQuitar, sugerencias, precioDe,
}: {
  concepto: ConceptoBorrador
  indice: number
  bloqueado: boolean
  onCambio: (parche: Partial<ConceptoBorrador>) => void
  onQuitar: () => void
  sugerencias: Sugerencia[]
  precioDe: BuscarPrecio
}) {
  const costo = costoConcepto(concepto)
  const precio = precioConcepto(concepto)
  const otros = sumaMateriales(concepto.materiales, 'otro')

  const cambiarMaterial = (i: number, parche: Partial<MaterialBorrador>) =>
    onCambio({
      materiales: concepto.materiales.map((m, j) => (j === i ? { ...m, ...parche } : m)),
    })

  // Al elegir un material conocido se pone también su último costo y, si viene
  // del catálogo, con qué producto quedó ligado: eso es lo que permite después
  // saber a cómo se compró.
  const elegirMaterial = (i: number, s: Sugerencia) =>
    cambiarMaterial(i, {
      material: s.texto,
      producto_id: s.producto_id ?? null,
      ...(s.monto ? { costo: String(s.monto) } : {}),
    })

  return (
    <div className="rounded-xl border border-tinta-200">
      <div className="flex items-center gap-2 border-b border-tinta-100 bg-tinta-50/60 px-4 py-2.5">
        <span className="text-xs font-semibold text-tinta-400">#{indice + 1}</span>
        <Entrada
          value={concepto.concepto}
          onChange={(e) => onCambio({ concepto: e.target.value })}
          placeholder="Portón principal"
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
                <EntradaSugerencias
                  valor={m.material}
                  // Al teclear encima se suelta el producto: un material ligado
                  // con el nombre cambiado miente peor que uno sin ligar.
                  onCambio={(v) => cambiarMaterial(i, { material: v, producto_id: null })}
                  onElegir={(s) => elegirMaterial(i, s)}
                  sugerencias={sugerencias}
                  placeholder="PTR 1x1"
                  disabled={bloqueado}
                />
                {precioDe(m) && (
                  <PrecioVivo
                    precio={precioDe(m)!}
                    onUsar={(monto) => cambiarMaterial(i, { costo: String(monto) })}
                  />
                )}
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

      <dl
        className={`grid grid-cols-2 gap-x-4 border-t border-tinta-100 bg-tinta-50/60 px-4 py-2.5 text-xs ${otros > 0 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}
      >
        <Mini etiqueta="Herrería" valor={pesos(sumaMateriales(concepto.materiales, 'herreria'))} />
        <Mini etiqueta="Pintura" valor={pesos(sumaMateriales(concepto.materiales, 'pintura'))} />
        {otros > 0 && <Mini etiqueta="Otros" valor={pesos(otros)} />}
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

function BloqueMateriales({
  doc, setDoc, setSucio, bloqueado, abierta, sugerencias, precioDe,
}: BloqueProps & { abierta: boolean; sugerencias: Sugerencia[]; precioDe: BuscarPrecio }) {
  const sueltos = doc.materiales
  // Los materiales capturados en el cotizador de herrería también son parte
  // del presupuesto: aquí se ven (y suman), pero se editan en su concepto.
  const deHerreria = doc.desglose.flatMap((c) =>
    c.materiales
      .filter((m) => m.material.trim())
      .map((m) => ({ ...m, concepto: c.concepto.trim() })),
  )
  const total = redondear(sumaMateriales(sueltos) + sumaMateriales(deHerreria))
  const cuantos = sueltos.length + deHerreria.length

  const actualizar = (i: number, parche: Partial<MaterialBorrador>) => {
    setDoc((d) => ({
      ...d,
      materiales: d.materiales.map((m, j) => (j === i ? { ...m, ...parche } : m)),
    }))
    setSucio(true)
  }

  // Al elegir un material conocido se pone también su último costo y el
  // producto del catálogo, si la sugerencia venía de ahí.
  const elegir = (i: number, s: Sugerencia) =>
    actualizar(i, {
      material: s.texto,
      producto_id: s.producto_id ?? null,
      ...(s.monto ? { costo: String(s.monto) } : {}),
    })

  return (
    <TarjetaPlegable
      titulo="Material presupuestado"
      abierta={abierta}
      resumen={
        cuantos === 0
          ? 'Sin material'
          : `${pesos(total)} · ${cuantos} ${cuantos === 1 ? 'material' : 'materiales'}`
      }
      pie={`${pesos(total)} · al aprobar se copia a la orden de trabajo como material COTIZADO, para compararlo después contra lo que realmente se gastó.`}
    >
      <div className="px-5 py-5">
        {cuantos === 0 && (
          <p className="mb-3 text-sm text-tinta-500">
            Opcional. Anota la pintura y el material que calculas usar para poder medir la utilidad
            real de la obra.
          </p>
        )}

        {deHerreria.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-tinta-400">
              Del cotizador de herrería
            </p>
            <ul className="divide-y divide-tinta-100 rounded-[14px] border-[0.5px] border-tinta-200 bg-tinta-50/60">
              {deHerreria.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3.5 py-2 text-sm">
                  <span className="min-w-0 truncate text-tinta-700">
                    {m.material}
                    {m.concepto && <span className="text-tinta-400"> · {m.concepto}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-tinta-600">
                    {num(m.piezas)} × {pesos(num(m.costo))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-tinta-400">
              Se editan en su concepto de herrería; al aprobar también pasan a la orden de trabajo.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          {sueltos.map((m, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto] items-center gap-1.5 lg:grid-cols-12"
            >
              <div className="lg:col-span-6">
                <EntradaSugerencias
                  valor={m.material}
                  onCambio={(v) => actualizar(i, { material: v, producto_id: null })}
                  onElegir={(s) => elegir(i, s)}
                  sugerencias={sugerencias}
                  placeholder="Rivinol 7 blanco"
                  disabled={bloqueado}
                />
                {precioDe(m) && (
                  <PrecioVivo
                    precio={precioDe(m)!}
                    onUsar={(monto) => actualizar(i, { costo: String(monto) })}
                  />
                )}
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
    </TarjetaPlegable>
  )
}
