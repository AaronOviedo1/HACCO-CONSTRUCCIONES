'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2, Pencil, Plus, Sparkles, Trash2, TriangleAlert, X } from 'lucide-react'
import {
  Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, Opciones, PieDialogo, Seleccion,
} from '@/components/formulario'
import { EntradaSugerencias } from '@/components/entrada-sugerencias'
import { SelectorFecha } from '@/components/filtro-fechas'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { hoyISO, num, redondear, type Sugerencia } from '@/lib/cotizaciones'
import { pesos } from '@/lib/format'
import { CATEGORIA_GASTO, CONDICION, METODO_PAGO } from '@/lib/finanzas'
import { prepararTicket, type DesgloseComprobante, type LecturaTicket } from '@/lib/ticket'
import {
  actualizarGasto, agregarProductoAlCatalogo, eliminarGasto, entradaInventario, registrarGasto,
} from '@/app/admin/finanzas-acciones'
import type {
  CategoriaGasto, CondicionCompra, Gasto, MetodoPago, ObraConcepto, Proveedor,
  TipoProducto, VInsumoExistencia,
} from '@/types/database'

type ObraSimple = { id: string; nombre: string; ot_numero: string | null }

/** Lo que hace falta del gasto para volver a abrirlo y corregirlo. */
export type GastoEditable = Pick<
  Gasto,
  | 'id' | 'obra_id' | 'concepto_id' | 'categoria' | 'descripcion' | 'piezas' | 'monto'
  | 'folio_factura' | 'proveedor_id' | 'metodo' | 'condicion' | 'fecha'
> & {
  /** El nombre de su obra, para poder nombrarla aunque ya esté cerrada. */
  obra?: string | null
  ot_numero?: string | null
}

type PropsComunes = {
  obras: ObraSimple[]
  proveedores: Pick<Proveedor, 'id' | 'nombre' | 'dias_credito_default'>[]
  conceptos: ObraConcepto[]
  obraFija?: string
  insumos?: VInsumoExistencia[]
  sugerencias?: Sugerencia[]
}

