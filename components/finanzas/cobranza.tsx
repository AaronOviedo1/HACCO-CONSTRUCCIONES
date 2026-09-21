'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { Paperclip, Pencil, Plus, Receipt, ShieldCheck, TriangleAlert, Trash2, X } from 'lucide-react'
import {
  AreaTexto, Campo, Casilla, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, Opciones,
  PieDialogo,
} from '@/components/formulario'
import { Etiqueta, FilaAccion, Td } from '@/components/ui'
import { SelectorFecha } from '@/components/filtro-fechas'
import { AccionesReciboPago } from '@/components/finanzas/recibo-de-pago'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { fecha, montoEnLetra, pesos, tamanoMonto } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import { conceptoDePago } from '@/lib/cobranza'
import { METODO_PAGO, METODO_PAGO_SIN_CAJA, TIPO_PAGO_COBRANZA } from '@/lib/finanzas'
import { PREF_RECIBO_COBRANZA } from '@/lib/preferencias'
import {
  actualizarCobro, eliminarCobro, emitirReciboPago, registrarCobro,
} from '@/app/admin/finanzas-acciones'
import type { MetodoPago, PagoCobranza, TipoPagoCobranza, VCobranza } from '@/types/database'

type ObraSimple = { id: string; nombre: string; ot_numero: string | null; estatus: string }

/** Un recibo ya emitido: lo que hace falta para nombrarlo y para abrirlo. */
export type ReciboRef = { id: string; folio: string | null }

/**
 * Los recibos que ya se le entregaron al cliente, por pago.
 *
 * Son dos papeles distintos y un mismo pago puede llevar los dos: el
 * recibo-contrato del anticipo —que se emite en la OT, con firmas— y el acuse
 * simple que se manda por WhatsApp. Guardarlos en un solo campo hacía que
 * emitir el acuse de un anticipo pareciera un duplicado del contrato.
 */
export type RecibosDelPago = { contrato?: ReciboRef; pago?: ReciboRef }
type Recibos = Record<string, RecibosDelPago>

