'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { FileDown, FileText, Receipt, ShieldCheck, Wrench } from 'lucide-react'
import {
  AreaTexto, Campo, CuerpoDialogo, Dialogo, Entrada, MensajeError, Numero, PieDialogo, Seleccion,
} from '@/components/formulario'
import { EstadoVacio, Etiqueta, Tarjeta } from '@/components/ui'
import { SelectorFecha } from '@/components/filtro-fechas'
import { fecha, montoEnLetra, pesos } from '@/lib/format'
import { hoyISO, num, redondear } from '@/lib/cotizaciones'
import { registrarPago } from '@/app/admin/obras/acciones'
import type { MetodoPago, TipoPagoCobranza } from '@/types/database'
import type { DatosObra } from '@/app/admin/obras/datos'

const METODOS: { valor: MetodoPago; texto: string }[] = [
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'deposito', texto: 'Depósito' },
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'cheque', texto: 'Cheque' },
  { valor: 'tarjeta_empresa', texto: 'Tarjeta' },
]

export function PanelDocumentos({ datos }: { datos: DatosObra }) {
  const [cobrando, setCobrando] = useState(false)
  const cerrada = datos.concentrado.estatus === 'cerrada'
  const cobranza = datos.cobranza

  const sinAnticipo = Number(cobranza?.anticipo ?? 0) === 0

  return (
    <div className="space-y-4">
      {/* Cobranza y recibos ---------------------------------------------- */}
      <Tarjeta
        titulo={
          <span className="flex items-center gap-2">
            <Receipt size={16} className="text-haaco-600" />
            Recibos de pago
          </span>
        }
        pie="El recibo-contrato acusa el anticipo y además deja asentado el saldo, el esquema de pagos, las fechas y las firmas."
      >
        {cobranza && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-tinta-100 px-5 py-3.5 text-sm sm:grid-cols-4">
            <Dato etiqueta="Cotizado" valor={pesos(cobranza.cotizado)} />
            <Dato
              etiqueta={`Anticipo ${Number(cobranza.anticipo_pct ?? 0)}%`}
              valor={pesos(cobranza.anticipo_esperado)}
            />
            <Dato etiqueta="Cobrado" valor={pesos(cobranza.cobrado)} />
            <Dato etiqueta="Saldo" valor={pesos(cobranza.saldo)} destacado />
          </dl>
        )}

        {datos.recibos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no hay recibos"
            descripcion={
              sinAnticipo
                ? 'Registra el anticipo para generar el recibo-contrato.'
                : 'Registra un pago para emitir su recibo.'
            }
            accion={
              !cerrada ? (
                <button
                  type="button"
                  onClick={() => setCobrando(true)}
                  className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800"
                >
                  Registrar pago
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-tinta-100">
              {datos.recibos.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-tinta-900">
                      <span className="font-mono text-xs text-haaco-700">{r.folio}</span>
                      <span className="truncate">{r.concepto}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-tinta-500">
                      {fecha(r.created_at)}
                      {r.fecha_inicio && ` · Inicio ${fecha(r.fecha_inicio)}`}
                      {r.fecha_estimada_entrega && ` · Entrega ${fecha(r.fecha_estimada_entrega)}`}
                    </p>
                  </div>
                  <a
                    href={`/api/recibos/${r.id}/pdf`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
                  >
                    <FileDown size={14} />
                    Recibo-contrato
                  </a>
                </li>
              ))}
            </ul>
            {!cerrada && (
              <div className="border-t border-tinta-100 px-5 py-2.5">
                <button
                  type="button"
                  onClick={() => setCobrando(true)}
                  className="text-sm font-medium text-haaco-700 hover:underline"
                >
                  Registrar otro pago →
                </button>
              </div>
            )}
          </>
        )}
      </Tarjeta>

      {/* Contratos y pagarés --------------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta
          titulo={
            <span className="flex items-center gap-2">
              <FileText size={16} className="text-haaco-600" />
              Contratos por obra determinada
            </span>
          }
        >
          {datos.contratos.length === 0 ? (
            <EstadoVacio titulo="Sin contratos" descripcion="Se crean en la pestaña Contratos." />
          ) : (
            <ul className="divide-y divide-tinta-100">
              {datos.contratos.map((c) => {
                const oficial = datos.oficiales.find((o) => o.id === c.trabajador_id)
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-tinta-900">{oficial?.nombre}</p>
                      <p className="text-xs text-tinta-500">
                        {pesos(c.total_pagar)} ·{' '}
                        {c.firma_oficial_at ? 'firmado' : 'sin firma del oficial'}
                      </p>
                    </div>
                    <a
                      href={`/api/contratos/${c.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
                    >
                      <FileDown size={14} />
                      PDF
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>

        <Tarjeta
          titulo={
            <span className="flex items-center gap-2">
              <Wrench size={16} className="text-haaco-600" />
              Pagarés de herramienta
            </span>
          }
        >
          {datos.pagares.length === 0 ? (
            <EstadoVacio titulo="Sin pagarés" descripcion="Se generan desde el contrato del oficial." />
          ) : (
            <ul className="divide-y divide-tinta-100">
              {datos.pagares.map((p) => {
                const contrato = datos.contratos.find((c) => c.id === p.contrato_id)
                const oficial = datos.oficiales.find((o) => o.id === contrato?.trabajador_id)
                const n = datos.pagareItems.filter((i) => i.pagare_id === p.id).length
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-tinta-900">
                        {oficial?.nombre}
                        <Etiqueta tono={p.estatus === 'activo' ? 'azul' : 'gris'}>
                          {p.estatus === 'activo' ? 'Activo' : 'Cancelado'}
                        </Etiqueta>
                      </p>
                      <p className="text-xs text-tinta-500">
                        {pesos(p.valor_total)} · {n} {n === 1 ? 'herramienta' : 'herramientas'}
                      </p>
                    </div>
                    <a
                      href={`/api/pagares/${p.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
                    >
                      <FileDown size={14} />
                      PDF
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </Tarjeta>
      </div>

      {/* Póliza ----------------------------------------------------------- */}
      <Tarjeta
        titulo={
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-haaco-600" />
            Póliza de garantía
          </span>
        }
      >
        {datos.poliza ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-tinta-900">
                <span className="font-mono text-xs text-haaco-700">{datos.poliza.folio}</span>
                {datos.poliza.vigencia_dias} días de garantía
              </p>
              <p className="text-xs text-tinta-500">
                {datos.poliza.fecha_conclusion
                  ? `Desde la conclusión el ${fecha(datos.poliza.fecha_conclusion)}`
                  : 'Sin fecha de conclusión'}
              </p>
            </div>
            <a
              href={`/api/polizas/${datos.poliza.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-lg border border-tinta-300 bg-white px-2.5 py-1.5 text-xs font-medium text-tinta-700 transition hover:bg-tinta-50"
            >
              <FileDown size={14} />
              Póliza
            </a>
          </div>
        ) : (
          <EstadoVacio
            titulo="Sin póliza"
            descripcion="Se emite en la pestaña Cierre, con el detalle de pinturas y colores por área."
          />
        )}
      </Tarjeta>

      {cobrando && cobranza && (
        <DialogoPago
          obraId={datos.obra.id}
          cotizacionId={datos.concentrado.cotizacion_id}
          cliente={datos.concentrado.cliente}
          folio={datos.concentrado.cotizacion_folio ?? ''}
          saldo={Number(cobranza.saldo)}
          anticipoEsperado={Number(cobranza.anticipo_esperado)}
          anticipoPagado={Number(cobranza.anticipo)}
          entregaEstimada={datos.obra.fecha_estimada_entrega}
          onCerrar={() => setCobrando(false)}
        />
      )}
    </div>
  )
}

function Dato({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-tinta-500">{etiqueta}</dt>
      <dd
        className={`tabular-nums ${destacado ? 'font-semibold text-haaco-700' : 'font-medium text-tinta-900'}`}
      >
        {valor}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
function DialogoPago({
  obraId, cotizacionId, cliente, folio, saldo, anticipoEsperado, anticipoPagado,
  entregaEstimada, onCerrar,
}: {
  obraId: string
  cotizacionId: string
  cliente: string
  folio: string
  saldo: number
  anticipoEsperado: number
  anticipoPagado: number
  entregaEstimada: string | null
  onCerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const esAnticipo = anticipoPagado === 0
  const [tipo, setTipo] = useState<TipoPagoCobranza>(esAnticipo ? 'anticipo' : 'abono')
  const [monto, setMonto] = useState(String(esAnticipo ? anticipoEsperado : ''))
  const [metodo, setMetodo] = useState<MetodoPago>('transferencia')
  const [fechaPago, setFechaPago] = useState(hoyISO())
  const [concepto, setConcepto] = useState(
    esAnticipo ? `Anticipo de la cotización ${folio}` : `Abono de la cotización ${folio}`,
  )
  const [esquema, setEsquema] = useState(
    esAnticipo ? 'Anticipo para iniciar los trabajos, saldo contra entrega.' : '',
  )
  const [inicio, setInicio] = useState(hoyISO())
  const [entrega, setEntrega] = useState(entregaEstimada ?? '')
  const [banco, setBanco] = useState('')
  const [generar, setGenerar] = useState(true)

  const saldoDespues = redondear(saldo - num(monto))

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await registrarPago(
        obraId,
        {
          cotizacion_id: cotizacionId,
          tipo,
          monto: num(monto),
          metodo,
          fecha: fechaPago,
          notas: null,
        },
        {
          generar,
          concepto,
          esquema_pagos: esquema.trim() || null,
          fecha_inicio: inicio || null,
          fecha_estimada_entrega: entrega || null,
          datos_bancarios: banco.trim() || null,
        },
      )
      if (!r.ok) return setError(r.error)
      onCerrar()
      router.refresh()
      if (r.datos?.reciboId) {
        window.open(`/api/recibos/${r.datos.reciboId}/pdf`, '_blank')
      }
    })

  return (
    <Dialogo
      abierto
      onCerrar={onCerrar}
      ancho="lg"
      titulo="Registrar pago del cliente"
      descripcion={`${cliente} · ${folio}`}
    >
      <CuerpoDialogo>
        <Campo
          etiqueta="Tipo"
          ancho="medio"
          hijo={
            <Seleccion value={tipo} onChange={(e) => setTipo(e.target.value as TipoPagoCobranza)}>
              <option value="anticipo">Anticipo</option>
              <option value="abono">Abono</option>
              <option value="liquidacion">Liquidación</option>
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Monto"
          ancho="medio"
          hijo={<Numero value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />}
          ayuda={
            tipo === 'anticipo'
              ? `Anticipo esperado: ${pesos(anticipoEsperado)}`
              : `Saldo actual: ${pesos(saldo)}`
          }
        />
        <Campo
          etiqueta="Método de pago"
          ancho="medio"
          hijo={
            <Seleccion value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              {METODOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.texto}
                </option>
              ))}
            </Seleccion>
          }
        />
        <Campo
          etiqueta="Fecha"
          ancho="medio"
          hijo={<SelectorFecha valor={fechaPago} onCambio={setFechaPago} />}
        />

        <div className="rounded-lg bg-tinta-50 px-3 py-2.5 text-sm sm:col-span-2">
          <p className="text-tinta-700">
            Saldo después del pago:{' '}
            <strong className={saldoDespues > 0 ? 'text-amber-700' : 'text-haaco-700'}>
              {pesos(Math.max(0, saldoDespues))}
            </strong>
          </p>
          {num(monto) > 0 && (
            <p className="mt-0.5 text-xs uppercase text-tinta-500">{montoEnLetra(num(monto))}</p>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-tinta-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={generar}
            onChange={(e) => setGenerar(e.target.checked)}
            className="h-4 w-4 rounded border-tinta-300 text-haaco-700 focus:ring-haaco-600"
          />
          Generar recibo-contrato
        </label>

        {generar && (
          <>
            <Campo
              etiqueta="Concepto"
              hijo={<Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} />}
            />
            <Campo
              etiqueta="Esquema de pagos"
              hijo={
                <AreaTexto
                  rows={2}
                  value={esquema}
                  onChange={(e) => setEsquema(e.target.value)}
                  placeholder="50% anticipo, 50% contra entrega"
                />
              }
            />
            <Campo
              etiqueta="Fecha de inicio"
              ancho="medio"
              hijo={<SelectorFecha valor={inicio} onCambio={setInicio} />}
            />
            <Campo
              etiqueta="Entrega estimada"
              ancho="medio"
              hijo={<SelectorFecha valor={entrega} onCambio={setEntrega} />}
            />
            <Campo
              etiqueta="Datos bancarios"
              hijo={
                <AreaTexto
                  rows={2}
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="Banco · Titular · Cuenta · CLABE"
                />
              }
              ayuda="Se imprimen al pie del recibo."
            />
          </>
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
          disabled={pendiente || num(monto) <= 0}
          className="rounded-lg bg-haaco-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-haaco-800 disabled:bg-haaco-300"
        >
          {pendiente ? 'Registrando…' : generar ? 'Registrar y generar recibo' : 'Registrar pago'}
        </button>
      </PieDialogo>
    </Dialogo>
  )
}