export function BotonNuevoGasto({
  abrirAlEntrar = false,
  ...props
}: PropsComunes & {
  /** Con `?nuevo=1` en la URL el formulario sale solo: es el aterrizaje del
      botón «+» del teléfono, que promete capturar el gasto, no ver la lista. */
  abrirAlEntrar?: boolean
}) {
  const [abierto, setAbierto] = useState(abrirAlEntrar)
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
      {abierto && <FormularioGasto {...props} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

/**
 * Corregir un gasto ya capturado: el caso de siempre es que se cargó como
 * general y era de una OT, o que se fue a la OT equivocada.
 */
export function BotonEditarGasto({ gasto, ...props }: PropsComunes & { gasto: GastoEditable }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded p-1 text-tinta-400 transition hover:bg-tinta-100 hover:text-tinta-800"
        aria-label={`Editar ${gasto.descripcion}`}
      >
        <Pencil size={15} />
      </button>
      {abierto && <FormularioGasto {...props} gasto={gasto} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

function FormularioGasto({
  obras: obrasAbiertas, proveedores, conceptos, obraFija, insumos = [], sugerencias = [],
  gasto, onCerrar,
}: PropsComunes & { gasto?: GastoEditable; onCerrar: () => void }) {
  const editando = Boolean(gasto)

  // La lista sólo trae las OT abiertas —a una cerrada no se le cargan gastos
  // nuevos—, pero si el gasto que se corrige es de una cerrada tiene que seguir
  // pudiendo quedarse donde está, o al guardar se iría a «general» sin avisar.
  const obras =
    gasto?.obra_id && !obrasAbiertas.some((o) => o.id === gasto.obra_id)
      ? [
          ...obrasAbiertas,
          { id: gasto.obra_id, nombre: `${gasto.obra ?? 'Obra'} (cerrada)`, ot_numero: gasto.ot_numero ?? null },
        ]
      : obrasAbiertas
  const router = useRouter()
  const pathname = usePathname()
  const entrada = useRef<HTMLInputElement>(null)
  const [pendiente, iniciar] = useTransition()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [archivo, setArchivo] = useState<File | null>(null)
  const [vista, setVista] = useState<string | null>(null)
  const [obraId, setObraId] = useState(gasto?.obra_id ?? obraFija ?? '')
  const [conceptoId, setConceptoId] = useState(gasto?.concepto_id ?? '')
  const [categoria, setCategoria] = useState<CategoriaGasto>(gasto?.categoria ?? 'material')
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? '')
  const [piezas, setPiezas] = useState(gasto ? String(gasto.piezas ?? 1) : '1')
  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '')
  // Cuando el ticket trae varios artículos, se captura renglón por renglón y
  // se registra un gasto por cada uno; null = captura sencilla de siempre.
  const [renglones, setRenglones] = useState<
    { descripcion: string; piezas: string; monto: string }[] | null
  >(null)
  const [folio, setFolio] = useState(gasto?.folio_factura ?? '')
  const [proveedorId, setProveedorId] = useState(gasto?.proveedor_id ?? '')
  const [metodo, setMetodo] = useState<MetodoPago>(gasto?.metodo ?? 'efectivo')
  const [condicion, setCondicion] = useState<CondicionCompra>(gasto?.condicion ?? 'contado')
  const [fecha, setFecha] = useState(gasto?.fecha ?? hoyISO())
  const [crearMaterial, setCrearMaterial] = useState(true)

  // Entrada al inventario del taller (compras para stock, sin obra)
  const [alInventario, setAlInventario] = useState(false)
  const [insumoId, setInsumoId] = useState('')
  const [insumoUnidad, setInsumoUnidad] = useState('pza')
  const [insumoCantidad, setInsumoCantidad] = useState('')

  // Alta rápida en el catálogo para gastos que se repiten
  const [catalogoAbierto, setCatalogoAbierto] = useState(false)
  const [catalogoUnidad, setCatalogoUnidad] = useState('pza')
  const [catalogoTipo, setCatalogoTipo] = useState<TipoProducto>('otro')
  const [catalogoListo, setCatalogoListo] = useState(false)

  // Lectura del ticket: lo que ya tecleó quien captura manda sobre lo que lea
  // la foto, aunque la foto llegue después.
  const tocado = useRef(new Set<string>())
  const [leyendo, setLeyendo] = useState(false)
  const [llenados, setLlenados] = useState<string[] | null>(null)
  const [avisoTicket, setAvisoTicket] = useState<string | null>(null)
  // El pie del comprobante: se enseña y sirve para comparar contra la suma de
  // los conceptos, que se puede corregir a mano.
  const [desgloseTicket, setDesgloseTicket] = useState<DesgloseComprobante | null>(null)

  const proveedor = proveedores.find((p) => p.id === proveedorId)
  const conceptosDeObra = conceptos.filter(() => Boolean(obraId))
  const esMaterialDeObra = categoria === 'material' && Boolean(obraId)
  // Compras para el stock del taller: material o herramienta sin obra asignada.
  // Al corregir un gasto no se ofrece: la entrada al inventario ya se dio (o no)
  // cuando se capturó, y repetirla duplicaría la existencia.
  const puedeInventario =
    !editando && (categoria === 'material' || categoria === 'herramienta') && !obraId && !renglones
  const enCatalogo = sugerencias.some(
    (s) => s.producto_id && s.texto.toLowerCase() === descripcion.trim().toLowerCase(),
  )

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
    setDesgloseTicket(null)
    // Pedir la lectura es decir «llénalo tú»: lo tecleado hasta aquí deja de
    // considerarse definitivo. Sin esto bastaba con haber escrito una letra en
    // la descripción —que abre enfocada— para que la foto ya no pisara nada y
    // el gasto acabara capturándose a mano. Lo que se corrija DESPUÉS, mientras
    // el ticket viaja, sí vuelve a marcarse y la lectura lo respeta.
    tocado.current.clear()
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

    // Ticket de varios artículos: cada concepto llega con sus piezas y su
    // importe, listo para revisar renglón por renglón. Si la captura ya está
    // dividida en conceptos, la lectura los reemplaza aunque el ticket traiga
    // uno solo; si no, hacen falta dos para que valga la pena dividirla.
    const porConceptos = l.renglones.length > (renglones === null ? 1 : 0)

    if (porConceptos && !tocado.current.has('conceptos')) {
      setRenglones(
        l.renglones.map((r) => ({
          descripcion: r.descripcion,
          piezas: String(r.piezas),
          monto: String(r.monto),
        })),
      )
      // El desglose acompaña a los renglones que salieron de ESTA lectura: si
      // los conceptos son los que alguien capturó a mano, compararlos contra el
      // pie de otro comprobante no diría nada.
      setDesgloseTicket(l.desglose)
      puestos.push(l.renglones.length === 1 ? 'el concepto' : `${l.renglones.length} conceptos`)
    } else if (renglones === null) {
      poner('descripción', l.descripcion, setDescripcion)
      poner('piezas', l.piezas === null ? null : String(l.piezas), setPiezas)
      poner('monto', l.monto === null ? null : String(l.monto), setMonto)
    }
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

  const cambiarRenglon = (i: number, parche: Partial<{ descripcion: string; piezas: string; monto: string }>) => {
    mio('conceptos')
    setRenglones((lista) => (lista ?? []).map((r, j) => (j === i ? { ...r, ...parche } : r)))
  }

  const filasValidas = (renglones ?? []).filter((r) => r.descripcion.trim() && num(r.monto) > 0)
  // Se redondea la suma porque 13,908 + 9,150.06 en coma flotante da
  // 23,058.059999999998 y encendería el aviso de descuadre por nada.
  const totalRenglones = redondear(filasValidas.reduce((s, r) => s + num(r.monto), 0))
  // Contra el total del comprobante, en vivo: si se corrige una casilla, el
  // aviso aparece o se va solo.
  const totalTicket = desgloseTicket?.total ?? null
  const descuadre =
    renglones && totalTicket !== null && filasValidas.length > 0
      ? redondear(totalRenglones - totalTicket)
      : 0

  /** De la captura sencilla al modo por conceptos y de regreso. */
  const dividir = () => {
    mio('conceptos')
    setRenglones([
      { descripcion, piezas, monto },
      { descripcion: '', piezas: '1', monto: '' },
    ])
  }
  const unir = () => {
    const primero = renglones?.[0]
    if (primero) {
      setDescripcion(primero.descripcion)
      setPiezas(primero.piezas)
      // Un solo gasto por lo que costó todo, no por lo del primer renglón.
      setMonto(String(totalRenglones || num(primero.monto)))
    }
    setRenglones(null)
    setDesgloseTicket(null)
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

      const base = {
        obra_id: obraId || null,
        concepto_id: conceptoId || null,
        categoria,
        folio_factura: folio.trim() || null,
        proveedor_id: proveedorId || null,
        metodo,
        condicion,
        foto_ticket_path: ruta,
        fecha,
        crear_material: esMaterialDeObra && crearMaterial,
      }

      if (gasto) {
        // Al corregir no se divide en conceptos ni se vuelve a dar entrada al
        // inventario: es el mismo gasto, con los datos puestos donde van.
        const r = await actualizarGasto(
          gasto.id,
          {
            ...base,
            descripcion,
            piezas: num(piezas) || 1,
            costo_unitario: num(piezas) > 0 ? num(monto) / num(piezas) : null,
            monto: num(monto),
          },
          gasto.obra_id,
        )
        if (!r.ok) return setError(r.error)
      } else if (renglones) {
        // Un gasto por concepto: comparten ticket, folio, proveedor y forma de pago.
        for (const [i, r] of filasValidas.entries()) {
          const res = await registrarGasto({
            ...base,
            descripcion: r.descripcion,
            piezas: num(r.piezas) || 1,
            costo_unitario: num(r.piezas) > 0 ? num(r.monto) / num(r.piezas) : null,
            monto: num(r.monto),
          })
          if (!res.ok) {
            setError(`Concepto ${i + 1} («${r.descripcion}»): ${res.error}`)
            return
          }
        }
      } else {
        const r = await registrarGasto({
          ...base,
          descripcion,
          piezas: num(piezas) || 1,
          costo_unitario: num(piezas) > 0 ? num(monto) / num(piezas) : null,
          monto: num(monto),
        })
        if (!r.ok) return setError(r.error)

        if (puedeInventario && alInventario && r.datos) {
          const cantidad = num(insumoCantidad) || num(piezas) || 1
          const re = await entradaInventario(
            r.datos.id,
            cantidad,
            insumoId || null,
            insumoId ? null : descripcion,
            insumoId ? null : insumoUnidad,
          )
          if (!re.ok) {
            setError(`El gasto quedó guardado, pero la entrada al inventario falló: ${re.error}`)
            return
          }
        }
      }

      onCerrar()

      // La página de gastos abre en el mes actual; si el ticket era de otro
      // mes (pasa seguido al capturar con calma), la vista brinca a ese mes
      // para que el gasto recién guardado quede a la vista.
      const mesGasto = fecha.slice(0, 7)
      if (pathname === '/admin/gastos' && mesGasto !== hoyISO().slice(0, 7)) {
        const [a, m] = mesGasto.split('-').map(Number)
        const ultimo = new Date(a, m, 0).getDate()
        router.replace(`/admin/gastos?desde=${mesGasto}-01&hasta=${mesGasto}-${String(ultimo).padStart(2, '0')}`)
      }
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo={editando ? 'Corregir gasto' : 'Nuevo gasto'}
      descripcion={
        editando
          ? 'Cambia lo que haga falta, incluida la obra a la que se carga.'
          : 'Toma la foto del ticket: se lee sola y tú nada más revisas.'
      }
    >
      <CuerpoDialogo>
        <input
          ref={entrada}
          type="file"
          accept="image/*,application/pdf"
          // Sin `capture`: con él, el teléfono abre la cámara y ya no deja
          // elegir de la galería, y los tickets casi siempre se capturan
          // después, con la foto ya tomada.
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
                  setDesgloseTicket(null)
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

        {renglones ? (
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-tinta-700">Conceptos del ticket</span>
              <button
                type="button"
                onClick={unir}
                className="text-xs font-medium text-tinta-500 underline-offset-2 hover:text-haaco-700 hover:underline"
              >
                Capturar como uno solo
              </button>
            </div>
            <div className="space-y-1.5">
              {renglones.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-1.5 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <Entrada
                      value={r.descripcion}
                      onChange={(e) => cambiarRenglon(i, { descripcion: e.target.value })}
                      placeholder="Cubeta Rivinol 7 blanco"
                    />
                  </div>
                  <div className="flex items-center justify-end lg:order-last lg:col-span-1">
                    {renglones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          mio('conceptos')
                          setRenglones((lista) => (lista ?? []).filter((_, j) => j !== i))
                        }}
                        className="flex h-11 w-11 items-center justify-center rounded text-tinta-400 hover:bg-red-50 hover:text-red-600 lg:h-auto lg:w-auto lg:p-1"
                        aria-label="Quitar concepto"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-1.5 lg:contents">
                    <div className="lg:col-span-2">
                      <Numero
                        value={r.piezas}
                        onChange={(e) => cambiarRenglon(i, { piezas: e.target.value })}
                        placeholder="pzas"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <Numero
                        value={r.monto}
                        onChange={(e) => cambiarRenglon(i, { monto: e.target.value })}
                        placeholder="importe"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  mio('conceptos')
                  setRenglones((lista) => [...(lista ?? []), { descripcion: '', piezas: '1', monto: '' }])
                }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-haaco-700 hover:underline"
              >
                <Plus size={14} />
                Agregar concepto
              </button>
              <span className="text-sm font-semibold tabular-nums text-tinta-900">
                Total {pesos(totalRenglones)}
              </span>
            </div>

            {desgloseTicket && (
              <p className="mt-1 text-xs tabular-nums text-tinta-400">
                Del comprobante: {resumenComprobante(desgloseTicket)}
              </p>
            )}

            {Math.abs(descuadre) >= 0.01 && (
              <p className="mt-1.5 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <TriangleAlert size={14} className="mt-px shrink-0" />
                <span>
                  La suma de los conceptos {descuadre > 0 ? 'se pasa por' : 'queda corta por'}{' '}
                  <strong className="font-semibold tabular-nums">{pesos(Math.abs(descuadre))}</strong>{' '}
                  del total del comprobante. Revísalos contra el papel antes de guardar.
                </span>
              </p>
            )}

            <p className="mt-1 text-xs text-tinta-400">
              Se registra un gasto por concepto; comparten ticket, folio, proveedor y forma de pago.
            </p>
          </div>
        ) : (
          <Campo
            etiqueta="Descripción"
            hijo={
              <EntradaSugerencias
                valor={descripcion}
                onCambio={(v) => {
                  mio('descripción')
                  setDescripcion(v)
                  setCatalogoListo(false)
                }}
                onElegir={(s) => {
                  mio('descripción')
                  setDescripcion(s.texto)
                  if (s.monto && !num(monto)) {
                    mio('importe')
                    setMonto(String(Math.round(s.monto * (num(piezas) || 1) * 100) / 100))
                  }
                  if (s.proveedor_id && !proveedorId) {
                    mio('proveedor')
                    setProveedorId(s.proveedor_id)
                  }
                }}
                sugerencias={sugerencias}
                placeholder="Cubetas Rivinol 7 blanco"
              />
            }
          />
        )}
        {!renglones && (
          <div className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 sm:col-span-2">
            {/* Dividir crea un gasto por concepto: eso es un alta, no una
                corrección, y al editar no tiene a dónde ir. */}
            {!editando && (
              <button
                type="button"
                onClick={dividir}
                className="text-xs font-medium text-tinta-500 underline-offset-2 hover:text-haaco-700 hover:underline"
              >
                ¿El ticket trae varios artículos? Divídelo en conceptos
              </button>
            )}
            {descripcion.trim() && !enCatalogo && !catalogoListo && (
              <button
                type="button"
                onClick={() => setCatalogoAbierto((v) => !v)}
                className="text-xs font-medium text-tinta-500 underline-offset-2 hover:text-haaco-700 hover:underline"
              >
                Agregar al catálogo
              </button>
            )}
            {catalogoListo && (
              <span className="text-xs font-medium text-haaco-700">
                Guardado en el catálogo: la próxima vez sale solo.
              </span>
            )}
          </div>
        )}
        {!renglones && catalogoAbierto && !catalogoListo && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg bg-tinta-50 px-3 py-2.5 sm:col-span-2">
            <Campo
              etiqueta="Unidad"
              hijo={
                <Entrada
                  value={catalogoUnidad}
                  onChange={(e) => setCatalogoUnidad(e.target.value)}
                  placeholder="pza"
                />
              }
            />
            <Campo
              etiqueta="Tipo"
              hijo={
                <Seleccion
                  value={catalogoTipo}
                  onChange={(e) => setCatalogoTipo(e.target.value as TipoProducto)}
                >
                  <option value="otro">Otro</option>
                  <option value="pintura">Pintura</option>
                  <option value="herreria">Herrería</option>
                  <option value="insumo_taller">Insumo de taller</option>
                </Seleccion>
              }
            />
            <button
              type="button"
              onClick={() =>
                iniciar(async () => {
                  const r = await agregarProductoAlCatalogo({
                    nombre: descripcion,
                    costo: num(piezas) > 0 ? num(monto) / num(piezas) : num(monto),
                    unidad: catalogoUnidad,
                    tipo: catalogoTipo,
                    proveedor_id: proveedorId || null,
                  })
                  if (!r.ok) return setError(r.error)
                  setCatalogoAbierto(false)
                  setCatalogoListo(true)
                })
              }
              disabled={pendiente}
              className="rounded-lg bg-haaco-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
            >
              Guardar en catálogo
            </button>
          </div>
        )}
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

        {!renglones && (
          <>
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
          </>
        )}

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

        {puedeInventario && (
          <div className="rounded-lg bg-tinta-50 px-3 py-2.5 sm:col-span-2">
            <label className="flex items-center gap-2.5 text-sm text-tinta-700">
              <input
                type="checkbox"
                checked={alInventario}
                onChange={(e) => setAlInventario(e.target.checked)}
                className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600"
              />
              Dar entrada al inventario del taller
            </label>
            {alInventario && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                <Campo
                  etiqueta="Insumo"
                  hijo={
                    <Seleccion value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>
                      <option value="">
                        {descripcion.trim()
                          ? `Nuevo: ${descripcion.trim().slice(0, 40)}`
                          : 'Insumo nuevo (usa la descripción)'}
                      </option>
                      {insumos.map((i) => (
                        <option key={i.producto_id} value={i.producto_id}>
                          {i.nombre} · {Number(i.existencia)} {i.unidad}
                        </option>
                      ))}
                    </Seleccion>
                  }
                />
                <Campo
                  etiqueta="Cantidad"
                  hijo={
                    <Numero
                      value={insumoCantidad}
                      onChange={(e) => setInsumoCantidad(e.target.value)}
                      placeholder={piezas || '1'}
                    />
                  }
                />
                {!insumoId && (
                  <Campo
                    etiqueta="Unidad"
                    hijo={
                      <Entrada
                        value={insumoUnidad}
                        onChange={(e) => setInsumoUnidad(e.target.value)}
                        placeholder="pza"
                      />
                    }
                  />
                )}
              </div>
            )}
          </div>
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
          disabled={
            pendiente ||
            subiendo ||
            (renglones ? filasValidas.length === 0 : !descripcion.trim() || num(monto) <= 0)
          }
          className="min-h-12 rounded-[14px] bg-haaco-700 px-4 text-base font-semibold text-white transition hover:bg-haaco-800 disabled:bg-haaco-300 sm:min-h-0 sm:rounded-lg sm:py-2 sm:text-sm sm:font-medium"
        >
          {subiendo
            ? 'Subiendo ticket…'
            : pendiente
              ? 'Guardando…'
              : editando
                ? 'Guardar cambios'
                : renglones && filasValidas.length > 1
                  ? `Registrar ${filasValidas.length} gastos`
                  : 'Registrar gasto'}
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

/**
 * «subtotal $31,807.69 · descuento −$11,930.05 · IVA $3,180.42 · total $23,058.06»
 *
 * Se arma por piezas y no de corrido porque las cifras que el comprobante no
 * trae vienen en null, y un «descuento −$0.00» en un ticket sin descuento es
 * ruido que confunde.
 */
function resumenComprobante(d: DesgloseComprobante) {
  const partes: string[] = []
  if (d.subtotal !== null) partes.push(`subtotal ${pesos(d.subtotal)}`)
  if (d.descuento !== null) partes.push(`descuento −${pesos(d.descuento)}`)
  if (d.impuesto !== null) partes.push(`IVA ${pesos(d.impuesto)}`)
  if (d.total !== null) partes.push(`total ${pesos(d.total)}`)
  return partes.join(' · ')
}

/**
 * Borra el gasto con todo y sus rastros: cuenta por pagar y material real.
 *
 * La confirmación se pide en un diálogo propio y no con el `confirm()` del
 * navegador: al tercer aviso seguido, Safari ofrece callar los cuadros de esta
 * página y a partir de ahí los borrados dejarían de responder sin decir nada.
 */
export function BotonEliminarGasto({ id, descripcion }: { id: string; descripcion: string }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  const borrar = () =>
    iniciar(async () => {
      setError(null)
      const r = await eliminarGasto(id)
      if (!r.ok) return setError(r.error)
      setConfirmando(false)
      router.refresh()
    })

  return (
    <>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => setConfirmando(true)}
        className={`rounded p-1 text-tinta-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 ${
          error ? 'text-red-600' : ''
        }`}
        aria-label={`Eliminar ${descripcion}`}
        title="Eliminar gasto"
      >
        {pendiente ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </button>

      {confirmando && (
        <Dialogo
          abierto
          onCerrar={() => setConfirmando(false)}
          titulo="Eliminar gasto"
          descripcion={descripcion}
        >
          <CuerpoDialogo>
            <p className="text-sm text-tinta-600 sm:col-span-2">
              También se quitan su cuenta por pagar y el material que dejó en la obra. No se puede
              deshacer.
            </p>
            <MensajeError mensaje={error} />
          </CuerpoDialogo>
          <PieDialogo>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
            >
              Conservar
            </button>
            <button
              type="button"
              onClick={borrar}
              disabled={pendiente}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:bg-red-300"
            >
              <Trash2 size={15} />
              {pendiente ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </PieDialogo>
        </Dialogo>
      )}
    </>
  )
}