export function AccionesCobranza({
  cobranza,
  pagos,
  obras,
  recibos,
  telefono,
  variante = 'tabla',
}: {
  cobranza: VCobranza
  pagos: PagoCobranza[]
  obras: ObraSimple[]
  recibos?: Recibos
  /** El del cliente: sin él no se puede mandar el recibo a su chat. */
  telefono?: string | null
  /** En el teléfono el pago es la acción principal de la tarjeta, no un icono. */
  variante?: 'tabla' | 'movil'
}) {
  const [abierto, setAbierto] = useState(false)

  // Una cotización sin saldo ya no se cobra: lo que se viene a hacer aquí es
  // revisar sus pagos, y si alguno quedó mal, corregirlo.
  const liquidada = Number(cobranza.saldo) <= 0

  return (
    <>
      {variante === 'movil' ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="min-h-11 rounded-[13px] bg-haaco-700 px-4 text-[15px] font-semibold text-white transition active:bg-haaco-800"
        >
          {liquidada ? 'Ver pagos' : 'Registrar abono'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          {liquidada ? <Receipt size={14} /> : <Plus size={14} />}
          {liquidada ? 'Pagos' : 'Pago'}
        </button>
      )}

      {abierto && (
        <DialogoCobranza
          cobranza={cobranza}
          pagos={pagos}
          obras={obras}
          recibos={recibos}
          telefono={telefono}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

/**
 * Un renglón del registro de cobranza.
 *
 * Lo que se hace aquí es cobrar, así que tocar el renglón —en cualquier
 * celda— abre el estado de cuenta de esa cotización con el alta de pago. De
 * eso se encarga `FilaAccion`; el botón «Pago» se queda a la derecha para que
 * la acción siga siendo visible, y el folio sigue llevando a la cotización.
 *
 * El historial usa el mismo renglón: ahí no hay nada que cobrar, pero es el
 * único camino para llegar a un pago que se capturó mal —y por el que la
 * cotización se dio por saldada de más—.
 */
export function FilaCobranza({
  cobranza,
  pagos,
  obras,
  recibos,
  telefono,
  children,
}: {
  cobranza: VCobranza
  pagos: PagoCobranza[]
  obras: ObraSimple[]
  recibos?: Recibos
  telefono?: string | null
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const liquidada = Number(cobranza.saldo) <= 0

  return (
    <FilaAccion alActivar={() => setAbierto(true)}>
      <Td className="font-medium text-tinta-900">
        <button type="button" onClick={() => setAbierto(true)} className="text-left">
          {cobranza.cliente}
        </button>
      </Td>

      {children}

      <Td>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          {liquidada ? <Receipt size={14} /> : <Plus size={14} />}
          {liquidada ? 'Pagos' : 'Pago'}
        </button>
        {abierto && (
          <DialogoCobranza
            cobranza={cobranza}
            pagos={pagos}
            obras={obras}
            recibos={recibos}
            telefono={telefono}
            onCerrar={() => setAbierto(false)}
          />
        )}
      </Td>
    </FilaAccion>
  )
}

/**
 * Cómo abre la casilla del recibo. Sin nada guardado, marcada: el caso común
 * es que el cliente quiera su papel, y desmarcarla se queda para la próxima.
 */
function leerPreferenciaRecibo(): boolean {
  try {
    return localStorage.getItem(PREF_RECIBO_COBRANZA) !== '0'
  } catch {
    // Navegación privada o almacenamiento bloqueado: no poder recordarlo no
    // impide emitir el recibo hoy.
    return true
  }
}

function DialogoCobranza({
  cobranza, pagos, obras, recibos, telefono, onCerrar,
}: {
  cobranza: VCobranza
  pagos: PagoCobranza[]
  obras: ObraSimple[]
  recibos?: Recibos
  telefono?: string | null
  onCerrar: () => void
}) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
  const campoMonto = useRef<HTMLInputElement>(null)
  const [pendiente, iniciar] = useTransition()
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saldo = Number(cobranza.saldo)
  const sinAnticipo = Number(cobranza.anticipo) === 0

  const [tipo, setTipo] = useState<TipoPagoCobranza>(sinAnticipo ? 'anticipo' : 'abono')
  const [monto, setMonto] = useState(
    String(sinAnticipo ? Number(cobranza.anticipo_esperado) : ''),
  )
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia')
  const [fechaPago, setFechaPago] = useState(hoyISO())
  const [notas, setNotas] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)

  // El recibo del cliente. La casilla abre como se dejó la última vez: hay
  // quien lo manda en todos los pagos y quien no lo usa nunca.
  //
  // Se lee al construir el estado y no en un efecto porque este diálogo nace
  // de un clic: para cuando existe, el navegador ya está. Con un efecto, la
  // casilla se pintaba marcada un instante antes de corregirse sola.
  const [conRecibo, setConRecibo] = useState(leerPreferenciaRecibo)
  const [concepto, setConcepto] = useState('')
  /** Mientras nadie lo escriba a mano, el concepto sigue al tipo de pago. */
  const [conceptoPropio, setConceptoPropio] = useState(false)
  /** El acuse recién emitido, para ofrecerlo sin tener que ir a buscarlo. */
  const [reciboNuevo, setReciboNuevo] = useState<(ReciboRef & { monto: number }) | null>(null)
  const [emitiendo, setEmitiendo] = useState(false)

  const cambiarConRecibo = (valor: boolean) => {
    setConRecibo(valor)
    try {
      localStorage.setItem(PREF_RECIBO_COBRANZA, valor ? '1' : '0')
    } catch {
      // Igual que arriba: no poder recordarlo no impide emitir el recibo hoy.
    }
  }

  /** El pago que se está corrigiendo. Nulo mientras se da uno de alta. */
  const [pagoEditado, setPagoEditado] = useState<PagoCobranza | null>(null)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)

  // El pago que se corrige ya viene descontado en `saldo`: para simular el
  // saldo que dejará hay que devolverlo primero, o se contaría dos veces.
  const saldoBase = redondear(saldo + Number(pagoEditado?.monto ?? 0))
  const saldoDespues = redondear(saldoBase - num(monto))
  const liquida = num(monto) > 0 && saldoDespues <= 0
  const obrasEntregadas = obras.filter(
    (o) => o.estatus === 'en_entrega' || o.estatus === 'terminada',
  )
  const reciboEmitido = pagoEditado ? recibos?.[pagoEditado.id] : undefined
  const idsObras = obras.map((o) => o.id)
  // El acuse cuelga de la OT sólo cuando no hay duda de cuál es: con dos obras
  // abiertas de la misma cotización, elegir una sería inventar.
  const obraDelRecibo = obras.length === 1 ? obras[0].id : null
  /** Con lo que abre el concepto: «Abono de la cotización F-475». */
  const conceptoSugerido = conceptoDePago(tipo, cobranza.folio)
  const conceptoFinal = conceptoPropio && concepto.trim() ? concepto : conceptoSugerido

  /** Los valores con los que abre el alta. Se usan al entrar y al cancelar. */
  const valoresDeAlta = () => {
    setTipo(sinAnticipo ? 'anticipo' : 'abono')
    setMonto(String(sinAnticipo ? Number(cobranza.anticipo_esperado) : ''))
    setMetodo('transferencia')
    setFechaPago(hoyISO())
    setNotas('')
    setArchivo(null)
    setConcepto('')
    setConceptoPropio(false)
  }

  const editar = (p: PagoCobranza) => {
    setError(null)
    setConfirmandoBorrado(false)
    setReciboNuevo(null)
    setPagoEditado(p)
    setTipo(p.tipo)
    setMonto(String(p.monto))
    setMetodo(p.metodo)
    setFechaPago(p.fecha)
    setNotas(p.notas ?? '')
    setArchivo(null)
  }

  const cancelarEdicion = () => {
    setPagoEditado(null)
    setConfirmandoBorrado(false)
    setError(null)
    valoresDeAlta()
  }

  // Lo que se viene a corregir es el monto: el cursor cae ahí con el número ya
  // escrito y seleccionado, para teclear el bueno encima.
  useEffect(() => {
    if (!pagoEditado) return
    campoMonto.current?.focus()
    campoMonto.current?.select()
  }, [pagoEditado])

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      // Al corregir sin adjuntar nada, el comprobante que ya traía se queda.
      let ruta: string | null = pagoEditado?.comprobante_path ?? null

      if (archivo) {
        setSubiendo(true)
        const supabase = crearClienteNavegador()
        const extension = archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        ruta = `${cobranza.cotizacion_id}/${Date.now()}.${extension}`

        const { error: errorSubida } = await supabase.storage
          .from('comprobantes')
          .upload(ruta, archivo, { contentType: archivo.type })

        setSubiendo(false)
        if (errorSubida) {
          setError(`No se pudo subir el comprobante: ${errorSubida.message}`)
          return
        }
      }

      const datos = {
        tipo,
        monto: num(monto),
        metodo,
        fecha: fechaPago,
        comprobante_path: ruta,
        notas: notas.trim() || null,
      }

      // Al corregir, el diálogo se queda abierto para que el saldo de arriba se
      // repinte con el número bueno, que es justo lo que se vino a ver.
      if (pagoEditado) {
        const r = await actualizarCobro(pagoEditado.id, datos, idsObras)
        if (!r.ok) return setError(r.error)
        cancelarEdicion()
        return router.refresh()
      }

      const r = await registrarCobro(
        { cotizacion_id: cobranza.cotizacion_id, ...datos },
        conRecibo ? { concepto: conceptoFinal, obra_id: obraDelRecibo } : undefined,
      )
      if (!r.ok) return setError(r.error)

      // Sin recibo, cerrar es la señal de que el pago quedó, como siempre.
      if (!conRecibo) {
        onCerrar()
        return router.refresh()
      }

      // Con recibo no se cierra: el papel es lo que se vino a buscar y aquí
      // están los botones para verlo y mandárselo al cliente. El formulario se
      // limpia de todos modos, para que nadie registre el mismo pago dos veces.
      const monto2 = num(monto)
      valoresDeAlta()
      if (r.datos?.recibo) setReciboNuevo({ ...r.datos.recibo, monto: monto2 })
      else if (r.datos?.avisoRecibo) {
        setError(
          `El pago quedó registrado, pero el recibo no se pudo emitir: ${r.datos.avisoRecibo}. ` +
            'Tócalo en la lista de arriba para volver a intentarlo.',
        )
      }
      router.refresh()
    })

  /** El acuse de un pago que ya estaba capturado, o que se registró sin él. */
  const emitirAhora = async (pago: PagoCobranza) => {
    setError(null)
    setEmitiendo(true)
    const r = await emitirReciboPago(pago.id, {
      concepto: conceptoFinal,
      obra_id: obraDelRecibo,
    })
    setEmitiendo(false)
    if (!r.ok) return setError(r.error)
    setReciboNuevo({ ...r.datos!, monto: Number(pago.monto) })
    router.refresh()
  }

  const borrar = () =>
    iniciar(async () => {
      if (!pagoEditado) return
      setError(null)
      const r = await eliminarCobro(pagoEditado.id, idsObras)
      if (!r.ok) return setError(r.error)
      cancelarEdicion()
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo={`${pagoEditado ? 'Corregir pago' : 'Cobranza'} · ${cobranza.folio}`}
      descripcion={cobranza.cliente}
    >
      <CuerpoDialogo>
        {/* Dos por renglón en el teléfono: a cuatro columnas cada monto se
            quedaba con 70 px y $27,170.00 mide más que eso. El orden no se
            toca —se lee de corrido para verificar que el saldo cuadra—. */}
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-tinta-50 px-4 py-3 text-sm sm:col-span-2 sm:grid-cols-4">
          <Dato etiqueta="Cotizado" valor={pesos(cobranza.cotizado)} />
          <Dato etiqueta="Anticipo esperado" valor={pesos(cobranza.anticipo_esperado)} />
          <Dato etiqueta="Cobrado" valor={pesos(cobranza.cobrado)} />
          <Dato etiqueta="Saldo" valor={pesos(saldo)} destacado />
        </dl>

        {saldo <= 0 && !pagoEditado && pagos.length > 0 && (
          <p
            className={`rounded-xl px-3 py-2.5 text-sm sm:col-span-2 ${
              saldo < 0 ? 'bg-amber-50 text-amber-800' : 'bg-tinta-50 text-tinta-600'
            }`}
          >
            {saldo < 0 ? (
              <>
                Lo cobrado rebasa lo cotizado en <strong>{pesos(-saldo)}</strong>. O un pago se
                capturó de más —tócalo abajo para corregirlo— o a la cotización le falta trabajo
                que sí se hizo.
              </>
            ) : (
              <>
                Esta cotización ya no tiene saldo. Si un pago se capturó de más, tócalo abajo
                para corregirlo y la obra regresa sola a «Por cobrar».
              </>
            )}
          </p>
        )}

        {pagos.length > 0 && (
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-tinta-700">Pagos registrados</p>
              <p className="text-xs text-tinta-400">Tócalos para corregirlos</p>
            </div>
            <ul className="divide-y divide-tinta-100 overflow-hidden rounded-xl border border-tinta-200">
              {pagos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => editar(p)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-tinta-50 ${
                      pagoEditado?.id === p.id ? 'bg-haaco-50 ring-1 ring-inset ring-haaco-200' : ''
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Etiqueta tono={p.tipo === 'anticipo' ? 'azul' : p.tipo === 'liquidacion' ? 'verde' : 'gris'}>
                        {TIPO_PAGO_COBRANZA[p.tipo]}
                      </Etiqueta>
                      <span className="text-tinta-500">{fecha(p.fecha)}</span>
                      <span className="hidden text-xs text-tinta-400 sm:inline">{METODO_PAGO[p.metodo]}</span>
                      {p.comprobante_path && <Paperclip size={13} className="shrink-0 text-tinta-400" />}
                      {recibos?.[p.id]?.pago && (
                        <span className="hidden shrink-0 font-mono text-[11px] text-haaco-700 sm:inline">
                          {recibos[p.id].pago!.folio}
                        </span>
                      )}
                      {p.updated_at !== p.created_at && (
                        <span className="text-xs text-tinta-400">corregido</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-medium tabular-nums text-tinta-900">{pesos(p.monto)}</span>
                      <Pencil size={13} className="text-tinta-400" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* El recibo-contrato del anticipo se imprime en la OT —lleva firmas y
            esquema de pagos—, así que aquí sólo se avisa de él. */}
        {reciboEmitido?.contrato && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 sm:col-span-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>
              Este pago ya tiene el recibo-contrato <strong>{reciboEmitido.contrato.folio}</strong>.
              Si le cambias el monto, el que se le entregó al cliente deja de coincidir: vuelve a
              imprimirlo desde la OT.
            </span>
          </p>
        )}

        {/* El acuse de este pago: el que se le manda al cliente. Si ya existe
            se ofrece, y si no, se emite sin salir de aquí —es el caso de los
            pagos de antes y el de «ahora sí me lo pide»—. */}
        {pagoEditado && !reciboNuevo && (
          <div className="rounded-xl border border-tinta-200 px-3 py-2.5 sm:col-span-2">
            {reciboEmitido?.pago ? (
              <>
                <p className="mb-2 text-sm text-tinta-700">
                  Recibo de pago{' '}
                  <strong className="font-mono text-haaco-700">{reciboEmitido.pago.folio}</strong>
                  {' · '}
                  <span className="text-tinta-500">
                    si le cambias el monto, vuelve a enviárselo
                  </span>
                </p>
                <AccionesReciboPago
                  reciboId={reciboEmitido.pago.id}
                  folio={reciboEmitido.pago.folio}
                  cliente={cobranza.cliente}
                  telefono={telefono}
                  monto={Number(pagoEditado.monto)}
                />
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-tinta-600">Este pago no tiene recibo.</p>
                <button
                  type="button"
                  onClick={() => emitirAhora(pagoEditado)}
                  disabled={emitiendo}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-haaco-200 bg-haaco-50 px-3 py-1.5 text-xs font-medium text-haaco-800 transition hover:bg-haaco-100 disabled:opacity-50"
                >
                  <Receipt size={14} />
                  {emitiendo ? 'Emitiendo…' : 'Emitir recibo'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recién emitido: el pago ya quedó y esto es lo que se hace con él. */}
        {reciboNuevo && (
          <div className="rounded-xl bg-haaco-50 px-4 py-3 ring-1 ring-haaco-200 sm:col-span-2">
            <p className="flex items-center gap-2 text-sm font-medium text-haaco-900">
              <ShieldCheck size={16} />
              Recibo <span className="font-mono">{reciboNuevo.folio}</span> listo por{' '}
              {pesos(reciboNuevo.monto)}
            </p>
            <div className="mt-2">
              <AccionesReciboPago
                reciboId={reciboNuevo.id}
                folio={reciboNuevo.folio}
                cliente={cobranza.cliente}
                telefono={telefono}
                monto={reciboNuevo.monto}
              />
            </div>
          </div>
        )}

        <Campo
          etiqueta="Tipo"
          ayuda="Es la etiqueta del reporte. El saldo lo mueve el monto, no esto."
          hijo={
            <Opciones
              valor={tipo}
              columnas={3}
              opciones={Object.entries(TIPO_PAGO_COBRANZA) as [TipoPagoCobranza, string][]}
              onCambio={setTipo}
            />
          }
        />
        <Campo
          etiqueta="Monto"
          ancho="medio"
          hijo={
            <Numero
              ref={campoMonto}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
              className="text-center text-2xl font-bold -tracking-[0.5px] lg:text-right lg:text-sm lg:font-normal lg:tracking-normal"
            />
          }
          ayuda={
            pagoEditado
              ? `Sin este pago el saldo sería ${pesos(saldoBase)}`
              : saldo > 0
                ? `Saldo actual ${pesos(saldo)}`
                : 'Ya está liquidada'
          }
        />
        <Campo
          etiqueta="Método"
          hijo={
            <Opciones
              valor={metodo}
              columnas={2}
              opciones={Object.entries(METODO_PAGO_SIN_CAJA) as [MetodoPago, string][]}
              onCambio={setMetodo}
            />
          }
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<SelectorFecha valor={fechaPago} onCambio={setFechaPago} />}
        />

        <div className="sm:col-span-2">
          <input
            ref={entrada}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
          {archivo ? (
            <p className="flex items-center justify-between gap-2 rounded-lg bg-tinta-50 px-3 py-2 text-sm text-tinta-700">
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip size={15} />
                <span className="truncate">{archivo.name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setArchivo(null)
                  if (entrada.current) entrada.current.value = ''
                }}
                className="rounded p-1 text-tinta-400"
                aria-label="Quitar comprobante"
              >
                <X size={14} />
              </button>
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => entrada.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-tinta-300 px-3 py-2.5 text-sm font-medium text-tinta-600 transition hover:bg-tinta-50"
              >
                <Paperclip size={15} />
                {pagoEditado?.comprobante_path ? 'Cambiar comprobante' : 'Adjuntar comprobante'}
              </button>
              {pagoEditado?.comprobante_path && (
                <p className="mt-1 text-xs text-tinta-400">
                  Ya tiene uno adjunto; si subes otro lo reemplaza.
                </p>
              )}
            </>
          )}
        </div>

        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />

        {/* Sólo al dar de alta: el recibo de un pago ya capturado se emite en
            el bloque de arriba, sobre el pago que se está viendo. */}
        {!pagoEditado && (
          <>
            <Casilla
              etiqueta="Generar el recibo para el cliente"
              checked={conRecibo}
              onChange={(e) => cambiarConRecibo(e.target.checked)}
            />
            {conRecibo ? (
              <Campo
                etiqueta="Concepto del recibo"
                hijo={
                  <Entrada
                    value={conceptoPropio ? concepto : conceptoSugerido}
                    onChange={(e) => {
                      setConceptoPropio(true)
                      setConcepto(e.target.value)
                    }}
                  />
                }
                ayuda="Es lo que va a leer el cliente en el papel."
              />
            ) : (
              <p className="-mt-1 text-xs text-tinta-400 sm:col-span-2">
                Así queda para la próxima. Si después te lo piden, el recibo se emite tocando el
                pago en la lista de arriba.
              </p>
            )}
          </>
        )}

        {num(monto) > 0 && (
          <div className="rounded-lg bg-tinta-50 px-3 py-2.5 text-sm sm:col-span-2">
            <p className="text-tinta-700">
              Saldo después:{' '}
              <strong className={saldoDespues > 0 ? 'text-amber-700' : 'text-haaco-700'}>
                {pesos(Math.max(0, saldoDespues))}
              </strong>
              {/* El sobrepago se dice con todas sus letras: en ceros y cobrado
                  de más se ven igual en la lista, y no son lo mismo. */}
              {saldoDespues < 0 && (
                <span className="text-amber-700">
                  {' '}· quedan <strong>{pesos(-saldoDespues)}</strong> cobrados de más
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs uppercase text-tinta-500">{montoEnLetra(num(monto))}</p>
          </div>
        )}

        {/* El aviso que faltaba: marcar «Liquidación» sobre un monto que no
            alcanza no cierra nada, pero se lee como si la obra ya se hubiera
            pagado. No se bloquea —una liquidación pactada por menos existe—,
            se avisa con el arreglo a un toque. */}
        {tipo === 'liquidacion' && num(monto) > 0 && saldoDespues > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 sm:col-span-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
            <span>
              Lo marcaste como <strong>Liquidación</strong>, pero con este monto quedan{' '}
              <strong>{pesos(saldoDespues)}</strong> por cobrar.{' '}
              <button
                type="button"
                onClick={() => setTipo('abono')}
                className="font-semibold underline underline-offset-2"
              >
                Cambiarlo a Abono
              </button>
            </span>
          </p>
        )}

        {tipo === 'abono' && num(monto) > 0 && saldoDespues <= 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-haaco-50 px-3 py-2.5 text-sm text-haaco-900 sm:col-span-2">
            <ShieldCheck size={15} className="mt-0.5 shrink-0" />
            <span>
              Con este monto la cotización queda liquidada.{' '}
              <button
                type="button"
                onClick={() => setTipo('liquidacion')}
                className="font-semibold underline underline-offset-2"
              >
                Marcarlo como Liquidación
              </button>
            </span>
          </p>
        )}

        {liquida && obrasEntregadas.length > 0 && (
          <div className="rounded-xl bg-haaco-50 px-4 py-3 text-sm text-haaco-900 ring-1 ring-haaco-200 sm:col-span-2">
            <p className="flex items-center gap-2 font-medium">
              <ShieldCheck size={16} />
              Este pago liquida la obra
            </p>
            <p className="mt-1 text-xs">
              Con la obra entregada ya se puede emitir la póliza de garantía y cerrar la OT:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {obrasEntregadas.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/obras/${o.id}?t=cierre`}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-haaco-800 ring-1 ring-haaco-200 hover:bg-haaco-100"
                >
                  {o.ot_numero} · {o.nombre}
                </Link>
              ))}
            </div>
          </div>
        )}

        <MensajeError mensaje={error} />
      </CuerpoDialogo>

      {/* El borrado vive aquí dentro y no en la lista de arriba: se pide la
          confirmación en el propio pie, como `PieFormulario`, porque al tercer
          `confirm()` seguido el navegador ofrece callar los cuadros de la
          página y los borrados dejan de funcionar sin avisar. */}
      <PieDialogo>
        {pagoEditado && confirmandoBorrado ? (
          <>
            <p className="mr-auto text-sm text-tinta-600 sm:flex-none">
              ¿Eliminar este pago de {pesos(pagoEditado.monto)}?
            </p>
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(false)}
              className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
            >
              No, conservar
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
          </>
        ) : (
          <>
            {pagoEditado && (
              <button
                type="button"
                onClick={() => setConfirmandoBorrado(true)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            )}
            <button
              type="button"
              onClick={pagoEditado ? cancelarEdicion : onCerrar}
              className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
            >
              {pagoEditado ? 'Cancelar' : 'Cerrar'}
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={pendiente || subiendo || num(monto) <= 0}
              className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
            >
              {subiendo
                ? 'Subiendo…'
                : pendiente
                  ? pagoEditado ? 'Guardando…' : 'Registrando…'
                  : pagoEditado ? 'Guardar cambios' : 'Registrar pago'}
            </button>
          </>
        )}
      </PieDialogo>
    </Dialogo>
  )
}

function Dato({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div>
      <dt className="text-xs leading-tight text-tinta-500">{etiqueta}</dt>
      <dd
        className={`${tamanoMonto(valor, 'dato')} tabular-nums ${
          destacado ? 'font-semibold text-haaco-700' : 'text-tinta-900'
        }`}
      >
        {valor}
      </dd>
    </div>
  )
}
