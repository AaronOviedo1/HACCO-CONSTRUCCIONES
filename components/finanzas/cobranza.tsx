'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { Paperclip, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, MensajeError, Numero, Opciones, PieDialogo,
} from '@/components/formulario'
import { Etiqueta } from '@/components/ui'
import { SelectorFecha } from '@/components/filtro-fechas'
import { crearClienteNavegador } from '@/lib/supabase/client'
import { fecha, montoEnLetra, pesos } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import { METODO_PAGO, TIPO_PAGO_COBRANZA } from '@/lib/finanzas'
import { eliminarCobro, registrarCobro } from '@/app/admin/finanzas-acciones'
import type { MetodoPago, PagoCobranza, TipoPagoCobranza, VCobranza } from '@/types/database'

type ObraSimple = { id: string; nombre: string; ot_numero: string | null; estatus: string }

export function AccionesCobranza({
  cobranza,
  pagos,
  obras,
  variante = 'tabla',
}: {
  cobranza: VCobranza
  pagos: PagoCobranza[]
  obras: ObraSimple[]
  /** En el teléfono el pago es la acción principal de la tarjeta, no un icono. */
  variante?: 'tabla' | 'movil'
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      {variante === 'movil' ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="min-h-11 rounded-[13px] bg-haaco-700 px-4 text-[15px] font-semibold text-white transition active:bg-haaco-800"
        >
          Registrar abono
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          <Plus size={14} />
          Pago
        </button>
      )}

      {abierto && (
        <DialogoCobranza
          cobranza={cobranza}
          pagos={pagos}
          obras={obras}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function DialogoCobranza({
  cobranza, pagos, obras, onCerrar,
}: {
  cobranza: VCobranza
  pagos: PagoCobranza[]
  obras: ObraSimple[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const entrada = useRef<HTMLInputElement>(null)
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

  const saldoDespues = redondear(saldo - num(monto))
  const liquida = num(monto) > 0 && saldoDespues <= 0
  const obrasEntregadas = obras.filter(
    (o) => o.estatus === 'en_entrega' || o.estatus === 'terminada',
  )

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      let ruta: string | null = null

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

      const r = await registrarCobro({
        cotizacion_id: cobranza.cotizacion_id,
        tipo,
        monto: num(monto),
        metodo,
        fecha: fechaPago,
        comprobante_path: ruta,
        notas: notas.trim() || null,
      })

      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
    })

  const borrar = (id: string) =>
    iniciar(async () => {
      if (!confirm('¿Eliminar este pago?')) return
      const r = await eliminarCobro(id)
      if (!r.ok) return setError(r.error)
      router.refresh()
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo={`Cobranza · ${cobranza.folio}`}
      descripcion={cobranza.cliente}
    >
      <CuerpoDialogo>
        <dl className="grid grid-cols-4 gap-3 rounded-xl bg-tinta-50 px-4 py-3 text-sm sm:col-span-2">
          <Dato etiqueta="Cotizado" valor={pesos(cobranza.cotizado)} />
          <Dato etiqueta="Anticipo esperado" valor={pesos(cobranza.anticipo_esperado)} />
          <Dato etiqueta="Cobrado" valor={pesos(cobranza.cobrado)} />
          <Dato etiqueta="Saldo" valor={pesos(saldo)} destacado />
        </dl>

        {pagos.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-tinta-700">Pagos registrados</p>
            <ul className="divide-y divide-tinta-100 overflow-hidden rounded-xl border border-tinta-200">
              {pagos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Etiqueta tono={p.tipo === 'anticipo' ? 'azul' : p.tipo === 'liquidacion' ? 'verde' : 'gris'}>
                      {TIPO_PAGO_COBRANZA[p.tipo]}
                    </Etiqueta>
                    <span className="text-tinta-500">{fecha(p.fecha)}</span>
                    <span className="text-xs text-tinta-400">{METODO_PAGO[p.metodo]}</span>
                    {p.comprobante_path && <Paperclip size={13} className="text-tinta-400" />}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium tabular-nums text-tinta-900">{pesos(p.monto)}</span>
                    <button
                      type="button"
                      onClick={() => borrar(p.id)}
                      disabled={pendiente}
                      className="rounded p-1 text-tinta-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Eliminar pago"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Campo
          etiqueta="Tipo"
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
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              autoFocus
              className="text-center text-2xl font-bold -tracking-[0.5px] lg:text-right lg:text-sm lg:font-normal lg:tracking-normal"
            />
          }
          ayuda={saldo > 0 ? `Saldo actual ${pesos(saldo)}` : 'Ya está liquidada'}
        />
        <Campo
          etiqueta="Método"
          hijo={
            <Opciones
              valor={metodo}
              columnas={2}
              opciones={Object.entries(METODO_PAGO) as [MetodoPago, string][]}
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
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-tinta-300 px-3 py-2.5 text-sm font-medium text-tinta-600 transition hover:bg-tinta-50"
            >
              <Paperclip size={15} />
              Adjuntar comprobante
            </button>
          )}
        </div>

        <Campo
          etiqueta="Notas"
          hijo={<AreaTexto rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />}
        />

        {num(monto) > 0 && (
          <div className="rounded-lg bg-tinta-50 px-3 py-2.5 text-sm sm:col-span-2">
            <p className="text-tinta-700">
              Saldo después:{' '}
              <strong className={saldoDespues > 0 ? 'text-amber-700' : 'text-haaco-700'}>
                {pesos(Math.max(0, saldoDespues))}
              </strong>
            </p>
            <p className="mt-0.5 text-xs uppercase text-tinta-500">{montoEnLetra(num(monto))}</p>
          </div>
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

      <PieDialogo>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-tinta-300 bg-white px-4 py-2 text-sm font-medium text-tinta-700 transition hover:bg-tinta-50"
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || subiendo || num(monto) <= 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {subiendo ? 'Subiendo…' : pendiente ? 'Registrando…' : 'Registrar pago'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}

function Dato({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-tinta-500">{etiqueta}</dt>
      <dd className={`tabular-nums ${destacado ? 'font-semibold text-haaco-700' : 'text-tinta-900'}`}>
        {valor}
      </dd>
    </div>
  )
}
